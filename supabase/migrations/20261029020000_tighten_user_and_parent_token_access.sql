-- 1. Principals no longer update `users` rows directly.
--    The policy allowed changing any column of any colleague in the school, including
--    auth_id (the link to the login identity). The app never updates users with a
--    principal's session — invites, activation and status all go through API routes that
--    use the service role — so the policy is dropped rather than narrowed.
drop policy if exists users_principal_update_school_non_admin on public.users;

-- 2. One profile per login identity. app_role()/app_school_id() read `limit 1`, so a
--    second profile on the same auth_id would make a user's role ambiguous.
--    Checked on 2026-10-29: no duplicates.
create unique index if not exists users_auth_id_unique_idx
  on public.users (auth_id)
  where auth_id is not null;

-- 3. Parent report tokens: a teacher sees only the tokens of classes they teach;
--    principals and supervisors keep school-wide read. (All app reads use the service role.)
drop policy if exists parent_report_tokens_staff_school_read on public.parent_report_tokens;
create policy parent_report_tokens_staff_school_read on public.parent_report_tokens
  for select
  using (
    exists (
      select 1
      from public.users u
      where u.auth_id = auth.uid()
        and u.school_id = parent_report_tokens.school_id
        and (
          u.role in ('principal', 'supervisor')
          or (
            u.role = 'teacher'
            and exists (
              select 1 from public.classes c
              where c.id = parent_report_tokens.class_id
                and c.teacher_id = u.id
            )
          )
        )
    )
  );

-- 4. Trigger-only function: nobody needs to call it over the API.
revoke execute on function public.prevent_school_id_change() from public, anon, authenticated;
