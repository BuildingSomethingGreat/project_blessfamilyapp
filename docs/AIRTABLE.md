# Airtable base

Base: **Client-TheKonnection-BlessAFamily** (`apphUgu1q4Z7ya3Tw`), workspace "My First Workspace".

| Table | Purpose | Key fields |
|---|---|---|
| Families `tbl3js1wiAmOCRbia` | one application | Family ID, Season, Status, Slug, Nickname, Guardian Name, Phone, Email, Preferred Contact, Address, City, State, ZIP, Transportation, Family Story, Story Approved, Photo (attachment), Photo Approved, Photo Private, Raised, Goal, Eligibility Confirmed, Notes, Admin Notes, Views, Claim Starts, Approved At, Fulfilled At, Created At, Children (link), Sponsorships (link) |
| Children `tblXUDKq9qkmChZEv` | one wishlist per child | Name, Age, Gender, Clothing Category, Shirt Size, Pants Size, Shoe Category, Shoe Size, Size Notes, Favorite Color, Hobbies, Clothing Wishlist, Other Clothing, Gift Types, Specific Gifts, Sort Order, Family (link) |
| Sponsors `tblYFw3iGoI6sFRRV` | Holiday Konnectors (people / orgs) | Name, Email, Phone, Organization, Preferred Contact, Notes, Display Name, Wall Opt In, Wall Hidden, Created At |
| Sponsorships `tblc4mXzDOQ1n9xD3` | dominoes tracker | Sponsorship ID, Status (Claimed, Shopping, Purchased, Wrapped, Dropped Off, Delivered, Released), Token, Handoff (Drop off, Deliver directly), Claimed/Shopping/Purchased/Wrapped/Dropped Off/Delivered/Released At, Next Follow Up At, Last Nudged At, Last Response At, Follow Up Count, Flagged, Flag Reason, Release Reason, Sponsor Note, Admin Notes, Family (link), Sponsor (link) |
| Activity `tblGel7Xm39AG9kOT` | event log | Activity ID, Type, Channel, Subject, Body, Meta (JSON), Occurred At, Family (link), Sponsorship (link) |
| Quotes `tblLQKlt60IfMYFVm` | testimonials | Name (credit), Quote, Role (Holiday Konnector, Konnection family), Organization, Email (private), Status (Pending, Approved, Hidden), Featured, Season, Submitted At, Family (link), Sponsorship (link) |
| Settings `tbl2PFxmR8b4Zn2cW` | season config | Key, Value, Description |

The API maps fields **by name** (`apps/api/src/store/airtable.ts`). Renaming a field in Airtable breaks the mapping; adding fields is safe.

Status options must stay in sync with `packages/shared/src/status.ts`. The API writes with `typecast: true`, so new select values (e.g. `Purchased`, `Wrapped`, `Girl`, `Boy`, `Prefer not to say`, `chip_in`) are created on first write. The original `Confirmed`, `Male` and `Female` choices are unused and can be deleted by hand.

Settings keys: season, dropoffDeadline, dropoffLocation, dropoffHours, contactEmail, contactPhone, catalogOpen, registrationOpen, perChildBudgetNote, orgDonateUrl, chipInsEnabled, chipInUrl, showPhotos, adminAlerts, alertEmails (team email recipients; empty = ADMIN_EMAILS), contactName.

Every email is an Activity row with Type `message_sent`; Meta holds `kind`, `audience` (konnector, family, admin, test), `to`, `ok`, `error` and the Resend id. New Konnectors are saved with Preferred Contact = Email (the claim form no longer offers text).

Privacy rules the API enforces: a family photo is public only when Photo Approved is on **and** Photo Private is off; a quote is public only when Status = Approved; a Konnector's name is on the public wall only when Wall Opt In is on, Wall Hidden is off, and one of their sponsorships reached Dropped Off or Delivered. Emails in Quotes and Sponsors never leave the admin API.

Useful Airtable views to create by hand: *Families · Available* (Status = Available, sort by Approved At), *Sponsorships · Needs attention* (Flagged = ✓ or Last Response At older than 3 days), *Activity · Messages* (Type = message_sent).

## Test data
The base is prefilled with 16 fictional households (30 children), 5 sponsors and 5 sponsorships at different dominoes steps, matching `apps/api/src/lib/seed-data.ts`. Guardian names, addresses and 555 phone numbers are invented. To wipe them before the real season, delete the rows in Families, Children, Sponsors, Sponsorships and Activity (Settings stay). The same data loads automatically in local dev (memory store).
