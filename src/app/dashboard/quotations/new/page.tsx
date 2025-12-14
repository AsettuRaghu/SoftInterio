"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// ============================================================================
// V2 Types - Using Cost Items with Dimensions for Calculation
// ============================================================================

interface CostItemCategory {
  id: string;
  name: string;
  slug: string;
  color?: string;
}

interface CostItem {
  id: string;
  name: string;
  slug: string;
  unit_code: string;
  default_rate: number;
  quality_tier?: string;
  category?: CostItemCategory;
}

interface ComponentType {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface SpaceType {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface TemplateLineItem {
  id: string;
  space_type_id?: string;
  component_type_id?: string;
  cost_item_id: string;
  rate?: number;
  space_type?: SpaceType;
  component_type?: ComponentType;
  cost_item?: CostItem;
}

interface TemplateSpace {
  id: string;
  space_type_id: string;
  default_name?: string;
  space_type?: SpaceType;
}

interface QuotationTemplate {
  id: string;
  name: string;
  description?: string;
  property_type: string;
  quality_tier: string;
  spaces: TemplateSpace[];
  line_items: TemplateLineItem[];
}

// Local state types for quotation builder
interface QuotationLineItem {
  id: string;
  costItemId: string;
  costItemName: string;
  categoryName: string;
  categoryColor?: string;
  unitCode: string;
  calculationType: string; // area, length, quantity, fixed
  rate: number;
  // Dimensions (entered by user)
  length?: number;
  width?: number;
  quantity?: number;
  // Calculated
  calculatedQuantity: number;
  amount: number;
}

interface QuotationComponent {
  id: string;
  componentTypeId: string;
  componentTypeName: string;
  description?: string; // User notes/description for this component
  lineItems: QuotationLineItem[];
  expanded: boolean;
  subtotal: number;
}

interface QuotationSpace {
  id: string;
  spaceTypeId: string;
  spaceTypeName: string;
  name: string; // Custom name like "Master Bedroom 1"
  // Space-level dimensions (optional, can be used for area calculation)
  length?: number;
  width?: number;
  area?: number;
  components: QuotationComponent[];
  directLineItems: QuotationLineItem[]; // Line items not under a component
  expanded: boolean;
  subtotal: number;
}

// Unit configuration for calculations
interface UnitConfig {
  code: string;
  name: string;
  calculation_type: "area" | "length" | "quantity" | "fixed";
}

const UNIT_CONFIGS: Record<string, UnitConfig> = {
  sqft: { code: "sqft", name: "Square Feet", calculation_type: "area" },
  rft: { code: "rft", name: "Running Feet", calculation_type: "length" },
  nos: { code: "nos", name: "Numbers", calculation_type: "quantity" },
  set: { code: "set", name: "Set", calculation_type: "quantity" },
  lot: { code: "lot", name: "Lot", calculation_type: "fixed" },
  lumpsum: { code: "lumpsum", name: "Lump Sum", calculation_type: "fixed" },
  kg: { code: "kg", name: "Kilogram", calculation_type: "quantity" },
  ltr: { code: "ltr", name: "Litre", calculation_type: "quantity" },
};

// Utility
const generateId = () => Math.random().toString(36).substr(2, 9);

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const CATEGORY_COLORS: Record<string, string> = {
  carcass: "bg-amber-100 text-amber-700",
  shutter: "bg-blue-100 text-blue-700",
  hardware: "bg-purple-100 text-purple-700",
  finish: "bg-pink-100 text-pink-700",
  labour: "bg-green-100 text-green-700",
  accessories: "bg-indigo-100 text-indigo-700",
  countertop: "bg-teal-100 text-teal-700",
  appliances: "bg-orange-100 text-orange-700",
  default: "bg-slate-100 text-slate-600",
};

function getCategoryColor(categorySlug?: string): string {
  if (!categorySlug) return CATEGORY_COLORS.default;
  return CATEGORY_COLORS[categorySlug.toLowerCase()] || CATEGORY_COLORS.default;
}

// ============================================================================
// Main Component
// ============================================================================

function NewQuotationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const leadId = searchParams.get("lead");

  // Form state
  const [quotationTitle, setQuotationTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  // Lead/client info (if creating from lead)
  const [leadInfo, setLeadInfo] = useState<{
    client_name: string;
    property_name: string;
    property_address: string;
    property_city: string;
    carpet_area_sqft: number;
  } | null>(null);

  // Template data
  const [template, setTemplate] = useState<QuotationTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Quotation structure
  const [spaces, setSpaces] = useState<QuotationSpace[]>([]);
  const [ungroupedLineItems, setUngroupedLineItems] = useState<
    QuotationLineItem[]
  >([]);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(
    new Set()
  );

  // Fetch template if templateId is provided
  useEffect(() => {
    if (templateId) {
      setLoadingTemplate(true);
      fetch(`/api/quotations/templates/${templateId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.template) {
            setTemplate(data.template);
            // Initialize quotation from template
            initializeFromTemplate(data.template);
          }
        })
        .catch((err) => console.error("Error loading template:", err))
        .finally(() => setLoadingTemplate(false));
    }
  }, [templateId]);

  // Fetch lead info if leadId is provided
  useEffect(() => {
    if (leadId) {
      fetch(`/api/sales/leads/${leadId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.lead) {
            setLeadInfo({
              client_name: data.lead.client_name || "",
              property_name: data.lead.property_name || "",
              property_address: data.lead.property_address || "",
              property_city: data.lead.property_city || "",
              carpet_area_sqft: data.lead.carpet_area_sqft || 0,
            });
            setQuotationTitle(
              `Quotation for ${data.lead.client_name || "Client"}`
            );
          }
        })
        .catch((err) => console.error("Error loading lead:", err));
    }
  }, [leadId]);

  // Initialize quotation structure from template
  const initializeFromTemplate = useCallback((tmpl: QuotationTemplate) => {
    const spaceMap = new Map<string, QuotationSpace>();
    const ungrouped: QuotationLineItem[] = [];

    // Create spaces from template spaces
    tmpl.spaces.forEach((ts) => {
      const spaceId = generateId();
      spaceMap.set(ts.space_type_id, {
        id: spaceId,
        spaceTypeId: ts.space_type_id,
        spaceTypeName: ts.space_type?.name || ts.space_type_id,
        name: ts.default_name || ts.space_type?.name || "Space",
        components: [],
        directLineItems: [],
        expanded: true,
        subtotal: 0,
      });
    });

    // Organize line items
    tmpl.line_items.forEach((item) => {
      const lineItem: QuotationLineItem = {
        id: generateId(),
        costItemId: item.cost_item_id,
        costItemName: item.cost_item?.name || item.cost_item_id,
        categoryName: item.cost_item?.category?.name || "",
        categoryColor: item.cost_item?.category?.color,
        unitCode: item.cost_item?.unit_code || "nos",
        calculationType:
          UNIT_CONFIGS[item.cost_item?.unit_code || "nos"]?.calculation_type ||
          "quantity",
        rate: item.rate || item.cost_item?.default_rate || 0,
        calculatedQuantity: 0,
        amount: 0,
      };

      if (item.space_type_id) {
        let space = spaceMap.get(item.space_type_id);

        // Create space if it doesn't exist
        if (!space) {
          const spaceId = generateId();
          space = {
            id: spaceId,
            spaceTypeId: item.space_type_id,
            spaceTypeName: item.space_type?.name || item.space_type_id,
            name: item.space_type?.name || "Space",
            components: [],
            directLineItems: [],
            expanded: true,
            subtotal: 0,
          };
          spaceMap.set(item.space_type_id, space);
        }

        if (item.component_type_id) {
          // Find or create component
          let component = space.components.find(
            (c) => c.componentTypeId === item.component_type_id
          );

          if (!component) {
            component = {
              id: generateId(),
              componentTypeId: item.component_type_id,
              componentTypeName:
                item.component_type?.name || item.component_type_id,
              lineItems: [],
              expanded: true,
              subtotal: 0,
            };
            space.components.push(component);
          }

          component.lineItems.push(lineItem);
        } else {
          // Direct line item under space
          space.directLineItems.push(lineItem);
        }
      } else {
        // Ungrouped
        ungrouped.push(lineItem);
      }
    });

    setSpaces(Array.from(spaceMap.values()));
    setUngroupedLineItems(ungrouped);

    // Expand all
    const allSpaceIds = new Set(Array.from(spaceMap.values()).map((s) => s.id));
    setExpandedSpaces(allSpaceIds);
  }, []);

  // Calculate line item amount based on dimensions
  const calculateLineItemAmount = useCallback(
    (item: QuotationLineItem): { quantity: number; amount: number } => {
      const calcType =
        UNIT_CONFIGS[item.unitCode]?.calculation_type || "quantity";
      let quantity = 0;

      switch (calcType) {
        case "area":
          quantity = (item.length || 0) * (item.width || 0);
          break;
        case "length":
          quantity = item.length || 0;
          break;
        case "quantity":
          quantity = item.quantity || 0;
          break;
        case "fixed":
          quantity = 1;
          break;
      }

      return {
        quantity,
        amount: quantity * item.rate,
      };
    },
    []
  );

  // Update line item dimensions
  const updateLineItemDimension = useCallback(
    (
      spaceId: string | null,
      componentId: string | null,
      lineItemId: string,
      field: "length" | "width" | "quantity",
      value: number
    ) => {
      if (spaceId === null) {
        // Ungrouped line item
        setUngroupedLineItems((items) =>
          items.map((item) => {
            if (item.id === lineItemId) {
              const updated = { ...item, [field]: value };
              const calc = calculateLineItemAmount(updated);
              return {
                ...updated,
                calculatedQuantity: calc.quantity,
                amount: calc.amount,
              };
            }
            return item;
          })
        );
      } else {
        setSpaces((prevSpaces) =>
          prevSpaces.map((space) => {
            if (space.id !== spaceId) return space;

            if (componentId === null) {
              // Direct line item under space
              return {
                ...space,
                directLineItems: space.directLineItems.map((item) => {
                  if (item.id === lineItemId) {
                    const updated = { ...item, [field]: value };
                    const calc = calculateLineItemAmount(updated);
                    return {
                      ...updated,
                      calculatedQuantity: calc.quantity,
                      amount: calc.amount,
                    };
                  }
                  return item;
                }),
              };
            }

            // Line item under component
            return {
              ...space,
              components: space.components.map((comp) => {
                if (comp.id !== componentId) return comp;
                return {
                  ...comp,
                  lineItems: comp.lineItems.map((item) => {
                    if (item.id === lineItemId) {
                      const updated = { ...item, [field]: value };
                      const calc = calculateLineItemAmount(updated);
                      return {
                        ...updated,
                        calculatedQuantity: calc.quantity,
                        amount: calc.amount,
                      };
                    }
                    return item;
                  }),
                };
              }),
            };
          })
        );
      }
    },
    [calculateLineItemAmount]
  );

  // Update space dimensions (applies to all sqft items in space)
  const updateSpaceDimensions = useCallback(
    (spaceId: string, length: number, width: number) => {
      setSpaces((prevSpaces) =>
        prevSpaces.map((space) => {
          if (space.id !== spaceId) return space;

          const area = length * width;

          // Update all area-based line items in this space
          const updateAreaItems = (items: QuotationLineItem[]) =>
            items.map((item) => {
              if (
                UNIT_CONFIGS[item.unitCode]?.calculation_type === "area" &&
                !item.length &&
                !item.width
              ) {
                // Only auto-fill if not already set
                const calc = calculateLineItemAmount({
                  ...item,
                  length,
                  width,
                });
                return {
                  ...item,
                  length,
                  width,
                  calculatedQuantity: calc.quantity,
                  amount: calc.amount,
                };
              }
              return item;
            });

          return {
            ...space,
            length,
            width,
            area,
            directLineItems: updateAreaItems(space.directLineItems),
            components: space.components.map((comp) => ({
              ...comp,
              lineItems: updateAreaItems(comp.lineItems),
            })),
          };
        })
      );
    },
    [calculateLineItemAmount]
  );

  // Update component description/notes
  const updateComponentDescription = useCallback(
    (spaceId: string, componentId: string, description: string) => {
      setSpaces((prevSpaces) =>
        prevSpaces.map((space) => {
          if (space.id !== spaceId) return space;
          return {
            ...space,
            components: space.components.map((comp) => {
              if (comp.id !== componentId) return comp;
              return { ...comp, description };
            }),
          };
        })
      );
    },
    []
  );

  // Update line item rate
  const updateLineItemRate = useCallback(
    (
      spaceId: string | null,
      componentId: string | null,
      lineItemId: string,
      rate: number
    ) => {
      if (spaceId === null) {
        // Ungrouped line item
        setUngroupedLineItems((items) =>
          items.map((item) => {
            if (item.id === lineItemId) {
              const updated = { ...item, rate };
              const calc = calculateLineItemAmount(updated);
              return {
                ...updated,
                calculatedQuantity: calc.quantity,
                amount: calc.amount,
              };
            }
            return item;
          })
        );
      } else {
        setSpaces((prevSpaces) =>
          prevSpaces.map((space) => {
            if (space.id !== spaceId) return space;

            if (componentId === null) {
              // Direct line item under space
              return {
                ...space,
                directLineItems: space.directLineItems.map((item) => {
                  if (item.id === lineItemId) {
                    const updated = { ...item, rate };
                    const calc = calculateLineItemAmount(updated);
                    return {
                      ...updated,
                      calculatedQuantity: calc.quantity,
                      amount: calc.amount,
                    };
                  }
                  return item;
                }),
              };
            }

            // Line item under component
            return {
              ...space,
              components: space.components.map((comp) => {
                if (comp.id !== componentId) return comp;
                return {
                  ...comp,
                  lineItems: comp.lineItems.map((item) => {
                    if (item.id === lineItemId) {
                      const updated = { ...item, rate };
                      const calc = calculateLineItemAmount(updated);
                      return {
                        ...updated,
                        calculatedQuantity: calc.quantity,
                        amount: calc.amount,
                      };
                    }
                    return item;
                  }),
                };
              }),
            };
          })
        );
      }
    },
    [calculateLineItemAmount]
  );

  // Calculate totals
  const totals = useMemo(() => {
    let subtotal = 0;

    spaces.forEach((space) => {
      space.directLineItems.forEach((item) => {
        subtotal += item.amount;
      });
      space.components.forEach((comp) => {
        comp.lineItems.forEach((item) => {
          subtotal += item.amount;
        });
      });
    });

    ungroupedLineItems.forEach((item) => {
      subtotal += item.amount;
    });

    const gst = subtotal * 0.18;
    const grandTotal = subtotal + gst;

    return { subtotal, gst, grandTotal };
  }, [spaces, ungroupedLineItems]);

  // Space totals for summary
  const spaceTotals = useMemo(() => {
    return spaces.map((space) => {
      let total = 0;
      space.directLineItems.forEach((item) => {
        total += item.amount;
      });
      space.components.forEach((comp) => {
        comp.lineItems.forEach((item) => {
          total += item.amount;
        });
      });
      return { id: space.id, name: space.name, total };
    });
  }, [spaces]);

  // Toggle expand
  const toggleSpace = (spaceId: string) => {
    setExpandedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  };

  const toggleComponent = (componentId: string) => {
    setExpandedComponents((prev) => {
      const next = new Set(prev);
      if (next.has(componentId)) next.delete(componentId);
      else next.add(componentId);
      return next;
    });
  };

  // Save quotation
  const saveQuotation = async (status: "draft" | "pending" = "draft") => {
    setIsSaving(true);

    try {
      // Build payload
      const payload: Record<string, unknown> = {
        title: quotationTitle,
        template_id: templateId,
        lead_id: leadId,
        status,
        valid_until: validUntil || null,
        notes,
        subtotal: totals.subtotal,
        tax_percent: 18,
        tax_amount: totals.gst,
        grand_total: totals.grandTotal,
        // V2 structure
        spaces: spaces.map((space, spaceIndex) => ({
          space_type_id: space.spaceTypeId,
          name: space.name,
          length: space.length,
          width: space.width,
          area: space.area,
          sort_order: spaceIndex,
          components: space.components.map((comp, compIndex) => ({
            component_type_id: comp.componentTypeId,
            name: comp.componentTypeName,
            sort_order: compIndex,
          })),
        })),
        lineItems: [
          // Flatten all line items
          ...spaces.flatMap((space) => [
            ...space.directLineItems.map((item, idx) => ({
              cost_item_id: item.costItemId,
              name: item.costItemName,
              length: item.length,
              width: item.width,
              quantity: item.calculatedQuantity,
              unit_code: item.unitCode,
              rate: item.rate,
              amount: item.amount,
              display_order: idx,
              // Space reference will be set by API based on space index
              space_index: spaces.indexOf(space),
            })),
            ...space.components.flatMap((comp) =>
              comp.lineItems.map((item, idx) => ({
                cost_item_id: item.costItemId,
                name: item.costItemName,
                length: item.length,
                width: item.width,
                quantity: item.calculatedQuantity,
                unit_code: item.unitCode,
                rate: item.rate,
                amount: item.amount,
                display_order: idx,
                space_index: spaces.indexOf(space),
                component_index: space.components.indexOf(comp),
              }))
            ),
          ]),
          ...ungroupedLineItems.map((item, idx) => ({
            cost_item_id: item.costItemId,
            name: item.costItemName,
            length: item.length,
            width: item.width,
            quantity: item.calculatedQuantity,
            unit_code: item.unitCode,
            rate: item.rate,
            amount: item.amount,
            display_order: idx,
          })),
        ],
      };

      const response = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save quotation");
      }

      const result = await response.json();
      router.push(`/dashboard/quotations/${result.quotation.id}`);
    } catch (error) {
      console.error("Error saving quotation:", error);
      alert(
        error instanceof Error ? error.message : "Failed to save quotation"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Render dimension inputs for a line item
  const renderDimensionInputs = (
    item: QuotationLineItem,
    spaceId: string | null,
    componentId: string | null
  ) => {
    const calcType =
      UNIT_CONFIGS[item.unitCode]?.calculation_type || "quantity";

    switch (calcType) {
      case "area":
        return (
          <>
            <td className="px-3 py-2">
              <input
                type="number"
                step="0.01"
                value={item.length || ""}
                onChange={(e) =>
                  updateLineItemDimension(
                    spaceId,
                    componentId,
                    item.id,
                    "length",
                    Math.max(0, parseFloat(e.target.value) || 0)
                  )
                }
                onFocus={(e) => e.target.select()}
                placeholder="L"
                className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
              />
            </td>
            <td className="px-3 py-2">
              <input
                type="number"
                step="0.01"
                value={item.width || ""}
                onChange={(e) =>
                  updateLineItemDimension(
                    spaceId,
                    componentId,
                    item.id,
                    "width",
                    Math.max(0, parseFloat(e.target.value) || 0)
                  )
                }
                onFocus={(e) => e.target.select()}
                placeholder="W"
                className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
              />
            </td>
            <td className="px-3 py-2 text-center text-slate-600">
              {item.calculatedQuantity.toFixed(2)}
            </td>
          </>
        );
      case "length":
        return (
          <>
            <td className="px-3 py-2">
              <input
                type="number"
                step="0.01"
                value={item.length || ""}
                onChange={(e) =>
                  updateLineItemDimension(
                    spaceId,
                    componentId,
                    item.id,
                    "length",
                    Math.max(0, parseFloat(e.target.value) || 0)
                  )
                }
                onFocus={(e) => e.target.select()}
                placeholder="Length"
                className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
              />
            </td>
            <td className="px-3 py-2">—</td>
            <td className="px-3 py-2 text-center text-slate-600">
              {item.calculatedQuantity.toFixed(2)}
            </td>
          </>
        );
      case "quantity":
        return (
          <>
            <td className="px-3 py-2">—</td>
            <td className="px-3 py-2">—</td>
            <td className="px-3 py-2">
              <input
                type="number"
                step="0.01"
                value={item.quantity || ""}
                onChange={(e) =>
                  updateLineItemDimension(
                    spaceId,
                    componentId,
                    item.id,
                    "quantity",
                    Math.max(0, parseFloat(e.target.value) || 0)
                  )
                }
                onFocus={(e) => e.target.select()}
                placeholder="Qty"
                className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
              />
            </td>
          </>
        );
      case "fixed":
        return (
          <>
            <td className="px-3 py-2">—</td>
            <td className="px-3 py-2">—</td>
            <td className="px-3 py-2 text-center text-slate-500">Lump Sum</td>
          </>
        );
      default:
        return (
          <>
            <td className="px-3 py-2">—</td>
            <td className="px-3 py-2">—</td>
            <td className="px-3 py-2">—</td>
          </>
        );
    }
  };

  // Loading state
  if (loadingTemplate) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/quotations"
                className="text-slate-600 hover:text-slate-900"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  New Quotation
                </h1>
                <p className="text-sm text-slate-500">
                  {template
                    ? `Based on: ${template.name}`
                    : "Create a cost estimate"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => saveQuotation("draft")}
                disabled={isSaving}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                onClick={() => saveQuotation("pending")}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Generate Quote"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Main Content */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Quotation Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Quotation Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quotation Title
                </label>
                <input
                  type="text"
                  value={quotationTitle}
                  onChange={(e) => setQuotationTitle(e.target.value)}
                  placeholder="e.g., 3BHK Interior Quotation"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {leadInfo && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Client
                  </label>
                  <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-900">
                    {leadInfo.client_name}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            {leadInfo && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Property
                  </label>
                  <p className="text-sm text-slate-600">
                    {leadInfo.property_name}, {leadInfo.property_city}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Carpet Area
                  </label>
                  <p className="text-sm text-slate-600">
                    {leadInfo.carpet_area_sqft} sqft
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Cost Breakdown */}
          {spaces.length === 0 && ungroupedLineItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No Template Selected
              </h3>
              <p className="text-slate-600 mb-6">
                Select a template to start building your quotation with
                predefined cost items.
              </p>
              <Link
                href="/dashboard/quotations/templates"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
              >
                Browse Templates
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Spaces */}
              {spaces.map((space) => (
                <div
                  key={space.id}
                  className="bg-white rounded-xl border border-slate-200"
                >
                  {/* Space Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-100 cursor-pointer rounded-t-xl"
                    onClick={() => toggleSpace(space.id)}
                  >
                    <div className="flex items-center gap-3">
                      <button className="text-blue-600">
                        <svg
                          className={`w-5 h-5 transition-transform ${
                            expandedSpaces.has(space.id) ? "rotate-90" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      </div>
                      <div>
                        <input
                          type="text"
                          value={space.name}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSpaces((prev) =>
                              prev.map((s) =>
                                s.id === space.id
                                  ? { ...s, name: e.target.value }
                                  : s
                              )
                            );
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-slate-900 bg-transparent border-none focus:ring-0 p-0"
                        />
                        <p className="text-xs text-slate-500">
                          {space.spaceTypeName} • {space.components.length}{" "}
                          components
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Quick dimension inputs for space */}
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs text-slate-500">
                          Space Size:
                        </span>
                        <input
                          type="number"
                          value={space.length || ""}
                          onChange={(e) =>
                            updateSpaceDimensions(
                              space.id,
                              parseFloat(e.target.value) || 0,
                              space.width || 0
                            )
                          }
                          placeholder="L"
                          className="w-14 px-2 py-1 text-xs border border-slate-300 rounded"
                        />
                        <span className="text-slate-400">×</span>
                        <input
                          type="number"
                          value={space.width || ""}
                          onChange={(e) =>
                            updateSpaceDimensions(
                              space.id,
                              space.length || 0,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="W"
                          className="w-14 px-2 py-1 text-xs border border-slate-300 rounded"
                        />
                        <span className="text-xs text-slate-500">ft</span>
                      </div>
                      <span className="text-lg font-bold text-blue-600">
                        {formatCurrency(
                          spaceTotals.find((t) => t.id === space.id)?.total || 0
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Space Content */}
                  {expandedSpaces.has(space.id) && (
                    <div className="p-4 space-y-4">
                      {/* Components */}
                      {space.components.map((component) => (
                        <div
                          key={component.id}
                          className="border border-slate-200 rounded-lg"
                        >
                          {/* Component Header */}
                          <div
                            className="flex items-center justify-between px-4 py-2.5 bg-slate-50 cursor-pointer rounded-t-lg"
                            onClick={() => toggleComponent(component.id)}
                          >
                            <div className="flex items-center gap-3">
                              <button className="text-slate-600">
                                <svg
                                  className={`w-4 h-4 transition-transform ${
                                    expandedComponents.has(component.id)
                                      ? "rotate-90"
                                      : ""
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </button>
                              <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
                                <svg
                                  className="w-3 h-3 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                  />
                                </svg>
                              </div>
                              <div>
                                <h5 className="text-sm font-medium text-slate-900">
                                  {component.componentTypeName}
                                </h5>
                                <p className="text-xs text-slate-500">
                                  {component.lineItems.length} cost items
                                </p>
                              </div>
                            </div>
                            <span className="font-semibold text-purple-600">
                              {formatCurrency(
                                component.lineItems.reduce(
                                  (sum, item) => sum + item.amount,
                                  0
                                )
                              )}
                            </span>
                          </div>

                          {/* Component Line Items */}
                          {expandedComponents.has(component.id) && (
                            <div className="p-3 border-t border-slate-100">
                              {/* Component Description/Notes */}
                              <div className="mb-3">
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                  Component Notes / Description
                                </label>
                                <textarea
                                  value={component.description || ""}
                                  onChange={(e) =>
                                    updateComponentDescription(
                                      space.id,
                                      component.id,
                                      e.target.value
                                    )
                                  }
                                  placeholder="e.g., 8ft x 7ft sliding wardrobe with mirror, soft-close hinges..."
                                  rows={2}
                                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-none"
                                />
                              </div>

                              <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                                      Cost Item
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                                      Unit
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                                      L (ft)
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                                      W (ft)
                                    </th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase">
                                      Qty
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                                      Rate (₹)
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                                      Amount
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {component.lineItems.map((item) => (
                                    <tr
                                      key={item.id}
                                      className="hover:bg-slate-50"
                                    >
                                      <td className="px-3 py-2">
                                        <span className="font-medium text-slate-900">
                                          {item.costItemName}
                                        </span>
                                        {item.categoryName && (
                                          <span
                                            className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getCategoryColor(
                                              item.categoryName
                                                .toLowerCase()
                                                .replace(/\s/g, "")
                                            )}`}
                                          >
                                            {item.categoryName}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-slate-600">
                                        {item.unitCode}
                                      </td>
                                      {renderDimensionInputs(
                                        item,
                                        space.id,
                                        component.id
                                      )}
                                      <td className="px-3 py-2">
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={item.rate || ""}
                                          onChange={(e) =>
                                            updateLineItemRate(
                                              space.id,
                                              component.id,
                                              item.id,
                                              Math.max(
                                                0,
                                                parseFloat(e.target.value) || 0
                                              )
                                            )
                                          }
                                          onFocus={(e) => e.target.select()}
                                          className="w-20 px-2 py-1 text-sm text-right border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                                        />
                                      </td>
                                      <td className="px-3 py-2 text-right font-medium text-green-600">
                                        {formatCurrency(item.amount)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Direct line items under space */}
                      {space.directLineItems.length > 0 && (
                        <div className="border border-dashed border-slate-300 rounded-lg p-3">
                          <h5 className="text-xs font-medium text-slate-500 uppercase mb-2">
                            Other Cost Items
                          </h5>
                          <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-100">
                              {space.directLineItems.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-medium text-slate-900">
                                    {item.costItemName}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {item.unitCode}
                                  </td>
                                  {renderDimensionInputs(item, space.id, null)}
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.rate || ""}
                                      onChange={(e) =>
                                        updateLineItemRate(
                                          space.id,
                                          null,
                                          item.id,
                                          Math.max(
                                            0,
                                            parseFloat(e.target.value) || 0
                                          )
                                        )
                                      }
                                      onFocus={(e) => e.target.select()}
                                      className="w-20 px-2 py-1 text-sm text-right border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium text-green-600">
                                    {formatCurrency(item.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Ungrouped Line Items */}
              {ungroupedLineItems.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Additional Cost Items
                  </h3>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                          Cost Item
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                          Unit
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                          L
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                          W
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase">
                          Qty
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                          Rate
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ungroupedLineItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {item.costItemName}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {item.unitCode}
                          </td>
                          {renderDimensionInputs(item, null, null)}
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.rate || ""}
                              onChange={(e) =>
                                updateLineItemRate(
                                  null,
                                  null,
                                  item.id,
                                  Math.max(0, parseFloat(e.target.value) || 0)
                                )
                              }
                              onFocus={(e) => e.target.select()}
                              className="w-20 px-2 py-1 text-sm text-right border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-green-600">
                            {formatCurrency(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar - Summary */}
        <div className="w-80 bg-white border-l border-slate-200 p-6 sticky top-[65px] h-[calc(100vh-65px)] overflow-auto">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Cost Summary
          </h2>

          {spaceTotals.length > 0 && (
            <div className="space-y-3 mb-6">
              {spaceTotals.map((space) => (
                <div
                  key={space.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100"
                >
                  <span className="text-sm text-slate-600">{space.name}</span>
                  <span className="text-sm font-medium text-slate-900">
                    {formatCurrency(space.total)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {(spaces.length > 0 || ungroupedLineItems.length > 0) && (
            <>
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(totals.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-600">GST (18%)</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(totals.gst)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <span className="text-lg font-semibold text-slate-900">
                    Grand Total
                  </span>
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(totals.grandTotal)}
                  </span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  Quick Stats
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Total Spaces</span>
                    <span className="font-medium text-blue-900">
                      {spaces.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Total Components</span>
                    <span className="font-medium text-blue-900">
                      {spaces.reduce((sum, s) => sum + s.components.length, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Total Line Items</span>
                    <span className="font-medium text-blue-900">
                      {spaces.reduce(
                        (sum, s) =>
                          sum +
                          s.directLineItems.length +
                          s.components.reduce(
                            (cSum, c) => cSum + c.lineItems.length,
                            0
                          ),
                        0
                      ) + ungroupedLineItems.length}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewQuotationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner />
            <p className="text-slate-600 mt-4">Loading...</p>
          </div>
        </div>
      }
    >
      <NewQuotationContent />
    </Suspense>
  );
}
