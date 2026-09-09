"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BuilderSpace,
  BuilderComponent,
  LineItem,
  MasterData,
  SpaceType,
  ComponentType,
  CostItem,
  generateId,
  formatCurrency,
  getMeasurementInfo,
  calculateSqft,
  convertToFeet,
  MeasurementUnit,
} from "@/components/quotations";
import { AddSpaceModal } from "@/components/quotations/AddSpaceModal";
import { AddComponentModal } from "@/components/quotations/AddComponentModal";
import { AddCostItemModal } from "@/components/quotations/AddCostItemModal";
import { SpaceCard } from "@/components/quotations/SpaceCard";
import { BuilderSidebar } from "@/components/quotations/BuilderSidebar";
import { RepriceModal } from "@/components/quotations/RepriceModal";
import { PrintQuotationModal } from "@/components/quotations/PrintQuotationModal";
import { TemplateModal } from "@/components/quotations/TemplateModal";
import { SaveAsTemplateModal } from "@/components/quotations/SaveAsTemplateModal";
import { NewVersionModal } from "@/components/quotations/NewVersionModal";
import { DEFAULT_TAX_PERCENT } from "@/utils/quotations";

interface QuotationBuilderProps {
  quotationId: string;
  /** Leave the builder and go back to reading the quotation. */
  onExit: () => void;
}

/**
 * The quotation builder.
 *
 * Was its own page at /quotations/[id]/edit. Viewing and editing a quotation
 * are one route now, so this is the edit half of it - the read half stays a
 * separate rendering on purpose: compact document tables are what a quotation
 * should look like when deciding whether to send it, and a grid of disabled
 * inputs is not that.
 */
export function QuotationBuilder({
  quotationId,
  onExit,
}: QuotationBuilderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const shouldOpenTemplateModal = searchParams.get("useTemplate") === "true";

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Reported by the quotation API. When false it has already stripped the cost
  // fields, so the profitability panel would have nothing to show anyway.
  const [canViewCosts, setCanViewCosts] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Components with lines that cannot be priced yet. Reported, never blocking. */
  const [incomplete, setIncomplete] = useState<
    Array<{ component: string; space: string; missing: number; what: string }>
  >([]);

  // Auto-save state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // The builder never knew where the quotation stood, which is why approving
  // was only possible from a page you had to know to navigate to.
  const [status, setStatus] = useState<string>("draft");
  const [approving, setApproving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  /**
   * What the quotation looked like when it was opened or last saved.
   *
   * "Unsaved changes" used to mean "something set state after an arbitrary
   * 100ms window closed", which is why a freshly opened quotation claimed to
   * be dirty - anything that settled late tripped it. It now means the
   * document differs from the one that was loaded, so it also clears itself
   * when an edit is undone.
   */
  const baselineRef = useRef<string | null>(null);

  // Quotation data
  const [quotationNumber, setQuotationNumber] = useState("");
  const [source, setSource] = useState<{ label: string; href: string } | null>(null);
  const [quotationName, setQuotationName] = useState("");
  const [version, setVersion] = useState(1);
  const [notes, setNotes] = useState("");
  const [taxPercent, setTaxPercent] = useState(DEFAULT_TAX_PERCENT);
  const [spaces, setSpaces] = useState<BuilderSpace[]>([]);

  // Master data
  const [masterData, setMasterData] = useState<MasterData>({
    units: [],
    space_types: [],
    component_types: [],
    quotation_cost_item_categories: [],
    quotation_cost_items: [],
  });

  // Modal states
  const [showAddSpaceModal, setShowAddSpaceModal] = useState(false);
  const [showAddComponentModal, setShowAddComponentModal] = useState<
    string | null
  >(null);
  const [showAddCostItemModal, setShowAddCostItemModal] = useState<{
    spaceId: string;
    componentId: string;
  } | null>(null);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [showRepriceModal, setShowRepriceModal] =
    useState(false);
  const [versionNotes, setVersionNotes] = useState("");
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);

  // Template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(
    null
  ); // Track which template was applied
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      name: string;
      property_type: string;
      quality_tier: string;
      description?: string;
      level?: string;
      applicable_space_type_ids?: string[];
      component_type_ids?: string[];
      component_type_names?: string[];
    }>
  >([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  // Assignee
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<
    Array<{
      id: string;
      name: string | null;
      email: string;
      roles?: Array<{ name: string }>;
    }>
  >([]);

  // Drag & drop state
  const [draggedSpaceId, setDraggedSpaceId] = useState<string | null>(null);
  const [dragOverSpaceId, setDragOverSpaceId] = useState<string | null>(null);

  // Validation state - triggers red highlighting on mandatory fields
  const [showValidation, setShowValidation] = useState(false);

  // Fetch master data
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const response = await fetch("/api/quotations/master-data");
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setMasterData({
              units: result.data.units || [],
              space_types: result.data.space_types || [],
              component_types: result.data.component_types || [],
              quotation_cost_item_categories:
                result.data.quotation_cost_item_categories ||
                result.data.cost_item_categories ||
                [],
              quotation_cost_items:
                result.data.quotation_cost_items ||
                result.data.cost_items ||
                [],
              items_by_category: result.grouped?.items_by_category || {},
            });
          }
        }
      } catch (error) {
        console.error("Error fetching master data:", error);
      }
    };
    fetchMasterData();
  }, []);

  // Fetch quotation data
  useEffect(() => {
    const fetchQuotation = async () => {
      if (!quotationId) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/quotations/${quotationId}`);
        if (!response.ok) throw new Error("Failed to load quotation");

        const data = await response.json();
        const q = data.quotation;

        if (!q) throw new Error("Quotation not found");

        setQuotationNumber(q.quotation_number || "");
        setStatus(q.status || "draft");
        // Which record this quotation belongs to. The breadcrumb otherwise
        // shows only the quotation number, which says nothing about whose job
        // is being priced.
        if (q.lead_id && q.lead?.lead_number) {
          setSource({
            label: q.lead.lead_number,
            href: `/dashboard/sales/leads/${q.lead_id}`,
          });
        } else if (q.project_id && q.project) {
          setSource({
            label: q.project.project_number || q.project.name || "Project",
            href: `/dashboard/projects/${q.project_id}`,
          });
        }
        setQuotationName(q.title || q.name || "");
        setVersion(q.version || 1);
        setNotes(q.notes || "");
        setTaxPercent(q.tax_percent ?? 18); // Load tax percent, default to 18%
        setAssignedTo(q.assigned_to || null);

        // Transform API spaces to builder format
        const transformedSpaces: BuilderSpace[] = (data.spaces || []).map(
          (space: any, idx: number) => ({
            id: space.id,
            spaceTypeId: space.space_type_id || "",
            name: space.space_type?.name || "Space",
            defaultName: space.name || `Space ${idx + 1}`,
            expanded: true,
            components: (space.components || []).map(
              (comp: any, compIdx: number) => ({
                id: comp.id,
                componentTypeId: comp.component_type_id || "",
                name:
                  comp.component_type?.name ||
                  comp.name ||
                  `Component ${compIdx + 1}`,
                description: comp.description || "",
                expanded: true,
                width: comp.width ?? null,
                height: comp.height ?? null,
                measurementUnit: (comp.metadata?.measurement_unit ||
                  "mm") as MeasurementUnit,
                lineItems: (comp.lineItems || []).map((item: any) => ({
                  id: item.id,
                  costItemId: item.cost_item_id,
                  costItemName:
                    item.cost_item?.name || item.name || "Cost Item",
                  categoryName: item.cost_item?.category?.name || "Other",
                  categoryColor: item.cost_item?.category?.color || "#718096",
                  unitCode: item.unit_code || "nos",
                  // Rate is the ACTUAL rate from quotation_line_items (what client pays)
                  rate: item.rate || 0,
                  // Default rate is the BASE COST from cost_items (suggested price)
                  defaultRate: item.cost_item?.default_rate || 0,
                  // Company cost is what we consider for internal costing
                  companyCost: item.cost_item?.company_cost || 0,
                  // Vendor cost is what we pay to purchase
                  vendorCost: item.cost_item?.vendor_cost || 0,
                  length: item.length,
                  width: item.width,
                  // Use stored measurement_unit from DB, default to mm
                  measurementUnit: (item.measurement_unit ||
                    "mm") as MeasurementUnit,
                  quantity: item.quantity || 1,
                  amount: item.amount || 0,
                  notes: item.notes || "",
                  // Existing lines pre-date this and have no flag; they keep
                  // the sizes already typed into them rather than being
                  // adopted by a component size entered later.
                  followsComponent:
                    item.metadata?.follows_component === true,
                })),
              })
            ),
          })
        );

        setSpaces(transformedSpaces);
        setCanViewCosts(!!data.can_view_costs);
        setLoadError(null);
      } catch (error) {
        console.error("Error loading quotation:", error);
        setLoadError(
          error instanceof Error ? error.message : "Failed to load quotation"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuotation();
  }, [quotationId]);

  // Fetch team members for assignee dropdown
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const response = await fetch("/api/team/members");
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setTeamMembers(result.data);
          }
        }
      } catch (error) {
        console.error("Error fetching team members:", error);
      }
    };
    fetchTeamMembers();
  }, []);

  // Auto-open template modal if URL has useTemplate=true
  useEffect(() => {
    if (shouldOpenTemplateModal && !isLoading) {
      openTemplateModal();
      router.replace(`/dashboard/quotations/${quotationId}?edit=1`, {
        scroll: false,
      });
    }
  }, [shouldOpenTemplateModal, isLoading, quotationId, router]);

  // Calculate totals
  const calculateTotals = useCallback(() => {
    let subtotal = 0;
    spaces.forEach((space) => {
      space.components.forEach((comp) => {
        comp.lineItems.forEach((item) => {
          subtotal += calculateItemAmount(item);
        });
      });
    });
    const taxAmount = subtotal * (taxPercent / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  }, [spaces, taxPercent]);

  // Calculate single item amount
  const calculateItemAmount = (item: LineItem): number => {
    const measureType = getMeasurementInfo(item.unitCode).type;
    const unit = item.measurementUnit || "mm"; // Use stored unit, default to mm for legacy data
    switch (measureType) {
      case "area":
        // Use calculateSqft to properly convert from selected unit to sqft
        const sqft = calculateSqft(item.length, item.width, unit);
        return sqft * item.rate;
      case "length":
        // Convert length to feet then multiply by rate
        const lengthInFeet = convertToFeet(item.length || 0, unit);
        return lengthInFeet * item.rate;
      case "quantity":
        return (item.quantity || 0) * item.rate;
      case "fixed":
        return item.rate;
      default:
        return (item.quantity || 0) * item.rate;
    }
  };

  // Space operations
  const addSpace = (spaceType: SpaceType) => {
    const existingCount = spaces.filter(
      (s) => s.spaceTypeId === spaceType.id
    ).length;
    const defaultName =
      existingCount > 0
        ? `${spaceType.name} ${existingCount + 1}`
        : spaceType.name;

    const newSpace: BuilderSpace = {
      id: `new-${generateId()}`,
      spaceTypeId: spaceType.id,
      name: spaceType.name,
      defaultName,
      components: [],
      expanded: true,
    };
    setSpaces([...spaces, newSpace]);
    setShowAddSpaceModal(false);
  };

  const updateSpaceName = (spaceId: string, name: string) => {
    setSpaces(
      spaces.map((s) => (s.id === spaceId ? { ...s, defaultName: name } : s))
    );
  };

  const deleteSpace = (spaceId: string) => {
    setSpaces(spaces.filter((s) => s.id !== spaceId));
  };

  const toggleSpaceExpand = (spaceId: string) => {
    setSpaces(
      spaces.map((s) =>
        s.id === spaceId ? { ...s, expanded: !s.expanded } : s
      )
    );
  };

  // Component operations
  const addComponent = (spaceId: string, componentType: ComponentType) => {
    const newComponent: BuilderComponent = {
      id: `new-${generateId()}`,
      componentTypeId: componentType.id,
      name: componentType.name,
      lineItems: [],
      expanded: true,
    };

    setSpaces(
      spaces.map((space) => {
        if (space.id === spaceId) {
          return { ...space, components: [...space.components, newComponent] };
        }
        return space;
      })
    );
    setShowAddComponentModal(null);
  };

  const deleteComponent = (spaceId: string, componentId: string) => {
    setSpaces(
      spaces.map((space) => {
        if (space.id === spaceId) {
          return {
            ...space,
            components: space.components.filter((c) => c.id !== componentId),
          };
        }
        return space;
      })
    );
  };

  const toggleComponentExpand = (spaceId: string, componentId: string) => {
    setSpaces(
      spaces.map((space) => {
        if (space.id === spaceId) {
          return {
            ...space,
            components: space.components.map((c) =>
              c.id === componentId ? { ...c, expanded: !c.expanded } : c
            ),
          };
        }
        return space;
      })
    );
  };

  const updateComponentDescription = (
    spaceId: string,
    componentId: string,
    description: string
  ) => {
    setSpaces(
      spaces.map((space) => {
        if (space.id === spaceId) {
          return {
            ...space,
            components: space.components.map((c) =>
              c.id === componentId ? { ...c, description } : c
            ),
          };
        }
        return space;
      })
    );
  };

  // Update component custom name (like "Master Wardrobe" instead of just "Wardrobe")
  const updateComponentName = (
    spaceId: string,
    componentId: string,
    customName: string
  ) => {
    setSpaces(
      spaces.map((space) => {
        if (space.id === spaceId) {
          return {
            ...space,
            components: space.components.map((c) =>
              c.id === componentId ? { ...c, customName } : c
            ),
          };
        }
        return space;
      })
    );
  };

  // Duplicate component within same space
  const duplicateComponent = (spaceId: string, componentId: string) => {
    const space = spaces.find((s) => s.id === spaceId);
    const component = space?.components.find((c) => c.id === componentId);
    if (!component) return;

    const newComponent: BuilderComponent = {
      ...component,
      id: `new-${generateId()}`,
      customName: component.customName
        ? `${component.customName} (Copy)`
        : `${component.name} (Copy)`,
      lineItems: component.lineItems.map((item) => ({
        ...item,
        id: `new-${generateId()}`,
      })),
    };

    setSpaces(
      spaces.map((s) => {
        if (s.id === spaceId) {
          const componentIndex = s.components.findIndex(
            (c) => c.id === componentId
          );
          const newComponents = [...s.components];
          newComponents.splice(componentIndex + 1, 0, newComponent);
          return { ...s, components: newComponents };
        }
        return s;
      })
    );
  };

  // Duplicate space
  const duplicateSpace = (spaceId: string) => {
    const space = spaces.find((s) => s.id === spaceId);
    if (!space) return;

    const newSpace: BuilderSpace = {
      ...space,
      id: `new-${generateId()}`,
      defaultName: `${space.defaultName} (Copy)`,
      components: space.components.map((comp) => ({
        ...comp,
        id: `new-${generateId()}`,
        lineItems: comp.lineItems.map((item) => ({
          ...item,
          id: `new-${generateId()}`,
        })),
      })),
    };

    const spaceIndex = spaces.findIndex((s) => s.id === spaceId);
    const newSpaces = [...spaces];
    newSpaces.splice(spaceIndex + 1, 0, newSpace);
    setSpaces(newSpaces);
  };

  // Drag & drop handlers for spaces
  const handleSpaceDragStart = (spaceId: string) => {
    setDraggedSpaceId(spaceId);
  };

  const handleSpaceDragOver = (e: React.DragEvent, spaceId: string) => {
    e.preventDefault();
    if (draggedSpaceId && draggedSpaceId !== spaceId) {
      setDragOverSpaceId(spaceId);
    }
  };

  const handleSpaceDragLeave = () => {
    setDragOverSpaceId(null);
  };

  const handleSpaceDrop = (targetSpaceId: string) => {
    if (!draggedSpaceId || draggedSpaceId === targetSpaceId) {
      setDraggedSpaceId(null);
      setDragOverSpaceId(null);
      return;
    }

    const draggedIndex = spaces.findIndex((s) => s.id === draggedSpaceId);
    const targetIndex = spaces.findIndex((s) => s.id === targetSpaceId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newSpaces = [...spaces];
    const [draggedSpace] = newSpaces.splice(draggedIndex, 1);
    newSpaces.splice(targetIndex, 0, draggedSpace);

    setSpaces(newSpaces);
    setDraggedSpaceId(null);
    setDragOverSpaceId(null);
  };

  const handleSpaceDragEnd = () => {
    setDraggedSpaceId(null);
    setDragOverSpaceId(null);
  };

  // Collapse/Expand all spaces and components
  const collapseAll = () => {
    setSpaces(
      spaces.map((space) => ({
        ...space,
        expanded: false,
        components: space.components.map((comp) => ({
          ...comp,
          expanded: false,
        })),
      }))
    );
  };

  const expandAll = () => {
    setSpaces(
      spaces.map((space) => ({
        ...space,
        expanded: true,
        components: space.components.map((comp) => ({
          ...comp,
          expanded: true,
        })),
      }))
    );
  };

  // Check if any spaces are collapsed
  const hasCollapsedSpaces = spaces.some(
    (s) => !s.expanded || s.components.some((c) => !c.expanded)
  );

  // Move space up/down (keyboard alternative to drag)
  const moveSpace = (spaceId: string, direction: "up" | "down") => {
    const index = spaces.findIndex((s) => s.id === spaceId);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= spaces.length) return;

    const newSpaces = [...spaces];
    [newSpaces[index], newSpaces[newIndex]] = [
      newSpaces[newIndex],
      newSpaces[index],
    ];
    setSpaces(newSpaces);
  };

  // Move component within a space
  const moveComponent = (
    spaceId: string,
    componentId: string,
    direction: "up" | "down"
  ) => {
    setSpaces(
      spaces.map((space) => {
        if (space.id !== spaceId) return space;

        const index = space.components.findIndex((c) => c.id === componentId);
        if (index === -1) return space;

        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= space.components.length) return space;

        const newComponents = [...space.components];
        [newComponents[index], newComponents[newIndex]] = [
          newComponents[newIndex],
          newComponents[index],
        ];

        return { ...space, components: newComponents };
      })
    );
  };

  // Move line item up/down within a component
  const moveLineItem = (
    spaceId: string,
    componentId: string,
    lineItemId: string,
    direction: "up" | "down"
  ) => {
    setSpaces(
      spaces.map((space) => {
        if (space.id !== spaceId) return space;

        const updatedComponents = space.components.map((component) => {
          if (component.id !== componentId) return component;

          const itemIndex = component.lineItems.findIndex(
            (li) => li.id === lineItemId
          );
          if (itemIndex === -1) return component;

          const newIndex = direction === "up" ? itemIndex - 1 : itemIndex + 1;
          if (newIndex < 0 || newIndex >= component.lineItems.length)
            return component;

          const newLineItems = [...component.lineItems];
          [newLineItems[itemIndex], newLineItems[newIndex]] = [
            newLineItems[newIndex],
            newLineItems[itemIndex],
          ];
          return { ...component, lineItems: newLineItems };
        });

        return { ...space, components: updatedComponents };
      })
    );
  };

  // Cost item operations
  const addCostItem = (
    spaceId: string,
    componentId: string,
    costItem: CostItem
  ) => {
    const categoriesData =
      masterData.quotation_cost_item_categories ||
      masterData.cost_item_categories ||
      [];
    const category = categoriesData.find((c) => c.id === costItem.category_id);

    const newLineItem: LineItem = {
      id: `new-${generateId()}`,
      costItemId: costItem.id,
      costItemName: costItem.name,
      categoryName: category?.name || "Other",
      categoryColor: category?.color || "#718096",
      unitCode: costItem.unit_code,
      rate: costItem.default_rate,
      defaultRate: costItem.default_rate,
      companyCost: costItem.company_cost || 0,
      vendorCost: costItem.vendor_cost || 0,
      length: null,
      width: null,
      measurementUnit: "mm" as MeasurementUnit, // Default to mm for precision (interior industry standard)
      quantity: 1,
      amount: 0,
      notes: "",
      // Measured lines follow the component by default, so a size already
      // entered applies to them the moment they are added.
      followsComponent: true,
    };

    setSpaces(
      spaces.map((space) => {
        if (space.id === spaceId) {
          return {
            ...space,
            components: space.components.map((comp) => {
              if (comp.id === componentId) {
                return { ...comp, lineItems: [...comp.lineItems, newLineItem] };
              }
              return comp;
            }),
          };
        }
        return space;
      })
    );
    setShowAddCostItemModal(null);
  };

  /**
   * Sets a component's size and pushes it down to every line still following.
   *
   * This is the point of the whole change: a wardrobe's shutters, back panel
   * and carcass share the wardrobe's size, and typing it into each of them is
   * what makes quotations slow. Lines whose size was typed by hand keep it.
   */
  const updateComponentDimensions = (
    spaceId: string,
    componentId: string,
    dimensions: Pick<
      BuilderComponent,
      "width" | "height" | "measurementUnit"
    >
  ) => {
    setSpaces(
      spaces.map((space) => {
        if (space.id !== spaceId) return space;
        return {
          ...space,
          components: space.components.map((comp) => {
            if (comp.id !== componentId) return comp;
            const unit = dimensions.measurementUnit || "mm";
            return {
              ...comp,
              ...dimensions,
              lineItems: comp.lineItems.map((item) => {
                const type = getMeasurementInfo(item.unitCode).type;
                const measured = type === "area" || type === "length";
                if (!measured || item.followsComponent === false) return item;
                return {
                  ...item,
                  length: dimensions.height ?? item.length ?? null,
                  width: dimensions.width ?? item.width ?? null,
                  measurementUnit: unit,
                };
              }),
            };
          }),
        };
      })
    );
  };

  const updateLineItem = (
    spaceId: string,
    componentId: string,
    lineItemId: string,
    updates: Partial<LineItem>
  ) => {
    setSpaces(
      spaces.map((space) => {
        if (space.id === spaceId) {
          return {
            ...space,
            components: space.components.map((comp) => {
              if (comp.id === componentId) {
                return {
                  ...comp,
                  lineItems: comp.lineItems.map((item) => {
                    if (item.id === lineItemId) {
                      // Typing a size on a line stops it following the
                      // component, the way entering a value replaces a formula
                      // in a spreadsheet. Without this, the next component
                      // resize would silently overwrite what was just typed.
                      const typedADimension =
                        "length" in updates || "width" in updates;
                      return {
                        ...item,
                        ...updates,
                        ...(typedADimension ? { followsComponent: false } : {}),
                      };
                    }
                    return item;
                  }),
                };
              }
              return comp;
            }),
          };
        }
        return space;
      })
    );
  };

  const deleteLineItem = (
    spaceId: string,
    componentId: string,
    lineItemId: string
  ) => {
    setSpaces(
      spaces.map((space) => {
        if (space.id === spaceId) {
          return {
            ...space,
            components: space.components.map((comp) => {
              if (comp.id === componentId) {
                return {
                  ...comp,
                  lineItems: comp.lineItems.filter(
                    (li) => li.id !== lineItemId
                  ),
                };
              }
              return comp;
            }),
          };
        }
        return space;
      })
    );
  };

  /**
   * What the template modal was opened for.
   *
   * A template can only be inserted where it fits: a wardrobe goes into a
   * room, a bundle into a component. Recording the target lets the modal show
   * only the templates that make sense and drop them in the right place.
   */
  const [templateTarget, setTemplateTarget] = useState<
    | { level: "quotation" | "space" }
    | {
        level: "component";
        spaceId: string;
        spaceName: string;
        // What kind of room this is, so the modal can put templates built for
        // it first.
        spaceTypeId?: string;
      }
    | {
        level: "cost_items";
        spaceId: string;
        componentId: string;
        componentName: string;
        // What kind of component, so a bundle built for a different one can
        // be flagged before it is applied.
        componentTypeId?: string;
      }
  >({ level: "quotation" });

  const openTemplateModal = (
    target: typeof templateTarget = { level: "quotation" }
  ) => {
    setTemplateTarget(target);
    setShowTemplateModal(true);
    fetchTemplates();
  };

  const fetchTemplates = useCallback(async (search?: string) => {
    try {
      setLoadingTemplates(true);
      const params = new URLSearchParams();
      params.set("status", "active");
      if (search) params.set("search", search);

      const response = await fetch(
        `/api/quotations/templates?${params.toString()}`
      );
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  /**
   * Turns a template payload into builder spaces.
   *
   * Shared by all four template levels: a component template converts to a
   * single throwaway space whose components are what actually get inserted, so
   * one conversion serves every insertion point.
   */
  const convertTemplateToSpaces = (template: any): BuilderSpace[] => {
      // Convert template to quotation spaces
      const newSpaces: BuilderSpace[] = [];
      const lineItemsBySpace: Record<string, Record<string, any[]>> = {};

      // Group line items by template_space_id (individual space instance, not just type)
      (template.line_items || []).forEach((item: any) => {
        const spaceKey =
          item.template_space_id || item.space_type_id || "ungrouped";
        const componentKey = item.component_type_id || "direct";

        if (!lineItemsBySpace[spaceKey]) lineItemsBySpace[spaceKey] = {};
        if (!lineItemsBySpace[spaceKey][componentKey])
          lineItemsBySpace[spaceKey][componentKey] = [];
        lineItemsBySpace[spaceKey][componentKey].push(item);
      });

      // Create spaces
      (template.spaces || []).forEach((ts: any, spaceIndex: number) => {
        const spaceType = masterData.space_types.find(
          (st) => st.id === ts.space_type_id
        );
        const spaceId = `new-${generateId()}`;
        // Use template_space_id to get line items specific to this space instance
        const spaceLineItems = lineItemsBySpace[ts.id] || {};

        const components: BuilderComponent[] = [];

        Object.entries(spaceLineItems).forEach(
          ([componentKey, items], compIndex) => {
            if (componentKey === "direct") return;

            const firstItem = items[0];
            const componentType = masterData.component_types.find(
              (ct) => ct.id === firstItem.component_type_id
            );

            components.push({
              id: `new-${generateId()}`,
              componentTypeId: firstItem.component_type_id || "",
              name:
                componentType?.name ||
                firstItem.component_type?.name ||
                "Component",
              expanded: true,
              lineItems: items.map((item: any) => {
                const costItemsData =
                  masterData.quotation_cost_items ||
                  masterData.cost_items ||
                  [];
                const categoriesData =
                  masterData.quotation_cost_item_categories ||
                  masterData.cost_item_categories ||
                  [];
                const costItem = costItemsData.find(
                  (ci) =>
                    ci.id === item.cost_item_id ||
                    ci.id === item.quotation_cost_item_id
                );
                const category = costItem?.category_id
                  ? categoriesData.find((c) => c.id === costItem.category_id)
                  : null;

                return {
                  id: `new-${generateId()}`,
                  costItemId: item.cost_item_id,
                  costItemName:
                    costItem?.name || item.cost_item?.name || "Cost Item",
                  categoryName:
                    category?.name || item.cost_item?.category?.name || "Other",
                  categoryColor:
                    category?.color ||
                    item.cost_item?.category?.color ||
                    "#718096",
                  unitCode:
                    costItem?.unit_code || item.cost_item?.unit_code || "nos",
                  // Today's catalogue rate wins over the one frozen into the
                  // template. A template records what a wardrobe is made of;
                  // the cost item library records what those things cost now.
                  // Preferring the stored rate meant every price revision left
                  // templates quietly stale.
                  rate:
                    costItem?.default_rate ||
                    item.cost_item?.default_rate ||
                    item.rate ||
                    0,
                  defaultRate:
                    costItem?.default_rate || item.cost_item?.default_rate || 0,
                  companyCost:
                    costItem?.company_cost || item.cost_item?.company_cost || 0,
                  vendorCost:
                    costItem?.vendor_cost || item.cost_item?.vendor_cost || 0,
                  length: null,
                  width: null,
                  measurementUnit: "mm" as MeasurementUnit, // Default to mm for precision
                  quantity: 1,
                  amount: 0,
                  notes: "",
                };
              }),
            });
          }
        );

        newSpaces.push({
          id: spaceId,
          spaceTypeId: ts.space_type_id,
          name: spaceType?.name || ts.space_type?.name || "Space",
          defaultName:
            ts.default_name ||
            spaceType?.name ||
            ts.space_type?.name ||
            "Space",
          components,
          expanded: true,
        });
      });

      return newSpaces;
  };

  /** What the builder is currently offering to save as a template. */
  const [savingTemplate, setSavingTemplate] = useState<
    | { level: "space"; space: BuilderSpace }
    | { level: "component"; space: BuilderSpace; component: BuilderComponent }
    | { level: "cost_items"; space: BuilderSpace; component: BuilderComponent }
    | null
  >(null);

  /**
   * Saves a space, a component, or one component's cost items as a template.
   *
   * Rates are deliberately not written: applying a template reads today's
   * price from the cost item library, so storing one here would only create a
   * number that silently goes stale. Contents are what a template is for.
   */
  const saveAsTemplate = async (name: string, description: string) => {
    if (!savingTemplate) return;

    const { level } = savingTemplate;
    const clientSpaceId = "s1";

    // Every level is expressed in the same flat line-item shape the template
    // tables already use; what differs is how much of the hierarchy is named.
    const lineItems: Record<string, unknown>[] = [];
    const componentsToSave =
      level === "space"
        ? savingTemplate.space.components
        : [savingTemplate.component];

    componentsToSave.forEach((comp) => {
      comp.lineItems.forEach((item, index) => {
        lineItems.push({
          client_space_id: level === "space" ? clientSpaceId : undefined,
          space_type_id:
            level === "space" ? savingTemplate.space.spaceTypeId : null,
          // A bundle has no component of its own - it is a set of items that
          // can drop into any component.
          component_type_id:
            level === "cost_items" ? null : comp.componentTypeId || null,
          cost_item_id: item.costItemId,
          display_order: index,
          notes: item.notes || null,
        });
      });
    });

    if (lineItems.length === 0) {
      throw new Error("There are no cost items here to save");
    }

    const response = await fetch("/api/quotations/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || null,
        level,
        template_data: {},
        spaces:
          level === "space"
            ? [
                {
                  client_id: clientSpaceId,
                  space_type_id: savingTemplate.space.spaceTypeId,
                  default_name:
                    savingTemplate.space.defaultName ||
                    savingTemplate.space.name,
                  display_order: 0,
                },
              ]
            : [],
        line_items: lineItems,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to save template");
    }

    // Refreshed so the new template is offered immediately, without a reload.
    void fetchTemplates();
  };

  /**
   * Inserts a component template's components into one space, or a cost-item
   * bundle's items into one component.
   *
   * Both reuse the same conversion: the template's contents arrive wrapped in
   * a space that is then discarded, because what is being inserted lives below
   * that level.
   */
  const applyTemplateInto = async (
    templateId: string,
    target: { spaceId: string; componentId?: string }
  ) => {
    try {
      setLoadingTemplate(true);
      const response = await fetch(`/api/quotations/templates/${templateId}`);
      if (!response.ok) throw new Error("Failed to load template");

      const data = await response.json();
      const template = data.template;
      if (!template) throw new Error("Template not found");

      const converted = convertTemplateToSpaces(template);
      const components = converted.flatMap((sp) => sp.components);
      if (components.length === 0) return;

      setSpaces((prev) =>
        prev.map((space) => {
          if (space.id !== target.spaceId) return space;

          // A bundle drops its cost items into one existing component.
          if (target.componentId) {
            const items = components.flatMap((c) => c.lineItems);
            return {
              ...space,
              components: space.components.map((comp) =>
                comp.id === target.componentId
                  ? { ...comp, lineItems: [...comp.lineItems, ...items] }
                  : comp
              ),
            };
          }

          // A component template appends whole components to the space.
          return { ...space, components: [...space.components, ...components] };
        })
      );
      setHasUnsavedChanges(true);
      setShowTemplateModal(false);
      setSelectedTemplateId(null);
      setTemplateSearch("");
    } catch (error) {
      console.error("Error applying template:", error);
      alert(error instanceof Error ? error.message : "Failed to apply template");
    } finally {
      setLoadingTemplate(false);
    }
  };

  /**
   * Applies a whole-quotation or space template.
   *
   * Appends by default. Replacing was the only behaviour before, which quietly
   * discarded everything already built - fine on an empty quotation, and
   * destructive on any other.
   */
  const loadTemplate = async (
    templateId: string,
    mode: "append" | "replace" = "append"
  ) => {
    try {
      setLoadingTemplate(true);
      const response = await fetch(`/api/quotations/templates/${templateId}`);
      if (!response.ok) throw new Error("Failed to load template");

      const data = await response.json();
      const template = data.template;
      if (!template) throw new Error("Template not found");

      const converted = convertTemplateToSpaces(template);

      setSpaces(mode === "replace" ? converted : [...spaces, ...converted]);
      setAppliedTemplateId(templateId); // Track which template was applied
      setShowTemplateModal(false);
      setSelectedTemplateId(null);
      setTemplateSearch("");
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error("Error loading template:", error);
      alert(error instanceof Error ? error.message : "Failed to load template");
    } finally {
      setLoadingTemplate(false);
    }
  };

  /**
   * Which lines are not yet complete enough to price.
   *
   * Grouped by component rather than listed per line, because that is where a
   * size is entered - a wardrobe's carcass, shutters and back panel all take
   * the wardrobe's measurement, so reporting each of them separately names the
   * same missing number three times and points at the wrong control.
   */
  const incompleteByComponent = (): Array<{
    component: string;
    space: string;
    missing: number;
    what: string;
  }> => {
    const groups: Array<{
      component: string; space: string; missing: number; what: string;
    }> = [];

    spaces.forEach((space) => {
      space.components.forEach((comp) => {
        const needsSize: string[] = [];
        let missing = 0;
        comp.lineItems.forEach((item) => {
          const type = getMeasurementInfo(item.unitCode).type;
          const noRate = !item.rate || item.rate <= 0;
          const noArea =
            type === "area" &&
            (!item.length || item.length <= 0 || !item.width || item.width <= 0);
          const noLength = type === "length" && (!item.length || item.length <= 0);
          const noQty = type === "quantity" && (!item.quantity || item.quantity <= 0);
          if (noRate || noArea || noLength || noQty) {
            missing += 1;
            if (noArea || noLength) needsSize.push("size");
            if (noQty) needsSize.push("quantity");
            if (noRate) needsSize.push("rate");
          }
        });
        if (missing > 0) {
          groups.push({
            component: comp.name,
            space: space.defaultName || space.name,
            missing,
            what: [...new Set(needsSize)].join(" and "),
          });
        }
      });
    });
    return groups;
  };


  /**
   * Approve what is on screen.
   *
   * Unsaved work is saved first: approving a price that differs from what the
   * person is looking at is worse than making them wait a moment. The server
   * decides whether they may - quotations.approve - and tells us if another
   * quotation on this lead was superseded by it.
   */
  const approveQuotation = async () => {
    if (!quotationId) return;
    setApproving(true);
    try {
      if (hasUnsavedChanges) {
        await saveQuotation(false, false);
      }

      const res = await fetch(`/api/quotations/${quotationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSaveError(data.error || "Could not approve this quotation");
        return;
      }

      setStatus("approved");
      if (data.supersededNumber) window.alert(data.message);
      // An approved quotation is no longer editable, so the builder is the
      // wrong place to be left standing.
      onExit?.();
    } finally {
      setApproving(false);
    }
  };

  // Save quotation
  const saveQuotation = async (
    createNewVersion = false,
    redirectAfterSave = true,
    overrideSpaces?: BuilderSpace[],
    overrideVersionNotes?: string
  ) => {
    try {
      setIsSaving(true);
      setSaveError(null); // Clear any previous error

      // Use override spaces if provided, otherwise use state
      const spacesToSave = overrideSpaces || spaces;
      const notesToUse = overrideVersionNotes ?? versionNotes;

      console.log("[saveQuotation] Starting save:", {
        createNewVersion,
        redirectAfterSave,
        spacesCount: spacesToSave.length,
        versionNotes: notesToUse,
        hasOverrideSpaces: !!overrideSpaces,
      });

      // For auto-save, skip validation if there are no line items yet
      const hasLineItems = spacesToSave.some((s) =>
        s.components.some((c) => c.lineItems.length > 0)
      );

      // Incompleteness no longer refuses the save.
      //
      // A quotation is built over several sittings - rooms first, then
      // measurements, then rates - and refusing to store any of it until every
      // line is measured meant a morning's work could not be kept. The
      // unfinished lines are reported instead, and the fields stay highlighted,
      // so the gap is visible without holding the work hostage.
      if (hasLineItems) {
        const groups = incompleteByComponent();
        setIncomplete(groups);
        if (groups.length > 0) setShowValidation(true);
      } else {
        setIncomplete([]);
      }

      // Calculate totals from the spaces we're saving
      const calculateTotalsFromSpaces = (
        spacesData: BuilderSpace[],
        taxRate: number
      ) => {
        const sub = spacesData.reduce((total, space) => {
          return (
            total +
            space.components.reduce((spaceTotal, comp) => {
              return (
                spaceTotal +
                comp.lineItems.reduce((compTotal, item) => {
                  return compTotal + calculateItemAmount(item);
                }, 0)
              );
            }, 0)
          );
        }, 0);
        const tax = sub * (taxRate / 100);
        return { subtotal: sub, taxAmount: tax, total: sub + tax };
      };

      const { subtotal, taxAmount, total } = calculateTotalsFromSpaces(
        spacesToSave,
        taxPercent
      );

      const payload = {
        title: quotationName,
        notes,
        assigned_to: assignedTo,
        template_id: appliedTemplateId, // Track which template was used
        subtotal,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        grand_total: total,
        create_new_version: createNewVersion,
        version_notes: createNewVersion ? notesToUse : undefined,
        spaces: spacesToSave.map((space, spaceIndex) => ({
          id: space.id.startsWith("new-") ? undefined : space.id,
          space_type_id: space.spaceTypeId,
          name: space.defaultName,
          sort_order: spaceIndex,
          components: space.components.map((comp, compIndex) => ({
            id: comp.id.startsWith("new-") ? undefined : comp.id,
            component_type_id: comp.componentTypeId,
            name: comp.name,
            description: comp.description,
            sort_order: compIndex,
            width: comp.width ?? null,
            height: comp.height ?? null,
            // The component's unit has no column of its own; metadata already
            // exists and is already persisted.
            metadata: {
              ...(comp as any).metadata,
              measurement_unit: comp.measurementUnit || "mm",
            },
            lineItems: comp.lineItems.map((item, itemIndex) => {
              // Calculate amount on frontend based on measurement unit
              const calculatedAmount = calculateItemAmount(item);

              return {
                id: item.id.startsWith("new-") ? undefined : item.id,
                cost_item_id: item.costItemId,
                name: item.costItemName,
                // Store dimensions as-is (in user's selected unit)
                length: item.length,
                width: item.width,
                quantity: item.quantity,
                unit_code: item.unitCode,
                rate: item.rate,
                // Internal costs, already loaded into the builder from the
                // cost item library. Sent so the server can snapshot them and
                // work out the margin; it recomputes the margin itself rather
                // than trusting anything sent from here.
                company_cost: item.companyCost,
                vendor_cost: item.vendorCost,
                // Store the measurement unit so we know how to interpret dimensions
                measurement_unit: item.measurementUnit || "mm",
                // Calculate amount on frontend
                amount: calculatedAmount,
                display_order: itemIndex,
                notes: item.notes,
                // No column for this either, and it is a builder concern
                // rather than something the PDF or client ever reads.
                metadata: {
                  ...(item as any).metadata,
                  follows_component: item.followsComponent !== false,
                },
              };
            }),
          })),
        })),
      };

      console.log("[saveQuotation] Sending request:", {
        quotationId,
        createNewVersion,
        spacesCount: payload.spaces.length,
        versionNotes: payload.version_notes,
      });

      const response = await fetch(`/api/quotations/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("[saveQuotation] API error:", result);
        throw new Error(result.error || "Failed to save quotation");
      }

      console.log("[saveQuotation] API response:", result);

      // For auto-save, don't redirect
      if (!redirectAfterSave) {
        baselineRef.current = JSON.stringify({
          spaces,
          quotationName,
          notes,
          assignedTo,
        });
        setHasUnsavedChanges(false);
        setLastSavedAt(new Date());
        setAutoSaveStatus("saved");
        // Reset status after 2 seconds
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
        return;
      }

      // A new version is a different quotation, so that one does navigate.
      if (createNewVersion && result.newVersionId) {
        console.log(
          "[saveQuotation] New version created, redirecting to:",
          result.newVersionId
        );
        router.push(`/dashboard/quotations/${result.newVersionId}?edit=1`);
        return;
      }

      // Saving used to leave the builder for the summary page, which meant
      // every save threw you out of the thing you were working on. It now just
      // stops being dirty; leaving is the Summary button's job.
      baselineRef.current = JSON.stringify({
        spaces,
        quotationName,
        notes,
        assignedTo,
      });
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Error saving:", error);
      setSaveError(
        error instanceof Error ? error.message : "Failed to save quotation"
      );
      setAutoSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save function (silent save without redirect)
  const autoSave = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving || isLoading) return;

    setAutoSaveStatus("saving");
    await saveQuotation(false, false);
  }, [hasUnsavedChanges, isSaving, isLoading]);

  // Trigger auto-save when the document actually differs from what was loaded
  useEffect(() => {
    if (isLoading) return;

    const current = JSON.stringify({
      spaces,
      quotationName,
      notes,
      assignedTo,
    });

    // First settle after a load: this is the document, not a change to it.
    if (baselineRef.current === null) {
      baselineRef.current = current;
      setHasUnsavedChanges(false);
      return;
    }

    if (current === baselineRef.current) {
      setHasUnsavedChanges(false);
      setAutoSaveStatus("idle");
      return;
    }

    setHasUnsavedChanges(true);
    setAutoSaveStatus("idle");

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (3 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 3000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [spaces, quotationName, notes, assignedTo, isLoading]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!isSaving) {
          saveQuotation(false, true);
        }
      }

      // Escape to go back (only if no modal is open)
      if (
        e.key === "Escape" &&
        !showAddSpaceModal &&
        !showAddComponentModal &&
        !showAddCostItemModal &&
        !showTemplateModal &&
        !showNewVersionModal
      ) {
        onExit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isSaving,
    showAddSpaceModal,
    showAddComponentModal,
    showAddCostItemModal,
    showTemplateModal,
    showNewVersionModal,
    quotationId,
    router,
  ]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Create a new revision and open it for editing
  const handleCreateRevision = async () => {
    try {
      setIsCreatingRevision(true);
      const response = await fetch(`/api/quotations/${quotationId}/revision`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create revision");
      }

      const data = await response.json();
      // Redirect to edit the new revision
      router.push(`/dashboard/quotations/${data.quotation.id}?edit=1`);
    } catch (err) {
      console.error("Error creating revision:", err);
      setSaveError(
        err instanceof Error ? err.message : "Failed to create revision"
      );
    } finally {
      setIsCreatingRevision(false);
    }
  };

  const totals = calculateTotals();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading quotation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Failed to load quotation
          </h2>
          <p className="text-slate-600 mb-4">{loadError}</p>
          <Link
            href="/dashboard/quotations"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Quotations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/quotations"
                className="text-slate-600 hover:text-slate-900"
                title="Back to Quotations"
              >
                <svg
                  className="w-5 h-5"
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
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/quotations"
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Quotations
                </Link>
                <span className="text-slate-400">/</span>
                <h1 className="text-lg font-bold text-slate-900">
                  {quotationNumber}
                </h1>
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  v{version}
                </span>
                {source && (
                  <Link
                    href={source.href}
                    className="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors"
                  >
                    {source.label}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Print shows the actual PDF the client receives. It sits here
                  rather than only on the summary page because a draft opens
                  straight into the builder now, and checking the document is
                  part of building it. */}
              <button
                onClick={() => setShowPrintModal(true)}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Print
              </button>

              {/*
               * Approving where the quotation is built.
               *
               * A draft opens straight into the builder, and the builder had
               * no header - so the only route to approving was a page you had
               * to know to ask for by URL. Unsaved work is saved first;
               * approving a price that is not what is on screen would be worse
               * than making someone press save.
               */}
              {!["approved", "superseded", "rejected", "cancelled"].includes(
                status
              ) && (
                <button
                  onClick={() => void approveQuotation()}
                  disabled={approving || isSaving}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {approving ? "Approving…" : "Approve"}
                </button>
              )}

              {/* Status, versions, sharing and margin live on the summary; it
                  is not a preview of the printed document, so it no longer
                  claims to be one. */}
              <button
                onClick={onExit}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
              >
                <svg
                  className="w-4 h-4"
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
                Summary
              </button>
              <button
                onClick={() => openTemplateModal({ level: "quotation" })}
                className="px-3 py-1.5 text-sm text-purple-600 hover:text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 flex items-center gap-1.5"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
                Template
              </button>
              <button
                onClick={() => setShowRepriceModal(true)}
                disabled={spaces.length === 0}
                className="px-3 py-1.5 text-sm text-emerald-600 hover:text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                Reprice
              </button>
              <button
                onClick={handleCreateRevision}
                disabled={isCreatingRevision}
                className="px-3 py-1.5 text-sm text-amber-700 border border-amber-300 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isCreatingRevision ? (
                  <div className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                )}
                {isCreatingRevision ? "Creating..." : "Revise"}
              </button>
              <button
                onClick={() => saveQuotation(false, true)}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving ? "Saving..." : "Save"}
                <span className="text-xs text-blue-200 hidden sm:inline">
                  ⌘S
                </span>
              </button>
            </div>
          </div>
          {/* Auto-save status bar */}
          <div className="flex items-center justify-between px-1 py-1 text-xs text-slate-500 border-t border-slate-100 mt-2">
            <div className="flex items-center gap-2">
              {autoSaveStatus === "saving" && (
                <span className="flex items-center gap-1.5 text-blue-600">
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  Auto-saving...
                </span>
              )}
              {autoSaveStatus === "saved" && (
                <span className="flex items-center gap-1.5 text-green-600">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Saved
                </span>
              )}
              {autoSaveStatus === "error" && (
                <span className="flex items-center gap-1.5 text-red-600">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Auto-save failed
                </span>
              )}
              {autoSaveStatus === "idle" && hasUnsavedChanges && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  Unsaved changes
                </span>
              )}
              {autoSaveStatus === "idle" &&
                !hasUnsavedChanges &&
                lastSavedAt && (
                  <span className="text-slate-400">
                    Last saved {lastSavedAt.toLocaleTimeString()}
                  </span>
                )}
            </div>
            <div className="hidden sm:flex items-center gap-3 text-slate-400">
              <span>⌘S save</span>
              <span>Esc back</span>
            </div>
          </div>
        </div>
      </div>

      {/* What is still unfinished. Amber, not red - the work saved, this is a
          list of what is left, and it names the component because that is the
          one place a size gets typed. */}
      {incomplete.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-900">
                Saved. {incomplete.reduce((n, g) => n + g.missing, 0)} line
                {incomplete.reduce((n, g) => n + g.missing, 0) === 1 ? "" : "s"}{" "}
                still need details before this can be sent.
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                {incomplete.slice(0, 6).map((g, i) => (
                  <span key={i} className="text-xs text-amber-800">
                    <span className="font-medium">{g.component}</span>
                    <span className="text-amber-600"> · {g.space}</span>
                    <span className="text-amber-600">
                      {" "}
                      — {g.missing} need {g.what}
                    </span>
                  </span>
                ))}
                {incomplete.length > 6 && (
                  <span className="text-xs text-amber-600">
                    and {incomplete.length - 6} more component
                    {incomplete.length - 6 === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setIncomplete([])}
              className="shrink-0 text-amber-500 hover:text-amber-700"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm text-red-800">{saveError}</span>
            </div>
            <button
              onClick={() => setSaveError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Main Content */}
        <div className="flex-1 p-4 overflow-auto">
          {/* Quotation Details - Compact */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Quotation Name
                </label>
                <input
                  type="text"
                  value={quotationName}
                  onChange={(e) => setQuotationName(e.target.value)}
                  placeholder="e.g., Villa Interior - Phase 1"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes..."
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="w-48">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Assigned To
                </label>
                <select
                  value={assignedTo || ""}
                  onChange={(e) => setAssignedTo(e.target.value || null)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name || member.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Spaces Header with Collapse All */}
          {spaces.length > 0 && (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">
                  {spaces.length} Space{spaces.length !== 1 ? "s" : ""}
                </span>
                <span className="text-xs text-slate-400">
                  • {spaces.reduce((sum, s) => sum + s.components.length, 0)}{" "}
                  Components
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={hasCollapsedSpaces ? expandAll : collapseAll}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                >
                  {hasCollapsedSpaces ? (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        />
                      </svg>
                      Expand All
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                        />
                      </svg>
                      Collapse All
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Spaces */}
          <div className="space-y-4">
            {spaces.length === 0 ? (
              /* Empty State - Show prominent buttons */
              <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-slate-400"
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
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No Spaces Added
                </h3>
                <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                  Start building your quotation by adding spaces manually or use
                  a template to get started quickly.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowAddSpaceModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Add Space
                  </button>
                  <button
                    onClick={() => openTemplateModal({ level: "quotation" })}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm border-2 border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-medium"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                      />
                    </svg>
                    Choose Template
                  </button>
                </div>
              </div>
            ) : (
              <>
                {spaces.map((space, index) => (
                  <SpaceCard
                    key={space.id}
                    space={space}
                    mode="quotation"
                    onToggleExpand={() => toggleSpaceExpand(space.id)}
                    onDelete={() => deleteSpace(space.id)}
                    onUpdateName={(name) => updateSpaceName(space.id, name)}
                    onAddComponent={() => setShowAddComponentModal(space.id)}
                    onToggleComponentExpand={(componentId) =>
                      toggleComponentExpand(space.id, componentId)
                    }
                    onDeleteComponent={(componentId) =>
                      deleteComponent(space.id, componentId)
                    }
                    onUpdateComponentDescription={(componentId, desc) =>
                      updateComponentDescription(space.id, componentId, desc)
                    }
                    onUpdateComponentName={(componentId, name) =>
                      updateComponentName(space.id, componentId, name)
                    }
                    masterData={masterData}
                    onAddCostItem={(componentId) =>
                      setShowAddCostItemModal({
                        spaceId: space.id,
                        componentId,
                      })
                    }
                    canViewCosts={canViewCosts}
                    onSaveAsTemplate={() =>
                      setSavingTemplate({ level: "space", space })
                    }
                    onSaveComponentAsTemplate={(componentId, asBundle) => {
                      const component = space.components.find(
                        (c) => c.id === componentId
                      );
                      if (!component) return;
                      setSavingTemplate({
                        level: asBundle ? "cost_items" : "component",
                        space,
                        component,
                      });
                    }}
                    onAddComponentFromTemplate={() =>
                      openTemplateModal({
                        level: "component",
                        spaceId: space.id,
                        spaceName: space.defaultName || space.name,
                        spaceTypeId: space.spaceTypeId || undefined,
                      })
                    }
                    onAddBundleToComponent={(componentId, componentName) =>
                      openTemplateModal({
                        level: "cost_items",
                        spaceId: space.id,
                        componentId,
                        componentName,
                        componentTypeId:
                          space.components.find((c) => c.id === componentId)
                            ?.componentTypeId || undefined,
                      })
                    }
                    onUpdateDimensions={(componentId, dimensions) =>
                      updateComponentDimensions(space.id, componentId, dimensions)
                    }
                    onUpdateLineItem={(componentId, lineItemId, updates) =>
                      updateLineItem(space.id, componentId, lineItemId, updates)
                    }
                    onDeleteLineItem={(componentId, lineItemId) =>
                      deleteLineItem(space.id, componentId, lineItemId)
                    }
                    formatCurrency={formatCurrency}
                    // Duplicate props
                    onDuplicateSpace={() => duplicateSpace(space.id)}
                    onDuplicateComponent={(componentId) =>
                      duplicateComponent(space.id, componentId)
                    }
                    // Drag & drop props
                    onDragStart={() => handleSpaceDragStart(space.id)}
                    onDragOver={(e) => handleSpaceDragOver(e, space.id)}
                    onDragLeave={handleSpaceDragLeave}
                    onDrop={() => handleSpaceDrop(space.id)}
                    onDragEnd={handleSpaceDragEnd}
                    isDragging={draggedSpaceId === space.id}
                    isDragOver={dragOverSpaceId === space.id}
                    // Move props for spaces
                    onMoveUp={() => moveSpace(space.id, "up")}
                    onMoveDown={() => moveSpace(space.id, "down")}
                    canMoveUp={index > 0}
                    canMoveDown={index < spaces.length - 1}
                    // Move props for components
                    onMoveComponentUp={(componentId) => {
                      const componentIndex = space.components.findIndex(
                        (c) => c.id === componentId
                      );
                      if (componentIndex > 0) {
                        moveComponent(space.id, componentId, "up");
                      }
                    }}
                    onMoveComponentDown={(componentId) => {
                      const componentIndex = space.components.findIndex(
                        (c) => c.id === componentId
                      );
                      if (componentIndex < space.components.length - 1) {
                        moveComponent(space.id, componentId, "down");
                      }
                    }}
                    onMoveLineItemUp={(componentId, lineItemId) =>
                      moveLineItem(space.id, componentId, lineItemId, "up")
                    }
                    onMoveLineItemDown={(componentId, lineItemId) =>
                      moveLineItem(space.id, componentId, lineItemId, "down")
                    }
                    showValidation={showValidation}
                  />
                ))}

                {/* Add Space / Paste Space Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddSpaceModal(true)}
                    className="flex-1 py-4 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl border-2 border-dashed border-blue-300 flex items-center justify-center gap-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add Space
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <BuilderSidebar
          mode="quotation"
          spaces={spaces}
          subtotal={totals.subtotal}
          taxAmount={totals.taxAmount}
          total={totals.total}
          taxPercent={taxPercent}
          onTaxPercentChange={(percent) => {
            setTaxPercent(percent);
            setHasUnsavedChanges(true);
          }}
          canViewCosts={canViewCosts}
        />
      </div>

      {/* Modals */}
      <AddSpaceModal
        isOpen={showAddSpaceModal}
        onClose={() => setShowAddSpaceModal(false)}
        onAdd={addSpace}
        spaceTypes={masterData.space_types}
      />

      {showAddComponentModal && (
        <AddComponentModal
          isOpen={true}
          onClose={() => setShowAddComponentModal(null)}
          onAdd={(componentType) =>
            addComponent(showAddComponentModal, componentType)
          }
          componentTypes={masterData.component_types}
        />
      )}

      {showAddCostItemModal && (
        <AddCostItemModal
          isOpen={true}
          onClose={() => setShowAddCostItemModal(null)}
          onAdd={(costItem) =>
            addCostItem(
              showAddCostItemModal.spaceId,
              showAddCostItemModal.componentId,
              costItem
            )
          }
          costItems={
            masterData.quotation_cost_items || masterData.cost_items || []
          }
          categories={
            masterData.quotation_cost_item_categories ||
            masterData.cost_item_categories ||
            []
          }
        />
      )}

      <TemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        target={templateTarget}
        onLoad={(templateId: string, mode: "append" | "replace") => {
          if (templateTarget.level === "component") {
            void applyTemplateInto(templateId, {
              spaceId: templateTarget.spaceId,
            });
          } else if (templateTarget.level === "cost_items") {
            void applyTemplateInto(templateId, {
              spaceId: templateTarget.spaceId,
              componentId: templateTarget.componentId,
            });
          } else {
            void loadTemplate(templateId, mode);
          }
        }}
        onFetchTemplates={fetchTemplates}
        templates={templates}
        isLoading={loadingTemplates}
        isApplying={loadingTemplate}
      />

      <SaveAsTemplateModal
        isOpen={!!savingTemplate}
        onClose={() => setSavingTemplate(null)}
        level={savingTemplate?.level || "component"}
        sourceName={
          savingTemplate
            ? savingTemplate.level === "space"
              ? savingTemplate.space.defaultName || savingTemplate.space.name
              : savingTemplate.component.name
            : ""
        }
        itemCount={
          savingTemplate
            ? savingTemplate.level === "space"
              ? savingTemplate.space.components.reduce(
                  (sum, c) => sum + c.lineItems.length,
                  0
                )
              : savingTemplate.component.lineItems.length
            : 0
        }
        onSave={saveAsTemplate}
      />

      <NewVersionModal
        isOpen={showNewVersionModal}
        onClose={() => setShowNewVersionModal(false)}
        onCreateVersion={() => {
          setShowNewVersionModal(false);
          saveQuotation(true);
        }}
        currentVersion={version}
        isCreating={false}
      />

      {/* Reprice: specification level and price adjustments */}
      <PrintQuotationModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        quotationId={quotationId}
        quotationNumber={quotationNumber}
      />

      <RepriceModal
        isOpen={showRepriceModal}
        onClose={() => setShowRepriceModal(false)}
        spaces={spaces}
        costItems={
          masterData.quotation_cost_items || masterData.cost_items || []
        }
        categories={
          masterData.quotation_cost_item_categories ||
          masterData.cost_item_categories ||
          []
        }
        componentTypes={masterData.component_types}
        onApply={(modifiedSpaces) => {
          console.log(
            "[EditPage] onApply called with",
            modifiedSpaces.length,
            "spaces"
          );
          setSpaces(modifiedSpaces);
          setHasUnsavedChanges(true);
        }}
        onSaveAsNewVersion={async (modifiedSpaces, notes) => {
          console.log("[EditPage] onSaveAsNewVersion called");
          console.log("[EditPage] Modified spaces:", modifiedSpaces.length);
          console.log("[EditPage] Version notes:", notes);
          // Update state for UI
          setSpaces(modifiedSpaces);
          setVersionNotes(notes || "Pricing scenario applied");
          // Pass spaces and notes directly to avoid async state issues
          await saveQuotation(
            true,
            true,
            modifiedSpaces,
            notes || "Pricing scenario applied"
          );
        }}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}

// Helper
function getMeasurementType(unitCode: string): string {
  const mapping: Record<string, string> = {
    sqft: "area",
    rft: "length",
    nos: "quantity",
    set: "quantity",
    lot: "fixed",
    lumpsum: "fixed",
    kg: "quantity",
    ltr: "quantity",
  };
  return mapping[unitCode?.toLowerCase()] || "quantity";
}
