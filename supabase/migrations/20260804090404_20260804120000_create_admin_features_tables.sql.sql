/*
# Admin feature tables: balance_audit_log, rewards_config, daily_checkins, withdrawal_fee_config, payment_gateways, impersonation_log, password_reset_log, admin_activity_log
# Also: alter website_settings (add telegram_url, whatsapp_url), alter transactions (add 'fee' type), alter withdrawals (add fee_amount)
*/

-- ===== Alter website_settings: add Telegram + WhatsApp =====
ALTER TABLE public.website_settings ADD COLUMN IF NOT EXISTS telegram_url text DEFAULT '';
ALTER TABLE public.website_settings ADD COLUMN IF NOT EXISTS whatsapp_url text DEFAULT '';

-- ===== Alter transactions: add 'fee' type and 'checkin' and 'welcome_bonus' types =====
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit','withdrawal','investment','profit','referral','bonus','fee','checkin','welcome_bonus'));

-- ===== Alter withdrawals: add fee_amount =====
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS fee_amount numeric(14,2) NOT NULL DEFAULT 0;

-- ===== balance_audit_log =====
CREATE TABLE IF NOT EXISTS public.balance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id text UNIQUE NOT NULL DEFAULT ('BAL-' || upper(substr(encode(gen_random_bytes(8),'hex'),1,12))),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  user_phone text,
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_name text NOT NULL DEFAULT '',
  previous_balance numeric(14,2) NOT NULL DEFAULT 0,
  new_balance numeric(14,2) NOT NULL DEFAULT 0,
  amount_changed numeric(14,2) NOT NULL DEFAULT 0,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('credit','debit')),
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS balance_audit_user_id_idx ON public.balance_audit_log(user_id);
CREATE INDEX IF NOT EXISTS balance_audit_admin_id_idx ON public.balance_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS balance_audit_created_idx ON public.balance_audit_log(created_at DESC);

ALTER TABLE public.balance_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "balance_audit_select_admin" ON public.balance_audit_log;
CREATE POLICY "balance_audit_select_admin" ON public.balance_audit_log
  FOR SELECT TO authenticated USING (public.is_admin());

-- No INSERT/UPDATE/DELETE from clients — only via SECURITY DEFINER function

-- ===== rewards_config (singleton) =====
CREATE TABLE IF NOT EXISTS public.rewards_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  welcome_bonus_enabled boolean NOT NULL DEFAULT false,
  welcome_bonus_amount numeric(14,2) NOT NULL DEFAULT 0,
  welcome_bonus_expiry_days int,
  daily_checkin_enabled boolean NOT NULL DEFAULT false,
  daily_checkin_amount numeric(14,2) NOT NULL DEFAULT 0,
  daily_checkin_reset_time text NOT NULL DEFAULT '00:00',
  daily_checkin_max_streak int,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rewards_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rewards_config_select_authed" ON public.rewards_config;
CREATE POLICY "rewards_config_select_authed" ON public.rewards_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rewards_config_update_admin" ON public.rewards_config;
CREATE POLICY "rewards_config_update_admin" ON public.rewards_config
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.rewards_config (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- ===== daily_checkins =====
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  streak int NOT NULL DEFAULT 1,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS daily_checkins_user_id_idx ON public.daily_checkins(user_id);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_checkins_select_own_or_admin" ON public.daily_checkins;
CREATE POLICY "daily_checkins_select_own_or_admin" ON public.daily_checkins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- No direct INSERT — only via claim_daily_checkin() function

-- ===== withdrawal_fee_config (singleton) =====
CREATE TABLE IF NOT EXISTS public.withdrawal_fee_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  fee_type text NOT NULL DEFAULT 'fixed' CHECK (fee_type IN ('fixed','percentage')),
  fee_value numeric(14,2) NOT NULL DEFAULT 0,
  min_fee numeric(14,2) NOT NULL DEFAULT 0,
  max_fee numeric(14,2),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_fee_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawal_fee_config_select_authed" ON public.withdrawal_fee_config;
CREATE POLICY "withdrawal_fee_config_select_authed" ON public.withdrawal_fee_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "withdrawal_fee_config_update_admin" ON public.withdrawal_fee_config;
CREATE POLICY "withdrawal_fee_config_update_admin" ON public.withdrawal_fee_config
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.withdrawal_fee_config (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- ===== payment_gateways =====
CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  public_key text NOT NULL DEFAULT '',
  secret_key text NOT NULL DEFAULT '',
  merchant_id text NOT NULL DEFAULT '',
  webhook_secret text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  supported_methods text[] NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_gateways_select_admin" ON public.payment_gateways;
CREATE POLICY "payment_gateways_select_admin" ON public.payment_gateways
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "payment_gateways_insert_admin" ON public.payment_gateways;
CREATE POLICY "payment_gateways_insert_admin" ON public.payment_gateways
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "payment_gateways_update_admin" ON public.payment_gateways;
CREATE POLICY "payment_gateways_update_admin" ON public.payment_gateways
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "payment_gateways_delete_admin" ON public.payment_gateways;
CREATE POLICY "payment_gateways_delete_admin" ON public.payment_gateways
  FOR DELETE TO authenticated USING (public.is_admin());

-- Seed default gateways
INSERT INTO public.payment_gateways (name, slug, sort_order) VALUES
  ('Paystack', 'paystack', 1),
  ('Nomba', 'nomba', 2),
  ('Flutterwave', 'flutterwave', 3),
  ('Monnify', 'monnify', 4)
ON CONFLICT (slug) DO NOTHING;

-- ===== impersonation_log =====
CREATE TABLE IF NOT EXISTS public.impersonation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_name text NOT NULL DEFAULT '',
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  ip_address text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended'))
);

CREATE INDEX IF NOT EXISTS impersonation_admin_id_idx ON public.impersonation_log(admin_id);
CREATE INDEX IF NOT EXISTS impersonation_user_id_idx ON public.impersonation_log(user_id);

ALTER TABLE public.impersonation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "impersonation_log_select_admin" ON public.impersonation_log;
CREATE POLICY "impersonation_log_select_admin" ON public.impersonation_log
  FOR SELECT TO authenticated USING (public.is_admin());

-- No client INSERT/UPDATE — only via SECURITY DEFINER functions

-- ===== password_reset_log =====
CREATE TABLE IF NOT EXISTS public.password_reset_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_name text NOT NULL DEFAULT '',
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_admin_id_idx ON public.password_reset_log(admin_id);

ALTER TABLE public.password_reset_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "password_reset_log_select_admin" ON public.password_reset_log;
CREATE POLICY "password_reset_log_select_admin" ON public.password_reset_log
  FOR SELECT TO authenticated USING (public.is_admin());

-- ===== admin_activity_log =====
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_name text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_activity_admin_id_idx ON public.admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS admin_activity_created_idx ON public.admin_activity_log(created_at DESC);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_activity_log_select_admin" ON public.admin_activity_log;
CREATE POLICY "admin_activity_log_select_admin" ON public.admin_activity_log
  FOR SELECT TO authenticated USING (public.is_admin());

-- ===== user_preferences (for functional settings) =====
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  notif_deposit boolean NOT NULL DEFAULT true,
  notif_withdrawal boolean NOT NULL DEFAULT true,
  notif_investment boolean NOT NULL DEFAULT true,
  notif_referral boolean NOT NULL DEFAULT true,
  notif_announcement boolean NOT NULL DEFAULT true,
  login_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_preferences_select_own" ON public.user_preferences;
CREATE POLICY "user_preferences_select_own" ON public.user_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_preferences_insert_own" ON public.user_preferences;
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_preferences_update_own" ON public.user_preferences;
CREATE POLICY "user_preferences_update_own" ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ===== wallets: add bonus_balance column =====
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS bonus_balance numeric(14,2) NOT NULL DEFAULT 0;
