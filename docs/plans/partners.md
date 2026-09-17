# Partners

Status: **plan, phase 1 being built** · 2026-09-17 · v1, plain language

Everyone a business works with, in one place: the customers it builds for,
the factories and distributors it buys from, the architects who bring it
work, the producers it commissions. One record per outside party, with the
roles it plays for this business, and the people at it.

## 1. Four words

| Word | Plain meaning |
|---|---|
| **Partner** | An outside party this business works with - a person or an organisation. One record, however many hats it wears. |
| **Type** | A hat: Customer, Architect, Interior Factory / OEM, Distributor, Producer, Contractor… A partner can wear several. The list is shipped and a business can add its own. |
| **Contact** | A person at a partner: the couple who own the flat, the site engineer at the factory, the accounts person at the distributor. Every partner has one **primary** contact - its owner. |
| **Platform identity** | The party's *own* account on SoftInterio, when they have one. Ours to point at, never ours to own. Empty today. |

## 2. The idea in one paragraph

A partner is **who this party is to us**. Our notes, our roles for them, our
purchase orders with them, the delays they cost us. The same factory is a
different partner record in every business that deals with it, and that is
right - each business's record is its own. When the factory gets its own
SoftInterio account, every one of those records can point at it; that
pointer is the start of the ecosystem (a customer's portal, ratings,
inspections, learning), and it lives on the platform side, not in any
business's data. Nothing is shared by default; what is shared later is
explicit.

## 3. Same person, twice

A returning customer must not become a second record. **Within a business,
the phone number says "same person"**; the email is a second hint; a name on
its own is never enough. When a new lead or a standalone quotation is being
typed and the phone matches, the form offers the existing partner - "This is
Amulya, 2 previous projects - use her?" - and creates a new one only when
nothing matches. Identifiers are designed as a list (phone, email, later a
platform identity), so adding one is not a rebuild.

*(The test data has 15 customers on one phone number, 1234567890. They are
kept as they are - one partner each - so testing is not disturbed; the rule
applies to what is created from now on.)*

## 4. What exists already, and what is added

Customers already exist as `clients` (every lead creates one) and vendors as
`stock_vendors` (with purchase orders). Neither is thrown away. A **partner**
row is created above each, and both point at it (`partner_id`). Leads,
projects, quotations and purchase orders keep working untouched.

Added: `partners`, `partner_types` (shipped + tenant), the link between
them, `partner_contacts`. Permissions: the existing `clients.*` keys are
what Partners is gated on - they were the customer keys and this is the
customer module grown up.

## 5. Where it lives

A top-level menu **Partners**, with one sub-item per type: Customers,
Architects, Interior Factory / OEM, Distributors, Producers, Contractors.
All lists share the app's list shape (name in bold, what-it-is beneath,
pills, plain dates). One detail page for every partner, its tabs depending
on the hats it wears: Overview · Contacts · Leads & Projects (customer) ·
Quotations (any - including the ones we issue on a vendor's behalf) ·
Purchase orders (vendor) · Delays (vendor - where their lateness landed) ·
Notes · Timeline.

## 6. What connects, and when

| Phase | What |
|---|---|
| **1 - now** | The identity layer; the lists and the detail page; *choose existing* on a new lead and on a standalone quotation. |
| **2** | Everything that names an outside party points at a partner: the project step's *Done by: vendor* names which; "waiting on" and a hold's *who exactly* become partners; a standalone quotation is *on behalf of* a partner; the delay log answers "days lost per vendor". |
| **3** | Platform identities: invitations, a customer's own portal, ratings, add-on services. A separate module with its own tables and rules; the partner record only points at it. |

## 7. Decisions taken

- Phone is the identity within a business; email second; identifiers are a list.
- Every partner has one primary contact, and may have many.
- Clients and Stock → Vendors move under Partners; one home per record.
- Money on partners (credit, outstanding) waits for the finance module.
