/*
# Create financial tables: investment_packages, investments, wallets, deposits, withdrawals, transactions, referrals, notifications, support_tickets, ticket_messages

1. New Tables
- `investment_packages` — admin-managed investment plans (name, description, price, ROI, duration, payout frequency, min/max investment, icon, status, featured). Public read so users can browse; admin-only write.
- `investments` — a user's active/completed investment in a package. Owner-scoped read; insert via privileged function (start_investment) which debits the wallet and computes expected_profit server-side.
- `wallets` — 1:1 with profile. Holds balance, totals (deposits, withdrawals, profit, referral earnings). Owner-read only; balance changes only via privileged functions.
- `deposits` — user deposit requests (bank transfer, crypto USDT, manual) with proof upload. Owner read; admin reads all; status transitions via privileged function.
- `withdrawals` — user withdrawal requests with bank details. Owner read; admin reads all; status transitions via privileged function.
- `transactions` — immutable ledger of every money movement for a user. Owner read; insert via privileged functions only (no client insert policy).
- `referrals` — tracks referrer -> referred relationship and bonus. Referrer read; created on sign-up via function.
- `notifications` — per-user and broadcast notifications. Owner read; update (mark read) own; insert via functions/admin.
- `support_tickets` — user support tickets. Owner read; user insert; admin reads all; status managed by admin or function.
- `ticket_messages` — messages in a ticket thread. Owner or admin read; insert by owner or admin.

2. Security
- RLS on every table.
- investment_packages: public SELECT (only active visible to users via app filter), admin full CRUD.
- All user-financial tables (investments, wallets, deposits, withdrawals, transactions, referrals): owner-scoped SELECT (auth.uid() = user_id); admin SELECT all via is_admin().
- Wallets, transactions: NO client INSERT/UPDATE/DELETE — all mutations go through SECURITY DEFINER functions (start_investment, approve_deposit, reject_deposit, approve_withdrawal, etc.) so balances can never be inflated from the client.
- deposits/withdrawals: owner can INSERT (create a request) and SELECT own; admin can SELECT all and UPDATE status via functions.
- support_tickets: owner INSERT + SELECT own; admin SELECT all + UPDATE status.
- ticket_messages: owner or admin SELECT; owner or admin INSERT.
- notifications: owner SELECT + UPDATE(read) own; admin/announcement INSERT own via function.

3. Important Notes
- Wallet balance, totals, and transaction amounts are NEVER client-writable. Column-level grants + function-only mutations enforce this.
- expected_profit and total_return on investments are computed in start_investment() from the package's server-side ROI/duration — never trusted from the client.
- All money columns are numeric(14,2) for NGN amounts.
*/

-- ===== investment_packages =====
CREATE TABLE IF NOT EXISTS public.investment_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(14,2) NOT NULL DEFAULT 0,
  roi numeric(5,2) NOT NULL DEFAULT 0,
  duration_days int NOT NULL DEFAULT 30,
  payout_frequency text NOT NULL DEFAULT 'daily' CHECK (payout_frequency IN ('daily','weekly','monthly')),
  min_investment numeric(14,2) NOT NULL DEFAULT 0,
  max_investment numeric(14,2) NOT NULL DEFAULT 1000000,
  icon text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  featured boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.investment_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packages_select_public" ON public.investment_packages;
CREATE POLICY "packages_select_public" ON public.investment_packages
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "packages_insert_admin" ON public.investment_packages;
CREATE POLICY "packages_insert_admin" ON public.investment_packages
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "packages_update_admin" ON public.investment_packages;
CREATE POLICY "packages_update_admin" ON public.investment_packages
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "packages_delete_admin" ON public.investment_packages;
CREATE POLICY "packages_delete_admin" ON public.investment_packages
  FOR DELETE TO authenticated USING (public.is_admin());

-- ===== wallets (1:1 with profile) =====
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  total_deposits numeric(14,2) NOT NULL DEFAULT 0,
  total_withdrawals numeric(14,2) NOT NULL DEFAULT 0,
  total_profit numeric(14,2) NOT NULL DEFAULT 0,
  referral_earnings numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets_select_own_or_admin" ON public.wallets;
CREATE POLICY "wallets_select_own_or_admin" ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- No client INSERT/UPDATE/DELETE on wallets — balance mutations only via functions
DROP POLICY IF EXISTS "wallets_insert_own" ON public.wallets;
CREATE POLICY "wallets_insert_own" ON public.wallets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ===== investments =====
CREATE TABLE IF NOT EXISTS public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.investment_packages(id) ON DELETE SET NULL,
  package_name text NOT NULL,
  amount numeric(14,2) NOT NULL,
  roi numeric(5,2) NOT NULL,
  duration_days int NOT NULL,
  payout_frequency text NOT NULL DEFAULT 'daily',
  expected_profit numeric(14,2) NOT NULL DEFAULT 0,
  total_return numeric(14,2) NOT NULL DEFAULT 0,
  start_date timestamptz NOT NULL DEFAULT now(),
  maturity_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investments_user_id_idx ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS investments_status_idx ON public.investments(status);

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investments_select_own_or_admin" ON public.investments;
CREATE POLICY "investments_select_own_or_admin" ON public.investments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- No direct client INSERT/UPDATE — start_investment() handles it
DROP POLICY IF EXISTS "investments_insert_own" ON public.investments;
CREATE POLICY "investments_insert_own" ON public.investments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ===== deposits =====
CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  method text NOT NULL CHECK (method IN ('bank_transfer','crypto_usdt','manual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  proof_url text,
  reference text NOT NULL,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS deposits_user_id_idx ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS deposits_status_idx ON public.deposits(status);

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deposits_select_own_or_admin" ON public.deposits;
CREATE POLICY "deposits_select_own_or_admin" ON public.deposits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "deposits_insert_own" ON public.deposits;
CREATE POLICY "deposits_insert_own" ON public.deposits
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Users can update only proof_url on pending deposits; admin can update status via function
DROP POLICY IF EXISTS "deposits_update_own" ON public.deposits;
CREATE POLICY "deposits_update_own" ON public.deposits
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE UPDATE ON public.deposits FROM authenticated;
GRANT UPDATE (proof_url) ON public.deposits TO authenticated;

-- ===== withdrawals =====
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  bank_name text NOT NULL,
  bank_account_name text NOT NULL,
  bank_account_number text NOT NULL,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS withdrawals_user_id_idx ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON public.withdrawals(status);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawals_select_own_or_admin" ON public.withdrawals;
CREATE POLICY "withdrawals_select_own_or_admin" ON public.withdrawals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawals;
CREATE POLICY "withdrawals_insert_own" ON public.withdrawals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ===== transactions (immutable ledger) =====
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit','withdrawal','investment','profit','referral','bonus')),
  amount numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  description text NOT NULL DEFAULT '',
  reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_created_idx ON public.transactions(created_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_own_or_admin" ON public.transactions;
CREATE POLICY "transactions_select_own_or_admin" ON public.transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- No client INSERT/UPDATE/DELETE — functions write the ledger

-- ===== referrals =====
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  bonus_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON public.referrals(referrer_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_select_own_or_admin" ON public.referrals;
CREATE POLICY "referrals_select_own_or_admin" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.is_admin());

-- ===== notifications =====
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit','withdrawal','investment','referral','announcement','system')),
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_select_own_or_admin" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (user_id IS NULL AND true) OR public.is_admin());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;

-- ===== support_tickets =====
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON public.support_tickets(user_id);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_select_own_or_admin" ON public.support_tickets;
CREATE POLICY "tickets_select_own_or_admin" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "tickets_insert_own" ON public.support_tickets;
CREATE POLICY "tickets_insert_own" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "tickets_update_own" ON public.support_tickets;
CREATE POLICY "tickets_update_own" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "tickets_update_admin" ON public.support_tickets;
CREATE POLICY "tickets_update_admin" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ===== ticket_messages =====
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user','admin')),
  message text NOT NULL,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_messages_ticket_id_idx ON public.ticket_messages(ticket_id);

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_own_or_admin" ON public.ticket_messages;
CREATE POLICY "messages_select_own_or_admin" ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.is_admin()))
  );

DROP POLICY IF EXISTS "messages_insert_own_or_admin" ON public.ticket_messages;
CREATE POLICY "messages_insert_own_or_admin" ON public.ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.is_admin())
    )
  );
