/*
# Create promotional_banners table and add welcome_toast_dismissed column to user_preferences

1. New Tables
- `promotional_banners` — stores admin-uploaded promotional flyer images displayed on user dashboard
  - id (uuid PK)
  - title (text, optional)
  - description (text, optional)
  - image_url (text, the uploaded flyer image URL from Supabase Storage)
  - link_url (text, optional destination URL for future click-through support)
  - enabled (boolean, default true — only one enabled banner shows at a time)
  - created_by (uuid, admin who uploaded)
  - created_at (timestamptz)
  - updated_at (timestamptz)

2. Modified Tables
- `user_preferences` — add `welcome_toast_dismissed` boolean column (default false)
  - Tracks whether a user has dismissed the one-time welcome toast

3. Security
- Enable RLS on `promotional_banners`
- SELECT: all authenticated users can see enabled banners (they're promotional content)
- INSERT/UPDATE/DELETE: admin only (via is_admin())
- Storage bucket `promo-banners` created for image uploads

4. Storage
- Create public bucket `promo-banners` for flyer image storage
*/

-- ===== promotional_banners table =====
CREATE TABLE IF NOT EXISTS public.promotional_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  link_url text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promotional_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_banners_select_authed" ON public.promotional_banners;
CREATE POLICY "promo_banners_select_authed" ON public.promotional_banners
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "promo_banners_insert_admin" ON public.promotional_banners;
CREATE POLICY "promo_banners_insert_admin" ON public.promotional_banners
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "promo_banners_update_admin" ON public.promotional_banners;
CREATE POLICY "promo_banners_update_admin" ON public.promotional_banners
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "promo_banners_delete_admin" ON public.promotional_banners;
CREATE POLICY "promo_banners_delete_admin" ON public.promotional_banners
  FOR DELETE TO authenticated USING (public.is_admin());

-- ===== Add welcome_toast_dismissed to user_preferences =====
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS welcome_toast_dismissed boolean NOT NULL DEFAULT false;

-- ===== Create storage bucket for promo banners =====
INSERT INTO storage.buckets (id, name, public) VALUES ('promo-banners', 'promo-banners', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies for promo-banners bucket
DROP POLICY IF EXISTS "promo_banners_storage_read" ON storage.objects;
CREATE POLICY "promo_banners_storage_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'promo-banners');

DROP POLICY IF EXISTS "promo_banners_storage_upload_admin" ON storage.objects;
CREATE POLICY "promo_banners_storage_upload_admin" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'promo-banners' AND public.is_admin());

DROP POLICY IF EXISTS "promo_banners_storage_delete_admin" ON storage.objects;
CREATE POLICY "promo_banners_storage_delete_admin" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'promo-banners' AND public.is_admin());
