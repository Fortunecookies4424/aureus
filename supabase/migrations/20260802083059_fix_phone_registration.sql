-- =====================================================
-- Fix phone-based registration: auto-confirm, uniqueness, pre-check
-- =====================================================

-- 1. BEFORE INSERT trigger on auth.users: auto-confirm @aureus.phone emails
--    so users can sign in immediately without email verification.
CREATE OR REPLACE FUNCTION public.auto_confirm_phone_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email LIKE '%@aureus.phone' THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_confirm_phone_users ON auth.users;
CREATE TRIGGER auto_confirm_phone_users
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_phone_users();

-- 2. Unique index on profiles.phone to prevent duplicate phone registrations
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_key
  ON public.profiles (phone) WHERE phone IS NOT NULL;

-- 3. Server-side phone uniqueness check callable from the client (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_phone_taken(p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE phone = p_phone);
$$;

GRANT EXECUTE ON FUNCTION public.is_phone_taken(text) TO anon, authenticated;