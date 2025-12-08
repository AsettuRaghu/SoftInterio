-- =====================================================
-- SoftInterio Tasks Module
-- =====================================================
-- Module: Task Management
-- Description: Comprehensive task management with templates,
--              comments, attachments, and cross-module linking
-- Target: Supabase (PostgreSQL with auth integration)
-- 
-- Run Order: 6 (After quotation module)
-- =====================================================

-- =====================================================
-- SECTION 1: ENUMS
-- =====================================================

-- Task priority levels
CREATE TYPE task_priority AS ENUM ('critical', 'high', 'medium', 'low');

-- Task status
CREATE TYPE task_status AS ENUM (
    'todo',
    'in_progress', 
    'on_hold',
    'completed',
    'cancelled'
);

-- Related entity types for tasks
CREATE TYPE task_related_type AS ENUM (
    'lead',
    'quotation', 
    'project',
    'client'
);

-- Template categories (protected types)
CREATE TYPE task_template_category AS ENUM (
    'project',      -- Project management tasks
    'carpentry',    -- Carpentry/fabrication tasks
    'sales',        -- Sales process tasks
    'design',       -- Design and approval tasks
    'installation', -- Installation tasks
    'general'       -- General/ad-hoc tasks
);

-- =====================================================
-- SECTION 2: TASK TAGS
-- =====================================================

CREATE TABLE IF NOT EXISTS task_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tag_name_per_tenant UNIQUE (tenant_id, name)
);

ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_task_tags_tenant ON task_tags(tenant_id);

-- =====================================================
-- SECTION 3: TASK TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category task_template_category NOT NULL DEFAULT 'general',
    is_active BOOLEAN DEFAULT true,
    is_protected BOOLEAN DEFAULT false,
    default_priority task_priority DEFAULT 'medium',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_template_name_per_tenant UNIQUE (tenant_id, name)
);

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_task_templates_tenant ON task_templates(tenant_id);
CREATE INDEX idx_task_templates_category ON task_templates(category);
CREATE INDEX idx_task_templates_active ON task_templates(is_active);

-- =====================================================
-- SECTION 4: TASK TEMPLATE ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS task_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
    parent_item_id UUID REFERENCES task_template_items(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority task_priority DEFAULT 'medium',
    relative_due_days INTEGER,
    estimated_hours DECIMAL(6,2),
    assign_to_role VARCHAR(100),
    assign_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_template_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_task_template_items_template ON task_template_items(template_id);
CREATE INDEX idx_task_template_items_parent ON task_template_items(parent_item_id);
CREATE INDEX idx_task_template_items_order ON task_template_items(template_id, sort_order);

-- =====================================================
-- SECTION 5: MAIN TASKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_number VARCHAR(20) NOT NULL,
    
    -- Hierarchy
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- Template reference
    template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,
    template_item_id UUID REFERENCES task_template_items(id) ON DELETE SET NULL,
    is_from_template BOOLEAN DEFAULT false,
    
    -- Core fields
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority task_priority DEFAULT 'medium',
    status task_status DEFAULT 'todo',
    
    -- Dates
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    
    -- Time tracking
    estimated_hours DECIMAL(6,2),
    actual_hours DECIMAL(6,2),
    
    -- Assignment
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Related entity (polymorphic)
    related_type task_related_type,
    related_id UUID,
    
    -- Recurrence
    is_recurring BOOLEAN DEFAULT false,
    recurrence_rule TEXT,
    recurrence_end_date DATE,
    
    -- Audit
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_task_number_per_tenant UNIQUE (tenant_id, task_number)
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_template ON tasks(template_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_related ON tasks(related_type, related_id);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_tenant_status_due ON tasks(tenant_id, status, due_date);
CREATE INDEX idx_tasks_assignee_status ON tasks(assigned_to, status);

-- =====================================================
-- SECTION 6: TASK TAG ASSIGNMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS task_tag_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES task_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_task_tag UNIQUE (task_id, tag_id)
);

ALTER TABLE task_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_task_tag_assignments_task ON task_tag_assignments(task_id);
CREATE INDEX idx_task_tag_assignments_tag ON task_tag_assignments(tag_id);

-- =====================================================
-- SECTION 7: TASK COMMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES task_comments(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_comments_created_by ON task_comments(created_by);
CREATE INDEX idx_task_comments_parent ON task_comments(parent_comment_id);

-- =====================================================
-- SECTION 8: TASK ATTACHMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(100),
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_task_attachments_task ON task_attachments(task_id);
CREATE INDEX idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);

-- =====================================================
-- SECTION 9: TASK ACTIVITIES
-- =====================================================

CREATE TABLE IF NOT EXISTS task_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_task_activities_task ON task_activities(task_id);
CREATE INDEX idx_task_activities_type ON task_activities(activity_type);
CREATE INDEX idx_task_activities_created ON task_activities(created_at);

-- =====================================================
-- SECTION 10: HELPER FUNCTIONS
-- =====================================================

-- Generate task number
CREATE OR REPLACE FUNCTION generate_task_number(p_tenant_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    v_count INTEGER;
    v_number VARCHAR(20);
BEGIN
    SELECT COUNT(*) + 1 INTO v_count
    FROM tasks
    WHERE tenant_id = p_tenant_id;
    
    v_number := 'TSK-' || LPAD(v_count::TEXT, 4, '0');
    
    WHILE EXISTS (SELECT 1 FROM tasks WHERE tenant_id = p_tenant_id AND task_number = v_number) LOOP
        v_count := v_count + 1;
        v_number := 'TSK-' || LPAD(v_count::TEXT, 4, '0');
    END LOOP;
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Create tasks from template
CREATE OR REPLACE FUNCTION create_tasks_from_template(
    p_template_id UUID,
    p_tenant_id UUID,
    p_created_by UUID,
    p_related_type task_related_type DEFAULT NULL,
    p_related_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (task_id UUID, title TEXT) AS $$
DECLARE
    v_template RECORD;
    v_item RECORD;
    v_task_id UUID;
    v_parent_task_map JSONB := '{}';
BEGIN
    SELECT * INTO v_template FROM task_templates WHERE id = p_template_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found or inactive: %', p_template_id;
    END IF;
    
    FOR v_item IN 
        SELECT * FROM task_template_items 
        WHERE template_id = p_template_id 
        ORDER BY parent_item_id NULLS FIRST, sort_order
    LOOP
        INSERT INTO tasks (
            tenant_id, parent_task_id, template_id, template_item_id, is_from_template,
            title, description, priority, status, start_date, due_date,
            estimated_hours, assigned_to, related_type, related_id, created_by, updated_by
        ) VALUES (
            p_tenant_id,
            (v_parent_task_map->>v_item.parent_item_id::TEXT)::UUID,
            p_template_id, v_item.id, true,
            v_item.title, v_item.description,
            COALESCE(v_item.priority, v_template.default_priority),
            'todo', p_start_date,
            CASE WHEN v_item.relative_due_days IS NOT NULL 
                 THEN p_start_date + v_item.relative_due_days ELSE NULL END,
            v_item.estimated_hours, v_item.assign_to_user_id,
            p_related_type, p_related_id, p_created_by, p_created_by
        )
        RETURNING id INTO v_task_id;
        
        v_parent_task_map := v_parent_task_map || jsonb_build_object(v_item.id::TEXT, v_task_id::TEXT);
        
        task_id := v_task_id;
        title := v_item.title;
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECTION 11: TRIGGERS
-- =====================================================

-- Auto-generate task number
CREATE OR REPLACE FUNCTION trigger_set_task_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.task_number IS NULL OR NEW.task_number = '' THEN
        NEW.task_number := generate_task_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_task_number
    BEFORE INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_task_number();

-- Update timestamps
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_templates_updated_at
    BEFORE UPDATE ON task_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_template_items_updated_at
    BEFORE UPDATE ON task_template_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_tags_updated_at
    BEFORE UPDATE ON task_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Log task status changes
CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO task_activities (task_id, activity_type, field_name, old_value, new_value, description, created_by)
        VALUES (
            NEW.id, 'status_changed', 'status', OLD.status::TEXT, NEW.status::TEXT,
            'Status changed from ' || OLD.status || ' to ' || NEW.status, NEW.updated_by
        );
        
        IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            NEW.completed_at := NOW();
            NEW.completed_by := NEW.updated_by;
        END IF;
        
        IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
            NEW.completed_at := NULL;
            NEW.completed_by := NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_status_change
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_status_change();

-- Log task assignment changes
CREATE OR REPLACE FUNCTION log_task_assignment_change()
RETURNS TRIGGER AS $$
DECLARE
    v_old_name TEXT;
    v_new_name TEXT;
BEGIN
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        SELECT name INTO v_old_name FROM users WHERE id = OLD.assigned_to;
        SELECT name INTO v_new_name FROM users WHERE id = NEW.assigned_to;
        
        INSERT INTO task_activities (task_id, activity_type, field_name, old_value, new_value, description, created_by)
        VALUES (
            NEW.id, 'assigned', 'assigned_to', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT,
            CASE 
                WHEN NEW.assigned_to IS NULL THEN 'Task unassigned from ' || COALESCE(v_old_name, 'unknown')
                WHEN OLD.assigned_to IS NULL THEN 'Task assigned to ' || COALESCE(v_new_name, 'unknown')
                ELSE 'Task reassigned from ' || COALESCE(v_old_name, 'unknown') || ' to ' || COALESCE(v_new_name, 'unknown')
            END,
            NEW.updated_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_assignment_change
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_assignment_change();

-- =====================================================
-- SECTION 12: RLS POLICIES
-- =====================================================

CREATE POLICY tasks_tenant_isolation ON tasks
    FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE POLICY task_templates_tenant_isolation ON task_templates
    FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE POLICY task_template_items_access ON task_template_items
    FOR ALL USING (template_id IN (SELECT id FROM task_templates WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY task_tags_tenant_isolation ON task_tags
    FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE POLICY task_tag_assignments_access ON task_tag_assignments
    FOR ALL USING (task_id IN (SELECT id FROM tasks WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY task_comments_access ON task_comments
    FOR ALL USING (task_id IN (SELECT id FROM tasks WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY task_attachments_access ON task_attachments
    FOR ALL USING (task_id IN (SELECT id FROM tasks WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY task_activities_access ON task_activities
    FOR ALL USING (task_id IN (SELECT id FROM tasks WHERE tenant_id = get_user_tenant_id()));

-- =====================================================
-- SECTION 13: VIEW FOR TASKS WITH DETAILS
-- =====================================================

CREATE OR REPLACE VIEW tasks_with_details AS
SELECT 
    t.*,
    au.name AS assigned_to_name,
    au.email AS assigned_to_email,
    au.avatar_url AS assigned_to_avatar,
    cu.name AS created_by_name,
    cu.email AS created_by_email,
    cbu.name AS completed_by_name,
    tt.name AS template_name,
    tt.category AS template_category,
    (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id) AS subtask_count,
    (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id AND st.status = 'completed') AS completed_subtask_count,
    (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id AND tc.is_deleted = false) AS comment_count,
    (SELECT COUNT(*) FROM task_attachments ta WHERE ta.task_id = t.id) AS attachment_count
FROM tasks t
LEFT JOIN users au ON au.id = t.assigned_to
LEFT JOIN users cu ON cu.id = t.created_by
LEFT JOIN users cbu ON cbu.id = t.completed_by
LEFT JOIN task_templates tt ON tt.id = t.template_id;

-- =====================================================
-- SECTION 14: PERMISSIONS
-- =====================================================

INSERT INTO permissions (key, description, module) VALUES
    ('tasks.view', 'View assigned tasks', 'tasks'),
    ('tasks.view_all', 'View all team tasks', 'tasks'),
    ('tasks.create', 'Create new tasks', 'tasks'),
    ('tasks.edit', 'Edit own tasks', 'tasks'),
    ('tasks.edit_all', 'Edit any task', 'tasks'),
    ('tasks.delete', 'Delete tasks', 'tasks'),
    ('tasks.assign', 'Assign tasks to others', 'tasks'),
    ('tasks.comment', 'Add comments to tasks', 'tasks'),
    ('tasks.templates.view', 'View task templates', 'tasks'),
    ('tasks.templates.create', 'Create task templates', 'tasks'),
    ('tasks.templates.edit', 'Edit task templates', 'tasks'),
    ('tasks.templates.delete', 'Delete task templates', 'tasks'),
    ('tasks.templates.manage_protected', 'Manage protected templates', 'tasks')
ON CONFLICT (key) DO NOTHING;

-- Grant to Owner
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Owner' AND p.key LIKE 'tasks.%'
ON CONFLICT DO NOTHING;

-- Grant to Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Admin' AND p.key LIKE 'tasks.%' AND p.key != 'tasks.templates.manage_protected'
ON CONFLICT DO NOTHING;

-- Grant to Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Manager' AND p.key IN (
    'tasks.view', 'tasks.view_all', 'tasks.create', 'tasks.edit', 'tasks.edit_all',
    'tasks.assign', 'tasks.comment', 'tasks.templates.view', 'tasks.templates.create',
    'tasks.templates.edit', 'tasks.templates.manage_protected'
)
ON CONFLICT DO NOTHING;

-- Grant to Sales Rep
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Sales Rep' AND p.key IN ('tasks.view', 'tasks.create', 'tasks.edit', 'tasks.comment', 'tasks.templates.view')
ON CONFLICT DO NOTHING;

-- Grant to Designer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Designer' AND p.key IN ('tasks.view', 'tasks.create', 'tasks.edit', 'tasks.comment', 'tasks.templates.view')
ON CONFLICT DO NOTHING;

-- =====================================================
-- TASK MODULE COMPLETE
-- =====================================================

COMMENT ON TABLE tasks IS 'Main tasks table supporting hierarchical tasks, templates, and cross-module linking';
COMMENT ON TABLE task_templates IS 'Reusable task templates with protected categories';
COMMENT ON TABLE task_template_items IS 'Individual task items within a template';
COMMENT ON TABLE task_tags IS 'Custom tags for task categorization';
COMMENT ON TABLE task_comments IS 'Comments/discussion on tasks';
COMMENT ON TABLE task_attachments IS 'File attachments on tasks';
COMMENT ON TABLE task_activities IS 'Activity log for task changes';
