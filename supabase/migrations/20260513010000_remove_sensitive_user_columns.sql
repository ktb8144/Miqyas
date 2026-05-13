-- Remove legacy sensitive columns from public.users.
-- Authentication is handled exclusively by Supabase Auth.

alter table public.users
  drop column if exists password,
  drop column if exists whatsapp_key;

notify pgrst, 'reload schema';
