-- Applied to production on 2026-10-03.
-- These are trigger functions; triggers do not check EXECUTE, so revoking it only
-- removes the public /rest/v1/rpc/ endpoints that Supabase's security advisor flagged.
revoke execute on function public.validate_package_publish_ready() from anon, authenticated, public;
revoke execute on function public.validate_package_question_mapping() from anon, authenticated, public;
