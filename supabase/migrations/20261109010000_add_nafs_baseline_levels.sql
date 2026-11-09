-- Share of students at each performance level (e.g. مرتفع / متوسط / منخفض / منخفض جدًا), as
-- printed in the school's NAFS report: [{ "name": text, "percent": numeric }], highest level first.
-- Filled when the principal uploads the report (PDF or photos) or edits it by hand.
-- The app works without this column (lib/nafs/baseline-db.ts falls back), so it can be applied any time.

alter table public.nafs_baselines
  add column if not exists levels jsonb not null default '[]'::jsonb
  check (jsonb_typeof(levels) = 'array');
