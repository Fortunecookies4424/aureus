-- Normalize both input and stored phones to local 11-digit format before comparison.
-- Handles: 234XXXXXXXXX → 0XXXXXXXXX, 0XXXXXXXXX unchanged, XXXXXXXXXX → 0XXXXXXXXX

CREATE OR REPLACE FUNCTION public.normalize_phone_local(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(regexp_replace(p_phone, '[^0-9]', '', 'g')) = 13
         AND regexp_replace(p_phone, '[^0-9]', '', 'g') LIKE '234%'
      THEN '0' || substr(regexp_replace(p_phone, '[^0-9]', '', 'g'), 4)
    WHEN length(regexp_replace(p_phone, '[^0-9]', '', 'g')) = 10
      THEN '0' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    ELSE regexp_replace(p_phone, '[^0-9]', '', 'g')
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_phone_taken(p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone IS NOT NULL
      AND public.normalize_phone_local(phone) = public.normalize_phone_local(p_phone)
  );
$$;