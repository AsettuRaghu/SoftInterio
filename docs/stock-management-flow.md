# Stock Management Flow - From Zero to Operations

## Overview

This document explains the complete stock management workflow for an interior design company, starting from Day 1 when there is zero stock.

---

## Phase 1: Master Data Setup (One-time)

### STEP 1: SETUP VENDORS

- Add all your suppliers/dealers
- Krishna Plywood, Sharma Hardware, Kitchen World, etc.
- Enter: Contact details, GST, payment terms, credit days

**WHY**: You need to know WHO you'll buy from

---

### STEP 2: SETUP BRANDS (Optional but recommended)

- Add manufacturers: Century, Hettich, Faber, etc.
- Link which vendors sell which brands

**WHY**: Track authorized dealers, compare brand pricing

---

### STEP 3: SETUP MATERIALS CATALOG

- Add all materials you'll use
- Plywood, hinges, laminates, appliances, etc.
- Set: SKU, unit, pricing tiers, minimum qty, reorder qty
- Link preferred vendor for each material
- Initial stock = 0 (you haven't bought anything yet!)

**WHY**: Create your catalog with costs for quotations

---

## Phase 2: First Project Requirement

### STEP 4: PROJECT GETS A QUOTATION APPROVED

- Client approves quotation for "Kumar Residence Kitchen"
- BOQ shows: 10 sheets plywood, 50 hinges, 1 chimney, etc.

**TRIGGER**: Now you need to procure materials

---

### STEP 5: CREATE MATERIAL REQUISITION (MR)

- Site supervisor/designer creates MR
- Links to project: "Kumar Residence Kitchen"
- Lists materials needed:
  - 10 sheets Century BWP 18mm
  - 50 pairs Hettich soft-close hinges
  - 1 Faber Hood Zenith 90cm chimney
- Sets priority: Normal/High/Urgent
- Sets required date: 15 Dec 2025

**STATUS**: Draft → Submitted (for approval)

**WHY**: Controlled process - prevents unauthorized buying

---

### STEP 6: APPROVE MATERIAL REQUISITION

- Manager reviews the MR
- Checks: Is this needed? Quantity correct? Budget ok?
- Can approve partially (approve 8 sheets, not 10)

**STATUS**: Submitted → Approved

**WHY**: Financial control - manager validates before buying

---

## Phase 3: Procurement

### STEP 7: CREATE PURCHASE ORDER (PO)

- Procurement creates PO from approved MR
- OR checks existing stock first (later, when you have it)
- Selects vendor: Krishna Plywood for plywood
- System shows vendor's price: ₹2,800/sheet
- PO generated: PO-00001

**May create MULTIPLE POs from one MR:**

- PO-00001 → Krishna Plywood (plywood)
- PO-00002 → Sharma Hardware (hinges)
- PO-00003 → Kitchen World (chimney)

**STATUS**: Draft → Pending Approval

---

### STEP 8: APPROVE & SEND PO

- Finance/Manager approves PO (checks budget)
- PO sent to vendor (email/WhatsApp/print)

**STATUS**: Pending Approval → Approved → Sent

**WHY**: Audit trail - formal documentation with vendor

---

## Phase 4: Receiving Goods

### STEP 9: VENDOR DELIVERS GOODS

- Krishna Plywood truck arrives at warehouse
- Delivery challan shows: 10 sheets Century BWP 18mm

---

### STEP 10: CREATE GOODS RECEIPT NOTE (GRN)

- Warehouse person creates GRN against PO-00001
- Physically counts: Received 10 sheets ✓
- Quality check: 9 good, 1 damaged
- Records:
  - Qty Received: 10
  - Qty Accepted: 9
  - Qty Rejected: 1 (Reason: Edge damage)

**STATUS**: GRN-00001 created

**⚡ AUTOMATIC**: Stock updated!

- Century BWP 18mm: 0 → 9 sheets

**WHY**: Verify delivery, quality control, update inventory

---

### STEP 11: PO STATUS UPDATES

- If full qty received: PO → "Received"
- If partial: PO → "Partially Received" (Waiting for replacement of 1 damaged sheet)

**WHY**: Track what's pending from vendor

---

## Phase 5: Stock Available for Use

### STEP 12: INVENTORY NOW SHOWS STOCK

Materials page shows:

| Material                  | In Stock | Status |
| ------------------------- | -------- | ------ |
| Century BWP 18mm Plywood  | 9        | ✓ OK   |
| Hettich Soft-Close Hinge  | 50       | ✓ OK   |
| Faber Hood Zenith Chimney | 1        | ✓ OK   |

- Materials issued to project site
- Stock decreases as materials are consumed

---

## Phase 6: Ongoing Operations (Repeat Cycle)

### STEP 13: LOW STOCK ALERTS

- System monitors: current_quantity vs minimum_quantity
- Alert: "Century BWP 18mm is LOW STOCK (2 left, min: 20)"

**TRIGGERS**: Reorder without waiting for MR

---

### STEP 14: REORDER (Stock Replenishment)

- Create PO directly (not from MR) for stock replenishment
- Order reorder_quantity (30 sheets as set in material)

This is DIFFERENT from project-based MR flow

---

## Visual Summary

```
                    MASTER DATA SETUP
                    ─────────────────
            Vendors → Brands → Materials (0 stock)
                              │
                              ▼
    ┌─────────────────────────────────────────────┐
    │           PROJECT REQUIREMENT               │
    │                                             │
    │   Quotation Approved → Need Materials       │
    └─────────────────────────────────────────────┘
                              │
                              ▼
    ┌─────────────────────────────────────────────┐
    │         MATERIAL REQUISITION (MR)           │
    │                                             │
    │   Site requests → Manager approves          │
    └─────────────────────────────────────────────┘
                              │
                              ▼
    ┌─────────────────────────────────────────────┐
    │          PURCHASE ORDER (PO)                │
    │                                             │
    │   Create PO → Approve → Send to Vendor      │
    └─────────────────────────────────────────────┘
                              │
                              ▼
    ┌─────────────────────────────────────────────┐
    │        GOODS RECEIPT NOTE (GRN)             │
    │                                             │
    │   Receive goods → Quality check → Accept    │
    │              ↓                              │
    │   ⚡ STOCK UPDATED AUTOMATICALLY            │
    └─────────────────────────────────────────────┘
                              │
                              ▼
    ┌─────────────────────────────────────────────┐
    │            INVENTORY                        │
    │                                             │
    │   Stock available → Issue to projects       │
    │   Monitor levels → Reorder when low         │
    └─────────────────────────────────────────────┘
```

---

## Key Controls Summary

| Stage       | Who Does It        | Controls                       |
| ----------- | ------------------ | ------------------------------ |
| MR          | Site team/Designer | Prevents unauthorized requests |
| MR Approval | Project Manager    | Validates need & quantity      |
| PO          | Procurement        | Chooses best vendor/price      |
| PO Approval | Finance/Owner      | Budget control                 |
| GRN         | Warehouse          | Verifies delivery & quality    |

**The flow ensures**: Every rupee spent is approved, every item received is verified, and stock is always accurate.

---

## Menu Items in SoftInterio

| Menu Item                 | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| **Materials/Inventory**   | Catalog of all materials with pricing, stock levels |
| **Vendors**               | Supplier master data, contacts, payment terms       |
| **Material Requisitions** | Request materials for projects                      |
| **Purchase Orders**       | Formal orders to vendors                            |
| **Goods Receipts (GRN)**  | Record deliveries, update stock                     |

---

_Document created: December 2025_
