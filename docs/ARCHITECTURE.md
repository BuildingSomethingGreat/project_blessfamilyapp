# Architecture

```
apps/web        Vite + React 19 + Tailwind v4 + motion   → Netlify (static PWA, /api proxied to Fly)
                design: "Bless-A-Family v3" (Poppins, Konnection purple, loader, swipe deck)
apps/api        Hono on Node 22                          → Netlify Functions (default, same site as the PWA) or Fly.io (optional always-on)
packages/shared types, zod schemas, size tables, state machines, public projection (used by both)
```

## Data model (Airtable base `apphUgu1q4Z7ya3Tw`)
- **Families** — one application. Status: Submitted → Needs Info / Available → Claimed → Fulfilled (or Withdrawn / Declined). Private contact fields. `Slug` is the unguessable public URL. `Story Approved` gates the public story, `Photo Approved` gates the optional `Photo` attachment. `Raised` / `Goal` track chip-in pledges. `Views` / `Claim Starts` are counters.
- **Children** — one wishlist per child, linked to a family.
- **Sponsors** — people/orgs, de-duplicated by email.
- **Sponsorships** — the dominoes tracker: Claimed → Shopping → Purchased → Wrapped → Dropped Off → Delivered, or Released. Carries `Token` (magic link), `Next Follow Up At`, `Follow Up Count`, `Last Response At`, `Flagged`.
- **Activity** — event log (views, claims, messages, responses, status changes, agent actions). All reports are computed from Families + Sponsorships + Activity.
- **Settings** — key/value season config (deadline, drop-off location, open/closed flags).

`packages/shared/src/derive.ts#toPublicFamily` is the single place that decides what the public can see.

## Request flow
- Public: `GET /api/families` (catalog), `GET /api/families/:slug`, `POST /api/families/:slug/claim`, `POST /api/families/:slug/chip-in` (pledge + external checkout URL), `POST /api/register` (may carry a `photoDataUrl`), `GET /api/settings`.
- Sponsor magic link: `GET /api/sponsor/:token`, `POST /api/sponsor/:token/status`, `POST /api/sponsor/:token/note`.
- Admin (cookie session): `/api/admin/*` — report, families, sponsorships, nudge, settings, export.csv, followups/run, assistant.

## Follow-up engine (`apps/api/src/followup`)
`engine.ts` holds the policy (`nextFollowUp`, `messageKindFor`) and the tick. The scheduler runs in-process every 10 minutes. Templates live in `messages.ts`; if `ANTHROPIC_API_KEY` is set the body is rewritten by Claude in a warmer voice with a hard rule to keep every fact and link, and it falls back to the template on any failure. Sponsors respond by tapping the next domino on their family page; that resets the counter. After `FOLLOWUP_FLAG_AFTER` unanswered nudges the sponsorship is flagged for an admin.

## Admin assistant (`apps/api/src/agent/admin-agent.ts`)
A manual tool-use loop over the store with eight tools (report, list/get families, list sponsorships, send nudge, update sponsorship, update family, draft). Writes are logged as `agent_action`. Releasing a family requires an explicit `confirmed=true`, and the system prompt tells the model to ask first. Conversations are kept in memory per machine for six hours.

## Store adapters
`Store` interface in `apps/api/src/store/types.ts`. `MemoryStore` (JSON file; seeds demo data) for local dev and tests, `AirtableStore` for production (photos go through Airtable's content upload API into the `Photo` attachment field). A Postgres/Supabase adapter is the planned next step when Airtable's rate limits or lack of transactions bite.

## Security notes
- Public endpoints never return guardian names, addresses, phone numbers, or unapproved stories.
- Claims are serialized per family in-process; the API runs as a single Fly machine on purpose.
- Admin sessions: HMAC-signed, HttpOnly, SameSite=Lax cookie; magic links expire in 15 minutes; the request endpoint does not reveal whether an email is an admin.
- Light per-IP rate limits on register and claim.
