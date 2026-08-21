-- Update handle_new_user trigger to support phone-based registration
-- When users sign up with phone+password (no full_name/username),
-- generate a username from phone digits and use phone as display name.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_meta jsonb;
  v_phone text;
  v_username text;
BEGIN
  v_meta := new.raw_user_meta_data;
  v_phone := COALESCE(v_meta->>'phone', '');

  IF v_meta ? 'referral_code' AND v_meta->>'referral_code' != '' THEN
    SELECT id INTO v_referrer_id FROM public.profiles
      WHERE referral_code = upper(v_meta->>'referral_code') LIMIT 1;
  END IF;

  -- Generate username from phone digits if not explicitly provided
  v_username := COALESCE(NULLIF(v_meta->>'username', ''),
    CASE
      WHEN v_phone != '' THEN regexp_replace(v_phone, '[^0-9]', '', 'g')
      ELSE 'user_' || substr(encode(gen_random_bytes(4),'hex'),1,8)
    END);

  INSERT INTO public.profiles (id, email, full_name, username, phone, referred_by)
  VALUES (
    new.id,
    new.email,
    COALESCE(NULLIF(v_meta->>'full_name', ''), v_phone, ''),
    v_username,
    NULLIF(v_phone, ''),
    v_referrer_id
  );
  RETURN new;
END;
$$;