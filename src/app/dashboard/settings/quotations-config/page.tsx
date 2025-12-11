"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  Squares2X2Icon,
  CubeIcon,
  SwatchIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import {
  SettingsPageLayout,
  SettingsPageHeader,
  SettingsPageContent,
} from "@/components/ui/SettingsPageLayout";
import { uiLogger } from "@/lib/logger";

interface SpaceType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface ComponentType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface ComponentVariant {
  id: string;
  component_type_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  component_type?: { id: string; name: string; slug: string };
}

type TabType = "spaces" | "components" | "variants";
type SortDirection = "asc" | "desc" | null;
type SortColumn = "name" | "description" | "is_active" | "component" | null;

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

interface ModalState {
  isOpen: boolean;
  mode: "add" | "edit";
  item: SpaceType | ComponentType | ComponentVariant | null;
}

interface DeleteModalState {
  isOpen: boolean;
  item: SpaceType | ComponentType | ComponentVariant | null;
  type: TabType;
}

export default function QuotationsConfigPage() {
  const [activeTab, setActiveTab] = useState<TabType>("spaces");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [spaces, setSpaces] = useState<SpaceType[]>([]);
  const [components, setComponents] = useState<ComponentType[]>([]);
  const [variants, setVariants] = useState<ComponentVariant[]>([]);

  // Sorting state for each tab
  const [spacesSort, setSpacesSort] = useState<SortState>({
    column: null,
    direction: null,
  });
  const [componentsSort, setComponentsSort] = useState<SortState>({
    column: null,
    direction: null,
  });
  const [variantsSort, setVariantsSort] = useState<SortState>({
    column: null,
    direction: null,
  });

  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    mode: "add",
    item: null,
  });
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    item: null,
    type: "spaces",
  });

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formComponentTypeId, setFormComponentTypeId] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSpaces = useCallback(async () => {
    try {
      uiLogger.debug("Fetching spaces");
      const res = await fetch("/api/quotations/config/space-types");
      if (!res.ok) throw new Error("Failed to fetch spaces");
      const data = await res.json();
      setSpaces(data.data || []);
      uiLogger.info("Spaces fetched successfully", {
        count: data.data?.length || 0,
      });
    } catch (err) {
      uiLogger.error("Error fetching spaces", { error: err });
      setError("Failed to load spaces");
    }
  }, []);

  const fetchComponents = useCallback(async () => {
    try {
      uiLogger.debug("Fetching components");
      const res = await fetch("/api/quotations/config/component-types");
      if (!res.ok) throw new Error("Failed to fetch components");
      const data = await res.json();
      setComponents(data.data || []);
      uiLogger.info("Components fetched successfully", {
        count: data.data?.length || 0,
      });
    } catch (err) {
      uiLogger.error("Error fetching components", { error: err });
      setError("Failed to load components");
    }
  }, []);

  const fetchVariants = useCallback(async () => {
    try {
      uiLogger.debug("Fetching variants");
      const res = await fetch("/api/quotations/config/component-variants");
      if (!res.ok) throw new Error("Failed to fetch variants");
      const data = await res.json();
      setVariants(data.data || []);
      uiLogger.info("Variants fetched successfully", {
        count: data.data?.length || 0,
      });
    } catch (err) {
      uiLogger.error("Error fetching variants", { error: err });
      setError("Failed to load variants");
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    uiLogger.info("Loading quotation configuration data");
    await Promise.all([fetchSpaces(), fetchComponents(), fetchVariants()]);
    setIsLoading(false);
    uiLogger.info("Quotation configuration data loaded");
  }, [fetchSpaces, fetchComponents, fetchVariants]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleTabChange = (tabId: TabType) => {
    uiLogger.debug("Switching quotation config tab", {
      from: activeTab,
      to: tabId,
    });
    setActiveTab(tabId);
  };

  const filteredSpaces = spaces.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredComponents = components.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVariants = variants.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.component_type?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sorting functions
  const sortSpaces = (data: SpaceType[], sort: SortState): SpaceType[] => {
    if (!sort.column || !sort.direction) return data;
    return [...data].sort((a, b) => {
      let aVal: string | boolean | null = null;
      let bVal: string | boolean | null = null;

      if (sort.column === "name") {
        aVal = a.name;
        bVal = b.name;
      } else if (sort.column === "description") {
        aVal = a.description;
        bVal = b.description;
      } else if (sort.column === "is_active") {
        aVal = a.is_active;
        bVal = b.is_active;
      }

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sort.direction === "asc" ? 1 : -1;
      if (bVal == null) return sort.direction === "asc" ? -1 : 1;

      if (typeof aVal === "boolean") {
        if (aVal === bVal) return 0;
        return sort.direction === "asc" ? (aVal ? -1 : 1) : aVal ? 1 : -1;
      }

      const cmp = String(aVal)
        .toLowerCase()
        .localeCompare(String(bVal).toLowerCase());
      return sort.direction === "asc" ? cmp : -cmp;
    });
  };

  const sortComponents = (
    data: ComponentType[],
    sort: SortState
  ): ComponentType[] => {
    if (!sort.column || !sort.direction) return data;
    return [...data].sort((a, b) => {
      let aVal: string | boolean | null = null;
      let bVal: string | boolean | null = null;

      if (sort.column === "name") {
        aVal = a.name;
        bVal = b.name;
      } else if (sort.column === "description") {
        aVal = a.description;
        bVal = b.description;
      } else if (sort.column === "is_active") {
        aVal = a.is_active;
        bVal = b.is_active;
      }

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sort.direction === "asc" ? 1 : -1;
      if (bVal == null) return sort.direction === "asc" ? -1 : 1;

      if (typeof aVal === "boolean") {
        if (aVal === bVal) return 0;
        return sort.direction === "asc" ? (aVal ? -1 : 1) : aVal ? 1 : -1;
      }

      const cmp = String(aVal)
        .toLowerCase()
        .localeCompare(String(bVal).toLowerCase());
      return sort.direction === "asc" ? cmp : -cmp;
    });
  };

  const sortVariants = (
    data: ComponentVariant[],
    sort: SortState,
    componentsList: ComponentType[]
  ): ComponentVariant[] => {
    if (!sort.column || !sort.direction) return data;
    return [...data].sort((a, b) => {
      let aVal: string | boolean | null = null;
      let bVal: string | boolean | null = null;

      if (sort.column === "name") {
        aVal = a.name;
        bVal = b.name;
      } else if (sort.column === "description") {
        aVal = a.description;
        bVal = b.description;
      } else if (sort.column === "is_active") {
        aVal = a.is_active;
        bVal = b.is_active;
      } else if (sort.column === "component") {
        aVal =
          a.component_type?.name ||
          componentsList.find((c) => c.id === a.component_type_id)?.name ||
          "";
        bVal =
          b.component_type?.name ||
          componentsList.find((c) => c.id === b.component_type_id)?.name ||
          "";
      }

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sort.direction === "asc" ? 1 : -1;
      if (bVal == null) return sort.direction === "asc" ? -1 : 1;

      if (typeof aVal === "boolean") {
        if (aVal === bVal) return 0;
        return sort.direction === "asc" ? (aVal ? -1 : 1) : aVal ? 1 : -1;
      }

      const cmp = String(aVal)
        .toLowerCase()
        .localeCompare(String(bVal).toLowerCase());
      return sort.direction === "asc" ? cmp : -cmp;
    });
  };

  // Sorted and filtered data
  const sortedSpaces = useMemo(
    () => sortSpaces(filteredSpaces, spacesSort),
    [filteredSpaces, spacesSort]
  );
  const sortedComponents = useMemo(
    () => sortComponents(filteredComponents, componentsSort),
    [filteredComponents, componentsSort]
  );
  const sortedVariants = useMemo(
    () => sortVariants(filteredVariants, variantsSort, components),
    [filteredVariants, variantsSort, components]
  );

  // Handle sort click
  const handleSort = (column: SortColumn) => {
    if (!column) return;

    const getSortState = () => {
      if (activeTab === "spaces") return spacesSort;
      if (activeTab === "components") return componentsSort;
      return variantsSort;
    };

    const setSortState = (state: SortState) => {
      if (activeTab === "spaces") setSpacesSort(state);
      else if (activeTab === "components") setComponentsSort(state);
      else setVariantsSort(state);
    };

    const currentSort = getSortState();
    let newDirection: SortDirection = "asc";

    if (currentSort.column === column) {
      if (currentSort.direction === "asc") newDirection = "desc";
      else if (currentSort.direction === "desc") newDirection = null;
    }

    setSortState({
      column: newDirection ? column : null,
      direction: newDirection,
    });
  };

  // Sort indicator component
  const SortIndicator = ({
    column,
    sortState,
  }: {
    column: SortColumn;
    sortState: SortState;
  }) => {
    const isActive = sortState.column === column;
    return (
      <span className="inline-flex flex-col ml-1">
        <ChevronUpIcon
          className={`w-3 h-3 -mb-1 ${
            isActive && sortState.direction === "asc"
              ? "text-blue-600"
              : "text-slate-300"
          }`}
        />
        <ChevronDownIcon
          className={`w-3 h-3 ${
            isActive && sortState.direction === "desc"
              ? "text-blue-600"
              : "text-slate-300"
          }`}
        />
      </span>
    );
  };

  const openAddModal = () => {
    setFormName("");
    setFormDescription("");
    setFormComponentTypeId(components[0]?.id || "");
    setFormIsActive(true);
    setModal({ isOpen: true, mode: "add", item: null });
  };

  const openEditModal = (
    item: SpaceType | ComponentType | ComponentVariant
  ) => {
    setFormName(item.name);
    setFormDescription(item.description || "");
    setFormIsActive(item.is_active);
    if ("component_type_id" in item) {
      setFormComponentTypeId(item.component_type_id);
    }
    setModal({ isOpen: true, mode: "edit", item });
  };

  const closeModal = () => setModal({ isOpen: false, mode: "add", item: null });

  const openDeleteModal = (
    item: SpaceType | ComponentType | ComponentVariant
  ) => {
    setDeleteModal({ isOpen: true, item, type: activeTab });
  };

  const closeDeleteModal = () =>
    setDeleteModal({ isOpen: false, item: null, type: "spaces" });

  const handleSave = async () => {
    if (!formName.trim()) return;
    setIsSaving(true);
    try {
      let endpoint = "";
      const body: Record<string, unknown> = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        is_active: formIsActive,
      };

      if (activeTab === "spaces") {
        endpoint = "/api/quotations/config/space-types";
      } else if (activeTab === "components") {
        endpoint = "/api/quotations/config/component-types";
      } else {
        endpoint = "/api/quotations/config/component-variants";
        body.component_type_id = formComponentTypeId;
      }

      if (modal.mode === "edit" && modal.item) {
        uiLogger.info("Updating item", {
          type: activeTab,
          id: modal.item.id,
          name: formName,
        });
        body.id = modal.item.id;
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to update");
        uiLogger.info("Item updated successfully", {
          type: activeTab,
          id: modal.item.id,
        });
      } else {
        uiLogger.info("Creating new item", { type: activeTab, name: formName });
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to create");
        uiLogger.info("Item created successfully", {
          type: activeTab,
          name: formName,
        });
      }

      closeModal();
      if (activeTab === "spaces") await fetchSpaces();
      else if (activeTab === "components") await fetchComponents();
      else await fetchVariants();
    } catch (err) {
      uiLogger.error("Error saving item", { type: activeTab, error: err });
      setError("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.item) return;
    setIsSaving(true);
    try {
      let endpoint = "";
      if (deleteModal.type === "spaces")
        endpoint = "/api/quotations/config/space-types";
      else if (deleteModal.type === "components")
        endpoint = "/api/quotations/config/component-types";
      else endpoint = "/api/quotations/config/component-variants";

      uiLogger.info("Deleting item", {
        type: deleteModal.type,
        id: deleteModal.item.id,
        name: deleteModal.item.name,
      });
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteModal.item.id }),
      });
      if (!res.ok) throw new Error("Failed to delete");

      uiLogger.info("Item deleted successfully", {
        type: deleteModal.type,
        id: deleteModal.item.id,
      });
      closeDeleteModal();
      if (deleteModal.type === "spaces") await fetchSpaces();
      else if (deleteModal.type === "components") await fetchComponents();
      else await fetchVariants();
    } catch (err) {
      uiLogger.error("Error deleting item", {
        type: deleteModal.type,
        error: err,
      });
      setError("Failed to delete. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const getAddButtonLabel = () => {
    if (activeTab === "spaces") return "Add Space";
    if (activeTab === "components") return "Add Component";
    return "Add Variant";
  };

  const getModalTitle = () => {
    const action = modal.mode === "add" ? "Add" : "Edit";
    if (activeTab === "spaces") return action + " Space";
    if (activeTab === "components") return action + " Component";
    return action + " Variant";
  };

  const getDeleteItemType = () => {
    if (deleteModal.type === "spaces") return "space";
    if (deleteModal.type === "components") return "component";
    return "variant";
  };

  const tabs = [
    {
      id: "spaces" as TabType,
      label: "Spaces",
      icon: Squares2X2Icon,
      count: spaces.length,
    },
    {
      id: "components" as TabType,
      label: "Components",
      icon: CubeIcon,
      count: components.length,
    },
    {
      id: "variants" as TabType,
      label: "Variants",
      icon: SwatchIcon,
      count: variants.length,
    },
  ];

  const renderTable = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-500">Loading...</p>
          </div>
        </div>
      );
    }

    const currentData =
      activeTab === "spaces"
        ? sortedSpaces
        : activeTab === "components"
        ? sortedComponents
        : sortedVariants;

    if (currentData.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Squares2X2Icon className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">
            No {activeTab} found
          </p>
          <p className="text-xs text-slate-500 mb-3">
            {searchQuery
              ? "Try adjusting your search"
              : "Create your first " + getDeleteItemType() + " to get started"}
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            {getAddButtonLabel()}
          </button>
        </div>
      );
    }

    if (activeTab === "spaces") {
      return (
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full table-auto">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200">
                <th
                  onClick={() => handleSort("name")}
                  className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <span className="flex items-center">
                    Name
                    <SortIndicator column="name" sortState={spacesSort} />
                  </span>
                </th>
                <th
                  onClick={() => handleSort("description")}
                  className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <span className="flex items-center">
                    Description
                    <SortIndicator
                      column="description"
                      sortState={spacesSort}
                    />
                  </span>
                </th>
                <th
                  onClick={() => handleSort("is_active")}
                  className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <span className="flex items-center">
                    Status
                    <SortIndicator column="is_active" sortState={spacesSort} />
                  </span>
                </th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedSpaces.map((space) => (
                <tr
                  key={space.id}
                  className="group border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-4 py-2.5 text-xs font-medium text-slate-800">
                    {space.name}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">
                    {space.description || "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        space.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {space.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(space)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(space)}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === "components") {
      return (
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full table-auto">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200">
                <th
                  onClick={() => handleSort("name")}
                  className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <span className="flex items-center">
                    Name
                    <SortIndicator column="name" sortState={componentsSort} />
                  </span>
                </th>
                <th
                  onClick={() => handleSort("description")}
                  className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <span className="flex items-center">
                    Description
                    <SortIndicator
                      column="description"
                      sortState={componentsSort}
                    />
                  </span>
                </th>
                <th
                  onClick={() => handleSort("is_active")}
                  className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <span className="flex items-center">
                    Status
                    <SortIndicator
                      column="is_active"
                      sortState={componentsSort}
                    />
                  </span>
                </th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedComponents.map((component) => (
                <tr
                  key={component.id}
                  className="group border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-4 py-2.5 text-xs font-medium text-slate-800">
                    {component.name}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">
                    {component.description || "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        component.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {component.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(component)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(component)}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full table-auto">
          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr className="border-b border-slate-200">
              <th
                onClick={() => handleSort("name")}
                className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <span className="flex items-center">
                  Name
                  <SortIndicator column="name" sortState={variantsSort} />
                </span>
              </th>
              <th
                onClick={() => handleSort("component")}
                className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <span className="flex items-center">
                  Component
                  <SortIndicator column="component" sortState={variantsSort} />
                </span>
              </th>
              <th
                onClick={() => handleSort("description")}
                className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <span className="flex items-center">
                  Description
                  <SortIndicator
                    column="description"
                    sortState={variantsSort}
                  />
                </span>
              </th>
              <th
                onClick={() => handleSort("is_active")}
                className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <span className="flex items-center">
                  Status
                  <SortIndicator column="is_active" sortState={variantsSort} />
                </span>
              </th>
              <th className="px-4 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedVariants.map((variant) => (
              <tr
                key={variant.id}
                className="group border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-4 py-2.5 text-xs font-medium text-slate-800">
                  {variant.name}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {variant.component_type?.name ||
                    components.find((c) => c.id === variant.component_type_id)
                      ?.name ||
                    "-"}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {variant.description || "-"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      variant.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {variant.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEditModal(variant)}
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(variant)}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <SettingsPageLayout isLoading={isLoading} isSaving={isSaving}>
      <SettingsPageHeader
        title="Quotations Config"
        subtitle="Manage spaces, components, and variants for quotations"
        breadcrumbs={[{ label: "Quotations Config" }]}
        icon={<Squares2X2Icon className="w-4 h-4 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        actions={
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-all"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            {getAddButtonLabel()}
          </button>
        }
      />
      <SettingsPageContent>
        <div className="h-full flex flex-col">
          {/* Tabs & Search Bar */}
          <div className="px-4 py-3 border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between gap-4">
              {/* Tabs */}
              <div className="flex items-center border-b border-transparent -mb-3 pb-3">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? "text-blue-600"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                      <span
                        className={`ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                          activeTab === tab.id
                            ? "bg-blue-100 text-blue-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {tab.count}
                      </span>
                      {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-52 pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-4 mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
              {error}
              <button
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Table Content */}
          {renderTable()}
        </div>
      </SettingsPageContent>

      {/* Add/Edit Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-800">
                {getModalTitle()}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter name..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>

              {activeTab === "variants" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Component *
                  </label>
                  <select
                    value={formComponentTypeId}
                    onChange={(e) => setFormComponentTypeId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  >
                    {components.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Enter description..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    formIsActive ? "bg-blue-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      formIsActive ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-xs text-slate-600">Active</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formName.trim() || isSaving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-linear-to-r from-blue-600 to-blue-500 rounded-lg hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSaving ? "Saving..." : modal.mode === "add" ? "Add" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeDeleteModal}
          />
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 p-5 w-full max-w-sm">
            <div className="text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-3">
                <TrashIcon className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">
                Delete {deleteModal.item.name}?
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                This action cannot be undone. This will permanently delete the{" "}
                {getDeleteItemType()}.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={closeDeleteModal}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SettingsPageLayout>
  );
}
