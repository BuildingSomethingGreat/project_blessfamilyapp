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

## 6. Email only, no gamification
Every message goes out by email through Resend: it needs no carrier approval and one channel keeps the log complete. Holiday Konnectors no longer choose text vs email; the claim form asks them to confirm updates come by email, and still records a phone for urgent delivery questions (it's in the sponsors CSV). All emails share one layout (`apps/api/src/notify/render.ts`: lavender page, white rounded card, bold Poppins headline, purple pill button) and every send, success or failure, is written to Activity as `message_sent` and shown in Admin → Emails. Sign-in links are redacted from the log. The "points" and social-feed ideas from the first inspiration shot don't fit a nonprofit holiday program; the equivalent motivation here is the live "families waiting / blessed" counter and the thank-you emails that close the loop.

## 7. Airtable now, Postgres (Supabase) when it hurts
Airtable is the system of record for this season because admins already use it and get a spreadsheet UI for free. The API talks to it through one adapter (`apps/api/src/store/airtable.ts`) behind a `Store` interface, with a short read cache to stay under Airtable's 5 req/s. Known limits: no transactions (the API serializes claims in-process; Fly runs one machine), and reporting gets slow past a few thousand activity rows. When that bites, the recommendation is **Supabase (Postgres)**, not Firebase: the data is relational (families → children → sponsorships → activity), reports are SQL, and row-level security covers the public/admin split. Implementing `Store` for Postgres is a contained job.

## 8. One backend on Fly, static PWA on Netlify
Rather than splitting CRUD into Netlify Functions and the agent onto Fly, everything server-side is one Hono process on Fly: the REST API, the follow-up scheduler, and the Claude admin assistant. Netlify serves the PWA and proxies `/api/*` to Fly so cookies stay same-origin and the service worker can cache public endpoints.

## 9. Admin sign-in is a magic link
No passwords to manage. Admin emails are an allowlist in the API environment; a sign-in link lands in their inbox and sets a two-week HttpOnly cookie.

## 10. Festive decor is a layer system, not page chrome
The holiday framing on the home page and Find a family page (`apps/web/src/components/festive`) is three layers: a back layer (CSS bokeh, blurred props, fine snow), the real content, and a front layer (sharp props, large soft snow) that overlaps the UI but is `pointer-events: none` and `aria-hidden`. Depth comes from blur, per-prop parallax rates, and the two snow canvases. Props are transparent PNGs in `apps/web/public/festive` (ornament with the K monogram, pine branch with lights, gifts, lantern, snowflake), generated for this project and quantized to keep the whole set under 400 KB. Everything respects `prefers-reduced-motion`, and the snow pauses off-screen and in hidden tabs. Below the `lg` breakpoint the sharp branches move behind the content so the headline and pill stay clear on phones.

## 11. "Holiday Konnectors", and how gifts reach a family
Public copy calls gift givers **Holiday Konnectors**; the code, API and Airtable keep the word "sponsor" so the data contract didn't churn. A Konnector chooses on the claim form whether to **drop off** at the drop-off site (we deliver) or **deliver directly**. Direct delivery never reveals the family's address on the site: staff see the choice in admin and connect the two privately. Gift rules (wrap, label with the child's name, gift receipt for clothing, same number of gifts per child) are repeated on the family page, the claim form, the Konnector page and the emails.

## 12. Quotes and the Wall of Holiday Konnectors are moderated
Testimonials come from `/share` (anyone) and from the Konnector page after hand-off, and always land as **Pending**; staff approve, hide, edit or feature them in Admin → Community, or add one they received by text. The Wall thanks Konnectors who opted in, and only after their gifts are handed off, so drive-by names can't appear; staff can hide or rename any entry. Default credit is first name + last initial.

## 13. Family photos are off by default
The application no longer asks for a photo unless an admin turns on "Ask families for a photo". When it's on, families can skip it or keep the photo staff-only; staff can still hide any photo per family.

## 14. Airtable is the right store for this season
At a few hundred families and a few thousand activity rows, Airtable's 5 requests/second limit is comfortable with the 20-second read cache, and staff get a spreadsheet for free. The base stays multi-table (Families, Children, Sponsors, Sponsorships, Quotes, Activity, Settings) because one flat table can't hold several children and a claim history per family. The live API refuses writes in production if Airtable isn't connected, rather than accepting data into a throwaway store.

## Open questions for The Konnection
- Direct delivery: should staff share the family's address with the Konnector, or meet them at the family's door?
- Do you want families to be able to update a wishlist after submitting (today: contact staff)?
- Should a sponsor be able to claim more than one family in one go (organizations often do)?
- Brand assets: I could not reach thekonnection.org from the build environment, so the palette (cream, ink, ember, pine, gold) is a proposal. Swap the tokens in `apps/web/src/styles.css`.

## Konnector log in
The public nav's purple button is **Sponsor log in**, for Holiday Konnectors only. We email a one-tap link to `/login?token=…` (30 minutes) that sets a 60-day `bf_konnector` cookie. Any other email, including a staff email, gets a "Doesn't look like you're a sponsor yet" email that points to the catalog. The response is the same either way, so the form can't be used to look people up. Staff sign in only through the privately shared `/admin/login`. Claiming a family also signs the Konnector in on that device. Once signed in, the button becomes "Hi, {first name}" and opens `/my-family`: one family opens its page directly, several show a list. The private family link (`/s/:token`) still works on its own.

When a signed-in Konnector blesses another family, the claim form is prefilled from their account but stays fully editable. Their account keeps its original details (blank phone or organization get filled in). Anything different for this family (another organization, a different name or phone) is written to that sponsorship's Admin Notes and shown in the team's claim email.

## Team alerts
Team emails go to **Settings → Team emails** (comma-separated, stored as the `alertEmails` setting, never returned by the public settings endpoint). When that is empty they go to everyone in `ADMIN_EMAILS`. Konnector updates (shopping, purchased, wrapped, handed off, released) and the notes they leave are key updates and always go out. New applications, claims, flagged Konnectors and the follow-up summary follow the **Also email activity** toggle (`adminAlerts`).

Email footers say "Questions? Email {contactName} at {contactEmail}" (Settings → Contact name, default Sharnese) instead of asking people to reply. Reply-To still points at the contact email in case someone replies anyway.

## Legal page
`/legal` (also `/privacy`, `/terms`) holds the Privacy Policy and Terms of Use in plain language, written from what the app actually does: the fields we collect, what is public, the vendors (Airtable, Netlify, Resend, Zeffy, Google Fonts, Anthropic for the staff assistant), no analytics or ad trackers, IPs used only in memory for spam and rate limits, Michigan law. The contact is the season contact email (Sharnese). It is linked from the site footers, the claim and registration forms, and every email footer. The text lives in `apps/web/src/pages/public/Legal.tsx`. Update it, and the effective date, whenever data handling changes (new fields, vendors or public surfaces).

Open: have counsel review before launch, especially retention (we say up to three years), tax language (no 501(c)(3) claim or EIN is stated), and whether direct-delivery Konnectors ever receive a family's address.

## Family nicknames
Every family shows publicly under a nickname. The application suggests one from the kids' gift interests and hobbies ("The Merry Builders"); the family can keep it, shuffle for another, or write their own before submitting. Admins can rename from the review queue or the family page, and the assistant can too. Because the nickname is public, `nicknameProblem` (`packages/shared/src/derive.ts`) rejects the parent's name, the children's last names, runs of 3+ digits (addresses, phone numbers) and unusual characters; the API enforces it on registration and on every rename, and the web field checks it live. Children's first names are already public, so they're allowed. An empty nickname falls back to the suggestion.

## Loading screen
The once-per-session loader deals last season's campaign photos (`PHOTOS.campaign`) onto the dark "table" like cards, with snow behind and in front, above the "Bless this family." reveal and counter. Reduced-motion users get the cards without the deal animation and no snow.

## Partner logos
The landing marquee shows the 25 partner logos from https://www.thekonnection.org/donate ("And join our other amazing partners."), saved as small copies in `apps/web/public/partners/` with `manifest.json`. Refresh them with `pnpm --filter @bless/web partners:fetch` (it picks gallery images whose alt text ends in "logo", skips The Konnection's own, and replaces the old set). In a cloud session run it as `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt pnpm --filter @bless/web partners:fetch` with `www.thekonnection.org` and `static.wixstatic.com` allowed. Logos stay grayscale and faded, and go full color on hover.
