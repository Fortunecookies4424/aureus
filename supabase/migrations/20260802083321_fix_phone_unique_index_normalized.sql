-- Replace the simple phone unique index with a normalized one that catches format variants.
-- Drop the old index first, then create a computed-column-based unique index.

DROP INDEX IF EXISTS public.profiles_phone_key;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_normalized_key
  ON public.profiles (public.normalize_phone_local(phone))
  WHERE phone IS NOT NULL;