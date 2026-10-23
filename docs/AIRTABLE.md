# Airtable base

Base: **Client-TheKonnection-BlessAFamily** (`apphUgu1q4Z7ya3Tw`), workspace "My First Workspace".

| Table | Purpose | Key fields |
|---|---|---|
| Families `tbl3js1wiAmOCRbia` | one application | Family ID, Season, Status, Slug, Nickname, Guardian Name, Phone, Email, Preferred Contact, Address, City, State, ZIP, Transportation, Family Story, Story Approved, Eligibility Confirmed, Notes, Admin Notes, Views, Claim Starts, Approved At, Fulfilled At, Created At, Children (link), Sponsorships (link) |
| Children `tblXUDKq9qkmChZEv` | one wishlist per child | Name, Age, Gender, Clothing Category, Shirt Size, Pants Size, Shoe Category, Shoe Size, Size Notes, Favorite Color, Hobbies, Clothing Wishlist, Other Clothing, Gift Types, Specific Gifts, Sort Order, Family (link) |
| Sponsors `tblYFw3iGoI6sFRRV` | people / orgs | Name, Email, Phone, Organization, Preferred Contact, Notes, Created At |
| Sponsorships `tblc4mXzDOQ1n9xD3` | dominoes tracker | Sponsorship ID, Status, Token, Claimed/Confirmed/Shopping/Dropped Off/Delivered/Released At, Next Follow Up At, Last Nudged At, Last Response At, Follow Up Count, Flagged, Flag Reason, Release Reason, Sponsor Note, Admin Notes, Family (link), Sponsor (link) |
| Activity `tblGel7Xm39AG9kOT` | event log | Activity ID, Type, Channel, Subject, Body, Meta (JSON), Occurred At, Family (link), Sponsorship (link) |
| Settings `tbl2PFxmR8b4Zn2cW` | season config | Key, Value, Description |

The API maps fields **by name** (`apps/api/src/store/airtable.ts`). Renaming a field in Airtable breaks the mapping; adding fields is safe.

Status options must stay in sync with `packages/shared/src/status.ts`.

Useful Airtable views to create by hand: *Families · Available* (Status = Available, sort by Approved At), *Sponsorships · Needs attention* (Flagged = ✓ or Last Response At older than 3 days), *Activity · Messages* (Type = message_sent).
