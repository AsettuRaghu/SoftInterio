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
  ComponentVariant,
  CostItem,
  generateId,
  formatCurrency,
} from "@/components/quotations";
import { AddSpaceModal } from "@/components/quotations/AddSpaceModal";
import { AddComponentModal } from "@/components/quotations/AddComponentModal";
import { SelectVariantModal } from "@/components/quotations/SelectVariantModal";
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
    component_variants: [],
    cost_item_categories: [],
    cost_items: [],
  });
  const [isLoadingMasterData, setIsLoadingMasterData] = useState(true);

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
      } finally {
        setIsLoadingMasterData(false);
      }
    };
    fetchMasterData();
  }, []);

  // Get variants for component
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
      id: generateId(),
      costItemId: costItem.id,
      costItemName: costItem.name,
      categoryName: category?.name || "Uncategorized",
      categoryColor: category?.color || "#718096",
      unitCode: costItem.unit_code,
      rate: costItem.default_rate,
      defaultRate: costItem.default_rate,
      groupName,
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
      const templateSpaces = spaces.map((space, idx) => ({
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
              space_type_id: space.spaceTypeId,
              component_type_id: component.componentTypeId,
              component_variant_id: component.variantId,
              cost_item_id: lineItem.costItemId,
              group_name: lineItem.groupName,
              rate:
                lineItem.rate !== lineItem.defaultRate ? lineItem.rate : null,
              display_order: lineItemOrder++,
            });
          });
        });
      });

      const response = await fetch("/api/quotations/templates", {
        method: "POST",
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
        throw new Error(error.error || "Failed to save template");
      }

      const result = await response.json();
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
          <div className="mb-6 p-4 bg-slate-100 rounded-lg border border-slate-200">
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
              <span className="flex items-center gap-1">
                <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">
                  Variant (optional)
                </span>
                <span>→</span>
              </span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                Cost Items
              </span>
            </div>
          </div>

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
                {spaces.map((space) => (
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
    </div>
  );
}
