"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
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
        const spaceMap = new Map<string, BuilderSpace>();
        const componentMap = new Map<string, BuilderComponent>();

        // Create spaces from template spaces
        (template.spaces || []).forEach((ts: any) => {
          const spaceType = masterData.space_types.find(
            (st) => st.id === ts.space_type_id
          );
          const spaceId = generateId();
          spaceMap.set(ts.space_type_id, {
            id: spaceId,
            spaceTypeId: ts.space_type_id,
            name: spaceType?.name || ts.space_type?.name || "Space",
            defaultName: ts.default_name || spaceType?.name || "Space",
            components: [],
            expanded: true,
          });
        });

        // Process line items to create components
        (template.line_items || []).forEach((item: any) => {
          if (!item.space_type_id || !item.component_type_id) return;

          let space = spaceMap.get(item.space_type_id);
          if (!space) {
            const spaceType = masterData.space_types.find(
              (st) => st.id === item.space_type_id
            );
            space = {
              id: generateId(),
              spaceTypeId: item.space_type_id,
              name: spaceType?.name || item.space_type?.name || "Space",
              defaultName: spaceType?.name || item.space_type?.name || "Space",
              components: [],
              expanded: true,
            };
            spaceMap.set(item.space_type_id, space);
          }

          const componentKey = `${item.space_type_id}-${
            item.component_type_id
          }-${item.component_variant_id || "default"}`;
          let component = componentMap.get(componentKey);
          if (!component) {
            const componentType = masterData.component_types.find(
              (ct) => ct.id === item.component_type_id
            );
            const variant = item.component_variant_id
              ? masterData.component_variants.find(
                  (v) => v.id === item.component_variant_id
                )
              : null;

            component = {
              id: generateId(),
              componentTypeId: item.component_type_id,
              variantId: item.component_variant_id,
              name:
                componentType?.name || item.component_type?.name || "Component",
              variantName: variant?.name || item.component_variant?.name,
              lineItems: [],
              expanded: true,
            };
            componentMap.set(componentKey, component);
            space.components.push(component);
          }

          const costItem = masterData.cost_items.find(
            (ci) => ci.id === item.cost_item_id
          );
          const category = costItem?.category_id
            ? masterData.cost_item_categories.find(
                (c) => c.id === costItem.category_id
              )
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
            groupName: item.group_name || "Other",
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

  // Update component variant
  const updateComponentVariant = (
    spaceId: string,
    componentId: string,
    variantId: string,
    variantName: string
  ) => {
    setSpaces(
      spaces.map((space) => {
        if (space.id === spaceId) {
          return {
            ...space,
            components: space.components.map((c) =>
              c.id === componentId
                ? {
                    ...c,
                    variantId: variantId || undefined,
                    variantName: variantName || undefined,
                  }
                : c
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

          {/* Spaces */}
          <div className="space-y-4">
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
                onUpdateComponentName={(componentId, name) =>
                  updateComponentName(space.id, componentId, name)
                }
                onUpdateComponentVariant={(
                  componentId,
                  variantId,
                  variantName
                ) =>
                  updateComponentVariant(
                    space.id,
                    componentId,
                    variantId,
                    variantName
                  )
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
