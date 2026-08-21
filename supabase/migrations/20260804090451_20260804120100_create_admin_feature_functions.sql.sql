/*
# Privileged functions for admin features
# - admin_update_balance_v2: logs to balance_audit_log + admin_activity_log
# - admin_reset_password: resets user password, logs to password_reset_log + admin_activity_log
# - start_impersonation / end_impersonation: manage impersonation sessions
# - claim_daily_checkin: user claims daily reward
# - award_welcome_bonus: called on signup if enabled
# - calculate_next_day_payout: projected payout calculation
*/

-- ===== admin_update_balance_v2 (replaces admin_update_balance with audit logging) =====
CREATE OR REPLACE FUNCTION public.admin_update_balance_v2(
  p_user_id uuid,
  p_new_balance numeric,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old numeric(14,2);
  v_user_name text;
  v_user_phone text;
  v_admin_name text;
  v_amount_changed numeric(14,2);
  v_adj_type text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_new_balance IS NULL OR p_new_balance < 0 THEN
    RAISE EXCEPTION 'Invalid balance';
  END IF;

  SELECT balance INTO v_old FROM public.wallets WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    PERFORM public.ensure_wallet(p_user_id);
    SELECT balance INTO v_old FROM public.wallets WHERE user_id = p_user_id;
  END IF;

  v_amount_changed := p_new_balance - v_old;
  v_adj_type := CASE WHEN v_amount_changed >= 0 THEN 'credit' ELSE 'debit' END;

  SELECT full_name, phone INTO v_user_name, v_user_phone FROM public.profiles WHERE id = p_user_id;
  SELECT full_name INTO v_admin_name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.wallets SET balance = p_new_balance WHERE user_id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (p_user_id, 'bonus', v_amount_changed, 'completed', COALESCE(p_reason, 'Balance adjusted by admin'), 'admin-' || gen_random_uuid()::text);

  -- Audit log
  INSERT INTO public.balance_audit_log (
    user_id, user_name, user_phone, admin_id, admin_name,
    previous_balance, new_balance, amount_changed, adjustment_type, reason
  ) VALUES (
    p_user_id, COALESCE(v_user_name, ''), v_user_phone, auth.uid(), COALESCE(v_admin_name, ''),
    v_old, p_new_balance, v_amount_changed, v_adj_type, COALESCE(p_reason, 'Manual adjustment')
  );

  -- Activity log
  INSERT INTO public.admin_activity_log (admin_id, admin_name, action, target_user_id, target_user_name, details)
  VALUES (auth.uid(), COALESCE(v_admin_name, ''), 'balance_adjustment', p_user_id, COALESCE(v_user_name, ''),
    'Adjusted balance from ₦' || v_old || ' to ₦' || p_new_balance || ' (' || v_adj_type || ')');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_balance_v2(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_balance_v2(uuid, numeric, text) TO authenticated;

-- ===== admin_reset_password =====
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_name text;
  v_admin_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 4 THEN
    RAISE EXCEPTION 'Password must be at least 4 characters';
  END IF;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  SELECT full_name INTO v_admin_name FROM public.profiles WHERE id = auth.uid();

  -- Update auth.users password
  UPDATE auth.users SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
    WHERE id = p_user_id;

  -- Log
  INSERT INTO public.password_reset_log (admin_id, admin_name, user_id, user_name)
  VALUES (auth.uid(), COALESCE(v_admin_name, ''), p_user_id, COALESCE(v_user_name, ''));

  INSERT INTO public.admin_activity_log (admin_id, admin_name, action, target_user_id, target_user_name, details)
  VALUES (auth.uid(), COALESCE(v_admin_name, ''), 'password_reset', p_user_id, COALESCE(v_user_name, ''),
    'Admin reset user password');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_password(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(uuid, text) TO authenticated;

-- ===== start_impersonation =====
CREATE OR REPLACE FUNCTION public.start_impersonation(p_user_id uuid)
RETURNS public.impersonation_log
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_log public.impersonation_log;
  v_user_name text;
  v_admin_name text;
  v_target_role text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT full_name, role INTO v_user_name, v_target_role FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF v_target_role = 'admin' THEN RAISE EXCEPTION 'Cannot impersonate admin accounts'; END IF;

  SELECT full_name INTO v_admin_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.impersonation_log (admin_id, admin_name, user_id, user_name, status)
  VALUES (auth.uid(), COALESCE(v_admin_name, ''), p_user_id, COALESCE(v_user_name, ''), 'active')
  RETURNING * INTO v_log;

  INSERT INTO public.admin_activity_log (admin_id, admin_name, action, target_user_id, target_user_name, details)
  VALUES (auth.uid(), COALESCE(v_admin_name, ''), 'impersonation_start', p_user_id, COALESCE(v_user_name, ''),
    'Started impersonation session');

  RETURN v_log;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_impersonation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_impersonation(uuid) TO authenticated;

-- ===== end_impersonation =====
CREATE OR REPLACE FUNCTION public.end_impersonation(p_log_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_log public.impersonation_log;
  v_admin_name text;
BEGIN
  SELECT * INTO v_log FROM public.impersonation_log WHERE id = p_log_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Log not found'; END IF;

  SELECT full_name INTO v_admin_name FROM public.profiles WHERE id = v_log.admin_id;

  UPDATE public.impersonation_log SET end_time = now(), status = 'ended' WHERE id = p_log_id;

  INSERT INTO public.admin_activity_log (admin_id, admin_name, action, target_user_id, target_user_name, details)
  VALUES (v_log.admin_id, COALESCE(v_admin_name, ''), 'impersonation_end', v_log.user_id, v_log.user_name,
    'Ended impersonation session');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.end_impersonation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.end_impersonation(uuid) TO authenticated;

-- ===== claim_daily_checkin =====
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

  -- Credit bonus balance
  UPDATE public.wallets SET bonus_balance = bonus_balance + v_config.daily_checkin_amount
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

REVOKE EXECUTE ON FUNCTION public.claim_daily_checkin() FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin() TO authenticated;

-- ===== award_welcome_bonus (called on signup) =====
CREATE OR REPLACE FUNCTION public.award_welcome_bonus(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_config public.rewards_config;
  v_wallet public.wallets;
BEGIN
  SELECT * INTO v_config FROM public.rewards_config LIMIT 1;
  IF NOT v_config.welcome_bonus_enabled THEN
    RETURN;
  END IF;
  IF v_config.welcome_bonus_amount <= 0 THEN
    RETURN;
  END IF;

  -- Check if user already received a welcome bonus
  PERFORM 1 FROM public.transactions
    WHERE user_id = p_user_id AND type = 'welcome_bonus' LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Ensure wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    v_wallet := public.ensure_wallet(p_user_id);
  END IF;

  -- Credit bonus balance
  UPDATE public.wallets SET bonus_balance = bonus_balance + v_config.welcome_bonus_amount
    WHERE user_id = p_user_id;

  -- Ledger
  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (p_user_id, 'welcome_bonus', v_config.welcome_bonus_amount, 'completed',
    'Welcome bonus', 'welcome-' || p_user_id::text);

  -- Notification
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (p_user_id, 'system', 'Welcome Bonus!',
    'You received ₦' || v_config.welcome_bonus_amount || ' as a welcome bonus. Start investing to unlock withdrawals.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_welcome_bonus(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_welcome_bonus(uuid) TO authenticated;

-- ===== calculate_next_day_payout =====
CREATE OR REPLACE FUNCTION public.calculate_next_day_payout()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_tomorrow date := CURRENT_DATE + 1;
  v_total numeric(14,2) := 0;
  v_user_count int := 0;
  v_pkg_breakdown jsonb;
BEGIN
  SELECT
    COALESCE(sum(i.expected_profit), 0) as total_payout,
    COUNT(DISTINCT i.user_id) as user_count,
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'package_name', i.package_name,
        'amount', sum(i.expected_profit),
        'count', count(*)
      )
    ), '[]'::jsonb) as breakdown
  INTO v_total, v_user_count, v_pkg_breakdown
  FROM public.investments i
  WHERE i.status = 'active'
    AND DATE(i.maturity_date) = v_tomorrow;

  RETURN jsonb_build_object(
    'total_payout', v_total,
    'user_count', v_user_count,
    'breakdown', v_pkg_breakdown,
    'target_date', v_tomorrow::text
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_next_day_payout() FROM anon;
GRANT EXECUTE ON FUNCTION public.calculate_next_day_payout() TO authenticated;

-- ===== calculate_withdrawal_fee =====
CREATE OR REPLACE FUNCTION public.calculate_withdrawal_fee(p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_config public.withdrawal_fee_config;
  v_fee numeric(14,2);
BEGIN
  SELECT * INTO v_config FROM public.withdrawal_fee_config LIMIT 1;

  IF NOT v_config.enabled THEN
    RETURN jsonb_build_object('fee', 0, 'net', p_amount, 'enabled', false);
  END IF;

  IF v_config.fee_type = 'fixed' THEN
    v_fee := v_config.fee_value;
  ELSE
    v_fee := round((p_amount * v_config.fee_value / 100.0)::numeric, 2);
  END IF;

  IF v_fee < v_config.min_fee THEN
    v_fee := v_config.min_fee;
  END IF;

  IF v_config.max_fee IS NOT NULL AND v_fee > v_config.max_fee THEN
    v_fee := v_config.max_fee;
  END IF;

  RETURN jsonb_build_object(
    'fee', v_fee,
    'net', p_amount - v_fee,
    'enabled', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_withdrawal_fee(numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.calculate_withdrawal_fee(numeric) TO authenticated;
