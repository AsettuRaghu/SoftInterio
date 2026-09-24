-- A customer is several people, and one of them decides.
--
-- `partner_contacts` has carried name, designation, phone, email, is_primary
-- and notes since 2026-09-17, and on this tenant there are 30 partners with
-- exactly 30 contacts - nobody has ever added a second person, because the
-- only screen to do it on is the Partners page and the person who talks to the
-- family is Sales, who holds no `partners.*` key at all.
--
-- `is_primary` is the OWNER OF THE RELATIONSHIP - who we ring. That is not the
-- same fact as who signs off the money, and in a family sale they are very
-- often different people: the wife chooses the finishes, the husband approves
-- the quotation, the father-in-law pays. A seller who cannot see which of the
-- three to get into the room is missing the thing that actually closes a deal.
--
-- **This is not a new idea, it is a resurrected one.** `LeadFamilyMember` in
-- src/types/leads.ts declares exactly this - `relation`, `is_decision_maker` -
-- against a table `lead_family_members` that **has never existed**: not in the
-- baseline, not in the database. The lead GET queried it on every page load and
-- destructured only `data`, so the error was swallowed and the page carried a
-- permanently empty list. The dead path goes in the same change as this column;
-- what it wanted is kept.
--
-- `partner_contacts` is the home rather than a per-lead table, because the
-- customer outlives the lead: the same family reappears on the project, on the
-- next flat, and eventually on the portal, where people have to hang off the
-- party and not off a sales record. `/api/partners/match` already searches
-- contact phones for this reason ("the couple who share a home give either
-- number").
--
-- Deliberately ONE boolean and no permissions model. Who may approve what is a
-- question for the customer portal, if it is ever built; inventing it now would
-- be a gate with no consumer, which is what the second preference was.

ALTER TABLE public.partner_contacts
  ADD COLUMN IF NOT EXISTS is_decision_maker boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.partner_contacts.is_decision_maker IS
  'This person signs off. Distinct from is_primary, which is who we ring - in a family sale they are usually different people. Any number of contacts may be decision makers; nothing enforces one.';

COMMENT ON COLUMN public.partner_contacts.is_primary IS
  'The owner of the relationship - who we ring. Exactly one per partner, enforced by a partial unique index. See is_decision_maker for who signs off.';

-- The existing sole contact of each partner was created from the lead form, so
-- it is both the person we ring and, until somebody says otherwise, the person
-- who decides. Leaving them all false would show every customer as having no
-- decision maker, which reads as missing data rather than as "not yet asked".
UPDATE public.partner_contacts SET is_decision_maker = true WHERE is_primary = true;
