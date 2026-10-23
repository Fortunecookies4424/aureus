/*
# Fix Referral System and Daily Check-in

## Problem 1: Referral System Not Working
The `profiles.referred_by` column is `text` type, but `handle_new_user()` inserts a `uuid` value into it.
PostgreSQL implicitly casts uuid to text, so the value gets stored as a text representation of the UUID.
However, `handle_new_referral()` trigger then compares `NEW.referred_by` (text) with `profiles.id` (uuid)
in the referrals table insert, which works due to implicit casting — BUT the real issue is that
`handle_new_referral()` references `NEW.username` which can be empty, and the referral bonus calculation
uses a hardcoded base of 1000 instead of the actual rewards_config.

The actual root cause: the `referred_by` text column stores the uuid as text, and when the
`handle_new_referral` trigger fires AFTER INSERT on profiles, it tries to INSERT into `referrals`
with `referrer_id = NEW.referred_by` (text) and `referred_id = NEW.id` (uuid). The text-to-uuid
cast works IF the text is a valid uuid format. But if `handle_new_user` passes a null or the
lookup fails, referred_by stays NULL and no referral record is created.

After investigation, the real issue is that `handle_new_user()` does a SELECT to find the referrer
by referral_code, but the referral_code lookup may fail because:
1. The referral_code in metadata might have whitespace or case issues
2. The `upper()` call helps but the metadata value might have extra characters

Fix: Change `referred_by` to proper `uuid` type with FK constraint, and make the referral lookup
in `handle_new_user()` more robust with trim(). Also fix `handle_new_referral()` to use
`rewards_config` for the bonus amount instead of a hardcoded base.

## Problem 2: Daily Check-in Goes to Bonus Balance
`claim_daily_checkin()` credits `bonus_balance` instead of `balance`.
Fix: Credit `balance` (available balance) instead.

## Changes
1. Alter `profiles.referred_by` from `text` to `uuid` with FK to `profiles(id)`
2. Recreate `handle_new_user()` with trim() on referral code lookup
3. Recreate `handle_new_referral()` to use rewards_config for bonus amount
4. Recreate `claim_daily_checkin()` to credit `balance` instead of `bonus_balance`
5. Add RLS policies on `daily_checkins` table (if missing)
*/

-- ===== Fix 1: Change referred_by to uuid with FK =====
-- First drop any existing policies/constraints that reference referred_by
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_referred_by_fkey;

-- Change column type (safe since no data exists)
ALTER TABLE public.profiles ALTER COLUMN referred_by TYPE uuid USING referred_by::uuid;

-- Add FK constraint
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_referred_by_fkey
  FOREIGN KEY (referred_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ===== Fix 2: Recreate handle_new_user with robust referral lookup =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_meta jsonb;
  v_rewards public.rewards_config;
  v_wallet public.wallets;
  v_bonus numeric(14,2);
  v_ref_code text;
BEGIN
  v_meta := new.raw_user_meta_data;

  -- Look up referrer if referral code provided (robust: trim + upper)
  IF v_meta ? 'referral_code' THEN
    v_ref_code := upper(trim(v_meta->>'referral_code'));
    IF v_ref_code != '' THEN
      SELECT id INTO v_referrer_id FROM public.profiles
        WHERE referral_code = v_ref_code LIMIT 1;
    END IF;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, username, phone, referred_by)
  VALUES (
    new.id,
    new.email,
    COALESCE(v_meta->>'full_name',''),
    COALESCE(v_meta->>'username',''),
    v_meta->>'phone',
    v_referrer_id
  );

  -- Ensure wallet exists
  INSERT INTO public.wallets (user_id) VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = new.id;

  -- Credit welcome bonus if enabled
  SELECT * INTO v_rewards FROM public.rewards_config LIMIT 1;
  IF v_rewards.welcome_bonus_enabled AND v_rewards.welcome_bonus_amount > 0 THEN
    v_bonus := v_rewards.welcome_bonus_amount;
    UPDATE public.wallets
      SET balance = balance + v_bonus,
          bonus_balance = bonus_balance + v_bonus
      WHERE user_id = new.id;

    INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
    VALUES (new.id, 'welcome_bonus', v_bonus, 'completed', 'Welcome registration bonus', 'WELCOME-' || new.id::text);

    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (new.id, 'system', 'Welcome Bonus!',
      'You received ₦' || v_bonus || ' as a welcome bonus. Start investing to grow your wealth!');
  END IF;

  RETURN new;
END;
$$;

-- ===== Fix 3: Recreate handle_new_referral to use rewards_config =====
CREATE OR REPLACE FUNCTION public.handle_new_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rewards public.rewards_config;
  v_bonus numeric(14,2);
  v_referrer public.profiles;
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    -- Get referrer profile for username
    SELECT * INTO v_referrer FROM public.profiles WHERE id = NEW.referred_by;
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    -- Get bonus amount from rewards_config
    SELECT * INTO v_rewards FROM public.rewards_config LIMIT 1;
    v_bonus := COALESCE(v_rewards.referral_bonus_amount, 0);

    IF v_bonus > 0 THEN
      -- Create referral record
      INSERT INTO public.referrals (referrer_id, referred_id, bonus_amount, status)
      VALUES (NEW.referred_by, NEW.id, v_bonus, 'paid');

      -- Credit referrer wallet immediately
      UPDATE public.wallets
        SET balance = balance + v_bonus,
            referral_earnings = referral_earnings + v_bonus
        WHERE user_id = NEW.referred_by;

      -- Transaction ledger
      INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
      VALUES (NEW.referred_by, 'referral', v_bonus, 'completed',
        'Referral bonus for ' || COALESCE(NEW.username, NEW.full_name, 'new user'),
        'REFERRAL-' || NEW.id::text);

      -- Notification
      INSERT INTO public.notifications (user_id, type, title, message)
      VALUES (NEW.referred_by, 'referral', 'New Referral Bonus!',
        'You earned ₦' || v_bonus || ' for referring ' || COALESCE(NEW.username, NEW.full_name, 'a friend') || '. Keep sharing your link!');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ===== Fix 4: Recreate claim_daily_checkin to credit balance =====
CREATE OR REPLACE FUNCTION public.claim_daily_checkin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_config public.rewards_config;
  v_yesterday date;
  v_yesterday_checkin public.daily_checkins;
  v_streak int;
  v_wallet public.wallets;
BEGIN
  SELECT * INTO v_config FROM public.rewards_config LIMIT 1;
  IF NOT v_config.daily_checkin_enabled THEN
    RAISE EXCEPTION 'Daily check-in is currently disabled';
  END IF;

  -- Check if already checked in today
  PERFORM 1 FROM public.daily_checkins WHERE user_id = auth.uid() AND checkin_date = CURRENT_DATE;
  IF FOUND THEN
    RAISE EXCEPTION 'You have already checked in today';
  END IF;

  -- Calculate streak
  v_yesterday := CURRENT_DATE - 1;
  SELECT * INTO v_yesterday_checkin FROM public.daily_checkins
    WHERE user_id = auth.uid() AND checkin_date = v_yesterday;
  v_streak := COALESCE(v_yesterday_checkin.streak, 0) + 1;

  IF v_config.daily_checkin_max_streak IS NOT NULL AND v_streak > v_config.daily_checkin_max_streak THEN
    v_streak := v_config.daily_checkin_max_streak;
  END IF;

  -- Ensure wallet exists
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    v_wallet := public.ensure_wallet(auth.uid());
  END IF;

  -- Credit available balance (NOT bonus_balance)
  UPDATE public.wallets SET balance = balance + v_config.daily_checkin_amount
    WHERE user_id = auth.uid();

  -- Record check-in
  INSERT INTO public.daily_checkins (user_id, amount, streak, checkin_date)
  VALUES (auth.uid(), v_config.daily_checkin_amount, v_streak, CURRENT_DATE);

  -- Transaction ledger
  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (auth.uid(), 'checkin', v_config.daily_checkin_amount, 'completed',
    'Daily check-in reward (streak: ' || v_streak || ')', 'checkin-' || CURRENT_DATE::text);

  -- Notification
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (auth.uid(), 'system', 'Daily Check-in Reward!',
    'You earned ₦' || v_config.daily_checkin_amount || ' for your daily check-in. Streak: ' || v_streak || ' days.');

  RETURN jsonb_build_object('success', true, 'amount', v_config.daily_checkin_amount, 'streak', v_streak);
END;
$$;

-- ===== Ensure daily_checkins RLS policies exist =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_checkins' AND policyname = 'select_own_checkins'
  ) THEN
    CREATE POLICY "select_own_checkins" ON public.daily_checkins
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_checkins' AND policyname = 'insert_own_checkins'
  ) THEN
    -- Allow the SECURITY DEFINER function to insert; users themselves don't insert directly
    -- But the function runs as the user, so we need INSERT policy
    CREATE POLICY "insert_own_checkins" ON public.daily_checkins
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
