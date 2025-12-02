"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  BuilderSpace,
  BuilderComponent,
  LineItem,
  MasterData,
  SpaceType,
  ComponentType,
  ComponentVariant,
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
import { SelectVariantModal } from "@/components/quotations/SelectVariantModal";
import { AddCostItemModal } from "@/components/quotations/AddCostItemModal";
import { SpaceCard } from "@/components/quotations/SpaceCard";
import { BuilderSidebar } from "@/components/quotations/BuilderSidebar";

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

  // Quotation data
  const [quotationNumber, setQuotationNumber] = useState("");
  const [quotationName, setQuotationName] = useState("");
  const [version, setVersion] = useState(1);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [spaces, setSpaces] = useState<BuilderSpace[]>([]);

  // Master data
  const [masterData, setMasterData] = useState<MasterData>({
    units: [],
    space_types: [],
    component_types: [],
    component_variants: [],
    cost_item_categories: [],
    cost_items: [],
  });

  // Modal states
  const [showAddSpaceModal, setShowAddSpaceModal] = useState(false);
  const [showAddComponentModal, setShowAddComponentModal] = useState<
    string | null
  >(null);
  const [showSelectVariantModal, setShowSelectVariantModal] = useState<{
    spaceId: string;
    componentId: string;
    componentTypeId: string;
  } | null>(null);
  const [showAddCostItemModal, setShowAddCostItemModal] = useState<{
    spaceId: string;
    componentId: string;
  } | null>(null);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [versionNotes, setVersionNotes] = useState("");
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);

  // Template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
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
              component_variants: result.data.component_variants || [],
              cost_item_categories: result.data.cost_item_categories || [],
              cost_items: result.data.cost_items || [],
              variants_by_component:
                result.grouped?.variants_by_component || {},
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
                variantId: comp.component_variant_id,
                name:
                  comp.component_type?.name ||
                  comp.name ||
                  `Component ${compIdx + 1}`,
                variantName: comp.component_variant?.name,
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
                  rate: item.rate || 0,
                  defaultRate: item.rate || 0,
                  groupName: item.group_name || "Other",
                  length: item.length,
                  width: item.width,
                  // Use stored measurement_unit from DB, default to ft for legacy data
                  measurementUnit: (item.measurement_unit ||
                    "ft") as MeasurementUnit,
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

  // Get variants for a component type
  const getVariantsForComponent = useCallback(
    (componentTypeId: string) => {
      if (masterData.variants_by_component?.[componentTypeId]) {
        return masterData.variants_by_component[componentTypeId];
      }
      return masterData.component_variants.filter(
        (v) => v.component_type_id === componentTypeId
      );
    },
    [masterData]
  );

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
    const taxAmount = subtotal * 0.18;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  }, [spaces]);

  // Calculate single item amount
  const calculateItemAmount = (item: LineItem): number => {
    const measureType = getMeasurementInfo(item.unitCode).type;
    const unit = item.measurementUnit || "ft"; // Use stored unit, default to ft for legacy data
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

    // Check if component has variants
    const variants = getVariantsForComponent(componentType.id);
    if (variants.length > 0) {
      setShowSelectVariantModal({
        spaceId,
        componentId: newComponent.id,
        componentTypeId: componentType.id,
      });
    }
    setShowAddComponentModal(null);
  };

  const setComponentVariant = (
    spaceId: string,
    componentId: string,
    variant: ComponentVariant
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
                  variantId: variant.id,
                  variantName: variant.name,
                };
              }
              return comp;
            }),
          };
        }
        return space;
      })
    );
    setShowSelectVariantModal(null);
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

  // Cost item operations
  const addCostItem = (
    spaceId: string,
    componentId: string,
    costItem: CostItem,
    groupName: string
  ) => {
    const category = masterData.cost_item_categories.find(
      (c) => c.id === costItem.category_id
    );

    const newLineItem: LineItem = {
      id: `new-${generateId()}`,
      costItemId: costItem.id,
      costItemName: costItem.name,
      categoryName: category?.name || "Other",
      categoryColor: category?.color || "#718096",
      unitCode: costItem.unit_code,
      rate: costItem.default_rate,
      defaultRate: costItem.default_rate,
      groupName,
      length: null,
      width: null,
      measurementUnit: "ft" as MeasurementUnit, // Default for new items, user can change
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
        const componentKey = item.component_type_id
          ? `${item.component_type_id}-${
              item.component_variant_id || "default"
            }`
          : "direct";

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
            const variant = firstItem.component_variant_id
              ? masterData.component_variants.find(
                  (v) => v.id === firstItem.component_variant_id
                )
              : null;

            components.push({
              id: `new-${generateId()}`,
              componentTypeId: firstItem.component_type_id || "",
              variantId: firstItem.component_variant_id,
              name:
                componentType?.name ||
                firstItem.component_type?.name ||
                "Component",
              variantName: variant?.name || firstItem.component_variant?.name,
              expanded: true,
              lineItems: items.map((item: any) => {
                const costItem = masterData.cost_items.find(
                  (ci) => ci.id === item.cost_item_id
                );
                const category = costItem?.category_id
                  ? masterData.cost_item_categories.find(
                      (c) => c.id === costItem.category_id
                    )
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
                  groupName: item.group_name || "Other",
                  length: null,
                  width: null,
                  measurementUnit: "ft" as MeasurementUnit, // Default for new items from template
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
                errors.push(`Length is required for "${itemLabel}"`);
              }
              if (!item.width || item.width <= 0) {
                errors.push(`Width is required for "${itemLabel}"`);
              }
              break;
            case "length":
              if (!item.length || item.length <= 0) {
                errors.push(`Length is required for "${itemLabel}"`);
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
  const saveQuotation = async (createNewVersion = false) => {
    try {
      setIsSaving(true);
      setSaveError(null); // Clear any previous error

      // Validate line items
      const validation = validateLineItems();
      if (!validation.valid) {
        // Show first 3 errors max
        const errorMsg = validation.errors.slice(0, 3).join("\n");
        const moreCount = validation.errors.length - 3;
        throw new Error(
          errorMsg + (moreCount > 0 ? `\n...and ${moreCount} more errors` : "")
        );
      }

      const { subtotal, taxAmount, total } = calculateTotals();

      const payload = {
        title: quotationName,
        valid_until: validUntil || null,
        notes,
        assigned_to: assignedTo,
        subtotal,
        tax_amount: taxAmount,
        grand_total: total,
        create_new_version: createNewVersion,
        version_notes: createNewVersion ? versionNotes : undefined,
        spaces: spaces.map((space, spaceIndex) => ({
          id: space.id.startsWith("new-") ? undefined : space.id,
          space_type_id: space.spaceTypeId,
          name: space.defaultName,
          sort_order: spaceIndex,
          components: space.components.map((comp, compIndex) => ({
            id: comp.id.startsWith("new-") ? undefined : comp.id,
            component_type_id: comp.componentTypeId,
            component_variant_id: comp.variantId,
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
                group_name: item.groupName,
                // Store dimensions as-is (in user's selected unit)
                length: item.length,
                width: item.width,
                quantity: item.quantity,
                unit_code: item.unitCode,
                rate: item.rate,
                // Store the measurement unit so we know how to interpret dimensions
                measurement_unit: item.measurementUnit || "ft",
                // Calculate amount on frontend
                amount: calculatedAmount,
                display_order: itemIndex,
                notes: item.notes,
              };
            }),
          })),
        })),
      };

      const response = await fetch(`/api/quotations/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save quotation");
      }

      router.push(`/dashboard/quotations/${quotationId}`);
    } catch (error) {
      console.error("Error saving:", error);
      setSaveError(
        error instanceof Error ? error.message : "Failed to save quotation"
      );
    } finally {
      setIsSaving(false);
    }
  };

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
                href={`/dashboard/quotations/${quotationId}`}
                className="text-slate-600 hover:text-slate-900"
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
                <h1 className="text-lg font-bold text-slate-900">
                  Edit Quotation
                </h1>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  {quotationNumber}
                </span>
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
                onClick={() => saveQuotation(false)}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
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
                {spaces.map((space) => (
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
                  />
                ))}

                {/* Add Space Button */}
                <button
                  onClick={() => setShowAddSpaceModal(true)}
                  className="w-full py-4 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl border-2 border-dashed border-blue-300 flex items-center justify-center gap-2"
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

      {showSelectVariantModal && (
        <SelectVariantModal
          isOpen={true}
          onClose={() => setShowSelectVariantModal(null)}
          onSelect={(variant) =>
            setComponentVariant(
              showSelectVariantModal.spaceId,
              showSelectVariantModal.componentId,
              variant
            )
          }
          variants={getVariantsForComponent(
            showSelectVariantModal.componentTypeId
          )}
        />
      )}

      {showAddCostItemModal && (
        <AddCostItemModal
          isOpen={true}
          onClose={() => setShowAddCostItemModal(null)}
          onAdd={(costItem, groupName) =>
            addCostItem(
              showAddCostItemModal.spaceId,
              showAddCostItemModal.componentId,
              costItem,
              groupName
            )
          }
          costItems={masterData.cost_items}
          categories={masterData.cost_item_categories}
        />
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Use Template
                </h2>
                <p className="text-sm text-slate-500">
                  Select a template to load
                </p>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <input
              type="text"
              placeholder="Search templates..."
              value={templateSearch}
              onChange={(e) => {
                setTemplateSearch(e.target.value);
                fetchTemplates(e.target.value);
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4"
            />

            <div className="flex-1 overflow-y-auto space-y-2">
              {loadingTemplates ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : templates.length === 0 ? (
                <p className="text-center text-slate-500 py-8">
                  No templates found
                </p>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`w-full p-4 text-left border rounded-lg transition-all ${
                      selectedTemplateId === template.id
                        ? "border-purple-500 bg-purple-50"
                        : "border-slate-200 hover:border-purple-300"
                    }`}
                  >
                    <div className="font-medium text-slate-900">
                      {template.name}
                    </div>
                    <div className="text-sm text-slate-500">
                      {template.property_type} • {template.quality_tier}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="flex gap-3 mt-4 pt-4 border-t">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="flex-1 py-2 text-slate-600 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  selectedTemplateId && loadTemplate(selectedTemplateId)
                }
                disabled={!selectedTemplateId || loadingTemplate}
                className="flex-1 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50"
              >
                {loadingTemplate ? "Loading..." : "Load Template"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Version Modal */}
      {showNewVersionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Create New Version
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              This will save as version {version + 1} while keeping the
              original.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Version Notes
              </label>
              <textarea
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                rows={3}
                placeholder="Describe changes..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewVersionModal(false)}
                className="flex-1 py-2 text-slate-600 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowNewVersionModal(false);
                  saveQuotation(true);
                }}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg"
              >
                Create Version
              </button>
            </div>
          </div>
        </div>
      )}
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
