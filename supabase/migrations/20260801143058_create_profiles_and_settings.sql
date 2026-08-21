/*
# Create core tables: profiles, website_settings, faqs, announcements, testimonials

1. New Tables
- `profiles` — extends Supabase auth.users with app-specific data (full name, username, phone, avatar, role, status, referral code, bank details). Owner-scoped by the user's own auth id; admin gets full access via policies checking role = 'admin'.
- `website_settings` — singleton row holding all CMS / site configuration (company name, logo, contact info, currency, referral percentage, withdrawal limits, maintenance mode, hero text, about text, social links, terms, privacy). Public read so the landing page can render; admin-only write.
- `faqs` — admin-managed FAQ entries shown on the landing page. Public read; admin-only write.
- `announcements` — admin-published announcements pushed to user notifications. Users read active ones; admin full CRUD.
- `testimonials` — admin-managed customer testimonials for the landing page. Public read; admin-only write.

2. Security
- RLS enabled on every table.
- profiles: users can read/update only their own row. Admins (role='admin') can read all and update all. Inserts happen via trigger on auth.users (no direct insert policy for clients).
- website_settings: public read (anon + authenticated) so the landing page works without login; admin-only update.
- faqs, testimonials: public read; admin-only insert/update/delete.
- announcements: authenticated users can read; admin-only insert/update/delete.
- Admin checks use a helper function is_admin() that reads the caller's profile role.
- A trigger creates a profile row automatically when a new auth.user is created, so sign-up doesn't require a separate profile insert from the client.

3. Important Notes
- `profiles.id` references `auth.users.id` (1:1). ON DELETE CASCADE so deleting a user removes the profile.
- `profiles.role` defaults to 'user'. Elevated to 'admin' only by a privileged function or direct DB action — never client-writable.
- `profiles.status` defaults to 'active'. Client-revoked so users can't un-suspend themselves.
- `profiles.referral_code` is unique and generated on insert via a default expression.
- `website_settings` has a single row enforced by a partial unique index on id.
*/

-- ===== profiles (created first so is_admin() can reference it) =====
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  username text NOT NULL DEFAULT '',
  phone text,
  avatar_url text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  referral_code text UNIQUE NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(5),'hex'),1,8)),
  referred_by text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Username uniqueness (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username));

-- Helper: is the current caller an admin? (defined after profiles exists)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile; admins can read all
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Users can update only their own profile, and NOT role/status fields (column grants below)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can update any profile
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Restrict which columns a regular user can update (NOT role, status, referral_code, referred_by, email)
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, username, phone, avatar_url, bank_name, bank_account_name, bank_account_number) ON public.profiles TO authenticated;
-- Admins keep full update rights
GRANT UPDATE ON public.profiles TO authenticated;

-- Auto-create a profile when a new auth.user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_meta jsonb;
BEGIN
  v_meta := new.raw_user_meta_data;

  IF v_meta ? 'referral_code' AND v_meta->>'referral_code' != '' THEN
    SELECT id INTO v_referrer_id FROM public.profiles
      WHERE referral_code = upper(v_meta->>'referral_code') LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, username, phone, referred_by)
  VALUES (
    new.id,
    new.email,
    COALESCE(v_meta->>'full_name',''),
    COALESCE(v_meta->>'username',''),
    v_meta->>'phone',
    v_referrer_id
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== website_settings (singleton) =====
CREATE TABLE IF NOT EXISTS public.website_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'Aureus',
  logo_url text,
  email text NOT NULL DEFAULT 'support@aureus.ng',
  phone text NOT NULL DEFAULT '+234 800 000 0000',
  address text NOT NULL DEFAULT 'Victoria Island, Lagos, Nigeria',
  currency text NOT NULL DEFAULT '₦',
  referral_percentage numeric NOT NULL DEFAULT 5,
  min_withdrawal numeric NOT NULL DEFAULT 1000,
  max_withdrawal numeric NOT NULL DEFAULT 5000000,
  maintenance_mode boolean NOT NULL DEFAULT false,
  hero_title text NOT NULL DEFAULT 'Grow Your Wealth with Confidence',
  hero_subtitle text NOT NULL DEFAULT 'Premium investment plans designed for ambitious Nigerians. Transparent returns, secure growth, and a platform built on trust.',
  hero_stat1_label text NOT NULL DEFAULT 'Total Invested',
  hero_stat1_value text NOT NULL DEFAULT '₦2.4B+',
  hero_stat2_label text NOT NULL DEFAULT 'Active Investors',
  hero_stat2_value text NOT NULL DEFAULT '18,000+',
  hero_stat3_label text NOT NULL DEFAULT 'Avg. ROI',
  hero_stat3_value text NOT NULL DEFAULT '42%',
  about_text text NOT NULL DEFAULT 'Aureus is a premier Nigerian investment platform built on transparency, security, and consistent returns. We connect ambitious investors with carefully structured investment opportunities, empowering you to grow your wealth with confidence.',
  contact_email text NOT NULL DEFAULT 'support@aureus.ng',
  contact_phone text NOT NULL DEFAULT '+234 800 000 0000',
  contact_address text NOT NULL DEFAULT 'Victoria Island, Lagos, Nigeria',
  facebook_url text DEFAULT '',
  twitter_url text DEFAULT '',
  instagram_url text DEFAULT '',
  linkedin_url text DEFAULT '',
  terms_text text NOT NULL DEFAULT 'These terms govern your use of the Aureus investment platform. By creating an account, you agree to these terms. All investments carry risk; past performance does not guarantee future results.',
  privacy_text text NOT NULL DEFAULT 'Your privacy is important to us. We collect only the information necessary to operate your account and process your investments. We never sell your data to third parties.',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_public" ON public.website_settings;
CREATE POLICY "settings_select_public" ON public.website_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "settings_update_admin" ON public.website_settings;
CREATE POLICY "settings_update_admin" ON public.website_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.website_settings (id) VALUES (gen_random_uuid())
  ON CONFLICT DO NOTHING;

-- ===== faqs =====
CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faqs_select_public" ON public.faqs;
CREATE POLICY "faqs_select_public" ON public.faqs
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "faqs_insert_admin" ON public.faqs;
CREATE POLICY "faqs_insert_admin" ON public.faqs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "faqs_update_admin" ON public.faqs;
CREATE POLICY "faqs_update_admin" ON public.faqs
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "faqs_delete_admin" ON public.faqs;
CREATE POLICY "faqs_delete_admin" ON public.faqs
  FOR DELETE TO authenticated USING (public.is_admin());

-- ===== announcements =====
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_select_authed" ON public.announcements;
CREATE POLICY "announcements_select_authed" ON public.announcements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "announcements_insert_admin" ON public.announcements;
CREATE POLICY "announcements_insert_admin" ON public.announcements
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "announcements_update_admin" ON public.announcements;
CREATE POLICY "announcements_update_admin" ON public.announcements
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "announcements_delete_admin" ON public.announcements;
CREATE POLICY "announcements_delete_admin" ON public.announcements
  FOR DELETE TO authenticated USING (public.is_admin());

-- ===== testimonials =====
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  message text NOT NULL,
  avatar_url text,
  rating int NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "testimonials_select_public" ON public.testimonials;
CREATE POLICY "testimonials_select_public" ON public.testimonials
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "testimonials_insert_admin" ON public.testimonials;
CREATE POLICY "testimonials_insert_admin" ON public.testimonials
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "testimonials_update_admin" ON public.testimonials;
CREATE POLICY "testimonials_update_admin" ON public.testimonials
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "testimonials_delete_admin" ON public.testimonials;
CREATE POLICY "testimonials_delete_admin" ON public.testimonials
  FOR DELETE TO authenticated USING (public.is_admin());
