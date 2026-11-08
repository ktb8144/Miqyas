# Claude (deep analysis)

Dala uses Claude Opus 5.5 for the two analyses that benefit most from thinking before answering.
Claude only **explains** numbers that the code has already computed; it never counts, and every
reply is checked against the data before it is shown. Only aggregated, anonymous data is sent
(no student, teacher, class or school names, and no images).

| Task | Where | How it runs | Default effort | If Claude fails |
|---|---|---|---|---|
| Weekly class report (`class_report`) | `POST /api/teacher/classes/[id]/report` | Live, streamed, up to 200 s | `high` | Gemini, then the fixed rules |
| Deep NAFS analysis (`nafs_analysis`) | `GET/POST /api/principal/nafs-analysis` | Message Batches API (no timeout, 50% cheaper), polled every 20 s by the page | `max` | The rule-based plan on the same page still shows; the principal can retry |

Code: `lib/claude.ts` (client), `lib/reports/class-report-ai.ts` (class report prompt + schema),
`lib/nafs/analysis-ai.ts` (NAFS prompt, schema, validation), `app/dashboard/principal/_components/nafs-deep-analysis.tsx` (UI).

## Turning it on

1. In the Claude Console, create an API key inside the **Dala** workspace.
2. In Vercel → Project → Settings → Environment Variables, add `ANTHROPIC_API_KEY`, then redeploy.
3. Apply the migration `supabase/migrations/20261107010000_create_nafs_analyses.sql`
   (the NAFS analysis stores its batch and result there; without it the section stays hidden).

Without `ANTHROPIC_API_KEY` everything works exactly as before (Gemini → rules).

## Settings (all optional)

| Variable | Meaning |
|---|---|
| `CLAUDE_DISABLED=true` | Switch Claude off without removing the key |
| `CLAUDE_MODEL` | Model for every task (default `claude-opus-5-5`) |
| `CLAUDE_MODEL_CLASS_REPORT`, `CLAUDE_MODEL_NAFS_ANALYSIS` | Per-task model, e.g. `claude-haiku-5-5` to cut cost later |
| `CLAUDE_EFFORT_CLASS_REPORT`, `CLAUDE_EFFORT_NAFS_ANALYSIS` | `low`, `medium`, `high`, `xhigh` or `max` |

Opus 5.5 always uses adaptive thinking; `effort` is the only depth control (manual
`budget_tokens` is rejected by the API). If you raise the class report to `xhigh`/`max`, watch
the logs: the live call stops at 200 s and falls back to Gemini.

## Watching cost

Every call logs a line `claude usage {...}` (or `claude batch usage {...}`) with input, output
(including thinking) and cache tokens. The Console's Usage page shows the same per workspace.
When the monthly credits run out the API answers "credit balance too low": the class report
falls back to Gemini/rules automatically and says so in its notice.

## Changing a prompt

The class report and NAFS prompts are in Arabic, in the `*_SYSTEM` constants. After changing the
NAFS prompt or schema, bump `NAFS_ANALYSIS_VERSION` so schools get a fresh analysis.
Do not add a schema field that asks for the model's "reasoning": Claude may refuse it. Ask for a
short explanation instead (as `why`, `likelyCause`, `evidence` do).
