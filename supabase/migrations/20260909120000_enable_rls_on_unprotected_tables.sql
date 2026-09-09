-- Six tables never had row level security switched on at all, so the anon key
-- read them in full. Found by sweeping all 124 tables against the anon key
-- before publishing it to Vercel.
--
-- subscription_payments was the live one: six billing rows exposing amount,
-- currency, status, the payment gateway reference (external_id) and any
-- gateway error message. The other five are empty today, which is the only
-- reason they leaked nothing - they are all tenant-scoped and would have
-- started leaking the moment anyone used them.
--
-- Deliberately left public: project_phase_categories and units carry no
-- tenant_id, and neither do permissions, role_permissions, subscription_plans
-- or subscription_plan_features. Those describe the product, not a customer.
--
-- src/lib/billing/payment.ts reads and inserts subscription_payments with the
-- user-scoped client (lines ~137 and ~214), so SELECT and INSERT both need a
-- policy or checkout breaks. Its three UPDATEs use the admin client and are
-- exempt.

ALTER TABLE "public"."subscription_payments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own tenant payments" ON "public"."subscription_payments"
  FOR SELECT TO "authenticated"
  USING ("tenant_id" = (
    SELECT "users"."tenant_id" FROM "public"."users"
     WHERE "users"."id" = "auth"."uid"()
  ));

CREATE POLICY "Record own tenant payments" ON "public"."subscription_payments"
  FOR INSERT TO "authenticated"
  WITH CHECK ("tenant_id" = (
    SELECT "users"."tenant_id" FROM "public"."users"
     WHERE "users"."id" = "auth"."uid"()
  ));

-- The five empty tenant-scoped tables. FOR ALL so that whoever wires them up
-- meets working behaviour rather than a silent empty list.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'component_templates', 'material_categories', 'material_presets',
    'materials', 'space_templates'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY "Tenant scoped access" ON public.%I
        FOR ALL TO authenticated
        USING (tenant_id = (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()))
        WITH CHECK (tenant_id = (SELECT users.tenant_id FROM public.users WHERE users.id = auth.uid()))
    $f$, t);
  END LOOP;
END $$;
