"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams, useSearchParams } from "next/navigation";
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
import { PricingScenariosModal } from "@/components/quotations/PricingScenariosModal";
import { TemplateModal } from "@/components/quotations/TemplateModal";
import { NewVersionModal } from "@/components/quotations/NewVersionModal";
import { DEFAULT_TAX_PERCENT } from "@/utils/quotations";

export default function EditQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const quotationId = params.id as string;
  const shouldOpenTemplateModal = searchParams.get("useTemplate") === "true";

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Auto-save state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  // Quotation data
  const [quotationNumber, setQuotationNumber] = useState("");
  const [quotationName, setQuotationName] = useState("");
  const [version, setVersion] = useState(1);
  const [validUntil, setValidUntil] = useState("");
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
  const [showPricingScenariosModal, setShowPricingScenariosModal] =
    useState(false);
  const [versionNotes, setVersionNotes] = useState("");
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);

  // Template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
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
        setQuotationName(q.title || q.name || "");
        setVersion(q.version || 1);
        setValidUntil(q.valid_until ? q.valid_until.split("T")[0] : "");
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
                })),
              })
            ),
          })
        );

        setSpaces(transformedSpaces);
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
      router.replace(`/dashboard/quotations/${quotationId}/edit`, {
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
                      return { ...item, ...updates };
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

  // Template operations
  const openTemplateModal = () => {
    setShowTemplateModal(true);
    fetchTemplates();
  };

  const fetchTemplates = async (search?: string) => {
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
  };

  const loadTemplate = async (templateId: string) => {
    try {
      setLoadingTemplate(true);
      const response = await fetch(`/api/quotations/templates/${templateId}`);
      if (!response.ok) throw new Error("Failed to load template");

      const data = await response.json();
      const template = data.template;

      if (!template) throw new Error("Template not found");

      // Convert template to quotation spaces
      const newSpaces: BuilderSpace[] = [];
      const lineItemsBySpace: Record<string, Record<string, any[]>> = {};

      // Group line items
      (template.line_items || []).forEach((item: any) => {
        const spaceKey = item.space_type_id || "ungrouped";
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
        const spaceLineItems = lineItemsBySpace[ts.space_type_id] || {};

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
                  rate:
                    item.rate ||
                    costItem?.default_rate ||
                    item.cost_item?.default_rate ||
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

      setSpaces(newSpaces);
      setAppliedTemplateId(templateId); // Track which template was applied
      setShowTemplateModal(false);
      setSelectedTemplateId(null);
      setTemplateSearch("");
    } catch (error) {
      console.error("Error loading template:", error);
      alert(error instanceof Error ? error.message : "Failed to load template");
    } finally {
      setLoadingTemplate(false);
    }
  };

  // Validate line items before save
  const validateLineItems = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    spaces.forEach((space) => {
      space.components.forEach((comp) => {
        comp.lineItems.forEach((item) => {
          const measureType = getMeasurementInfo(item.unitCode).type;
          const itemLabel = `${item.costItemName} in ${comp.name} (${space.defaultName})`;

          // Check rate is set
          if (!item.rate || item.rate <= 0) {
            errors.push(`Rate is required for "${itemLabel}"`);
          }

          // Check dimensions based on measurement type
          switch (measureType) {
            case "area":
              if (!item.length || item.length <= 0) {
                errors.push(`Height is required for "${itemLabel}"`);
              }
              if (!item.width || item.width <= 0) {
                errors.push(`Width is required for "${itemLabel}"`);
              }
              break;
            case "length":
              if (!item.length || item.length <= 0) {
                errors.push(`Height is required for "${itemLabel}"`);
              }
              break;
            case "quantity":
              if (!item.quantity || item.quantity <= 0) {
                errors.push(`Quantity is required for "${itemLabel}"`);
              }
              break;
            // 'fixed' type doesn't need dimensions
          }
        });
      });
    });

    return { valid: errors.length === 0, errors };
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

      // Validate line items (only if redirecting or has line items)
      if (redirectAfterSave || hasLineItems) {
        const validation = validateLineItems();
        if (!validation.valid && redirectAfterSave) {
          // Enable validation highlighting on mandatory fields
          setShowValidation(true);
          // Show first 3 errors max
          const errorMsg = validation.errors.slice(0, 3).join("\n");
          const moreCount = validation.errors.length - 3;
          throw new Error(
            errorMsg +
              (moreCount > 0 ? `\n...and ${moreCount} more errors` : "")
          );
        }
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
        valid_until: validUntil || null,
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
                // Store the measurement unit so we know how to interpret dimensions
                measurement_unit: item.measurementUnit || "mm",
                // Calculate amount on frontend
                amount: calculatedAmount,
                display_order: itemIndex,
                notes: item.notes,
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
        setHasUnsavedChanges(false);
        setLastSavedAt(new Date());
        setAutoSaveStatus("saved");
        // Reset status after 2 seconds
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
        return;
      }

      // If a new version was created, redirect to the new version
      if (createNewVersion && result.newVersionId) {
        console.log(
          "[saveQuotation] New version created, redirecting to:",
          result.newVersionId
        );
        router.push(`/dashboard/quotations/${result.newVersionId}`);
      } else {
        router.push(`/dashboard/quotations/${quotationId}`);
      }
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

  // Trigger auto-save when data changes (debounced)
  useEffect(() => {
    // Skip initial load
    if (isInitialLoadRef.current) {
      return;
    }

    // Mark as having unsaved changes
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
  }, [spaces, quotationName, validUntil, notes, assignedTo]);

  // Mark initial load complete after data is loaded
  useEffect(() => {
    if (!isLoading && isInitialLoadRef.current) {
      // Small delay to ensure all state is set
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 100);
    }
  }, [isLoading]);

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
        router.push(`/dashboard/quotations/${quotationId}`);
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
      router.push(`/dashboard/quotations/${data.quotation.id}/edit`);
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
                <Link
                  href={`/dashboard/quotations/${quotationId}`}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  {quotationNumber}
                </Link>
                <span className="text-slate-400">/</span>
                <h1 className="text-lg font-bold text-slate-900">Edit</h1>
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  v{version}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openTemplateModal}
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
                onClick={() => setShowPricingScenariosModal(true)}
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
                Scenarios
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
              <div className="w-36">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
                    onClick={openTemplateModal}
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
        onLoad={() => {
          selectedTemplateId && loadTemplate(selectedTemplateId);
        }}
        onFetchTemplates={fetchTemplates}
        templates={templates}
        isLoading={loadingTemplates}
        isApplying={loadingTemplate}
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

      {/* Pricing Scenarios Modal (Adjustments + Material Swap) */}
      <PricingScenariosModal
        isOpen={showPricingScenariosModal}
        onClose={() => setShowPricingScenariosModal(false)}
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
