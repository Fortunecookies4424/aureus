-- Make is_phone_taken robust against different phone formats (local vs international)
-- by normalizing both the input and stored phones to digits-only before comparing.

CREATE OR REPLACE FUNCTION public.is_phone_taken(p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone IS NOT NULL
      AND regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
  );
$$;