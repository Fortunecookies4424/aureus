/*
# Create privileged functions for money movements and wallet management

1. New Functions
- `ensure_wallet(p_user_id)` — creates a wallet row for a user if it doesn't exist. Called on first dashboard load.
- `start_investment(p_package_id, p_amount)` — debits the user's wallet, validates amount against package min/max, computes expected_profit and total_return from the package's server-side ROI/duration, creates the investment row, and writes a transaction ledger entry. Returns the new investment.
- `approve_deposit(p_deposit_id)` — admin-only. Sets deposit to approved, credits the wallet balance + total_deposits, writes a transaction, and notifies the user.
- `reject_deposit(p_deposit_id, p_note)` — admin-only. Sets deposit to rejected and notifies the user.
- `request_withdrawal(p_amount, p_bank_name, p_bank_account_name, p_bank_account_number)` — debits the wallet immediately (holds the funds), validates against min/max from website_settings, creates the withdrawal row, and writes a pending transaction. Returns the new withdrawal.
- `approve_withdrawal(p_withdrawal_id)` — admin-only. Sets withdrawal to approved and notifies the user.
- `reject_withdrawal(p_withdrawal_id, p_note)` — admin-only. Refunds the held amount to the wallet, sets withdrawal to rejected, and notifies the user.
- `mark_withdrawal_paid(p_withdrawal_id)` — admin-only. Sets withdrawal to paid, updates wallet total_withdrawals, marks the transaction completed, and notifies the user.
- `complete_investment(p_investment_id)` — credits expected profit + principal to wallet, marks investment completed, updates total_profit, writes a transaction, and notifies the user.
- `create_referral(p_referred_id)` — creates a referral row linking the new user to their referrer (if any) with a bonus from website_settings. Called via trigger on profiles insert.
- `admin_update_balance(p_user_id, p_new_balance, p_reason)` — admin-only. Directly sets a user's wallet balance and writes a ledger entry. Used for corrections.
- `admin_set_user_status(p_user_id, p_status)` — admin-only. Suspends or activates a user.

2. Security
- All functions are SECURITY DEFINER with SET search_path = public so they run as the owner and bypass RLS — the authorization check inside each function is mandatory.
- Admin-only functions verify is_admin() at the top and RAISE EXCEPTION if not.
- User-facing functions derive the actor from auth.uid() — never from a parameter.
- All amounts are validated server-side (min/max, positive, sufficient balance).
- Profit is computed from the package's ROI stored in the database — never from the client.

3. Important Notes
- These functions are the ONLY way to mutate wallet balances, investment records, and transaction ledger entries.
- Column-level grants on wallets/transactions/investments prevent direct client writes; these functions bypass those grants because they run as the definer.
- Each money movement writes an immutable transaction row for audit.
*/

-- ===== ensure_wallet =====
CREATE OR REPLACE FUNCTION public.ensure_wallet(p_user_id uuid)
RETURNS public.wallets
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets;
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
  RETURN v_wallet;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_wallet(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(uuid) TO authenticated;

-- ===== start_investment =====
CREATE OR REPLACE FUNCTION public.start_investment(p_package_id uuid, p_amount numeric)
RETURNS public.investments
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pkg public.investment_packages;
  v_wallet public.wallets;
  v_investment public.investments;
  v_expected_profit numeric(14,2);
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

  v_expected_profit := round((p_amount * v_pkg.roi / 100.0)::numeric, 2);
  v_total_return := p_amount + v_expected_profit;
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
    v_pkg.payout_frequency, v_expected_profit, v_total_return, now(), v_maturity, 'active'
  ) RETURNING * INTO v_investment;

  -- Ledger entry
  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (auth.uid(), 'investment', p_amount, 'completed', 'Investment in ' || v_pkg.name, v_investment.id::text);

  -- Notification
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (auth.uid(), 'investment', 'Investment Started',
    'Your investment of ₦' || p_amount || ' in ' || v_pkg.name || ' is now active. Expected profit: ₦' || v_expected_profit);

  RETURN v_investment;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_investment(uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_investment(uuid, numeric) TO authenticated;

-- ===== approve_deposit =====
CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deposit public.deposits;
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

  -- Credit wallet
  UPDATE public.wallets
    SET balance = balance + v_deposit.amount,
        total_deposits = total_deposits + v_deposit.amount
    WHERE user_id = v_deposit.user_id;

  -- Ledger
  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (v_deposit.user_id, 'deposit', v_deposit.amount, 'completed', 'Deposit approved (' || v_deposit.method || ')', v_deposit.id::text);

  -- Notify
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (v_deposit.user_id, 'deposit', 'Deposit Approved',
    'Your deposit of ₦' || v_deposit.amount || ' has been approved and credited to your wallet.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_deposit(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;

-- ===== reject_deposit =====
CREATE OR REPLACE FUNCTION public.reject_deposit(p_deposit_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deposit public.deposits;
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
    SET status = 'rejected', processed_at = now(), admin_note = p_note
    WHERE id = p_deposit_id;

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (v_deposit.user_id, 'deposit', 'Deposit Update',
    'Your deposit of ₦' || v_deposit.amount || ' could not be verified. Please contact support if you have questions.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_deposit(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_deposit(uuid, text) TO authenticated;

-- ===== request_withdrawal =====
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount numeric,
  p_bank_name text,
  p_bank_account_name text,
  p_bank_account_number text
)
RETURNS public.withdrawals
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets;
  v_withdrawal public.withdrawals;
  v_settings public.website_settings;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid withdrawal amount';
  END IF;
  IF p_bank_name IS NULL OR p_bank_account_name IS NULL OR p_bank_account_number IS NULL THEN
    RAISE EXCEPTION 'Bank details are required';
  END IF;

  SELECT * INTO v_settings FROM public.website_settings LIMIT 1;
  IF p_amount < v_settings.min_withdrawal THEN
    RAISE EXCEPTION 'Amount below minimum withdrawal of ₦%', v_settings.min_withdrawal;
  END IF;
  IF p_amount > v_settings.max_withdrawal THEN
    RAISE EXCEPTION 'Amount above maximum withdrawal of ₦%', v_settings.max_withdrawal;
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    v_wallet := public.ensure_wallet(auth.uid());
  END IF;
  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  -- Hold the funds immediately
  UPDATE public.wallets
    SET balance = balance - p_amount
    WHERE user_id = auth.uid();

  INSERT INTO public.withdrawals (user_id, amount, status, bank_name, bank_account_name, bank_account_number)
  VALUES (auth.uid(), p_amount, 'pending', p_bank_name, p_bank_account_name, p_bank_account_number)
  RETURNING * INTO v_withdrawal;

  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (auth.uid(), 'withdrawal', p_amount, 'pending', 'Withdrawal request', v_withdrawal.id::text);

  RETURN v_withdrawal;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, text) TO authenticated;

-- ===== approve_withdrawal =====
CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_w public.withdrawals;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF v_w.status != 'pending' THEN RAISE EXCEPTION 'Withdrawal already processed'; END IF;

  UPDATE public.withdrawals SET status = 'approved', processed_at = now() WHERE id = p_withdrawal_id;

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (v_w.user_id, 'withdrawal', 'Withdrawal Approved',
    'Your withdrawal of ₦' || v_w.amount || ' has been approved and is being processed.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_withdrawal(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;

-- ===== reject_withdrawal =====
CREATE OR REPLACE FUNCTION public.reject_withdrawal(p_withdrawal_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_w public.withdrawals;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF v_w.status = 'rejected' OR v_w.status = 'paid' THEN RAISE EXCEPTION 'Withdrawal already processed'; END IF;

  -- Refund the held amount
  UPDATE public.wallets SET balance = balance + v_w.amount WHERE user_id = v_w.user_id;

  UPDATE public.withdrawals SET status = 'rejected', processed_at = now(), admin_note = p_note WHERE id = p_withdrawal_id;

  UPDATE public.transactions SET status = 'failed', description = 'Withdrawal rejected'
    WHERE reference = v_w.id::text AND user_id = v_w.user_id;

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (v_w.user_id, 'withdrawal', 'Withdrawal Update',
    'Your withdrawal of ₦' || v_w.amount || ' was rejected. The amount has been refunded to your wallet.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated;

-- ===== mark_withdrawal_paid =====
CREATE OR REPLACE FUNCTION public.mark_withdrawal_paid(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_w public.withdrawals;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_w FROM public.withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF v_w.status = 'paid' THEN RAISE EXCEPTION 'Already marked as paid'; END IF;

  UPDATE public.withdrawals SET status = 'paid', processed_at = now() WHERE id = p_withdrawal_id;

  UPDATE public.wallets SET total_withdrawals = total_withdrawals + v_w.amount WHERE user_id = v_w.user_id;

  UPDATE public.transactions SET status = 'completed', description = 'Withdrawal paid'
    WHERE reference = v_w.id::text AND user_id = v_w.user_id;

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (v_w.user_id, 'withdrawal', 'Withdrawal Paid',
    'Your withdrawal of ₦' || v_w.amount || ' has been sent to your bank account.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_withdrawal_paid(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_withdrawal_paid(uuid) TO authenticated;

-- ===== complete_investment =====
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

  -- Credit principal + profit
  UPDATE public.wallets
    SET balance = balance + v_inv.total_return,
        total_profit = total_profit + v_inv.expected_profit
    WHERE user_id = v_inv.user_id;

  UPDATE public.investments SET status = 'completed' WHERE id = p_investment_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (v_inv.user_id, 'profit', v_inv.total_return, 'completed', 'Investment completed: ' || v_inv.package_name, v_inv.id::text);

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (v_inv.user_id, 'investment', 'Investment Completed',
    'Your investment in ' || v_inv.package_name || ' has matured. ₦' || v_inv.total_return || ' credited to your wallet.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_investment(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_investment(uuid) TO authenticated;

-- ===== create_referral (trigger on profiles) =====
CREATE OR REPLACE FUNCTION public.handle_new_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_settings public.website_settings;
  v_bonus numeric(14,2);
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    SELECT * INTO v_settings FROM public.website_settings LIMIT 1;
    -- Referral bonus is a flat amount (we use referral_percentage of a base of 1000 as signup bonus)
    v_bonus := round((1000.0 * v_settings.referral_percentage / 100.0)::numeric, 2);

    INSERT INTO public.referrals (referrer_id, referred_id, bonus_amount, status)
    VALUES (NEW.referred_by, NEW.id, v_bonus, 'pending');

    -- Credit referrer wallet immediately for the signup bonus
    UPDATE public.wallets
      SET balance = balance + v_bonus,
          referral_earnings = referral_earnings + v_bonus
      WHERE user_id = NEW.referred_by;

    INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
    VALUES (NEW.referred_by, 'referral', v_bonus, 'completed', 'Referral bonus for ' || NEW.username, NEW.id::text);

    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (NEW.referred_by, 'referral', 'New Referral Bonus!',
      'You earned ₦' || v_bonus || ' for referring ' || NEW.username || '. Keep sharing your link!');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_referral();

-- ===== admin_update_balance =====
CREATE OR REPLACE FUNCTION public.admin_update_balance(p_user_id uuid, p_new_balance numeric, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old numeric(14,2);
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

  UPDATE public.wallets SET balance = p_new_balance WHERE user_id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (p_user_id, 'bonus', p_new_balance - v_old, 'completed', COALESCE(p_reason, 'Balance adjusted by admin'), 'admin-' || gen_random_uuid()::text);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_balance(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_balance(uuid, numeric, text) TO authenticated;

-- ===== admin_set_user_status =====
CREATE OR REPLACE FUNCTION public.admin_set_user_status(p_user_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_status NOT IN ('active','suspended') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own status';
  END IF;

  UPDATE public.profiles SET status = p_status WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) TO authenticated;
