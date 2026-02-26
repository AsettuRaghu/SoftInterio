# Calendar Module Architecture

## Overview

The calendar module in SoftInterio uses a **hybrid approach** combining two data sources:

1. **Lead Activities** - Meetings and site visits attached to leads
2. **Standalone Calendar Events** - Independent calendar entries that can optionally link to leads or projects

This design allows maximum flexibility: events can be completely independent or attached to any entity.

## Data Model

### Calendar Events Table

```sql
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,

    -- Event Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) DEFAULT 'other',

    -- Timing
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE,
    is_all_day BOOLEAN DEFAULT FALSE,

    -- Location & Notes
    location VARCHAR(500),
    notes TEXT,

    -- Completion Tracking
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID,

    -- Optional Linking (like tasks)
    linked_type VARCHAR(20),        -- 'lead' or 'project'
    linked_id UUID,                 -- lead_id or project_id

    -- Attendees (JSONB format)
    attendees JSONB DEFAULT '[]',

    -- Audit
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_calendar_events_linked ON calendar_events(linked_type, linked_id);
CREATE INDEX idx_calendar_events_scheduled ON calendar_events(scheduled_at);
CREATE INDEX idx_calendar_events_tenant ON calendar_events(tenant_id);
```

### Lead Activities Table (Events Source)

Lead activities can include meetings and site visits:

```sql
-- From lead_activities table
activity_type: 'meeting_scheduled' | 'client_meeting' | 'internal_meeting' | 'site_visit' | ...
meeting_scheduled_at: TIMESTAMP  -- When the meeting is scheduled
meeting_location: VARCHAR
meeting_completed: BOOLEAN
meeting_notes: TEXT
attendees: JSONB
```

## Key Differences: Calendar vs Tasks Attachment

| Feature           | Tasks                          | Calendar Events                                    |
| ----------------- | ------------------------------ | -------------------------------------------------- |
| **Attachment**    | `related_type` + `related_id`  | `linked_type` + `linked_id`                        |
| **Related Types** | lead, project, quotation, etc. | lead, project (currently)                          |
| **Hierarchy**     | Parent-child (subtasks)        | Standalone or linked                               |
| **Events Source** | Single `tasks` table           | Dual source: `lead_activities` + `calendar_events` |
| **Filtering**     | By entity + parent_only        | By source type + entity                            |

## API Endpoints

### GET /api/calendar

Fetches calendar events from both sources with unified format.

**Query Parameters:**

- `start` - Start date for range (ISO format)
- `end` - End date for range (ISO format)
- `source` - Filter by source: `lead`, `project`, `standalone`, `all`
- `linked_id` - Specific lead or project ID

**Response Structure:**

```typescript
{
  events: CalendarEvent[],           // All events matching filters
  eventsByDate: Record<string, CalendarEvent[]>,  // Grouped by date
  upcomingEvents: CalendarEvent[],    // Next 7 days
  overdueEvents: CalendarEvent[],     // Overdue incomplete events
}
```

**Event Transformation:**

Both lead activities and standalone events are transformed to a unified format:

```typescript
interface UnifiedCalendarEvent {
  id: string;
  source_type: "lead" | "project" | "standalone";
  source_id: string | null; // lead_id or project_id
  source_number: string | null; // lead_number, project_number
  source_name: string | null; // client_name, project_name
  activity_type: string;
  meeting_type: string;

  title: string;
  description: string | null;
  scheduled_at: string;
  end_at: string | null;
  is_all_day: boolean;
  location: string | null;
  is_completed: boolean;
  notes: string | null;
  attendees: any[];

  created_by: string;
  created_user: { id; name; avatar_url };
  created_at: string;
}
```

## Attachment Mechanisms

### 1. Lead-Attached Events (Lead Activities)

Events created from the lead detail page:

```typescript
// Event created from lead activity form
{
  lead_id: "xxx",
  activity_type: "meeting_scheduled",  // or "site_visit", etc.
  meeting_scheduled_at: "2026-02-04T...",
  created_by: current_user_id
  // This becomes a calendar event automatically
}
```

**How it's displayed:**

- In lead's Calendar tab → shows all events for that lead
- In lead's Activity timeline → shows in chronological feed
- In main calendar → shows as "Lead Activity" with lead context

### 2. Standalone Linked Events (Calendar Events Table)

Events created from the main Calendar module:

```typescript
// Event created from calendar form
{
  title: "Follow-up meeting",
  scheduled_at: "2026-02-04T...",
  linked_type: "lead",              // Optional
  linked_id: "lead_uuid",           // Optional
  created_by: current_user_id
}
```

**Key Features:**

- Can be completely standalone (no linked_type/linked_id)
- Can be attached to any lead or project
- Can be used for company-wide events (team meetings, holidays, etc.)

## Usage in Different Contexts

### In Leads Detail Page

```tsx
<CalendarTab
  linkedType="lead"
  linkedId={lead.id}
  // Shows only events for this lead
  // Sources: lead activities + calendar_events with linked_type='lead' && linked_id=lead.id
/>
```

### In Projects Detail Page

```tsx
<CalendarTab
  linkedType="project"
  linkedId={project.id}
  // Shows only events for this project
  // Sources: (no lead activities) + calendar_events with linked_type='project' && linked_id=project.id
/>
```

### In Main Calendar Module

```tsx
<CalendarTableReusable
  linkedType="all"
  // Shows all events from all sources
  // User can filter by source: lead, project, standalone
/>
```

## Attendees Management

Calendar events support attendee tracking via JSONB:

```json
[
  {
    "type": "team", // or "external"
    "id": "user_uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "status": "attending" // or "invited", "declined"
  }
]
```

## Completion Tracking

Unlike tasks (which have discrete statuses), calendar events track completion:

```typescript
{
  is_completed: boolean,
  completed_at: timestamp | null,
  completed_by: user_id | null
}
```

## Permission & Visibility Rules

**Admin/Owner Users:**

- See all events in the tenant
- Can create, edit, delete any event

**Regular Users:**

- See events they created
- See events where they're listed as attendee
- Can only edit/delete their own events

## API Routes for Management

### Create Calendar Event

```
POST /api/calendar/[id]
{
  title: string,
  scheduled_at: string,
  end_at?: string,
  location?: string,
  linked_type?: 'lead' | 'project',
  linked_id?: string,
  attendees?: Attendee[],
  notes?: string
}
```

### Update Calendar Event

```
PATCH /api/calendar/[id]
{
  // Same fields as create
}
```

### Complete Calendar Event

```
PATCH /api/calendar/[id]/complete
{
  is_completed: boolean,
  notes?: string
}
```

### Delete Calendar Event

```
DELETE /api/calendar/[id]
```

## Component Structure

### CalendarTableReusable

Main component for displaying calendar events with:

- Event list view
- Calendar grid view
- Filtering by type, date range, source
- Create/Edit/Delete controls
- Attendee management
- Completion tracking

### Event Modal Components

- `CreateEventModal` - Create new calendar event
- `EditEventModal` - Edit existing event
- `EventDetailModal` - View event details

## Indexing & Performance

```sql
-- Key indexes for calendar operations
CREATE INDEX idx_calendar_events_tenant ON calendar_events(tenant_id);
CREATE INDEX idx_calendar_events_linked ON calendar_events(linked_type, linked_id);
CREATE INDEX idx_calendar_events_scheduled ON calendar_events(scheduled_at);
CREATE INDEX idx_calendar_events_type ON calendar_events(event_type);
CREATE INDEX idx_calendar_events_created_by ON calendar_events(created_by);
```

## Comparison with Tasks Module

```
┌─────────────────────────────────────────────────┐
│          TASKS vs CALENDAR ARCHITECTURE         │
├─────────────────────────────────────────────────┤
│                                                 │
│ TASKS:                   CALENDAR:              │
│ ------                   --------               │
│ Single table source      Dual source           │
│ related_type/id          linked_type/id        │
│ Parent-child tree        Flat with linking     │
│ Hierarchical subtasks    No subtasks           │
│ Discrete statuses        Binary completion     │
│ Can be linked to         Can be linked to      │
│   Lead, Project,           Lead, Project       │
│   Quotation, etc.                              │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Summary

Yes, calendar entries **ARE attached to leads and projects** just like tasks, using the same `linked_type` + `linked_id` pattern:

✅ **Similarities to Tasks:**

- Attachment via `linked_type` and `linked_id` fields
- Can filter by entity
- Support multi-tenant isolation
- Show in entity detail pages

⚡ **Key Differences:**

- **Dual source:** Can come from lead_activities (automatic) OR calendar_events (manual)
- **No hierarchy:** No parent-child relationships
- **Completion tracking:** Simple is_completed flag, not discrete statuses
- **Attendee support:** Built-in attendee JSONB field
- **Flexible linking:** Can be standalone or linked

The calendar module is designed to be more flexible than tasks—events don't have to be attached to anything, making it suitable for company-wide events, holidays, and team meetings alongside entity-specific events.
