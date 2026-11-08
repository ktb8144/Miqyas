-- School stage (primary / intermediate / combined) for schools, and the stage a teacher teaches.
-- Asked at sign-up so data can be grouped by stage. Null for accounts created before this.

alter table public.schools
  add column if not exists stage text check (stage in ('primary', 'intermediate', 'combined'));

alter table public.users
  add column if not exists stage text check (stage in ('primary', 'intermediate', 'combined'));

comment on column public.schools.stage is 'primary | intermediate | combined (مجمع: ابتدائي ومتوسط)';
comment on column public.users.stage is 'For teachers: the stage they teach (primary | intermediate | combined).';
