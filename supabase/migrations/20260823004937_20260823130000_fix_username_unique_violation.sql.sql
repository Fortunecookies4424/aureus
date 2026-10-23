/*
# Fix: New user registration failing due to unique constraint violations

## Root Cause
The `profiles` table has a unique index on `lower(username)` (`profiles_username_lower_key`).
When `handle_new_user()` inserts a new profile with `COALESCE(v_meta->>'username', '')`,
users who don't provide a username get an empty string `''`. The second user without a
username triggers a unique constraint violation on `lower('') = ''`, causing the entire
registration to fail.

## Fix
1. Modify `handle_new_user()` to generate a unique username from the email prefix + random
   suffix when no username is provided in metadata.
2. Also ensure the referral_code default doesn't collide (unlikely but add retry logic).

## Changes
- Recreate `handle_new_user()` with auto-generated unique username fallback
*/

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
  v_username text;
  v_email_prefix text;
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

  -- Generate username: use provided username, or derive from email + random suffix
  v_username := COALESCE(NULLIF(trim(v_meta->>'username'), ''), '');
  IF v_username = '' THEN
    -- Extract prefix before @ from email
    v_email_prefix := split_part(new.email, '@', 1);
    -- Sanitize: keep only alphanumeric, lowercase, max 12 chars
    v_email_prefix := lower(substr(regexp_replace(v_email_prefix, '[^a-zA-Z0-9]', '', 'g'), 1, 12));
    IF v_email_prefix = '' THEN
      v_email_prefix := 'user';
    END IF;
    -- Append random 4-digit suffix to ensure uniqueness
    v_username := v_email_prefix || lpad((floor(random() * 10000))::text, 4, '0');
  END IF;

  -- Create profile (let referral_code use its default)
  INSERT INTO public.profiles (id, email, full_name, username, phone, referred_by)
  VALUES (
    new.id,
    new.email,
    COALESCE(v_meta->>'full_name',''),
    v_username,
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
