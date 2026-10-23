/*
# Fix ROI, Registration Bonus, and Referral System

1. New Tables
- `investment_earnings` — tracks daily ROI credits per investment to prevent duplicates
  - id (uuid PK)
  - investment_id (uuid FK -> investments, ON DELETE CASCADE)
  - user_id (uuid FK -> profiles)
  - earning_date (date) — the day this earning is for
  - amount numeric(14,2) — the daily ROI credited
  - created_at timestamptz
  - UNIQUE(investment_id, earning_date) — prevents double-crediting

2. Modified Functions
- `handle_new_user()` — now credits welcome bonus from rewards_config if enabled
- `start_investment()` — ROI is now interpreted as daily ROI percentage (25% = 25% daily)
- `complete_investment()` — updated to work with new daily ROI model
- New: `process_daily_roi()` — credits daily ROI to all active investments, idempotent per day
- New: `bulk_approve_deposits()` — admin bulk action
- New: `bulk_reject_deposits()` — admin bulk action
- New: `bulk_approve_withdrawals()` — admin bulk action
- New: `bulk_reject_withdrawals()` — admin bulk action
- New: `bulk_set_user_status()` — admin bulk action

3. Security
- investment_earnings: owner-scoped SELECT, no client INSERT/UPDATE/DELETE
- All new functions are SECURITY DEFINER with admin checks where needed
*/

-- ===== investment_earnings table =====
CREATE TABLE IF NOT EXISTS public.investment_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  earning_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(investment_id, earning_date)
);

CREATE INDEX IF NOT EXISTS investment_earnings_user_idx ON public.investment_earnings(user_id);
CREATE INDEX IF NOT EXISTS investment_earnings_investment_idx ON public.investment_earnings(investment_id);
CREATE INDEX IF NOT EXISTS investment_earnings_date_idx ON public.investment_earnings(earning_date);

ALTER TABLE public.investment_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investment_earnings_select_own_or_admin" ON public.investment_earnings;
CREATE POLICY "investment_earnings_select_own_or_admin" ON public.investment_earnings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ===== Fix handle_new_user: credit welcome bonus =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_meta jsonb;
  v_settings public.website_settings;
  v_rewards public.rewards_config;
  v_wallet public.wallets;
  v_bonus numeric(14,2);
BEGIN
  v_meta := new.raw_user_meta_data;

  -- Look up referrer if referral code provided
  IF v_meta ? 'referral_code' AND v_meta->>'referral_code' != '' THEN
    SELECT id INTO v_referrer_id FROM public.profiles
      WHERE referral_code = upper(v_meta->>'referral_code') LIMIT 1;
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

-- ===== Fix start_investment: ROI is daily ROI rate =====
CREATE OR REPLACE FUNCTION public.start_investment(p_package_id uuid, p_amount numeric)
RETURNS public.investments
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pkg public.investment_packages;
  v_wallet public.wallets;
  v_investment public.investments;
  v_daily_roi numeric(14,2);
  v_total_profit numeric(14,2);
  v_total_return numeric(14,2);
  v_maturity timestamptz;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid investment amount';
  END IF;

  SELECT * INTO v_pkg FROM public.investment_packages WHERE id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investment package not found';
  END IF;
  IF v_pkg.status != 'active' THEN
    RAISE EXCEPTION 'This investment package is not currently available';
  END IF;
  IF p_amount < v_pkg.min_investment THEN
    RAISE EXCEPTION 'Amount below minimum investment for this plan';
  END IF;
  IF p_amount > v_pkg.max_investment THEN
    RAISE EXCEPTION 'Amount above maximum investment for this plan';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    v_wallet := public.ensure_wallet(auth.uid());
  END IF;
  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance for this investment';
  END IF;

  -- Daily ROI = amount * roi% (roi is the daily rate, e.g. 25 means 25%)
  v_daily_roi := round((p_amount * v_pkg.roi / 100.0)::numeric, 2);
  v_total_profit := round((v_daily_roi * v_pkg.duration_days)::numeric, 2);
  v_total_return := p_amount + v_total_profit;
  v_maturity := now() + (v_pkg.duration_days || ' days')::interval;

  -- Debit wallet
  UPDATE public.wallets
    SET balance = balance - p_amount
    WHERE user_id = auth.uid();

  -- Create investment
  INSERT INTO public.investments (
    user_id, package_id, package_name, amount, roi, duration_days,
    payout_frequency, expected_profit, total_return, start_date, maturity_date, status
  ) VALUES (
    auth.uid(), p_package_id, v_pkg.name, p_amount, v_pkg.roi, v_pkg.duration_days,
    v_pkg.payout_frequency, v_total_profit, v_total_return, now(), v_maturity, 'active'
  ) RETURNING * INTO v_investment;

  -- Ledger entry
  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (auth.uid(), 'investment', p_amount, 'completed', 'Investment in ' || v_pkg.name, v_investment.id::text);

  -- Notification
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (auth.uid(), 'investment', 'Investment Started',
    'Your investment of ₦' || p_amount || ' in ' || v_pkg.name || ' is now active. Daily ROI: ₦' || v_daily_roi || ' for ' || v_pkg.duration_days || ' days.');

  RETURN v_investment;
END;
$$;

-- ===== New: process_daily_roi — credits daily ROI to all active investments =====
CREATE OR REPLACE FUNCTION public.process_daily_roi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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
    -- Daily ROI = investment amount * roi% (roi is daily rate)
    v_daily_roi := round((v_inv.amount * v_inv.roi / 100.0)::numeric, 2);

    -- Credit wallet
    UPDATE public.wallets
      SET balance = balance + v_daily_roi,
          total_profit = total_profit + v_daily_roi
      WHERE user_id = v_inv.user_id;

    -- Record earning to prevent duplicates
    INSERT INTO public.investment_earnings (investment_id, user_id, earning_date, amount)
    VALUES (v_inv.id, v_inv.user_id, v_today, v_daily_roi);

    -- Transaction record
    INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
    VALUES (v_inv.user_id, 'profit', v_daily_roi, 'completed',
      'Daily ROI for ' || v_inv.package_name, 'ROI-' || v_inv.id::text || '-' || v_today::text);

    v_credited := v_credited + 1;
  END LOOP;

  -- Check if any investments have reached maturity and complete them
  FOR v_inv IN
    SELECT i.* FROM public.investments i
    WHERE i.status = 'active' AND i.maturity_date <= now()
  LOOP
    -- Credit remaining principal back (profit already credited daily)
    UPDATE public.wallets
      SET balance = balance + v_inv.amount
      WHERE user_id = v_inv.user_id;

    UPDATE public.investments SET status = 'completed' WHERE id = v_inv.id;

    INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
    VALUES (v_inv.user_id, 'profit', v_inv.amount, 'completed',
      'Principal returned: ' || v_inv.package_name, 'PRINCIPAL-' || v_inv.id::text);

    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (v_inv.user_id, 'investment', 'Investment Completed',
      'Your investment in ' || v_inv.package_name || ' has matured. Principal of ₦' || v_inv.amount || ' returned to your wallet.');
  END LOOP;

  RAISE NOTICE 'Processed daily ROI for % investments', v_credited;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_daily_roi() FROM anon;
GRANT EXECUTE ON FUNCTION public.process_daily_roi() TO authenticated;

-- ===== Fix complete_investment to work with new model =====
CREATE OR REPLACE FUNCTION public.complete_investment(p_investment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv public.investments;
BEGIN
  SELECT * INTO v_inv FROM public.investments WHERE id = p_investment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment not found'; END IF;
  IF v_inv.status != 'active' THEN RAISE EXCEPTION 'Investment is not active'; END IF;
  IF now() < v_inv.maturity_date THEN RAISE EXCEPTION 'Investment has not reached maturity'; END IF;

  -- Credit principal back (profit already credited daily via process_daily_roi)
  UPDATE public.wallets
    SET balance = balance + v_inv.amount
    WHERE user_id = v_inv.user_id;

  UPDATE public.investments SET status = 'completed' WHERE id = p_investment_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (v_inv.user_id, 'profit', v_inv.amount, 'completed',
    'Principal returned: ' || v_inv.package_name, 'PRINCIPAL-' || v_inv.id::text);

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (v_inv.user_id, 'investment', 'Investment Completed',
    'Your investment in ' || v_inv.package_name || ' has matured. Principal of ₦' || v_inv.amount || ' returned to your wallet.');
END;
$$;

-- ===== Bulk action functions =====

CREATE OR REPLACE FUNCTION public.bulk_approve_deposits(p_deposit_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  FOREACH v_id IN ARRAY p_deposit_ids LOOP
    PERFORM public.approve_deposit(v_id);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bulk_approve_deposits(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_approve_deposits(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_reject_deposits(p_deposit_ids uuid[], p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  FOREACH v_id IN ARRAY p_deposit_ids LOOP
    PERFORM public.reject_deposit(v_id, p_note);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bulk_reject_deposits(uuid[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_reject_deposits(uuid[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_approve_withdrawals(p_withdrawal_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  FOREACH v_id IN ARRAY p_withdrawal_ids LOOP
    PERFORM public.approve_withdrawal(v_id);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bulk_approve_withdrawals(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_approve_withdrawals(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_reject_withdrawals(p_withdrawal_ids uuid[], p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  FOREACH v_id IN ARRAY p_withdrawal_ids LOOP
    PERFORM public.reject_withdrawal(v_id, p_note);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bulk_reject_withdrawals(uuid[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_reject_withdrawals(uuid[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_set_user_status(p_user_ids uuid[], p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  FOREACH v_id IN ARRAY p_user_ids LOOP
    IF v_id != auth.uid() THEN
      PERFORM public.admin_set_user_status(v_id, p_status);
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bulk_set_user_status(uuid[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_set_user_status(uuid[], text) TO authenticated;
