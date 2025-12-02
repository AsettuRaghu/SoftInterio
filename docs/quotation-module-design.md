# Quotation Module - Design Document

## Overview

The quotation module implements a 4-level hierarchical costing structure optimized for:

- Fast creation using templates
- Easy revisions with instant recalculation
- Transparent cost communication with clients
- Version control and comparison

---

## 1. UI/UX Design Philosophy

### Core Principles

1. **Progressive Disclosure**: Show complexity only when needed
2. **Template-First Approach**: Start with pre-configured templates
3. **Inline Editing**: Edit values without opening modals
4. **Real-time Calculations**: Instant updates on any change
5. **Collapsible Hierarchy**: Expand/collapse levels for focus
6. **Drag & Drop**: Reorder items easily

---

## 2. Page Structure

### 2.1 Quotation List Page (`/dashboard/quotations`)

```
┌─────────────────────────────────────────────────────────────────┐
│ Quotations                                    [+ New Quotation] │
├─────────────────────────────────────────────────────────────────┤
│ [Search...] [Status ▼] [Date Range] [Client ▼]                  │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ QT-2024-0001 │ Prestige Lakeside │ ₹12,50,000 │ Draft │ v1  │ │
│ │ John Doe     │ 3BHK Complete     │            │       │     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ QT-2024-0002 │ Brigade Gateway   │ ₹8,75,000  │ Sent  │ v2  │ │
│ │ Jane Smith   │ Kitchen + Bedroom │            │       │     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Quotation Builder Page (`/dashboard/quotations/[id]`)

The main quotation editor with 4-level hierarchy:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Back   QT-2024-0001                              [Preview] [Save] [Send]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Client: John Doe  │  Property: Prestige Lakeside, 3BHK  │  Lead: LD-0042  │
│  Version: 1        │  Status: Draft                       │  ₹12,50,000    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ [+ Add Space] [Load Template ▼] [Import from Library]                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ LEVEL 1: MASTER BEDROOM ─────────────────────────────── ₹3,50,000 ────┐ │
│ │  [▼ Expand]  [⋮ Menu]                                                   │ │
│ │                                                                         │ │
│ │  ┌─ LEVEL 2: Wardrobe (8ft × 7ft) ───────────────────── ₹1,80,000 ──┐  │ │
│ │  │  [▼]  Type: Sliding │ Shutters: 4                                │  │ │
│ │  │                                                                   │  │ │
│ │  │  ┌─ LEVEL 3: Carcass - 18mm BWP Plywood ─────────── ₹45,000 ──┐  │  │ │
│ │  │  │  ┌─ LEVEL 4 ──────────────────────────────────────────────┐│  │  │ │
│ │  │  │  │  Area: 120 sqft  │  Rate: ₹375/sqft  │  = ₹45,000      ││  │  │ │
│ │  │  │  └────────────────────────────────────────────────────────┘│  │  │ │
│ │  │  └────────────────────────────────────────────────────────────┘  │  │ │
│ │  │                                                                   │  │ │
│ │  │  ┌─ LEVEL 3: Shutter - Acrylic Finish ──────────── ₹85,000 ──┐  │  │ │
│ │  │  │  ┌─ LEVEL 4 ──────────────────────────────────────────────┐│  │  │ │
│ │  │  │  │  Area: 56 sqft   │  Rate: ₹1,500/sqft │  = ₹84,000     ││  │  │ │
│ │  │  │  │  Edge Band       │  ₹20/rft × 50 rft  │  = ₹1,000      ││  │  │ │
│ │  │  │  └────────────────────────────────────────────────────────┘│  │  │ │
│ │  │  └────────────────────────────────────────────────────────────┘  │  │ │
│ │  │                                                                   │  │ │
│ │  │  ┌─ LEVEL 3: Hardware - Hettich Premium ────────── ₹35,000 ──┐  │  │ │
│ │  │  │  Soft-close hinges: 16 × ₹450  │  Channels: 4 × ₹2,800    │  │  │ │
│ │  │  │  Handles: 4 × ₹850             │  Locks: 2 × ₹1,200       │  │  │ │
│ │  │  └────────────────────────────────────────────────────────────┘  │  │ │
│ │  │                                                                   │  │ │
│ │  │  ┌─ LEVEL 3: Accessories ───────────────────────── ₹15,000 ──┐  │  │ │
│ │  │  │  Trouser pullout: 1 × ₹4,500  │  Tie rack: 1 × ₹1,200     │  │  │ │
│ │  │  │  LED strip: 8ft × ₹350        │  Mirror: 1 × ₹6,500       │  │  │ │
│ │  │  └────────────────────────────────────────────────────────────┘  │  │ │
│ │  └───────────────────────────────────────────────────────────────────┘  │ │
│ │                                                                         │ │
│ │  ┌─ LEVEL 2: TV Unit (10ft × 8ft) ───────────────────── ₹95,000 ──┐   │ │
│ │  │  [▼]  Type: Wall Mounted with Storage                          │   │ │
│ │  │  ... (collapsed)                                                │   │ │
│ │  └─────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                         │ │
│ │  [+ Add Component]                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ LEVEL 1: LIVING ROOM ────────────────────────────────── ₹4,20,000 ────┐ │
│ │  [▶ Collapsed]  [⋮ Menu]                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ LEVEL 1: KITCHEN ────────────────────────────────────── ₹4,80,000 ────┐ │
│ │  [▶ Collapsed]  [⋮ Menu]                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                              SUMMARY                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Subtotal (Materials + Labour)                              ₹11,50,000      │
│  Overheads (8%)                                                ₹92,000      │
│  GST (18%)                                                   ₹2,23,560      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  GRAND TOTAL                                                ₹14,65,560      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Key UI Components

### 3.1 Space/Room Card (Level 1)

```tsx
<SpaceCard>
  - Drag handle for reordering - Space name (editable inline) - Collapse/expand
  toggle - Subtotal display - Context menu (duplicate, delete, add from
  template) - List of Component cards (Level 2) - "Add Component" button
</SpaceCard>
```

### 3.2 Component Card (Level 2)

```tsx
<ComponentCard>
  - Component name with type selector - Dimensions input (W × H or custom) -
  Quick specs summary - Subtotal display - List of Material/Spec items (Level 3)
  - "Add Material/Spec" button
</ComponentCard>
```

### 3.3 Material/Specification Row (Level 3)

```tsx
<MaterialRow>
  - Material category dropdown - Material/finish selector - Expandable cost
  breakdown (Level 4) - Line total - Quick actions (swap material, duplicate,
  delete)
</MaterialRow>
```

### 3.4 Cost Attribute Row (Level 4)

```tsx
<CostAttributeRow>
  - Attribute name (Area, Quantity, Labour, etc.) - Value input with unit - Rate
  input - Calculated amount - Auto-calculate toggle
</CostAttributeRow>
```

---

## 4. Template System

### 4.1 Template Types

1. **Full Quotation Templates**: Complete project templates (3BHK Standard, 2BHK Premium)
2. **Space Templates**: Room-level templates (Master Bedroom Luxury, Modular Kitchen L-Shape)
3. **Component Templates**: Item-level templates (8ft Sliding Wardrobe, TV Unit with Storage)
4. **Material Presets**: Pre-configured material combinations (Premium Package, Budget Package)

### 4.2 Template Hierarchy

```
Quotation Templates
├── 3BHK Complete (Premium)
│   ├── Master Bedroom Template
│   │   ├── Wardrobe Component Template
│   │   │   ├── Premium Material Preset
│   │   │   └── Standard Material Preset
│   │   ├── TV Unit Component Template
│   │   └── False Ceiling Component Template
│   ├── Living Room Template
│   ├── Kitchen Template
│   └── ...
└── 2BHK Essential (Budget)
    └── ...
```

### 4.3 Template UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Template Library                                   [+ Create]   │
├─────────────────────────────────────────────────────────────────┤
│ [Full Quotation] [Spaces] [Components] [Material Presets]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Full Quotation Templates                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📋 3BHK Complete (Premium)                                   │ │
│ │    5 Spaces │ 18 Components │ Base: ₹15,00,000              │ │
│ │    [Preview] [Use Template] [Edit]                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📋 2BHK Essential (Budget)                                   │ │
│ │    4 Spaces │ 12 Components │ Base: ₹6,50,000               │ │
│ │    [Preview] [Use Template] [Edit]                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Interaction Patterns

### 5.1 Quick Actions

| Action            | Trigger                             | Result                                |
| ----------------- | ----------------------------------- | ------------------------------------- |
| Swap Material     | Click material → Select alternative | Instant recalculation                 |
| Duplicate Space   | Context menu → Duplicate            | Creates copy with incremented name    |
| Change Dimensions | Edit W × H                          | Recalculates all dependent costs      |
| Apply Preset      | Select preset from dropdown         | Replaces materials with preset values |
| Compare Versions  | Version selector                    | Side-by-side comparison               |

### 5.2 Keyboard Shortcuts

- `Ctrl+S`: Save quotation
- `Ctrl+D`: Duplicate selected item
- `Delete`: Remove selected item
- `↑/↓`: Navigate items
- `Enter`: Edit selected item
- `Escape`: Cancel edit / Collapse

### 5.3 Drag & Drop

- Reorder Spaces (Level 1)
- Reorder Components within a Space (Level 2)
- Move Component to different Space
- Reorder Materials within a Component (Level 3)

---

## 6. Revision & Version Control

### 6.1 Version Management

```
┌─────────────────────────────────────────────────────────────────┐
│ Version History                                                 │
├─────────────────────────────────────────────────────────────────┤
│ ● v3 (Current) - Dec 1, 2024 - ₹14,65,560                      │
│   Changed: Kitchen material upgrade, Added balcony             │
│                                                                 │
│ ○ v2 - Nov 28, 2024 - ₹12,50,000                               │
│   Changed: Reduced master bedroom scope                         │
│   [View] [Compare with Current] [Restore]                       │
│                                                                 │
│ ○ v1 - Nov 25, 2024 - ₹15,20,000                               │
│   Initial quotation                                             │
│   [View] [Compare with Current] [Restore]                       │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Comparison View

Side-by-side diff showing:

- Added items (green highlight)
- Removed items (red highlight)
- Changed values (yellow highlight)
- Price difference summary

---

## 7. Client View / PDF Export

### 7.1 Presentation Modes

1. **Detailed View**: Shows all 4 levels (internal use)
2. **Client Summary**: Shows Level 1 + Level 2 with totals (client presentation)
3. **Room-wise Summary**: Shows only Level 1 totals
4. **Line Item View**: Flat list of all components

### 7.2 PDF Structure

```
Page 1: Cover + Summary
Page 2-N: Space-wise breakdown (Level 1 + 2)
Last Page: Terms & Conditions
```

---

## 8. Mobile Responsiveness

### 8.1 Mobile View Adaptations

- Collapsible cards by default
- Bottom sheet for editing
- Swipe actions (delete, duplicate)
- Simplified 2-level view (Spaces + Components)
- Full details on tap

---

## 9. Real-time Collaboration (Future)

- Multiple users editing simultaneously
- Presence indicators
- Change attribution
- Conflict resolution

---

## 10. Integration Points

### 10.1 With Leads Module

- Create quotation from lead
- Link quotation to lead
- Update lead stage on quotation status change

### 10.2 With Projects Module

- Convert won quotation to project
- Use quotation as project budget baseline

### 10.3 With Inventory Module

- Check material availability
- Reserve materials on quotation approval

---

## Next Steps

1. ✅ Finalize database schema - `database/migrations/009_quotation_module.sql`
2. ✅ Create TypeScript types - `src/types/quotations.ts`
3. Create API endpoints
4. Build UI components
5. Implement template system
6. Add version control
7. PDF generation
8. Testing & refinement

---

## Implementation Summary

### Files Created

| File                                           | Purpose                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `database/migrations/009_quotation_module.sql` | Complete database schema with 4-level hierarchy, templates, triggers for auto-calculation, and RLS policies |
| `src/types/quotations.ts`                      | TypeScript type definitions for all quotation-related entities                                              |
| `docs/quotation-module-design.md`              | This design document                                                                                        |

### Database Tables Created

**Master Data (Library)**

- `space_types` - Level 1 definitions (rooms)
- `component_types` - Level 2 definitions (furniture/work items)
- `material_categories` - Level 3 grouping
- `materials` - Level 3 definitions with rates
- `cost_attribute_types` - Level 4 definitions

**Templates**

- `quotation_templates` - Full project templates
- `space_templates` - Room-level templates
- `component_templates` - Item-level templates
- `material_presets` - Pre-configured material sets

**Quotation Data**

- `quotations` - Main quotation header
- `quotation_spaces` - Level 1: Spaces/Rooms
- `quotation_components` - Level 2: Components/Work items
- `quotation_materials` - Level 3: Materials/Specifications
- `quotation_cost_attributes` - Level 4: Cost breakdown

**Version Control**

- `quotation_snapshots` - Full state snapshots
- `quotation_changes` - Granular change log

### Key Features

1. **Auto-Calculation Triggers**: Database triggers automatically recalculate:

   - Material subtotal from cost attributes
   - Component subtotal from materials
   - Space subtotal from components
   - Quotation totals from spaces

2. **Template System**: Hierarchical templates at all levels for fast creation

3. **Version Control**: Built-in versioning with `duplicate_quotation()` function

4. **Row-Level Security**: Tenant isolation for all tables

5. **Flexible Schema**: JSONB fields for custom configurations and specifications
