-- One cost item table (2026-09-22, decided with the user).
--
-- `cost_items` was renamed `quotation_cost_items` long before the
-- baseline, and every stock table already points at the new name. What
-- survived under the old one was code that could never run: the Stock →
-- Cost items page and its API (deleted), the stock overview's counts
-- (re-pointed), and two functions - a PO trigger never attached to a
-- table and a seed superseded by seed_tenant_catalogue(). Both go.
--
-- The vocabulary, so the procurement and finance modules start from one
-- definition (also in CLAUDE.md):
--   rate          what we sell it at              quotation_cost_items.default_rate
--   vendor price  what a vendor charges, on a date, at a quantity - a LIST,
--                 not a column (vendor_cost is its one-number stand-in until
--                 procurement keeps the list)
--   landed cost   vendor price × unit conversion + wastage + labour;
--                 company_cost is its typed stand-in for now
--   margin        (rate − landed cost) / landed cost - computed, never typed
-- A quotation line snapshots rate and cost at copy time, and cost and
-- margin reach only holders of cost_items.pricing - both unchanged.

DROP FUNCTION IF EXISTS public.sync_cost_item_from_po();
DROP FUNCTION IF EXISTS public.seed_quotation_master_data_v2(uuid);

COMMENT ON TABLE public.quotation_cost_items IS
  'The cost item: a thing the business sells or fits, with its selling RATE (default_rate). company_cost / vendor_cost are one-number stand-ins for landed cost and the vendor price list - see the vocabulary in CLAUDE.md. Used by the catalogue, component offers, scope choices, quotation lines (which snapshot rate and cost), templates, the Design Library and stock.';
COMMENT ON COLUMN public.quotation_cost_items.default_rate IS 'The selling rate - what a quotation line is priced at.';
COMMENT ON COLUMN public.quotation_cost_items.vendor_cost IS 'Stand-in for the vendor price list: the last known buying price. Undated and vendor-less; procurement replaces it with a list.';
COMMENT ON COLUMN public.quotation_cost_items.company_cost IS 'Stand-in for landed cost: vendor price plus conversion, wastage and labour. Typed until procurement can derive it.';
