# Airtable base

Base: **Client-TheKonnection-BlessAFamily** (`apphUgu1q4Z7ya3Tw`), workspace "My First Workspace".

| Table | Purpose | Key fields |
|---|---|---|
| Families `tbl3js1wiAmOCRbia` | one application | Family ID, Season, Status, Slug, Nickname, Guardian Name, Phone, Email, Preferred Contact, Address, City, State, ZIP, Transportation, Family Story, Story Approved, Photo (attachment), Photo Approved, Raised, Goal, Eligibility Confirmed, Notes, Admin Notes, Views, Claim Starts, Approved At, Fulfilled At, Created At, Children (link), Sponsorships (link) |
| Children `tblXUDKq9qkmChZEv` | one wishlist per child | Name, Age, Gender, Clothing Category, Shirt Size, Pants Size, Shoe Category, Shoe Size, Size Notes, Favorite Color, Hobbies, Clothing Wishlist, Other Clothing, Gift Types, Specific Gifts, Sort Order, Family (link) |
| Sponsors `tblYFw3iGoI6sFRRV` | people / orgs | Name, Email, Phone, Organization, Preferred Contact, Notes, Created At |
| Sponsorships `tblc4mXzDOQ1n9xD3` | dominoes tracker | Sponsorship ID, Status (Claimed, Shopping, Purchased, Wrapped, Dropped Off, Delivered, Released), Token, Claimed/Shopping/Purchased/Wrapped/Dropped Off/Delivered/Released At, Next Follow Up At, Last Nudged At, Last Response At, Follow Up Count, Flagged, Flag Reason, Release Reason, Sponsor Note, Admin Notes, Family (link), Sponsor (link) |
| Activity `tblGel7Xm39AG9kOT` | event log | Activity ID, Type, Channel, Subject, Body, Meta (JSON), Occurred At, Family (link), Sponsorship (link) |
| Settings `tbl2PFxmR8b4Zn2cW` | season config | Key, Value, Description |

The API maps fields **by name** (`apps/api/src/store/airtable.ts`). Renaming a field in Airtable breaks the mapping; adding fields is safe.

Status options must stay in sync with `packages/shared/src/status.ts`. The API writes with `typecast: true`, so new select values (e.g. `Purchased`, `Wrapped`, `Girl`, `Boy`, `Prefer not to say`, `chip_in`) are created on first write. The original `Confirmed`, `Male` and `Female` choices are unused and can be deleted by hand.

Settings keys: season, dropoffDeadline, dropoffLocation, dropoffHours, contactEmail, contactPhone, catalogOpen, registrationOpen, perChildBudgetNote, orgDonateUrl, chipInsEnabled, chipInUrl, showPhotos.

Useful Airtable views to create by hand: *Families · Available* (Status = Available, sort by Approved At), *Sponsorships · Needs attention* (Flagged = ✓ or Last Response At older than 3 days), *Activity · Messages* (Type = message_sent).

## Test data
The base is prefilled with 16 fictional households (30 children), 5 sponsors and 5 sponsorships at different dominoes steps, matching `apps/api/src/lib/seed-data.ts`. Guardian names, addresses and 555 phone numbers are invented. To wipe them before the real season, delete the rows in Families, Children, Sponsors, Sponsorships and Activity (Settings stay). The same data loads automatically in local dev (memory store).
