"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
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
} from "@/components/quotations";
import { AddSpaceModal } from "@/components/quotations/AddSpaceModal";
import { AddComponentModal } from "@/components/quotations/AddComponentModal";
import { AddCostItemModal } from "@/components/quotations/AddCostItemModal";
import { SpaceCard } from "@/components/quotations/SpaceCard";

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Template data
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [propertyType, setPropertyType] = useState("3bhk");
  const [qualityTier, setQualityTier] = useState("standard");
  const [spaces, setSpaces] = useState<BuilderSpace[]>([]);

  // Master data
  const [masterData, setMasterData] = useState<MasterData>({
    units: [],
    space_types: [],
    component_types: [],
    quotation_cost_item_categories: [],
    quotation_cost_items: [],
  });
  const [isLoadingMasterData, setIsLoadingMasterData] = useState(true);

  // Drag and drop states
  const [draggedSpaceId, setDraggedSpaceId] = useState<string | null>(null);
  const [dragOverSpaceId, setDragOverSpaceId] = useState<string | null>(null);

  // Modal states
  const [showAddSpaceModal, setShowAddSpaceModal] = useState(false);
  const [showAddComponentModal, setShowAddComponentModal] = useState<
    string | null
  >(null);
  const [showAddCostItemModal, setShowAddCostItemModal] = useState<{
    spaceId: string;
    componentId: string;
  } | null>(null);

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
      } finally {
        setIsLoadingMasterData(false);
      }
    };
    fetchMasterData();
  }, []);

  // Fetch template data
  useEffect(() => {
    const fetchTemplate = async () => {
      if (!templateId || isLoadingMasterData) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/quotations/templates/${templateId}`);
        if (!response.ok) throw new Error("Failed to load template");

        const result = await response.json();
        if (!result.success || !result.template)
          throw new Error("Template not found");

        const template = result.template;

        setTemplateName(template.name || "");
        setTemplateDescription(template.description || "");
        setPropertyType(template.property_type || "3bhk");
        setQualityTier(template.quality_tier || "standard");

        // Convert API structure to builder format
        // Use template_space.id (database ID) as the key to properly distinguish multiple spaces of the same type
        const spaceMap = new Map<string, BuilderSpace>();
        const componentMap = new Map<string, BuilderComponent>();

        // Create spaces from template spaces - using the actual space instance ID (ts.id) as key
        // This ensures each space (e.g., Bedroom 1, Bedroom 2) is treated separately
        (template.spaces || []).forEach((ts: any) => {
          const spaceType = masterData.space_types.find(
            (st) => st.id === ts.space_type_id
          );
          const spaceId = generateId();
          // Use ts.id (template_space database id) as the key, NOT space_type_id
          spaceMap.set(ts.id, {
            id: spaceId,
            spaceTypeId: ts.space_type_id,
            templateSpaceId: ts.id, // Store the database ID for reference
            name: spaceType?.name || ts.space_type?.name || "Space",
            defaultName: ts.default_name || spaceType?.name || "Space",
            components: [],
            expanded: true,
          });
        });

        // Process line items to create components
        // Match line items to spaces using template_space_id first (new schema), then fall back to space_type_id
        (template.line_items || []).forEach((item: any) => {
          if (!item.component_type_id) return;

          // First try to match by template_space_id (links to specific space instance)
          let spaceKey = item.template_space_id;
          let space = spaceKey ? spaceMap.get(spaceKey) : undefined;

          // Fall back to space_type_id if no template_space_id (legacy data)
          // Find the first space with matching space_type_id
          if (!space && item.space_type_id) {
            const matchingEntry = Array.from(spaceMap.entries()).find(
              ([, s]) => s.spaceTypeId === item.space_type_id
            );
            if (matchingEntry) {
              spaceKey = matchingEntry[0];
              space = matchingEntry[1];
            } else {
              // Create a new space if none exists
              const spaceType = masterData.space_types.find(
                (st) => st.id === item.space_type_id
              );
              spaceKey = `legacy-${item.space_type_id}`;
              space = {
                id: generateId(),
                spaceTypeId: item.space_type_id,
                name: spaceType?.name || item.space_type?.name || "Space",
                defaultName:
                  spaceType?.name || item.space_type?.name || "Space",
                components: [],
                expanded: true,
              };
              spaceMap.set(spaceKey, space);
            }
          }

          if (!space) return;

          // Create component key using the resolved space key (unique per space instance)
          const componentKey = `${spaceKey}-${item.component_type_id}`;
          let component = componentMap.get(componentKey);
          if (!component) {
            const componentType = masterData.component_types.find(
              (ct) => ct.id === item.component_type_id
            );

            component = {
              id: generateId(),
              componentTypeId: item.component_type_id,
              name:
                componentType?.name || item.component_type?.name || "Component",
              lineItems: [],
              expanded: true,
            };
            componentMap.set(componentKey, component);
            space.components.push(component);
          }

          const costItemsData =
            masterData.quotation_cost_items || masterData.cost_items || [];
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

          component.lineItems.push({
            id: generateId(),
            costItemId: item.cost_item_id,
            costItemName: costItem?.name || item.cost_item?.name || "Cost Item",
            categoryName:
              category?.name ||
              item.cost_item?.category?.name ||
              "Uncategorized",
            categoryColor:
              category?.color || item.cost_item?.category?.color || "#718096",
            unitCode: costItem?.unit_code || item.cost_item?.unit_code || "nos",
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
          });
        });

        setSpaces(Array.from(spaceMap.values()));
        setLoadError(null);
      } catch (error) {
        console.error("Error loading template:", error);
        setLoadError(
          error instanceof Error ? error.message : "Failed to load template"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplate();
  }, [templateId, isLoadingMasterData, masterData]);

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
      id: generateId(),
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

  // Move space up/down
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

  // Move component up/down within a space
  const moveComponent = (
    spaceId: string,
    componentId: string,
    direction: "up" | "down"
  ) => {
    setSpaces(
      spaces.map((space) => {
        if (space.id !== spaceId) return space;

        const compIndex = space.components.findIndex(
          (c) => c.id === componentId
        );
        if (compIndex === -1) return space;

        const newIndex = direction === "up" ? compIndex - 1 : compIndex + 1;
        if (newIndex < 0 || newIndex >= space.components.length) return space;

        const newComponents = [...space.components];
        [newComponents[compIndex], newComponents[newIndex]] = [
          newComponents[newIndex],
          newComponents[compIndex],
        ];
        return { ...space, components: newComponents };
      })
    );
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

  // Duplicate space with all components and line items
  const duplicateSpace = (spaceId: string) => {
    const spaceIndex = spaces.findIndex((s) => s.id === spaceId);
    if (spaceIndex === -1) return;

    const originalSpace = spaces[spaceIndex];
    const existingCount = spaces.filter(
      (s) => s.spaceTypeId === originalSpace.spaceTypeId
    ).length;

    const newSpace: BuilderSpace = {
      id: generateId(),
      spaceTypeId: originalSpace.spaceTypeId,
      name: originalSpace.name,
      defaultName: `${originalSpace.name} ${existingCount + 1}`,
      components: originalSpace.components.map((comp) => ({
        ...comp,
        id: generateId(),
        lineItems: comp.lineItems.map((item) => ({
          ...item,
          id: generateId(),
        })),
      })),
      expanded: true,
    };

    const newSpaces = [...spaces];
    newSpaces.splice(spaceIndex + 1, 0, newSpace);
    setSpaces(newSpaces);
  };

  // Duplicate component with all line items
  const duplicateComponent = (spaceId: string, componentId: string) => {
    setSpaces(
      spaces.map((space) => {
        if (space.id !== spaceId) return space;

        const compIndex = space.components.findIndex(
          (c) => c.id === componentId
        );
        if (compIndex === -1) return space;

        const originalComp = space.components[compIndex];
        const newComponent: BuilderComponent = {
          ...originalComp,
          id: generateId(),
          lineItems: originalComp.lineItems.map((item) => ({
            ...item,
            id: generateId(),
          })),
        };

        const newComponents = [...space.components];
        newComponents.splice(compIndex + 1, 0, newComponent);
        return { ...space, components: newComponents };
      })
    );
  };

  // Component operations
  const addComponent = (spaceId: string, componentType: ComponentType) => {
    const newComponent: BuilderComponent = {
      id: generateId(),
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

  // Update component custom name
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
      id: generateId(),
      costItemId: costItem.id,
      costItemName: costItem.name,
      categoryName: category?.name || "Uncategorized",
      categoryColor: category?.color || "#718096",
      unitCode: costItem.unit_code,
      rate: costItem.default_rate,
      defaultRate: costItem.default_rate,
      companyCost: costItem.company_cost || 0,
      vendorCost: costItem.vendor_cost || 0,
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
                  lineItems: comp.lineItems.map((item) =>
                    item.id === lineItemId ? { ...item, ...updates } : item
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

  // Save template
  const saveTemplate = async () => {
    if (!templateName.trim()) {
      alert("Please enter a template name");
      return;
    }

    setIsSaving(true);

    try {
      // Include client_id so the API can map spaces to line items
      const templateSpaces = spaces.map((space, idx) => ({
        client_id: space.id, // Frontend-generated ID for mapping
        space_type_id: space.spaceTypeId,
        default_name: space.defaultName,
        display_order: idx,
      }));

      const templateLineItems: any[] = [];
      let lineItemOrder = 0;

      spaces.forEach((space) => {
        space.components.forEach((component) => {
          component.lineItems.forEach((lineItem) => {
            templateLineItems.push({
              client_space_id: space.id, // Reference to specific space instance
              space_type_id: space.spaceTypeId,
              component_type_id: component.componentTypeId,
              cost_item_id: lineItem.costItemId,
              rate:
                lineItem.rate !== lineItem.defaultRate ? lineItem.rate : null,
              display_order: lineItemOrder++,
            });
          });
        });
      });

      const response = await fetch(`/api/quotations/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          property_type: propertyType,
          quality_tier: qualityTier,
          spaces: templateSpaces,
          line_items: templateLineItems,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update template");
      }

      router.push(`/dashboard/quotations/templates/${templateId}`);
    } catch (error) {
      console.error("Error saving template:", error);
      alert(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingMasterData || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-slate-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading template...</p>
        </div>
      </div>
    );
  }

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
            Failed to load template
          </h2>
          <p className="text-slate-600 mb-4">{loadError}</p>
          <Link
            href="/dashboard/quotations/templates"
            className="inline-flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
          >
            Back to Templates
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
                href={`/dashboard/quotations/templates/${templateId}`}
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
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  Edit Template
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/quotations/templates/${templateId}`}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                onClick={saveTemplate}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Main Content */}
        <div className="flex-1 p-4 overflow-auto">
          {/* Template Details - Compact */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Premium 3BHK Package"
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                />
              </div>
              <div className="w-32">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Property Type
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                >
                  <option value="1bhk">1 BHK</option>
                  <option value="2bhk">2 BHK</option>
                  <option value="3bhk">3 BHK</option>
                  <option value="4bhk">4 BHK</option>
                  <option value="villa">Villa</option>
                  <option value="penthouse">Penthouse</option>
                  <option value="office">Office</option>
                  <option value="retail">Retail</option>
                </select>
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Quality Tier
                </label>
                <select
                  value={qualityTier}
                  onChange={(e) => setQualityTier(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                >
                  <option value="budget">Budget</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="luxury">Luxury</option>
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
                />
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
            {spaces.map((space, spaceIndex) => (
              <SpaceCard
                key={space.id}
                space={space}
                mode="template"
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
                onUpdateComponentName={(componentId, name) =>
                  updateComponentName(space.id, componentId, name)
                }
                masterData={masterData}
                onAddCostItem={(componentId) =>
                  setShowAddCostItemModal({ spaceId: space.id, componentId })
                }
                onUpdateLineItem={(componentId, lineItemId, updates) =>
                  updateLineItem(space.id, componentId, lineItemId, updates)
                }
                onDeleteLineItem={(componentId, lineItemId) =>
                  deleteLineItem(space.id, componentId, lineItemId)
                }
                formatCurrency={formatCurrency}
                // Drag and drop
                onDragStart={() => handleSpaceDragStart(space.id)}
                onDragOver={(e) => handleSpaceDragOver(e, space.id)}
                onDragLeave={handleSpaceDragLeave}
                onDrop={() => handleSpaceDrop(space.id)}
                onDragEnd={handleSpaceDragEnd}
                isDragging={draggedSpaceId === space.id}
                isDragOver={dragOverSpaceId === space.id}
                // Duplicate
                onDuplicateSpace={() => duplicateSpace(space.id)}
                onDuplicateComponent={(componentId) =>
                  duplicateComponent(space.id, componentId)
                }
                onMoveComponentUp={(componentId) =>
                  moveComponent(space.id, componentId, "up")
                }
                onMoveComponentDown={(componentId) =>
                  moveComponent(space.id, componentId, "down")
                }
              />
            ))}

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
          </div>
        </div>
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
    </div>
  );
}
