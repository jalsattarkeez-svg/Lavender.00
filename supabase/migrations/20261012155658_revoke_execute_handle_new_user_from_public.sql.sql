-- Revoke EXECUTE on handle_new_user() from PUBLIC so anon/authenticated
-- can no longer call it via /rest/v1/rpc/handle_new_user.
-- The trigger on auth.users still works because triggers execute as the
-- function owner (SECURITY DEFINER), not through role grants.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;