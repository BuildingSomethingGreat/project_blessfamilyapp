# Bless-A-Family (The Konnection)

pnpm monorepo. `packages/shared` (domain types/schemas), `apps/api` (Hono, Fly.io), `apps/web` (Vite React PWA, Netlify).

- Run everything: `pnpm dev` (api :8787 seeds demo data in memory; web :5173 proxies /api).
- Checks before pushing: `pnpm typecheck && pnpm test && pnpm --filter @bless/web build`.
- Public data exposure is decided in one place: `packages/shared/src/derive.ts#toPublicFamily`. Never add guardian/address fields to `PublicFamily`.
- Airtable field names are the contract (`apps/api/src/store/airtable.ts`, `docs/AIRTABLE.md`). Status option lists must match `packages/shared/src/status.ts`.
- Email: every message goes through `apps/api/src/notify/mailer.ts` (Resend via `RESEND_API_KEY` / `RESEND_EMAIL`, console otherwise), renders with `notify/render.ts`, and is logged as `message_sent` (Admin → Emails). Konnectors are email-only. Await sends in request handlers (serverless).
- Follow-up policy lives in `apps/api/src/followup/engine.ts` (`nextFollowUp`, `messageKindFor`) and is unit tested; message copy in `followup/messages.ts`.
- Design is the "Bless-A-Family v3" prototype (Poppins, purple `--color-pri #6c22dd`, ink `#1d1133`, bg `#f6f3fb`). Tokens are Tailwind v4 `@theme` vars in `apps/web/src/styles.css`; UI kit in `apps/web/src/components/ui`. Keep new UI on those tokens.
- Festive decor (branches, ornament, gifts, lantern, snow) lives in `apps/web/src/components/festive` with PNGs in `apps/web/public/festive`; it is decorative only (`aria-hidden`, `pointer-events-none`) and must never cover interactive UI.
- Public copy calls sponsors "Holiday Konnectors"; code and Airtable keep `sponsor`. Admin calls the board "Sponsors" (`/admin/sponsors`, CSV at `/api/admin/sponsors.csv`). Konnectors log in by magic link ("Sponsor log in", `routes/account.ts`, `/login`); staff only via the private `/admin/login`. Team emails go to Settings → Team emails (`alertEmails`, never public), falling back to `ADMIN_EMAILS`. Quotes and the Konnector wall are moderated (`/admin/community`).
- Production never seeds demo data and returns 503 on writes without Airtable (`apps/api/src/app.ts`).
- Privacy Policy and Terms live in `apps/web/src/pages/public/Legal.tsx` (`/legal`). If you add a field, vendor or public surface, update them and the effective date.
- Decisions and open questions: `docs/DECISIONS.md`.
