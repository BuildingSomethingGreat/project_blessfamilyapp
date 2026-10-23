# Decisions and pushback

Short record of where the build deliberately departs from the brief, and why. Each one is reversible.

## 1. Sponsors claim a family; the app does not take money
The brief mentions "donate" and a GoFundMe feel. The demo HTML, and the program as described, is an **adoption** model: a sponsor takes on a whole household and buys the wishlist. Adding card payments means Stripe onboarding for the nonprofit, PCI scope, refunds, and receipts for tax purposes. None of that is needed for the core pain point (follow-up). So:
- The catalog reads like a store, but the call to action is "Bless this family", not "Donate".
- A "Can't take on a whole family?" card links to the org's existing general-fund page (`orgDonateUrl` in Settings).
- If you later want partial giving (e.g. "cover one child" or "chip in $50"), that is a new flow; the data model already keeps children as separate records so it can be added without a migration.

## 2. No photos of children, anywhere
The inspiration shots are photo-heavy. For a public catalog of minors' wishlists that is a safeguarding and consent problem, and it would also make families self-conscious about applying. Instead every family gets abstract "family art": a gradient generated from the kids' favorite colors. It is distinctive, warm, and fully private. Public cards show first names, ages, sizes, wishes, city, and a short story the family wrote and an admin approved. Never a surname, address, or guardian name.

## 3. Typeform-style, but children are grouped into a few screens
One question per screen is great for the household info (and it's built that way). For children it would be brutal: three kids × 15 fields = 45 screens. So each child is a short group of 5 screens (who, sizes, interests, clothing, gifts). Progress is saved to the device so a parent can stop and resume.

## 4. Family nicknames instead of "Family BF-014"
Codes are cold and stories need a subject. Each family gets a derived, non-identifying nickname ("The Bright Builders") based on the kids' interests. Admins can override it.

## 5. The follow-up system flags, it never auto-releases
The dominoes engine nudges sponsors on a schedule (48h to confirm, check-ins every 5 days, tighter as the deadline nears). After two unanswered nudges it **flags** the sponsorship for a human and stops. Automatically reopening a family that someone may already be shopping for is a worse failure than a day of admin delay. Release is one click in the admin, with a reason, and it notifies the sponsor.

## 6. Email first, SMS optional, no gamification
Email via Resend is the default because it needs no carrier approval. Twilio SMS is wired behind a flag because texts get better response rates from sponsors who chose "Text". The "points" and social-feed ideas from the first inspiration shot don't fit a nonprofit holiday program; the equivalent motivation here is the live "families waiting / blessed" counter and the thank-you emails that close the loop.

## 7. Airtable now, Postgres (Supabase) when it hurts
Airtable is the system of record for this season because admins already use it and get a spreadsheet UI for free. The API talks to it through one adapter (`apps/api/src/store/airtable.ts`) behind a `Store` interface, with a short read cache to stay under Airtable's 5 req/s. Known limits: no transactions (the API serializes claims in-process; Fly runs one machine), and reporting gets slow past a few thousand activity rows. When that bites, the recommendation is **Supabase (Postgres)**, not Firebase: the data is relational (families → children → sponsorships → activity), reports are SQL, and row-level security covers the public/admin split. Implementing `Store` for Postgres is a contained job.

## 8. One backend on Fly, static PWA on Netlify
Rather than splitting CRUD into Netlify Functions and the agent onto Fly, everything server-side is one Hono process on Fly: the REST API, the follow-up scheduler, and the Claude admin assistant. Netlify serves the PWA and proxies `/api/*` to Fly so cookies stay same-origin and the service worker can cache public endpoints.

## 9. Admin sign-in is a magic link
No passwords to manage. Admin emails are an allowlist in the API environment; a sign-in link lands in their inbox and sets a two-week HttpOnly cookie.

## Open questions for The Konnection
- Drop-off logistics: one location? Should sponsors book a slot?
- Do you want families to be able to update a wishlist after submitting (today: contact staff)?
- Should a sponsor be able to claim more than one family in one go (organizations often do)?
- Text message follow-ups: worth a Twilio number this season?
- Brand assets: I could not reach thekonnection.org from the build environment, so the palette (cream, ink, ember, pine, gold) is a proposal. Swap the tokens in `apps/web/src/styles.css`.
