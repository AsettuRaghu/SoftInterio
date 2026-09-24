-- Who referred this lead.
--
-- More than 95% of this business's leads arrive as referrals - "most of our
-- customers come to us through architects" - and `lead_source` has carried
-- `architect_referral` and `client_referral` since the beginning with nowhere to
-- record WHICH architect or WHICH customer. Eight of the nineteen leads on record
-- already name one of those two sources and not one of them says who.
--
-- That is the difference between a statistic and a working relationship. The
-- reason given for wanting it is exactly right and worth keeping here: so the
-- referrer can be nudged when the customer stops answering, and thanked or paid
-- when the job closes. Neither is possible from a source code alone.
--
-- **One column, not two.** An architect and a customer are both `partners` - that
-- is what the Partners module is for, the identity above the records that hold
-- outside parties - so a single pointer serves both, and `lead_source` says which
-- kind of list to pick from. A separate `referred_by_architect_id` and
-- `referred_by_client_id` would be two columns that must never both be set.
--
-- ON DELETE SET NULL: a partner who leaves the book must not take the lead with
-- them, and the lead's `lead_source` still records that it was a referral.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS referred_by_partner_id uuid
    REFERENCES public.partners(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leads.referred_by_partner_id IS
  'The partner who referred this lead - an architect for architect_referral, a customer for client_referral. One column for both, because both are partners; lead_source says which list to choose from.';

-- The question this column exists to answer is "what has Naveen sent us?", so
-- the index is on the referrer.
CREATE INDEX IF NOT EXISTS idx_leads_referred_by
  ON public.leads (referred_by_partner_id)
  WHERE referred_by_partner_id IS NOT NULL;
