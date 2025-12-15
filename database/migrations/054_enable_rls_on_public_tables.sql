-- Enable RLS and Create Policies for Public Tables
-- This migration resolves Supabase security advisories by enabling Row Level Security

-- ============================================================================
-- STEP 1: Enable RLS on all public schema tables
-- ============================================================================

-- Units table (the main issue flagged)
ALTER TABLE IF EXISTS public.units ENABLE ROW LEVEL SECURITY;

-- Stock Management Tables
ALTER TABLE IF EXISTS public.stock_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_vendor_brands ENABLE ROW LEVEL SECURITY;

-- Sales/Leads Tables
ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lead_activities ENABLE ROW LEVEL SECURITY;

-- Quotation Tables
ALTER TABLE IF EXISTS public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quotation_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quotation_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quotation_activities ENABLE ROW LEVEL SECURITY;

-- Projects and other shared tables
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.po_approval_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create RLS Policies
-- ============================================================================
-- These policies ensure authenticated users can only access data they have access to
-- via their tenant membership

-- ============================================================================
-- Master Data Policies (Units, Vendors, Brands, etc.)
-- Master data is typically shared across the entire tenant
-- ============================================================================

-- Units: Readable by all authenticated users in the tenant
CREATE POLICY "Units are readable by authenticated users"
  ON public.units
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = units.tenant_id
    )
  );

-- Vendors: Readable by authenticated users in the tenant
CREATE POLICY "Vendors are readable by authenticated users"
  ON public.stock_vendors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_vendors.tenant_id
    )
  );

-- Vendors: Insertable/Updatable by authenticated users in the tenant
CREATE POLICY "Vendors can be inserted by authenticated users"
  ON public.stock_vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_vendors.tenant_id
    )
  );

CREATE POLICY "Vendors can be updated by authenticated users"
  ON public.stock_vendors
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_vendors.tenant_id
    )
  );

CREATE POLICY "Vendors can be deleted by authenticated users"
  ON public.stock_vendors
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_vendors.tenant_id
    )
  );

-- Brands: Similar policies
CREATE POLICY "Brands are readable by authenticated users"
  ON public.stock_brands
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_brands.tenant_id
    )
  );

CREATE POLICY "Brands can be inserted by authenticated users"
  ON public.stock_brands
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_brands.tenant_id
    )
  );

CREATE POLICY "Brands can be updated by authenticated users"
  ON public.stock_brands
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_brands.tenant_id
    )
  );

CREATE POLICY "Brands can be deleted by authenticated users"
  ON public.stock_brands
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_brands.tenant_id
    )
  );

-- Cost Items: Similar policies
CREATE POLICY "Cost items are readable by authenticated users"
  ON public.stock_cost_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_cost_items.tenant_id
    )
  );

CREATE POLICY "Cost items can be inserted by authenticated users"
  ON public.stock_cost_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_cost_items.tenant_id
    )
  );

CREATE POLICY "Cost items can be updated by authenticated users"
  ON public.stock_cost_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_cost_items.tenant_id
    )
  );

CREATE POLICY "Cost items can be deleted by authenticated users"
  ON public.stock_cost_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_cost_items.tenant_id
    )
  );

-- ============================================================================
-- Stock Management Policies
-- ============================================================================

-- Purchase Orders: Readable by authenticated users in the tenant
CREATE POLICY "Purchase orders are readable by authenticated users"
  ON public.stock_purchase_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_purchase_orders.tenant_id
    )
  );

CREATE POLICY "Purchase orders can be inserted"
  ON public.stock_purchase_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_purchase_orders.tenant_id
    )
  );

CREATE POLICY "Purchase orders can be updated"
  ON public.stock_purchase_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_purchase_orders.tenant_id
    )
  );

CREATE POLICY "Purchase orders can be deleted"
  ON public.stock_purchase_orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_purchase_orders.tenant_id
    )
  );

-- PO Items: Readable
CREATE POLICY "Purchase order items are readable"
  ON public.stock_purchase_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_purchase_orders po
      INNER JOIN public.users u ON u.tenant_id = po.tenant_id
      WHERE u.id = auth.uid()
      AND po.id = stock_purchase_order_items.purchase_order_id
    )
  );

CREATE POLICY "Purchase order items can be inserted"
  ON public.stock_purchase_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stock_purchase_orders po
      INNER JOIN public.users u ON u.tenant_id = po.tenant_id
      WHERE u.id = auth.uid()
      AND po.id = stock_purchase_order_items.purchase_order_id
    )
  );

CREATE POLICY "Purchase order items can be updated"
  ON public.stock_purchase_order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_purchase_orders po
      INNER JOIN public.users u ON u.tenant_id = po.tenant_id
      WHERE u.id = auth.uid()
      AND po.id = stock_purchase_order_items.purchase_order_id
    )
  );

CREATE POLICY "Purchase order items can be deleted"
  ON public.stock_purchase_order_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_purchase_orders po
      INNER JOIN public.users u ON u.tenant_id = po.tenant_id
      WHERE u.id = auth.uid()
      AND po.id = stock_purchase_order_items.purchase_order_id
    )
  );

-- Goods Receipts
CREATE POLICY "Goods receipts are readable"
  ON public.stock_goods_receipts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_goods_receipts.tenant_id
    )
  );

CREATE POLICY "Goods receipts can be inserted"
  ON public.stock_goods_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_goods_receipts.tenant_id
    )
  );

CREATE POLICY "Goods receipts can be updated"
  ON public.stock_goods_receipts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_goods_receipts.tenant_id
    )
  );

CREATE POLICY "Goods receipts can be deleted"
  ON public.stock_goods_receipts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_goods_receipts.tenant_id
    )
  );

-- Inventory
CREATE POLICY "Inventory is readable"
  ON public.stock_inventory
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_inventory.tenant_id
    )
  );

CREATE POLICY "Inventory can be inserted"
  ON public.stock_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_inventory.tenant_id
    )
  );

CREATE POLICY "Inventory can be updated"
  ON public.stock_inventory
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_inventory.tenant_id
    )
  );

CREATE POLICY "Inventory can be deleted"
  ON public.stock_inventory
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = stock_inventory.tenant_id
    )
  );

-- ============================================================================
-- Sales/Leads Policies
-- ============================================================================

-- Clients: Readable
CREATE POLICY "Clients are readable"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = clients.tenant_id
    )
  );

CREATE POLICY "Clients can be inserted"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = clients.tenant_id
    )
  );

CREATE POLICY "Clients can be updated"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = clients.tenant_id
    )
  );

CREATE POLICY "Clients can be deleted"
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = clients.tenant_id
    )
  );

-- Properties
CREATE POLICY "Properties are readable"
  ON public.properties
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = properties.tenant_id
    )
  );

CREATE POLICY "Properties can be inserted"
  ON public.properties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = properties.tenant_id
    )
  );

CREATE POLICY "Properties can be updated"
  ON public.properties
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = properties.tenant_id
    )
  );

CREATE POLICY "Properties can be deleted"
  ON public.properties
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = properties.tenant_id
    )
  );

-- Leads
CREATE POLICY "Leads are readable"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = leads.tenant_id
    )
  );

CREATE POLICY "Leads can be inserted"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = leads.tenant_id
    )
  );

CREATE POLICY "Leads can be updated"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = leads.tenant_id
    )
  );

CREATE POLICY "Leads can be deleted"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = leads.tenant_id
    )
  );

-- Lead Notes
CREATE POLICY "Lead notes are readable"
  ON public.lead_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      INNER JOIN public.users u ON u.tenant_id = l.tenant_id
      WHERE u.id = auth.uid()
      AND l.id = lead_notes.lead_id
    )
  );

CREATE POLICY "Lead notes can be inserted"
  ON public.lead_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      INNER JOIN public.users u ON u.tenant_id = l.tenant_id
      WHERE u.id = auth.uid()
      AND l.id = lead_notes.lead_id
    )
  );

CREATE POLICY "Lead notes can be updated"
  ON public.lead_notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      INNER JOIN public.users u ON u.tenant_id = l.tenant_id
      WHERE u.id = auth.uid()
      AND l.id = lead_notes.lead_id
    )
  );

CREATE POLICY "Lead notes can be deleted"
  ON public.lead_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      INNER JOIN public.users u ON u.tenant_id = l.tenant_id
      WHERE u.id = auth.uid()
      AND l.id = lead_notes.lead_id
    )
  );

-- Lead Activities
CREATE POLICY "Lead activities are readable"
  ON public.lead_activities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      INNER JOIN public.users u ON u.tenant_id = l.tenant_id
      WHERE u.id = auth.uid()
      AND l.id = lead_activities.lead_id
    )
  );

CREATE POLICY "Lead activities can be inserted"
  ON public.lead_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      INNER JOIN public.users u ON u.tenant_id = l.tenant_id
      WHERE u.id = auth.uid()
      AND l.id = lead_activities.lead_id
    )
  );

-- ============================================================================
-- Quotation Policies
-- ============================================================================

-- Quotations
CREATE POLICY "Quotations are readable"
  ON public.quotations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = quotations.tenant_id
    )
  );

CREATE POLICY "Quotations can be inserted"
  ON public.quotations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = quotations.tenant_id
    )
  );

CREATE POLICY "Quotations can be updated"
  ON public.quotations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = quotations.tenant_id
    )
  );

CREATE POLICY "Quotations can be deleted"
  ON public.quotations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = quotations.tenant_id
    )
  );

-- Quotation Spaces
CREATE POLICY "Quotation spaces are readable"
  ON public.quotation_spaces
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      INNER JOIN public.users u ON u.tenant_id = q.tenant_id
      WHERE u.id = auth.uid()
      AND q.id = quotation_spaces.quotation_id
    )
  );

CREATE POLICY "Quotation spaces can be inserted"
  ON public.quotation_spaces
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotations q
      INNER JOIN public.users u ON u.tenant_id = q.tenant_id
      WHERE u.id = auth.uid()
      AND q.id = quotation_spaces.quotation_id
    )
  );

CREATE POLICY "Quotation spaces can be updated"
  ON public.quotation_spaces
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      INNER JOIN public.users u ON u.tenant_id = q.tenant_id
      WHERE u.id = auth.uid()
      AND q.id = quotation_spaces.quotation_id
    )
  );

CREATE POLICY "Quotation spaces can be deleted"
  ON public.quotation_spaces
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      INNER JOIN public.users u ON u.tenant_id = q.tenant_id
      WHERE u.id = auth.uid()
      AND q.id = quotation_spaces.quotation_id
    )
  );

-- Quotation Components
CREATE POLICY "Quotation components are readable"
  ON public.quotation_components
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      INNER JOIN public.users u ON u.tenant_id = q.tenant_id
      WHERE u.id = auth.uid()
      AND q.id = quotation_components.quotation_id
    )
  );

CREATE POLICY "Quotation components can be inserted"
  ON public.quotation_components
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotations q
      INNER JOIN public.users u ON u.tenant_id = q.tenant_id
      WHERE u.id = auth.uid()
      AND q.id = quotation_components.quotation_id
    )
  );

CREATE POLICY "Quotation components can be updated"
  ON public.quotation_components
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      INNER JOIN public.users u ON u.tenant_id = q.tenant_id
      WHERE u.id = auth.uid()
      AND q.id = quotation_components.quotation_id
    )
  );

CREATE POLICY "Quotation components can be deleted"
  ON public.quotation_components
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      INNER JOIN public.users u ON u.tenant_id = q.tenant_id
      WHERE u.id = auth.uid()
      AND q.id = quotation_components.quotation_id
    )
  );

-- Quotation Activities
CREATE POLICY "Quotation activities are readable"
  ON public.quotation_activities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      INNER JOIN public.users u ON u.tenant_id = q.tenant_id
      WHERE u.id = auth.uid()
      AND q.id = quotation_activities.quotation_id
    )
  );

CREATE POLICY "Quotation activities can be inserted"
  ON public.quotation_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotations q
      INNER JOIN public.users u ON u.tenant_id = q.tenant_id
      WHERE u.id = auth.uid()
      AND q.id = quotation_activities.quotation_id
    )
  );

-- ============================================================================
-- Project Policies
-- ============================================================================

CREATE POLICY "Projects are readable"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = projects.tenant_id
    )
  );

CREATE POLICY "Projects can be inserted"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = projects.tenant_id
    )
  );

CREATE POLICY "Projects can be updated"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = projects.tenant_id
    )
  );

CREATE POLICY "Projects can be deleted"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = projects.tenant_id
    )
  );

-- ============================================================================
-- Team Policies
-- ============================================================================

CREATE POLICY "Teams are readable by members"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.team_id = teams.id
    )
  );

CREATE POLICY "Teams can be inserted"
  ON public.teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Teams can be updated by team members"
  ON public.teams
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.team_id = teams.id
    )
  );

-- Team Members
CREATE POLICY "Team members are readable by team members"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.team_id = team_members.team_id
    )
  );

CREATE POLICY "Team members can be inserted"
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.team_id = team_members.team_id
    )
  );

CREATE POLICY "Team members can be deleted by team members"
  ON public.team_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.team_id = team_members.team_id
    )
  );

-- ============================================================================
-- Users Policies
-- ============================================================================

CREATE POLICY "Users can see their own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.team_id IN (
        SELECT team_id FROM public.team_members
        WHERE user_id = users.id
      )
    )
  );

-- ============================================================================
-- Approval History Policies
-- ============================================================================

CREATE POLICY "Approval history is readable"
  ON public.po_approval_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_purchase_orders po
      INNER JOIN public.users u ON u.tenant_id = po.tenant_id
      WHERE u.id = auth.uid()
      AND po.id = po_approval_history.purchase_order_id
    )
  );

CREATE POLICY "Approval history can be inserted"
  ON public.po_approval_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stock_purchase_orders po
      INNER JOIN public.users u ON u.tenant_id = po.tenant_id
      WHERE u.id = auth.uid()
      AND po.id = po_approval_history.purchase_order_id
    )
  );

-- ============================================================================
-- Note: Create indexes on commonly filtered columns for RLS policy performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_id_tenant_id ON public.users(id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_team ON public.team_members(user_id, team_id);

CREATE INDEX IF NOT EXISTS idx_stock_vendors_tenant_id ON public.stock_vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_brands_tenant_id ON public.stock_brands(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_cost_items_tenant_id ON public.stock_cost_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_inventory_tenant_id ON public.stock_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_purchase_orders_tenant_id ON public.stock_purchase_orders(tenant_id);

CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_tenant_id ON public.properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON public.lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);

CREATE INDEX IF NOT EXISTS idx_quotations_tenant_id ON public.quotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotation_spaces_quotation_id ON public.quotation_spaces(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_components_quotation_id ON public.quotation_components(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_activities_quotation_id ON public.quotation_activities(quotation_id);

CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON public.projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_purchase_order_items_po_id ON public.stock_purchase_order_items(purchase_order_id);
