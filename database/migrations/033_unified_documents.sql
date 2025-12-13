-- =====================================================
-- Migration: 033_unified_documents.sql
-- Description: Create unified documents table for all modules
-- Supports: leads, projects, quotations, invoices, clients, etc.
-- =====================================================

-- =====================================================
-- STEP 1: CREATE DOCUMENT LINKED TYPE ENUM
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_linked_type') THEN
        CREATE TYPE document_linked_type AS ENUM (
            'lead',
            'project', 
            'quotation',
            'invoice',
            'client',
            'property',
            'purchase_order',
            'vendor',
            'expense'
        );
    END IF;
END $$;

-- =====================================================
-- STEP 2: CREATE DOCUMENT CATEGORY ENUM
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_category') THEN
        CREATE TYPE document_category AS ENUM (
            'contract',
            'agreement',
            'proposal',
            'design',
            'floor_plan',
            '3d_render',
            'photo',
            'invoice',
            'receipt',
            'purchase_order',
            'delivery_note',
            'identification',
            'property_document',
            'reference',
            'other'
        );
    END IF;
END $$;

-- =====================================================
-- STEP 3: CREATE UNIFIED DOCUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Polymorphic relation
    linked_type document_linked_type NOT NULL,
    linked_id UUID NOT NULL,
    
    -- File information
    file_name VARCHAR(255) NOT NULL,           -- Stored name (with timestamp/uuid)
    original_name VARCHAR(255) NOT NULL,       -- User's original filename
    file_type VARCHAR(100),                    -- MIME type
    file_extension VARCHAR(20),                -- Extension (.pdf, .jpg, etc.)
    file_size BIGINT,                          -- Size in bytes
    
    -- Storage
    storage_bucket VARCHAR(100) NOT NULL DEFAULT 'documents',
    storage_path TEXT NOT NULL,                -- Full path in storage bucket
    
    -- Metadata
    category document_category DEFAULT 'other',
    title VARCHAR(255),                        -- Optional display title
    description TEXT,
    tags TEXT[],                               -- Array of tags for filtering
    
    -- Version control (for document revisions)
    version INT DEFAULT 1,
    parent_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    is_latest BOOLEAN DEFAULT TRUE,
    
    -- Audit
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- STEP 4: CREATE INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_linked ON documents(linked_type, linked_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);

-- =====================================================
-- STEP 5: ENABLE RLS
-- =====================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view documents in their tenant
CREATE POLICY "documents_tenant_isolation" ON documents
    FOR ALL
    USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- =====================================================
-- STEP 6: CREATE UPDATED_AT TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_documents_updated_at ON documents;
CREATE TRIGGER trigger_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_documents_updated_at();

-- =====================================================
-- STEP 7: MIGRATE EXISTING LEAD_DOCUMENTS DATA
-- =====================================================
-- Insert existing lead documents into unified table
INSERT INTO documents (
    tenant_id,
    linked_type,
    linked_id,
    file_name,
    original_name,
    file_type,
    file_size,
    storage_path,
    category,
    description,
    uploaded_by,
    created_at
)
SELECT 
    l.tenant_id,
    'lead'::document_linked_type,
    ld.lead_id,
    ld.file_name,
    ld.file_name,  -- original_name same as file_name for legacy data
    ld.file_type,
    ld.file_size_bytes,
    COALESCE(ld.storage_path, ld.file_url),
    CASE 
        WHEN ld.document_type = 'contract' THEN 'contract'::document_category
        WHEN ld.document_type = 'design' THEN 'design'::document_category
        WHEN ld.document_type = 'photo' THEN 'photo'::document_category
        WHEN ld.document_type = 'floor_plan' THEN 'floor_plan'::document_category
        ELSE 'other'::document_category
    END,
    ld.description,
    ld.uploaded_by,
    ld.created_at
FROM lead_documents ld
JOIN leads l ON l.id = ld.lead_id
WHERE NOT EXISTS (
    SELECT 1 FROM documents d 
    WHERE d.linked_type = 'lead' 
    AND d.linked_id = ld.lead_id 
    AND d.file_name = ld.file_name
);

-- =====================================================
-- STEP 8: ADD COMMENTS
-- =====================================================
COMMENT ON TABLE documents IS 'Unified document storage for all modules (leads, projects, quotations, etc.)';
COMMENT ON COLUMN documents.linked_type IS 'Type of entity this document is attached to';
COMMENT ON COLUMN documents.linked_id IS 'UUID of the linked entity';
COMMENT ON COLUMN documents.file_name IS 'Stored filename (may include timestamp/uuid for uniqueness)';
COMMENT ON COLUMN documents.original_name IS 'Original filename as uploaded by user';
COMMENT ON COLUMN documents.storage_path IS 'Full path within the storage bucket';
COMMENT ON COLUMN documents.parent_id IS 'Reference to previous version of this document';
COMMENT ON COLUMN documents.is_latest IS 'Whether this is the latest version of the document';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- The unified documents table is now ready.
-- The old lead_documents table is preserved for backward compatibility.
-- Future: DROP TABLE lead_documents after verifying migration success.
