/*
# Fixed price model + package images + coupon system + storage setup

## 1. Investment Packages — fixed price + images
- Add `image_url` column to `investment_packages` (nullable text) for uploaded package images.
- Set `min_investment = price` and `max_investment = price` for all existing packages so the transition to fixed price is seamless.
- Update `start_investment()` to validate against the package's `price` column (exact match) instead of min/max range.

## 2. Coupon System
- `coupons` table: admin-managed redeemable gift codes with value, max redemptions, expiry, status.
- `coupon_redemptions` table: tracks which user redeemed which coupon (one-per-user enforced via unique constraint).
- `redeem_coupon()` function: SECURITY DEFINER — validates code, checks active/not-expired/not-full/not-already-redeemed, credits wallet, writes transaction + notification. Atomic.
- RLS: admin full CRUD on coupons; users can only call `redeem_coupon()` (no direct table access).

## 3. Storage
- Create `package-images` public bucket for package image uploads.
- Create `coupon-system` not needed — coupons are code-based, no images.

## 4. Security
- All coupon mutations go through `redeem_coupon()` — no direct client writes to wallets/transactions.
- Admin-only CRUD on coupons table via `is_admin()`.
- User cannot read coupons table directly (prevents enumeration of codes).
*/

-- ===== 1. Investment packages: add image_url, sync min/max to price =====
ALTER TABLE public.investment_packages ADD COLUMN IF NOT EXISTS image_url text;

-- Sync existing packages: set min=max=price so old code doesn't break during transition
UPDATE public.investment_packages SET min_investment = price WHERE min_investment != price;
UPDATE public.investment_packages SET max_investment = price WHERE max_investment != price;

-- Update start_investment to validate exact price match
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
  IF p_amount != v_pkg.price THEN
    RAISE EXCEPTION 'Amount must match the package price of ₦%', v_pkg.price;
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

  UPDATE public.wallets
    SET balance = balance - p_amount
    WHERE user_id = auth.uid();

  INSERT INTO public.investments (
    user_id, package_id, package_name, amount, roi, duration_days,
    payout_frequency, expected_profit, total_return, start_date, maturity_date, status
  ) VALUES (
    auth.uid(), p_package_id, v_pkg.name, p_amount, v_pkg.roi, v_pkg.duration_days,
    v_pkg.payout_frequency, v_expected_profit, v_total_return, now(), v_maturity, 'active'
  ) RETURNING * INTO v_investment;

  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (auth.uid(), 'investment', p_amount, 'completed', 'Investment in ' || v_pkg.name, v_investment.id::text);

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (auth.uid(), 'investment', 'Investment Started',
    'Your investment of ₦' || p_amount || ' in ' || v_pkg.name || ' is now active. Expected profit: ₦' || v_expected_profit);

  RETURN v_investment;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_investment(uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_investment(uuid, numeric) TO authenticated;

-- ===== 2. Coupons table =====
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  value numeric(14,2) NOT NULL DEFAULT 0,
  max_redemptions int NOT NULL DEFAULT 1,
  redeemed_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coupons_code_idx ON public.coupons(code);
CREATE INDEX IF NOT EXISTS coupons_status_idx ON public.coupons(status);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupons_select_admin" ON public.coupons;
CREATE POLICY "coupons_select_admin" ON public.coupons
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "coupons_insert_admin" ON public.coupons;
CREATE POLICY "coupons_insert_admin" ON public.coupons
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "coupons_update_admin" ON public.coupons;
CREATE POLICY "coupons_update_admin" ON public.coupons
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "coupons_delete_admin" ON public.coupons;
CREATE POLICY "coupons_delete_admin" ON public.coupons
  FOR DELETE TO authenticated USING (public.is_admin());

-- ===== 3. Coupon redemptions table =====
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_user_coupon_idx
  ON public.coupon_redemptions (coupon_id, user_id);

CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx ON public.coupon_redemptions(user_id);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "redemptions_select_admin" ON public.coupon_redemptions;
CREATE POLICY "redemptions_select_admin" ON public.coupon_redemptions
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "redemptions_select_own" ON public.coupon_redemptions;
CREATE POLICY "redemptions_select_own" ON public.coupon_redemptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ===== 4. redeem_coupon function =====
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_coupon public.coupons;
  v_wallet public.wallets;
  v_count int;
  v_already int;
  v_result json;
BEGIN
  -- Normalize code to uppercase
  v_coupon := NULL;
  SELECT * INTO v_coupon FROM public.coupons WHERE upper(code) = upper(p_code);

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Invalid coupon code. Please check and try again.');
  END IF;

  IF v_coupon.status = 'disabled' THEN
    RETURN json_build_object('success', false, 'message', 'This coupon has been disabled.');
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND now() > v_coupon.expires_at THEN
    RETURN json_build_object('success', false, 'message', 'This coupon has expired.');
  END IF;

  IF v_coupon.redeemed_count >= v_coupon.max_redemptions THEN
    RETURN json_build_object('success', false, 'message', 'This coupon has reached its redemption limit.');
  END IF;

  -- Check if this user already redeemed
  SELECT count(*) INTO v_already FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = auth.uid();
  IF v_already > 0 THEN
    RETURN json_build_object('success', false, 'message', 'You have already redeemed this coupon.');
  END IF;

  -- Ensure wallet exists
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    v_wallet := public.ensure_wallet(auth.uid());
  END IF;

  -- Credit wallet
  UPDATE public.wallets
    SET balance = balance + v_coupon.value
    WHERE user_id = auth.uid();

  -- Increment redemption count
  UPDATE public.coupons
    SET redeemed_count = redeemed_count + 1, updated_at = now()
    WHERE id = v_coupon.id;

  -- Record redemption
  INSERT INTO public.coupon_redemptions (coupon_id, user_id, amount)
  VALUES (v_coupon.id, auth.uid(), v_coupon.value);

  -- Transaction ledger
  INSERT INTO public.transactions (user_id, type, amount, status, description, reference)
  VALUES (auth.uid(), 'bonus', v_coupon.value, 'completed', 'Coupon redeemed: ' || v_coupon.code, v_coupon.id::text);

  -- Notification
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (auth.uid(), 'system', 'Coupon Redeemed!',
    '₦' || v_coupon.value || ' has been credited to your wallet from coupon code ' || v_coupon.code);

  RETURN json_build_object('success', true, 'message', 'Coupon redeemed successfully! ₦' || v_coupon.value || ' added to your wallet.', 'amount', v_coupon.value);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_coupon(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text) TO authenticated;

-- ===== 5. Storage bucket for package images =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('package-images', 'package-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read of package images
DROP POLICY IF EXISTS "package_images_public_read" ON storage.objects;
CREATE POLICY "package_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'package-images');

-- Allow authenticated admins to upload/update/delete package images
DROP POLICY IF EXISTS "package_images_admin_upload" ON storage.objects;
CREATE POLICY "package_images_admin_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'package-images' AND public.is_admin());

DROP POLICY IF EXISTS "package_images_admin_update" ON storage.objects;
CREATE POLICY "package_images_admin_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'package-images' AND public.is_admin()) WITH CHECK (bucket_id = 'package-images' AND public.is_admin());

DROP POLICY IF EXISTS "package_images_admin_delete" ON storage.objects;
CREATE POLICY "package_images_admin_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'package-images' AND public.is_admin());

-- Also allow any authenticated user to upload to a 'profile-avatars' bucket if it exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS "avatars_owner_upload" ON storage.objects;
CREATE POLICY "avatars_owner_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]) WITH CHECK (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);