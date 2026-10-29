# Bless-A-Family · The Konnection

A PWA for The Konnection's holiday giving program. Families in the organization share what their kids need; sponsors pick a whole household from a public catalog; the system does the follow-up so staff don't have to.

- **Families**: a one-question-at-a-time application (`/register`) with the full wishlist per child, saved to the device as you go.
- **Sponsors**: a swipe-or-grid catalog (`/families`) with short family stories, one-tap claim, optional chip-ins, and a private family page (`/s/:token`) with the six-step dominoes tracker.
- **Admins**: dashboard with the reports that matter (families left, follow-up response rate, overdue sponsors, matching, views), one-click nudges and releases, a Claude-powered assistant that answers questions and takes actions, and CSV export.
- **Follow-up engine**: automatic, deadline-aware email nudges (Resend, logged in Admin → Emails); flags unresponsive sponsors for a human instead of auto-releasing.

Design: the "Bless-A-Family v3" prototype (Konnection purple, Poppins, loading page). Stack: React 19 + Vite + Tailwind v4 + motion (Netlify) · Hono on Node 22 (Fly.io) · Airtable now, Postgres later · Claude for the assistant.

```bash
pnpm install && pnpm dev      # web http://localhost:5173, api :8787 with demo data
pnpm test && pnpm typecheck
pnpm reset:data               # wipe the local demo data; it reseeds on the next pnpm dev
```

Deployed: connect the repo to Netlify and set the env vars listed in `netlify.toml` (the API ships as Netlify Functions on the same site). Admin: http://localhost:5173/admin/login — enter `admin@example.com` (the default `ADMIN_EMAILS`); in local dev the sign-in link is shown right on the page. In production the admin lives at `https://<your-netlify-domain>/admin/login` and only emails listed in the API's `ADMIN_EMAILS` can sign in.

Docs: [Architecture](docs/ARCHITECTURE.md) · [Deploy](docs/DEPLOY.md) · [Airtable](docs/AIRTABLE.md) · [Decisions & pushback](docs/DECISIONS.md)
