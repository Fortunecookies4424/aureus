/*
# Fix: revoke EXECUTE on privileged functions from PUBLIC

1. Security Changes
- All SECURITY DEFINER functions were granted EXECUTE to PUBLIC by default (Postgres behavior), which includes the anon role.
- This migration revokes EXECUTE FROM PUBLIC on every privileged function, then re-grants only to authenticated.
- This closes the gap where an unauthenticated caller could invoke admin functions or wallet mutations via the REST API.

2. Functions affected
- ensure_wallet, start_investment, approve_deposit, reject_deposit, request_withdrawal, approve_withdrawal, reject_withdrawal, mark_withdrawal_paid, complete_investment, admin_update_balance, admin_set_user_status, is_admin
*/

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_wallet(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_investment(uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_deposit(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_withdrawal(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_withdrawal_paid(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_investment(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_balance(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) FROM PUBLIC;

-- Re-grant to authenticated only
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_investment(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_deposit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_withdrawal_paid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_investment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_balance(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) TO authenticated;
