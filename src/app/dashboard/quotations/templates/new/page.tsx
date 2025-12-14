"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function NewTemplatePage() {
  const router = useRouter();

  // Template data
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [propertyType, setPropertyType] = useState("3bhk");
  const [qualityTier, setQualityTier] = useState("standard");
  const [spaces, setSpaces] = useState<BuilderSpace[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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

    if (spaces.length === 0) {
      alert("Please add at least one space to the template");
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

      const payload = {
        name: templateName,
        description: templateDescription,
        property_type: propertyType,
        quality_tier: qualityTier,
        spaces: templateSpaces,
        line_items: templateLineItems,
      };

      console.log("=== SAVING TEMPLATE ===");
      console.log("Payload:", JSON.stringify(payload, null, 2));
      console.log("Spaces count:", templateSpaces.length);
      console.log("Line items count:", templateLineItems.length);

      const response = await fetch("/api/quotations/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("API Response:", JSON.stringify(result, null, 2));

      if (!response.ok) {
        throw new Error(result.error || "Failed to save template");
      }

      console.log("Template saved successfully:", result.template?.id);
      router.push(
        `/dashboard/quotations/templates/${result.template?.id || ""}`
      );
    } catch (error) {
      console.error("Error saving template:", error);
      alert(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingMasterData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-slate-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading master data...</p>
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
                href="/dashboard/quotations/templates"
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
                  Create Template
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/quotations/templates"
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                onClick={saveTemplate}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Template"}
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
                  placeholder="e.g., 3BHK Premium Package"
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
                  <option value="commercial">Commercial</option>
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

          {/* Hierarchy Info */}
          <div className="mb-4 p-4 bg-slate-100 rounded-lg border border-slate-200">
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Structure:</span>
              <span className="flex items-center gap-1">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                  Space
                </span>
                <span>→</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                  Component
                </span>
                <span>→</span>
              </span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                Cost Items
              </span>
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
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Start Building Your Template
                </h3>
                <p className="text-slate-600 mb-6">
                  Add spaces (rooms) to begin creating your template structure
                </p>
                <button
                  onClick={() => setShowAddSpaceModal(true)}
                  className="px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
                >
                  + Add First Space
                </button>
              </div>
            ) : (
              <>
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
              </>
            )}
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
