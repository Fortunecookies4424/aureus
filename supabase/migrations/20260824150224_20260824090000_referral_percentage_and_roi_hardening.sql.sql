/*
# Referral Percentage-Based Commission + Daily ROI Hardening

## Summary

This migration changes the referral system from a fixed signup bonus to a
percentage-based commission that is credited when a referred user's deposit
is approved. It also hardens the daily ROI processing against duplicate
transaction ledger entries.

## Changes

### 1. Referral System — Percentage-Based Commission on Deposits

Previously, `handle_new_referral` (trigger on profiles) credited a fixed
`referral_bonus_amount` to the referrer immediately at signup. Now:

- `handle_new_referral` creates a referral record with status `pending` and
  `bonus_amount = 0` (no immediate payout). The commission will be calculated
  and credited when the referred user's deposit is approved.
- `handle_new_user` (trigger on auth.users) now rejects self-referrals and
  skips suspended/deleted referrers.
- `approve_deposit` now checks if the depositing user has a referrer. If so,
  it calculates commission = deposit_amount x referral_percentage / 100,
  credits the referrer's wallet, updates the referral record, creates a
  transaction ledger entry, and sends a notification.

### 2. Duplicate Commission Protection

- A new `referral_commissions` table tracks which deposit has already
  generated a referral commission, with a UNIQUE constraint on `deposit_id`.
- The `approve_deposit` function inserts into `referral_commissions` before
  crediting, using ON CONFLICT DO NOTHING for idempotency.

### 3. Daily ROI Hardening

- `process_daily_roi` now checks for an existing transaction with the same
  reference before inserting, preventing duplicate ledger entries on retry.

## New Tables
- `referral_commissions` — tracks referral commission payouts per deposit.

## Security
- RLS enabled on `referral_commissions`.
- All commission calculations happen in SECURITY DEFINER functions.
*/

-- ============================================================
-- 1. Create referral_commissions table for duplicate protection
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deposit_id uuid NOT NULL REFERENCES public.deposits(id) ON DELETE CASCADE,
  commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_referral_commissions" ON public.referral_commissions;
CREATE POLICY "select_own_referral_commissions" ON public.referral_commissions
  FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- Unique constraint: one commission per deposit (idempotency)
DROP INDEX IF EXISTS referral_commissions_deposit_id_key;
CREATE UNIQUE INDEX referral_commissions_deposit_id_key ON public.referral_commissions (deposit_id);

-- ============================================================
-- 2. Update handle_new_referral: create pending referral, no immediate payout
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer public.profiles;
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    SELECT * INTO v_referrer FROM public.profiles WHERE id = NEW.referred_by;
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    IF v_referrer.status = 'suspended' THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.referrals (referrer_id, referred_id, bonus_amount, status)
    VALUES (NEW.referred_by, NEW.id, 0, 'pending')
    ON CONFLICT (referred_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Update handle_new_user: reject self-referrals, skip suspended referrers
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_meta jsonb;
  v_rewards public.rewards_config;
  v_wallet public.wallets;
  v_bonus numeric(14,2);
  v_ref_code text;
  v_username text;
  v_email_prefix text;
  v_referrer_profile public.profiles;
BEGIN
  v_meta := new.raw_user_meta_data;

  IF v_meta ? 'referral_code' THEN
    v_ref_code := upper(trim(v_meta->>'referral_code'));
    IF v_ref_code != '' THEN
      SELECT id INTO v_referrer_id FROM public.profiles
      WHERE referral_code = v_ref_code LIMIT 1;

      IF v_referrer_id IS NOT NULL THEN
        SELECT * INTO v_referrer_profile FROM public.profiles WHERE id = v_referrer_id;
        IF v_referrer_profile.status = 'suspended' OR v_referrer_profile.status = 'deleted' THEN
          v_referrer_id := NULL;
        END IF;
      END IF;
    END IF;
  END IF;

  v_username := COALESCE(NULLIF(trim(v_meta->>'username'), ''), '');
  IF v_username = '' THEN
    v_email_prefix := split_part(new.email, '@', 1);
    v_email_prefix := lower(substr(regexp_replace(v_email_prefix, '[^a-zA-Z0-9]', '', 'g'), 1, 12));
    IF v_email_prefix = '' THEN
      v_email_prefix := 'user';
    END IF;
    v_username := v_email_prefix || lpad((floor(random() * 10000))::text, 4, '0');
  END IF;

  INSERT INTO public.profiles (id, email, full_name, username, phone, referred_by)
  VALUES (
    new.id,
    new.email,
    COALESCE(v_meta->>'full_name',''),
    v_username,
    v_meta->>'phone',
    v_referrer_id
  );

  IF v_referrer_id = new.id THEN
    UPDATE public.profiles SET referred_by = NULL WHERE id = new.id;
    DELETE FROM public.referrals WHERE referred_id = new.id AND referrer_id = new.id;
  END IF;

  INSERT INTO public.wallets (user_id) VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = new.id;

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

-- ============================================================
-- 4. Update approve_deposit: credit referral commission on deposit approval
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit public.deposits;
  v_referred public.profiles;
  v_referrer public.profiles;
  v_settings public.website_settings;
  v_commission numeric(14,2);
  v_referral public.referrals;
  v_existing_commission record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit not found';
  END IF;
  IF v_deposit.status != 'pending' THEN
    RAISE EXCEPTION 'Deposit already processed';
  END IF;

  UPDATE public.deposits
  SET status = 'approved', processed_at = now()
  WHERE id = p_deposit_id;

  UPDATE public.wallets
  SET balance = balance + v_deposit.amount,
  total_deposits = total_deposits + v_deposit.amount
  WHERE user_id = v_deposit.user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (v_deposit.user_id, 'deposit', v_deposit.amount, 'completed', 'Deposit approved (' || v_deposit.method || ')', v_deposit.id::text);

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (v_deposit.user_id, 'deposit', 'Deposit Approved',
  'Your deposit of ₦' || v_deposit.amount || ' has been approved and credited to your wallet.');

  -- Referral Commission
  SELECT * INTO v_referred FROM public.profiles WHERE id = v_deposit.user_id;
  IF v_referred.referred_by IS NOT NULL THEN
    SELECT * INTO v_referrer FROM public.profiles WHERE id = v_referred.referred_by;
    IF FOUND AND v_referrer.status != 'suspended' AND v_referrer.status != 'deleted' THEN
      SELECT * INTO v_referral FROM public.referrals
      WHERE referrer_id = v_referrer.id AND referred_id = v_referred.id
      LIMIT 1;

      IF FOUND THEN
        SELECT * INTO v_existing_commission FROM public.referral_commissions
        WHERE deposit_id = v_deposit.id LIMIT 1;

        IF NOT FOUND THEN
          SELECT * INTO v_settings FROM public.website_settings LIMIT 1;
          v_commission := round((v_deposit.amount * v_settings.referral_percentage / 100.0)::numeric, 2);

          IF v_commission > 0 THEN
            INSERT INTO public.referral_commissions (referral_id, referrer_id, referred_id, deposit_id, commission_amount)
            VALUES (v_referral.id, v_referrer.id, v_referred.id, v_deposit.id, v_commission)
            ON CONFLICT (deposit_id) DO NOTHING;

            UPDATE public.wallets
            SET balance = balance + v_commission,
            referral_earnings = referral_earnings + v_commission
            WHERE user_id = v_referrer.id;

            UPDATE public.referrals
            SET status = 'paid', bonus_amount = bonus_amount + v_commission
            WHERE id = v_referral.id;

            INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
            VALUES (v_referrer.id, 'referral', v_commission, 'completed',
            'Referral commission for ' || COALESCE(v_referred.username, v_referred.full_name, 'referred user') || '''s deposit',
            'REFCOMM-' || v_deposit.id::text);

            INSERT INTO public.notifications (user_id, type, title, message)
            VALUES (v_referrer.id, 'referral', 'Referral Commission Earned!',
            'You earned ₦' || v_commission || ' (' || v_settings.referral_percentage || '%) for ' ||
            COALESCE(v_referred.username, v_referred.full_name, 'a friend') || '''s deposit.');
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- 5. Harden process_daily_roi: prevent duplicate transaction entries
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_daily_roi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_daily_roi numeric(14,2);
  v_today date := CURRENT_DATE;
  v_credited int := 0;
BEGIN
  FOR v_inv IN
    SELECT i.* FROM public.investments i
    WHERE i.status = 'active'
    AND i.start_date::date <= v_today
    AND NOT EXISTS (
      SELECT 1 FROM public.investment_earnings ie
      WHERE ie.investment_id = i.id AND ie.earning_date = v_today
    )
  LOOP
    v_daily_roi := round((v_inv.amount * v_inv.roi / 100.0)::numeric, 2);

    UPDATE public.wallets
    SET balance = balance + v_daily_roi,
    total_profit = total_profit + v_daily_roi
    WHERE user_id = v_inv.user_id;

    INSERT INTO public.investment_earnings (investment_id, user_id, earning_date, amount)
    VALUES (v_inv.id, v_inv.user_id, v_today, v_daily_roi);

    IF NOT EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.reference = 'ROI-' || v_inv.id::text || '-' || v_today::text
    ) THEN
      INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
      VALUES (v_inv.user_id, 'profit', v_daily_roi, 'completed',
      'Daily ROI for ' || v_inv.package_name, 'ROI-' || v_inv.id::text || '-' || v_today::text);
    END IF;

    v_credited := v_credited + 1;
  END LOOP;

  FOR v_inv IN
    SELECT i.* FROM public.investments i
    WHERE i.status = 'active' AND i.maturity_date <= now()
  LOOP
    UPDATE public.wallets
    SET balance = balance + v_inv.amount
    WHERE user_id = v_inv.user_id;

    UPDATE public.investments SET status = 'completed' WHERE id = v_inv.id;

    IF NOT EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.reference = 'PRINCIPAL-' || v_inv.id::text
    ) THEN
      INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
      VALUES (v_inv.user_id, 'profit', v_inv.amount, 'completed',
      'Principal returned: ' || v_inv.package_name, 'PRINCIPAL-' || v_inv.id::text);
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (v_inv.user_id, 'investment', 'Investment Completed',
    'Your investment in ' || v_inv.package_name || ' has matured. Principal of ₦' || v_inv.amount || ' returned to your wallet.')
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Processed daily ROI for % investments', v_credited;
END;
$$;
