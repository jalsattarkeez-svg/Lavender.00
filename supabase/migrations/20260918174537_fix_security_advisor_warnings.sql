/*
# Fix security advisor warnings

1. Set search_path on update_updated_at function to prevent search_path mutable warning.
2. Revoke EXECUTE on handle_new_user from anon and authenticated roles — it should only be called by the trigger, not via the REST API.
*/

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
