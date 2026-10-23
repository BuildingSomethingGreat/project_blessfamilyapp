# Deploying

**Default: everything on Netlify.** The PWA is static and the API runs as Netlify Functions on the same site (`/api/*`), with a scheduled function running the follow-up engine every 15 minutes. One site, one set of environment variables, no second host.

**Optional: Fly.io for the API.** Use it if you want an always-on process (sub-minute follow-up ticks, long admin-assistant runs beyond the function timeout). Then point the PWA at it by replacing the `/api/*` rewrite in `netlify.toml` with a proxy to the Fly URL.

## Netlify (recommended path)
1. In Netlify, **Add new site → Import from Git**, pick this repo and the branch. `netlify.toml` already holds the build command, publish dir and functions dir.
2. **Site configuration → Environment variables**, add:

| Variable | Value |
|---|---|
| `AIRTABLE_TOKEN` | personal access token scoped to base `apphUgu1q4Z7ya3Tw` (`data.records:read`, `data.records:write`, `schema.bases:read`). Without it the API serves in-memory demo data that resets on cold starts. |
| `SESSION_SECRET` | `openssl rand -base64 48` |
| `ADMIN_EMAILS` | comma-separated admin emails |
| `ADMIN_PASSCODE` | a team passcode; lets admins sign in before an email provider exists |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional, turns on magic-link emails and sponsor follow-ups |
| `ANTHROPIC_API_KEY` | optional, enables the admin assistant and message personalization |

3. **Deploy**. The admin is at `https://<your-site>.netlify.app/admin/login`: enter an allowlisted email, then the passcode (or tap the emailed link once Resend is configured).

Limits to know: Netlify Functions time out at 10 s (26 s on request), so very long assistant answers may be cut; the in-memory store is per-instance, so set `AIRTABLE_TOKEN` for anything beyond a demo.

## 0. One-time secrets
| Where | Variable | Notes |
|---|---|---|
| Fly | `AIRTABLE_TOKEN` | Personal access token scoped to base `apphUgu1q4Z7ya3Tw` with `data.records:read`, `data.records:write`, `schema.bases:read` |
| Fly | `SESSION_SECRET` | `openssl rand -base64 48` |
| Fly | `ADMIN_EMAILS` | comma-separated admin inbox addresses |
| Fly | `RESEND_API_KEY` | from resend.com (verify the sending domain, set `EMAIL_FROM`) |
| Fly | `ANTHROPIC_API_KEY` | optional; enables the assistant and message personalization |
| Fly | `TWILIO_*` | optional; enables SMS follow-ups |
| GitHub | `FLY_API_TOKEN`, `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` | for the deploy workflow |

## Fly.io (optional, always-on API)
```bash
fly auth login
fly apps create bless-a-family-api            # name is referenced in netlify.toml and fly.toml
fly secrets set -a bless-a-family-api AIRTABLE_TOKEN=... SESSION_SECRET=... ADMIN_EMAILS=you@thekonnection.org RESEND_API_KEY=... ANTHROPIC_API_KEY=...
fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
fly logs -a bless-a-family-api
```
`fly.toml` keeps one machine running (`min_machines_running = 1`, auto-stop off) because the scheduler is in-process. Update `WEB_URL` / `CORS_ORIGINS` in `fly.toml` once you know the Netlify domain.

Seed the Airtable base with settings (and optional demo households):
```bash
AIRTABLE_TOKEN=... pnpm --filter @bless/api seed:airtable          # settings only
AIRTABLE_TOKEN=... pnpm --filter @bless/api seed:airtable -- --demo # + demo families (skips if the base has families)
```

## Pointing Netlify at Fly instead
Replace the `/api/*` rewrite in `netlify.toml` with:
```toml
[[redirects]]
  from = "/api/*"
  to = "https://bless-a-family-api.fly.dev/api/:splat"
  status = 200
  force = true
```
and set `WEB_URL` / `CORS_ORIGINS` on Fly to the Netlify domain.

## GitHub Actions
`.github/workflows/ci.yml` runs typecheck, tests and the web build on every push. `.github/workflows/deploy.yml` deploys both targets on push to `main` once the three secrets above exist.

## Local development
```bash
pnpm install
cp apps/api/.env.example apps/api/.env    # defaults run in memory with demo data and a console mailer
pnpm dev                                  # api on :8787, web on :5173 (proxies /api)
```
Admin sign-in locally: enter `admin@example.com` on /admin/login; the dev link is shown in the UI and printed in the API log.
Run the follow-up tick on demand from the Follow-ups page, or `curl -X POST localhost:8787/api/admin/followups/run` with the session cookie.

## Partner logos (landing-page marquee)
The marquee reads `apps/web/public/partners/manifest.json`. Populate it from The Konnection's donate page (run on a machine that can reach the site):
```bash
pnpm --filter @bless/web partners:fetch        # downloads logos into apps/web/public/partners and writes manifest.json
```
Review the printed list, delete anything that is not a partner logo, and commit. Until the manifest has entries the marquee falls back to the combined partner strip from thekonnection.org.

## Custom domain
Point `bless.thekonnection.org` at Netlify; the API can stay on `*.fly.dev` because it is only reached through the proxy.
