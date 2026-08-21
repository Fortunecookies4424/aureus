-- Update handle_new_user to generate a unique username from phone digits
-- and handle full_name from metadata for phone-based registrations.

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
  v_full_name text;
BEGIN
  v_meta := new.raw_user_meta_data;
  v_phone := NULLIF(v_meta->>'phone', '');

  IF v_meta ? 'referral_code' AND v_meta->>'referral_code' != '' THEN
    SELECT id INTO v_referrer_id FROM public.profiles
      WHERE referral_code = upper(v_meta->>'referral_code') LIMIT 1;
  END IF;

  v_full_name := NULLIF(v_meta->>'full_name', '');

  -- Generate username from phone digits; append a 4-char suffix to avoid collisions
  IF v_phone IS NOT NULL THEN
    v_username := regexp_replace(v_phone, '[^0-9]', '', 'g');
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username)) LOOP
      v_username := v_username || substr(encode(gen_random_bytes(2),'hex'),1,4);
    END LOOP;
  ELSE
    v_username := 'user_' || substr(encode(gen_random_bytes(4),'hex'),1,8);
  END IF;

  INSERT INTO public.profiles (id, email, full_name, username, phone, referred_by)
  VALUES (
    new.id,
    new.email,
    COALESCE(v_full_name, ''),
    v_username,
    v_phone,
    v_referrer_id
  );
  RETURN new;
END;
$$;