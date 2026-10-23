# Bless-A-Family (The Konnection)

pnpm monorepo. `packages/shared` (domain types/schemas), `apps/api` (Hono, Fly.io), `apps/web` (Vite React PWA, Netlify).

- Run everything: `pnpm dev` (api :8787 seeds demo data in memory; web :5173 proxies /api).
- Checks before pushing: `pnpm typecheck && pnpm test && pnpm --filter @bless/web build`.
- Public data exposure is decided in one place: `packages/shared/src/derive.ts#toPublicFamily`. Never add guardian/address fields to `PublicFamily`.
- Airtable field names are the contract (`apps/api/src/store/airtable.ts`, `docs/AIRTABLE.md`). Status option lists must match `packages/shared/src/status.ts`.
- Follow-up policy lives in `apps/api/src/followup/engine.ts` (`nextFollowUp`, `messageKindFor`) and is unit tested; message copy in `followup/messages.ts`.
- Design is the "Bless This Family v3" prototype (Poppins, purple `--color-pri #6c22dd`, ink `#1d1133`, bg `#f6f3fb`). Tokens are Tailwind v4 `@theme` vars in `apps/web/src/styles.css`; UI kit in `apps/web/src/components/ui`. Keep new UI on those tokens.
- Decisions and open questions: `docs/DECISIONS.md`.
