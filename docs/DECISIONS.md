# Decisions and pushback

> **October 23 update — v3 redesign.** The product now follows the "Bless This Family v3" prototype (purple Konnection palette, Poppins, loading page, swipe deck). Three earlier decisions changed with it: chip-ins exist (as pledges that hand off to the org's existing Zeffy checkout, see §1), families may opt in to a photo that staff approve before it shows (§2), and the dominoes have six steps (Claimed → Shopping → Purchased → Wrapped → Dropped Off → Delivered). Everything else below still holds.

Short record of where the build deliberately departs from the brief, and why. Each one is reversible.

## 1. Sponsors claim a family; the app does not take money
The brief mentions "donate" and a GoFundMe feel. The demo HTML, and the program as described, is an **adoption** model: a sponsor takes on a whole household and buys the wishlist. Adding card payments means Stripe onboarding for the nonprofit, PCI scope, refunds, and receipts for tax purposes. None of that is needed for the core pain point (follow-up). So:
- The catalog reads like a store, but the call to action is "Bless this family", not "Donate".
- A "Can't take on a whole family?" card links to the org's existing general-fund page (`orgDonateUrl` in Settings).
- **v3 adds "Chip in"** on each family page. The app records the pledge (amount, fee cover, email) against the family and opens the external checkout in `chipInUrl` (today: The Konnection's Zeffy form, prefilled with the amount and a note naming the family). The app never touches card data. Reconciling Zeffy payouts to families is manual until a Stripe Connect/Zeffy webhook is wired; `Raised` on the family is the pledged amount, not confirmed cash. Turn it off with `chipInsEnabled` in Settings.
- If you later want partial giving (e.g. "cover one child" or "chip in $50"), that is a new flow; the data model already keeps children as separate records so it can be added without a migration.

## 2. Photos are opt-in, consented, and staff-approved
Public cards default to "family art", a gradient generated from the kids' favorite colors, so a family with no photo never looks like the odd one out. In v3 a family may add one photo during the application ("a doorway, hands, a holiday table — faces are optional"). It stays private until an admin ticks **Photo Approved** in the review queue, where the checklist reminds staff not to publish faces of minors without the consent box. `showPhotos` in Settings hides every photo at once. Never a surname, address, or guardian name, with or without a photo.

## 3. Typeform-style, but children are grouped into a few screens
One question per screen is great for the household info (and it's built that way). For children it would be brutal: three kids × 15 fields = 45 screens. So each child is a short group of 5 screens (who, sizes, interests, clothing, gifts). Progress is saved to the device so a parent can stop and resume.

## 4. Family nicknames instead of "Family BF-014"
Codes are cold and stories need a subject. Each family gets a derived, non-identifying nickname ("The Bright Builders") based on the kids' interests. Admins can override it.

## 5. The follow-up system flags, it never auto-releases
The dominoes engine nudges sponsors on a schedule (48h after a claim if they haven't started shopping, then every 5 days while shopping/purchased/wrapped, daily inside the last week). After two unanswered nudges it **flags** the sponsorship for a human and stops. Automatically reopening a family that someone may already be shopping for is a worse failure than a day of admin delay. Release is one click in the admin, with a reason, and it notifies the sponsor.

## 6. Email first, SMS optional, no gamification
Email via Resend is the default because it needs no carrier approval. Twilio SMS is wired behind a flag because texts get better response rates from sponsors who chose "Text". The "points" and social-feed ideas from the first inspiration shot don't fit a nonprofit holiday program; the equivalent motivation here is the live "families waiting / blessed" counter and the thank-you emails that close the loop.

## 7. Airtable now, Postgres (Supabase) when it hurts
Airtable is the system of record for this season because admins already use it and get a spreadsheet UI for free. The API talks to it through one adapter (`apps/api/src/store/airtable.ts`) behind a `Store` interface, with a short read cache to stay under Airtable's 5 req/s. Known limits: no transactions (the API serializes claims in-process; Fly runs one machine), and reporting gets slow past a few thousand activity rows. When that bites, the recommendation is **Supabase (Postgres)**, not Firebase: the data is relational (families → children → sponsorships → activity), reports are SQL, and row-level security covers the public/admin split. Implementing `Store` for Postgres is a contained job.

## 8. One backend on Fly, static PWA on Netlify
Rather than splitting CRUD into Netlify Functions and the agent onto Fly, everything server-side is one Hono process on Fly: the REST API, the follow-up scheduler, and the Claude admin assistant. Netlify serves the PWA and proxies `/api/*` to Fly so cookies stay same-origin and the service worker can cache public endpoints.

## 9. Admin sign-in is a magic link
No passwords to manage. Admin emails are an allowlist in the API environment; a sign-in link lands in their inbox and sets a two-week HttpOnly cookie.

## 10. Festive decor is a layer system, not page chrome
The holiday framing on the home page and Find a family page (`apps/web/src/components/festive`) is three layers: a back layer (CSS bokeh, blurred props, fine snow), the real content, and a front layer (sharp props, large soft snow) that overlaps the UI but is `pointer-events: none` and `aria-hidden`. Depth comes from blur, per-prop parallax rates, and the two snow canvases. Props are transparent PNGs in `apps/web/public/festive` (ornament with the K monogram, pine branch with lights, gifts, lantern, snowflake), generated for this project and quantized to keep the whole set under 400 KB. Everything respects `prefers-reduced-motion`, and the snow pauses off-screen and in hidden tabs. Below the `lg` breakpoint the sharp branches move behind the content so the headline and pill stay clear on phones.

## Open questions for The Konnection
- Drop-off logistics: one location? Should sponsors book a slot?
- Do you want families to be able to update a wishlist after submitting (today: contact staff)?
- Should a sponsor be able to claim more than one family in one go (organizations often do)?
- Text message follow-ups: worth a Twilio number this season?
- Brand assets: I could not reach thekonnection.org from the build environment, so the palette (cream, ink, ember, pine, gold) is a proposal. Swap the tokens in `apps/web/src/styles.css`.
