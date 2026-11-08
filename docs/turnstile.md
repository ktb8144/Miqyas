# Cloudflare Turnstile (sign-up protection)

`/signup` shows a Cloudflare Turnstile check, and `POST /api/signup` verifies its token with
Cloudflare before it looks up or creates anything (`lib/turnstile.ts`). Each token works once and
expires after 5 minutes, so the page asks for a fresh one after every failed try.

| Vercel variable | Production | Preview |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | the widget's site key (Cloudflare → Turnstile → widget "Dala signup") | `1x00000000000000000000AA` (Cloudflare test key, always passes) |
| `TURNSTILE_SECRET_KEY` | the widget's secret key (secret) | `1x0000000000000000000000000000000AA` (test key, always passes) |

- The site key is read at build time: after changing it, redeploy.
- Without `TURNSTILE_SECRET_KEY` the server check is off and without the site key the widget is
  hidden, so a deploy without keys never blocks sign-ups.
- The widget's hostnames in Cloudflare are `dalaedu.com` and `www.dalaedu.com`. To protect another
  domain, add it there.
- If Cloudflare cannot be reached the sign-up is refused with "تعذر التحقق الآن" (fails closed).
