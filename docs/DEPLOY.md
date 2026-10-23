# Deploying

Two targets: the API on **Fly.io** (always-on process that also runs the follow-up scheduler and the admin assistant) and the PWA on **Netlify** (static, proxies `/api/*` to Fly).

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

## 1. Fly.io (API)
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

## 2. Netlify (PWA)
```bash
npx netlify-cli login
npx netlify-cli sites:create --name bless-a-family   # or create in the dashboard, then `netlify link`
npx netlify-cli deploy --prod --build
```
Or connect the GitHub repo in the Netlify dashboard; `netlify.toml` already holds the build command and the `/api/*` proxy to `https://bless-a-family-api.fly.dev`. If you rename either app, update that redirect and `WEB_URL` / `CORS_ORIGINS` on Fly.

## 3. GitHub Actions
`.github/workflows/ci.yml` runs typecheck, tests and the web build on every push. `.github/workflows/deploy.yml` deploys both targets on push to `main` once the three secrets above exist.

## Local development
```bash
pnpm install
cp apps/api/.env.example apps/api/.env    # defaults run in memory with demo data and a console mailer
pnpm dev                                  # api on :8787, web on :5173 (proxies /api)
```
Admin sign-in locally: enter `admin@example.com` on /admin/login; the dev link is shown in the UI and printed in the API log.
Run the follow-up tick on demand from the Follow-ups page, or `curl -X POST localhost:8787/api/admin/followups/run` with the session cookie.

## Custom domain
Point `bless.thekonnection.org` at Netlify; the API can stay on `*.fly.dev` because it is only reached through the proxy.
