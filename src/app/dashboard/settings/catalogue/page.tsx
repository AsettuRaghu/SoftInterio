"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  Squares2X2Icon,
  CubeIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  TagIcon,
  ListBulletIcon,
  RectangleStackIcon,
  CalculatorIcon,
  PhotoIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import {
  SettingsPageLayout,
  SettingsPageHeader,
  SettingsPageContent,
} from "@/components/ui/SettingsPageLayout";
import { uiLogger } from "@/lib/logger";
import { invalidateQuotationConfig } from "@/lib/quotations/config-cache";
import { CostItemPicturesDialog } from "@/components/catalogue/CostItemPictures";
import { PresetEditor } from "@/components/catalogue/PresetEditor";
import { SearchSelect } from "@/components/ui/SearchSelect";
import type { ScopePreset } from "@/types/property-scope";

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
  /** The tenant's costing rule; see lib/costing. */
  config_schema?: Record<string, unknown> | null;
  /** Space types it declares it belongs in; empty = any. */
  applicable_space_types?: string[] | null;
}

interface CostItemCategory {
  id: string;
  name: string;
  description: string | null;
  /** How the room sheet asks for it, and the decision it shares with others. */
  question?: string | null;
  decision?: string | null;
  is_active: boolean;
  created_at: string;
  is_charge?: boolean;
}

interface QuotationCostItem {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  unit_code: string;
  company_cost: number | null;
  default_rate: number | null;
  quality_tier?: string | null;
  /** Pictures in the Design Library under this item. */
  picture_count?: number;
  is_active: boolean;
  created_at: string;
  category?: { id: string; name: string } | null;
}

type TabType = "spaces" | "components" | "categories" | "costItems" | "presets";
type SortDirection = "asc" | "desc" | null;
type SortColumn =
  | "name"
  | "description"
  | "is_active"
  | "component"
  | "category"
  | "unit_code"
  | "company_cost"
  | "default_rate"
  | null;

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

interface ModalState {
  isOpen: boolean;
  mode: "add" | "edit";
  item: SpaceType | ComponentType | CostItemCategory | QuotationCostItem | null;
}

interface DeleteModalState {
  isOpen: boolean;
  item: SpaceType | ComponentType | CostItemCategory | QuotationCostItem | ScopePreset | null;
  type: TabType;
}

export default function QuotationsConfigPage() {
  const [activeTab, setActiveTab] = useState<TabType>("spaces");
  // Presets are a table like the other four; only their editor is their
  // own, because a preset is a list of spaces × counts, not a form of fields.
  const [presets, setPresets] = useState<ScopePreset[]>([]);
  const [presetEditing, setPresetEditing] = useState<ScopePreset | "new" | null>(null);

  // Arrive on a tab by URL - the old /catalogue/presets address forwards here.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab") as TabType | null;
    if (tab && ["spaces", "components", "categories", "costItems", "presets"].includes(tab)) setActiveTab(tab);
  }, []);
  // Set from the cost items response. Users without cost_items.pricing get no
  // company cost at all, so the column and its form field are hidden rather
  // than shown empty - a blank column invites people to fill it in.
  const [canViewCosts, setCanViewCosts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Active only, until asked: an inactive item is one somebody retired, and
  // showing it beside the live ones on every visit is noise (2026-09-22).
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  // Extra filters, each only meaningful on one tab.
  const [spaceFilter, setSpaceFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [spaces, setSpaces] = useState<SpaceType[]>([]);
  const [components, setComponents] = useState<ComponentType[]>([]);
  const [categories, setCategories] = useState<CostItemCategory[]>([]);
  const [costItems, setCostItems] = useState<QuotationCostItem[]>([]);

  // Sorting state for each tab: alphabetical by name until a column is
  // clicked, the same on every tab (2026-09-22). The unsorted default was
  // the API's order - display_order, then whatever the seed inserted - which
  // differed from tab to tab and read as random once the catalogue grew.
  const BY_NAME: SortState = { column: "name", direction: "asc" };
  const [spacesSort, setSpacesSort] = useState<SortState>(BY_NAME);
  const [componentsSort, setComponentsSort] = useState<SortState>(BY_NAME);
  const [categoriesSort, setCategoriesSort] = useState<SortState>(BY_NAME);
  const [costItemsSort, setCostItemsSort] = useState<SortState>(BY_NAME);
  const [presetsSort, setPresetsSort] = useState<SortState>(BY_NAME);

  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    mode: "add",
    item: null,
  });
  // Pictures of a cost item - Design Library entries under it.
  const [picturesOf, setPicturesOf] = useState<{ id: string; name: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    item: null,
    type: "spaces",
  });

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formQuestion, setFormQuestion] = useState("");
  const [formDecision, setFormDecision] = useState("");
  const [formUnitCode, setFormUnitCode] = useState("sqft");
  const [formCompanyCost, setFormCompanyCost] = useState("");
  const [formDefaultRate, setFormDefaultRate] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  // Which spaces a component type suits. Empty means no restriction, which is
  // the right default - a component nobody has classified should still be
  // offered rather than hidden.
  const [formSpaceTypeIds, setFormSpaceTypeIds] = useState<string[]>([]);
  // Separate from the page banner, which sits behind the modal overlay and so
  // is invisible exactly when a save fails.
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // For outcomes that are not failures but are not what was asked either -
  // a cost item in use is deactivated rather than deleted, and saying nothing
  // leaves the user staring at a row they thought they had removed.
  const [notice, setNotice] = useState<string | null>(null);
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

  const fetchCategories = useCallback(async () => {
    try {
      uiLogger.debug("Fetching cost item categories");
      const res = await fetch("/api/settings/quotation-cost-item-categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      const data = await res.json();
      setCategories(data.quotationCostItemCategories || data.categories || []);
      uiLogger.info("Categories fetched successfully", {
        count:
          (data.quotationCostItemCategories || data.categories)?.length || 0,
      });
    } catch (err) {
      uiLogger.error("Error fetching categories", { error: err });
      setError("Failed to load categories");
    }
  }, []);

  const fetchCostItems = useCallback(async () => {
    try {
      uiLogger.debug("Fetching quotation cost items");
      // The API pages at 50; this screen is the whole catalogue, so read
      // every page. It used to take the first page only, and once the
      // catalogue passed 50 items whole categories silently went missing.
      const all: QuotationCostItem[] = [];
      let canView = false;
      for (let page = 1, pages = 1; page <= pages; page++) {
        const res = await fetch(`/api/settings/quotation-cost-items?page=${page}&limit=200`);
        if (!res.ok) throw new Error("Failed to fetch cost items");
        const data = await res.json();
        all.push(...(data.quotationCostItems || data.costItems || []));
        canView = !!data.can_view_costs;
        pages = data.pagination?.totalPages || 1;
      }
      setCostItems(all);
      setCanViewCosts(canView);
      uiLogger.info("Cost items fetched successfully", { count: all.length });
    } catch (err) {
      uiLogger.error("Error fetching cost items", { error: err });
      setError("Failed to load items");
    }
  }, []);

  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch("/api/scope-presets?all=1");
      if (!res.ok) throw new Error("Failed to fetch presets");
      const data = await res.json();
      setPresets(data.data || []);
    } catch (err) {
      uiLogger.error("Error fetching presets", { error: err });
      setError("Failed to load presets");
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    uiLogger.info("Loading quotation configuration data");
    await Promise.all([
      fetchSpaces(),
      fetchComponents(),
      fetchCategories(),
      fetchCostItems(),
      fetchPresets(),
    ]);
    setIsLoading(false);
    uiLogger.info("Quotation configuration data loaded");
  }, [fetchSpaces, fetchComponents, fetchCategories, fetchCostItems, fetchPresets]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleTabChange = (tabId: TabType) => {
    uiLogger.debug("Switching quotation config tab", {
      from: activeTab,
      to: tabId,
    });
    setActiveTab(tabId);
    // The address follows the tab, so a reload, the back button and a
    // shared link all land on the tab that was being looked at.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tabId);
    window.history.replaceState(window.history.state, "", url);
  };

  /** Active / inactive, applied the same way on every tab. */
  const matchesStatus = (isActive: boolean) =>
    statusFilter === "all" ||
    (statusFilter === "active" ? isActive : !isActive);

  // The search covers every column a row shows - name, description, the
  // spaces a component belongs in, a preset's spaces, a cost item's
  // category, unit and tier, and the status word - so what is on screen is
  // what is searched. "general" used to miss every component that belonged
  // in Home General because only name and description were read.
  const q = searchQuery.trim().toLowerCase();
  const matchesSearch = (...fields: (string | null | undefined)[]) => !q || fields.some((f) => !!f && f.toLowerCase().includes(q));
  const spaceName = (id: string) => spaces.find((sp) => sp.id === id)?.name ?? "";
  const statusWord = (isActive: boolean) => (isActive ? "active" : "inactive");

  const filteredSpaces = spaces.filter(
    (s) => matchesStatus(s.is_active) && matchesSearch(s.name, s.description, statusWord(s.is_active))
  );

  const filteredPresets = presets.filter(
    (p) => matchesStatus(p.is_active) && matchesSearch(p.name, p.description, statusWord(p.is_active), ...p.items.map((it) => spaceName(it.space_type_id)))
  );

  const filteredComponents = components.filter((c) => {
    if (!matchesStatus(c.is_active)) return false;
    const ids = c.applicable_space_types || [];
    if (spaceFilter !== "all") {
      // Unrestricted components suit every space, so they match any filter.
      if (ids.length > 0 && !ids.includes(spaceFilter)) return false;
    }
    return matchesSearch(c.name, c.description, statusWord(c.is_active), ids.length ? undefined : "any space", ...ids.map(spaceName));
  });

  const filteredCategories = categories.filter(
    (c) => matchesStatus(c.is_active) && matchesSearch(c.name, c.description, statusWord(c.is_active), c.is_charge ? "charge" : undefined)
  );

  const filteredCostItems = costItems.filter(
    (item) =>
      matchesStatus(item.is_active) &&
      (categoryFilter === "all" || item.category_id === categoryFilter) &&
      matchesSearch(item.name, item.description, item.category?.name, item.unit_code, item.quality_tier, statusWord(item.is_active), item.default_rate != null ? String(item.default_rate) : undefined, item.picture_count ? "with pictures" : "no pictures")
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

  const sortCategories = (
    data: CostItemCategory[],
    sort: SortState
  ): CostItemCategory[] => {
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

  const sortCostItems = (
    data: QuotationCostItem[],
    sort: SortState,
    categoriesList: CostItemCategory[]
  ): QuotationCostItem[] => {
    if (!sort.column || !sort.direction) return data;
    return [...data].sort((a, b) => {
      let aVal: string | boolean | number | null = null;
      let bVal: string | boolean | number | null = null;

      if (sort.column === "name") {
        aVal = a.name;
        bVal = b.name;
      } else if (sort.column === "description") {
        aVal = a.description;
        bVal = b.description;
      } else if (sort.column === "is_active") {
        aVal = a.is_active;
        bVal = b.is_active;
      } else if (sort.column === "category") {
        aVal =
          a.category?.name ||
          categoriesList.find((c) => c.id === a.category_id)?.name ||
          "";
        bVal =
          b.category?.name ||
          categoriesList.find((c) => c.id === b.category_id)?.name ||
          "";
      } else if (sort.column === "unit_code") {
        aVal = a.unit_code;
        bVal = b.unit_code;
      } else if (sort.column === "company_cost") {
        aVal = a.company_cost;
        bVal = b.company_cost;
      } else if (sort.column === "default_rate") {
        aVal = a.default_rate;
        bVal = b.default_rate;
      }

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sort.direction === "asc" ? 1 : -1;
      if (bVal == null) return sort.direction === "asc" ? -1 : 1;

      if (typeof aVal === "boolean") {
        if (aVal === bVal) return 0;
        return sort.direction === "asc" ? (aVal ? -1 : 1) : aVal ? 1 : -1;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        const cmp = aVal - bVal;
        return sort.direction === "asc" ? cmp : -cmp;
      }

      const cmp = String(aVal)
        .toLowerCase()
        .localeCompare(String(bVal).toLowerCase());
      return sort.direction === "asc" ? cmp : -cmp;
    });
  };

  // Sorted and filtered data
  const sortPresets = (data: ScopePreset[], sort: SortState): ScopePreset[] => {
    if (!sort.column || !sort.direction) return data;
    return [...data].sort((a, b) => {
      const pick = (x: ScopePreset) => (sort.column === "name" ? x.name : sort.column === "description" ? x.description ?? "" : sort.column === "is_active" ? String(x.is_active) : "");
      const cmp = pick(a).localeCompare(pick(b));
      return sort.direction === "asc" ? cmp : -cmp;
    });
  };

  const sortedPresets = useMemo(() => sortPresets(filteredPresets, presetsSort), [filteredPresets, presetsSort]);
  const sortedSpaces = useMemo(
    () => sortSpaces(filteredSpaces, spacesSort),
    [filteredSpaces, spacesSort]
  );
  const sortedComponents = useMemo(
    () => sortComponents(filteredComponents, componentsSort),
    [filteredComponents, componentsSort]
  );
  const sortedCategories = useMemo(
    () => sortCategories(filteredCategories, categoriesSort),
    [filteredCategories, categoriesSort]
  );
  const sortedCostItems = useMemo(
    () => sortCostItems(filteredCostItems, costItemsSort, categories),
    [filteredCostItems, costItemsSort, categories]
  );

  /**
   * One pager for all four tabs.
   *
   * Each tab keeps its own sorted list, but only one is on screen, so the
   * paging state is shared - and reset whenever the view underneath it
   * changes, or a filter could leave the user on a page that no longer exists.
   */
  const activeRows =
    activeTab === "spaces"
      ? sortedSpaces
      : activeTab === "components"
      ? sortedComponents
      : activeTab === "categories"
      ? sortedCategories
      : activeTab === "presets"
      ? sortedPresets
      : sortedCostItems;

  const totalPages = Math.max(1, Math.ceil(activeRows.length / pageSize));
  const pageStart = (page - 1) * pageSize;

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery, statusFilter, spaceFilter, categoryFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paginate = <T,>(rows: T[]): T[] =>
    rows.slice(pageStart, pageStart + pageSize);

  // Handle sort click
  const handleSort = (column: SortColumn) => {
    if (!column) return;

    const getSortState = () => {
      if (activeTab === "spaces") return spacesSort;
      if (activeTab === "components") return componentsSort;
      if (activeTab === "categories") return categoriesSort;
      if (activeTab === "presets") return presetsSort;
      return costItemsSort;
    };

    const setSortState = (state: SortState) => {
      if (activeTab === "spaces") setSpacesSort(state);
      else if (activeTab === "components") setComponentsSort(state);
      else if (activeTab === "categories") setCategoriesSort(state);
      else if (activeTab === "presets") setPresetsSort(state);
      else setCostItemsSort(state);
    };
    const currentSort = getSortState();
    let newDirection: SortDirection = "asc";

    if (currentSort.column === column) {
      if (currentSort.direction === "asc") newDirection = "desc";
      else if (currentSort.direction === "desc") newDirection = null;
    }

    // A third click clears the column; the list goes back to alphabetical
    // rather than to no order at all.
    setSortState(newDirection ? { column, direction: newDirection } : BY_NAME);
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
    if (activeTab === "presets") {
      setPresetEditing("new");
      return;
    }
    setFormName("");
    setFormDescription("");
    setFormCategoryId("");
    setFormUnitCode("sqft");
    setFormCompanyCost("");
    setFormDefaultRate("");
    setFormQuestion("");
    setFormDecision("");
    setFormIsActive(true);
    setFormSpaceTypeIds([]);
    setModalError(null);
    setModal({ isOpen: true, mode: "add", item: null });
  };

  const openEditModal = (
    item: SpaceType | ComponentType | CostItemCategory | QuotationCostItem
  ) => {
    setFormName(item.name);
    setFormDescription(item.description || "");
    setFormQuestion((item as { question?: string | null }).question || "");
    setFormDecision((item as { decision?: string | null }).decision || "");
    setFormIsActive(item.is_active);
    setFormSpaceTypeIds(
      (item as { applicable_space_types?: string[] | null })
        .applicable_space_types || []
    );
    setModalError(null);
    if ("category_id" in item) {
      setFormCategoryId(item.category_id || "");
      setFormUnitCode(item.unit_code || "sqft");
      setFormCompanyCost(item.company_cost?.toString() || "");
      setFormDefaultRate(item.default_rate?.toString() || "");
    }
    setModal({ isOpen: true, mode: "edit", item });
  };

  const closeModal = () => {
    setModalError(null);
    setModal({ isOpen: false, mode: "add", item: null });
  };

  const openDeleteModal = (
    item: SpaceType | ComponentType | CostItemCategory | QuotationCostItem
  ) => {
    setDeleteError(null);
    setNotice(null);
    setDeleteModal({ isOpen: true, item, type: activeTab });
  };

  const closeDeleteModal = () => {
    setDeleteError(null);
    setDeleteModal({ isOpen: false, item: null, type: "spaces" });
  };

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
        body.applicable_space_types = formSpaceTypeIds;
      } else if (activeTab === "categories") {
        endpoint = "/api/settings/quotation-cost-item-categories";
        body.question = formQuestion;
        body.decision = formDecision;
      } else if (activeTab === "costItems") {
        endpoint = "/api/settings/quotation-cost-items";
        body.category_id = formCategoryId || null;
        body.unit_code = formUnitCode;
        // Only sent when the user can actually see it. Omitting the key
        // leaves the stored value alone; sending null would wipe a cost the
        // user was never shown, just by saving an unrelated edit.
        if (canViewCosts) {
          body.company_cost = formCompanyCost
            ? parseFloat(formCompanyCost)
            : null;
        }
        body.default_rate = formDefaultRate
          ? parseFloat(formDefaultRate)
          : null;
      }

      if (modal.mode === "edit" && modal.item) {
        uiLogger.info("Updating item", {
          type: activeTab,
          id: modal.item.id,
          name: formName,
        });
        const itemEndpoint =
          activeTab === "categories" || activeTab === "costItems"
            ? `${endpoint}/${modal.item.id}`
            : endpoint;

        if (activeTab !== "categories" && activeTab !== "costItems") {
          body.id = modal.item.id;
        }

        const res = await fetch(itemEndpoint, {
          method:
            activeTab === "categories" || activeTab === "costItems"
              ? "PUT"
              : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update");
        }
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
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create");
        }
        uiLogger.info("Item created successfully", {
          type: activeTab,
          name: formName,
        });
      }

      // The Spaces tab caches these lists for five minutes; this screen is the
      // only thing that edits them, so it drops the cache rather than leaving
      // somebody to wonder why their new space type is not offered yet.
      invalidateQuotationConfig();
      closeModal();
      if (activeTab === "spaces") await fetchSpaces();
      else if (activeTab === "components") await fetchComponents();
      else if (activeTab === "categories") await fetchCategories();
      else if (activeTab === "costItems") await fetchCostItems();
    } catch (err) {
      uiLogger.error("Error saving item", { type: activeTab, error: err });
      setModalError(
        err instanceof Error ? err.message : "Failed to save. Please try again."
      );
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
      else if (deleteModal.type === "categories")
        endpoint = `/api/settings/quotation-cost-item-categories/${deleteModal.item.id}`;
      else if (deleteModal.type === "costItems")
        endpoint = `/api/settings/quotation-cost-items/${deleteModal.item.id}`;
      else if (deleteModal.type === "presets")
        endpoint = `/api/scope-presets/${deleteModal.item.id}`;

      uiLogger.info("Deleting item", {
        type: deleteModal.type,
        id: deleteModal.item.id,
        name: deleteModal.item.name,
      });

      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        ...(deleteModal.type !== "categories" &&
        deleteModal.type !== "costItems" &&
        deleteModal.type !== "presets"
          ? { body: JSON.stringify({ id: deleteModal.item.id }) }
          : {}),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || "Failed to delete");
      }

      setNotice(
        result.deactivated
          ? `"${deleteModal.item.name}" is used by existing quotations, so it has been marked inactive instead of deleted. It will no longer be offered on new ones.`
          : null
      );

      invalidateQuotationConfig();
      uiLogger.info("Item deleted successfully", {
        type: deleteModal.type,
        id: deleteModal.item.id,
      });
      closeDeleteModal();
      if (deleteModal.type === "spaces") await fetchSpaces();
      else if (deleteModal.type === "presets") await fetchPresets();
      else if (deleteModal.type === "components") await fetchComponents();
      else if (deleteModal.type === "categories") await fetchCategories();
      else if (deleteModal.type === "costItems") await fetchCostItems();
    } catch (err) {
      uiLogger.error("Error deleting item", {
        type: deleteModal.type,
        error: err,
      });
      // The server explains why - usually "it is in use" - and "try again"
      // would be wrong advice for that.
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getAddButtonLabel = () => {
    if (activeTab === "spaces") return "Add Space";
    if (activeTab === "components") return "Add Component";
    if (activeTab === "categories") return "Add Category";
    if (activeTab === "presets") return "New Preset";
    return "Add Item";
  };

  const getModalTitle = () => {
    const action = modal.mode === "add" ? "Add" : "Edit";
    if (activeTab === "spaces") return action + " Space";
    if (activeTab === "components") return action + " Component";
    if (activeTab === "categories") return action + " Category";
    return action + " Item";
  };

  const getDeleteItemType = () => {
    if (deleteModal.type === "spaces") return "space";
    if (deleteModal.type === "components") return "component";
    if (deleteModal.type === "categories") return "category";
    if (deleteModal.type === "presets") return "preset";
    return "item";
  };

  const tabs = [
    {
      id: "spaces" as TabType,
      label: "Spaces",
      icon: Squares2X2Icon,
      count: spaces.filter((x) => matchesStatus(x.is_active)).length,
    },
    {
      id: "components" as TabType,
      label: "Components",
      icon: CubeIcon,
      count: components.filter((x) => matchesStatus(x.is_active)).length,
    },
    {
      id: "categories" as TabType,
      label: "Item Categories",
      icon: TagIcon,
      count: categories.filter((x) => matchesStatus(x.is_active)).length,
    },
    {
      id: "costItems" as TabType,
      label: "Items",
      icon: ListBulletIcon,
      count: costItems.filter((x) => matchesStatus(x.is_active)).length,
    },
    {
      id: "presets" as TabType,
      label: "Presets",
      icon: RectangleStackIcon,
      count: presets.filter((x) => matchesStatus(x.is_active)).length,
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
        : activeTab === "categories"
        ? sortedCategories
        : activeTab === "presets"
          ? sortedPresets
          : sortedCostItems;

    if (currentData.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Squares2X2Icon className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">
            No {activeTab === "costItems" ? "items" : activeTab} found
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

    if (activeTab === "presets") {
      const spaceNameById = new Map(spaces.map((sp) => [sp.id, sp.name]));
      const togglePreset = async (p: ScopePreset) => {
        const res = await fetch(`/api/scope-presets/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !p.is_active }),
        });
        if (!res.ok) setError("Could not save the preset");
        invalidateQuotationConfig();
        await fetchPresets();
      };
      const th = (label: string, column: SortColumn) => (
        <th onClick={() => handleSort(column)} className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none">
          <span className="flex items-center">
            {label}
            <SortIndicator column={column} sortState={presetsSort} />
          </span>
        </th>
      );
      return (
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full table-auto">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200">
                {th("Name", "name")}
                {th("Description", "description")}
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Spaces</th>
                {th("Status", "is_active")}
                <th className="px-4 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginate(sortedPresets).map((p) => (
                <tr key={p.id} className="group border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2.5 text-xs font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{p.description || "-"}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">
                    {p.items.length === 0
                      ? "-"
                      : p.items.map((it, i) => (
                          <span key={i}>
                            {i > 0 && <span className="text-slate-300"> · </span>}
                            {spaceNameById.get(it.space_type_id) ?? "Unknown space"}
                            {it.count > 1 && <span className="text-slate-400"> ×{it.count}</span>}
                          </span>
                        ))}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => void togglePreset(p)}
                        title={p.is_active ? "Hide from sellers" : "Show to sellers"}
                        className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-white text-slate-500 border-slate-200 hover:bg-slate-50 transition-all"
                      >
                        {p.is_active ? <EyeSlashIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setPresetEditing(p)}
                        title="Edit"
                        className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all"
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setNotice(null);
                          setDeleteModal({ isOpen: true, item: p, type: "presets" });
                        }}
                        title="Delete"
                        className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 transition-all"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
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
              {paginate(sortedSpaces).map((space) => (
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
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEditModal(space)}
                        title="Edit"
                        className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all"
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(space)}
                        title="Delete"
                        className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 transition-all"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
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
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Applicable Spaces
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
              {paginate(sortedComponents).map((component) => (
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
                    {/* An empty mapping means no restriction, so it is spelled
                        out rather than shown as a dash - "any space" and "not
                        configured" look identical otherwise. */}
                    {(() => {
                      const ids =
                        (component as { applicable_space_types?: string[] | null })
                          .applicable_space_types || [];
                      if (ids.length === 0) {
                        return (
                          <span className="text-[10px] text-slate-400 italic">
                            Any space
                          </span>
                        );
                      }
                      const names = ids
                        .map((id) => spaces.find((sp) => sp.id === id)?.name)
                        .filter(Boolean) as string[];
                      return (
                        <span className="inline-flex flex-wrap gap-1">
                          {names.slice(0, 3).map((n) => (
                            <span
                              key={n}
                              className="inline-flex items-center px-1 py-px rounded text-[9px] font-medium bg-blue-50 text-blue-700 border border-blue-200 leading-4"
                            >
                              {n}
                            </span>
                          ))}
                          {names.length > 3 && (
                            <span
                              className="text-[10px] text-slate-400"
                              title={names.join(", ")}
                            >
                              +{names.length - 3}
                            </span>
                          )}
                        </span>
                      );
                    })()}
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
                    <div className="flex items-center justify-end gap-1.5">
                      {/* How this business measures the component and what
                          each cost line is priced per - the tenant's rule. */}
                      <Link
                        href={`/dashboard/settings/catalogue/components/${component.id}/costing`}
                        title="How it is measured, what it offers on the room sheet, and what each item is priced per"
                        className={`w-6.5 h-6.5 flex items-center justify-center rounded-md border transition-all ${
                          component.config_schema && (component.config_schema as { fields?: unknown[] }).fields?.length
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <CalculatorIcon className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => openEditModal(component)}
                        title="Edit"
                        className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all"
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(component)}
                        title="Delete"
                        className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 transition-all"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
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

    // Categories table
    if (activeTab === "categories") {
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
                    <SortIndicator column="name" sortState={categoriesSort} />
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
                      sortState={categoriesSort}
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
                      sortState={categoriesSort}
                    />
                  </span>
                </th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginate(sortedCategories).map((category) => (
                <tr
                  key={category.id}
                  className="group border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-4 py-2.5 text-xs font-medium text-slate-800">
                    {category.name}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">
                    {category.description || "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        category.is_active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {category.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEditModal(category)}
                        title="Edit"
                        className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all"
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(category)}
                        title="Delete"
                        className="w-6.5 h-6.5 flex items-center justify-center rounded-md border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 transition-all"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
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

    // Cost Items table
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
                  <SortIndicator column="name" sortState={costItemsSort} />
                </span>
              </th>
              <th
                onClick={() => handleSort("category")}
                className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <span className="flex items-center">
                  Category
                  <SortIndicator column="category" sortState={costItemsSort} />
                </span>
              </th>
              <th
                onClick={() => handleSort("unit_code")}
                className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <span className="flex items-center">
                  Unit
                  <SortIndicator column="unit_code" sortState={costItemsSort} />
                </span>
              </th>
              {canViewCosts && (
              <th
                onClick={() => handleSort("company_cost")}
                className="px-4 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <span className="flex items-center justify-end">
                  Company Cost
                  <SortIndicator
                    column="company_cost"
                    sortState={costItemsSort}
                  />
                </span>
              </th>
              )}
              <th
                onClick={() => handleSort("default_rate")}
                className="px-4 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <span className="flex items-center justify-end">
                  Default Rate
                  <SortIndicator
                    column="default_rate"
                    sortState={costItemsSort}
                  />
                </span>
              </th>
              <th
                onClick={() => handleSort("is_active")}
                className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <span className="flex items-center">
                  Status
                  <SortIndicator column="is_active" sortState={costItemsSort} />
                </span>
              </th>
              <th className="px-4 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paginate(sortedCostItems).map((item) => (
              <tr
                key={item.id}
                className="group border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-4 py-2.5 text-xs font-medium text-slate-800">
                  {item.name}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {item.category?.name ||
                    categories.find((c) => c.id === item.category_id)?.name ||
                    "-"}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {item.unit_code}
                </td>
                {canViewCosts && (
                  <td className="px-4 py-2.5 text-xs text-slate-600 text-right">
                    {item.company_cost != null
                      ? `₹${item.company_cost.toLocaleString()}`
                      : "-"}
                  </td>
                )}
                <td className="px-4 py-2.5 text-xs text-slate-600 text-right">
                  {item.default_rate != null
                    ? `₹${item.default_rate.toLocaleString()}`
                    : "-"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      item.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* Green with a count when the item has pictures, grey
                        when it has none - so the ones still to photograph
                        stand out in the list. */}
                    <button
                      onClick={() => setPicturesOf({ id: item.id, name: item.name })}
                      title={item.picture_count ? `${item.picture_count} picture${item.picture_count === 1 ? "" : "s"} - shown on the room sheet while choosing` : "No pictures yet - add some for the room sheet"}
                      className={`relative p-1.5 rounded-lg transition-colors ${item.picture_count ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-300 hover:text-slate-600 hover:bg-slate-200"}`}
                    >
                      <PhotoIcon className="w-4 h-4" />
                      {!!item.picture_count && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-semibold leading-[14px] text-center">
                          {item.picture_count}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(item)}
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
        title="Catalogue"
        subtitle="What this business builds and sells: spaces, components, categories and items. The quotation, the Scope tab and the Design Library all read from here."
        breadcrumbs={[{ label: "Catalogue" }]}
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

              {/* Status applies to every table tab; the pills match the notes
                  and tasks tables so the whole app filters the same way. */}
              <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg shrink-0">
                {(["all", "active", "inactive"] as const).map((key) => {
                  const isActive = statusFilter === key;
                  const label =
                    key === "all"
                      ? "All"
                      : key === "active"
                      ? "Active"
                      : "Inactive";
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStatusFilter(key)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {activeTab === "components" && (
                <SearchSelect
                  value={spaceFilter === "all" ? "" : spaceFilter}
                  onChange={(v) => setSpaceFilter(v || "all")}
                  emptyLabel="All spaces"
                  options={spaces.filter((sp) => sp.is_active).map((sp) => ({ value: sp.id, label: sp.name }))}
                  className="w-44"
                  buttonClassName="px-2.5 py-1.5 text-xs"
                />
              )}

              {activeTab === "costItems" && (
                <SearchSelect
                  value={categoryFilter === "all" ? "" : categoryFilter}
                  onChange={(v) => setCategoryFilter(v || "all")}
                  emptyLabel="All categories"
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  className="w-48"
                  buttonClassName="px-2.5 py-1.5 text-xs"
                />
              )}

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
          </div>

          {notice && (
            <div className="mx-4 mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start justify-between gap-3">
              <span>{notice}</span>
              <button
                onClick={() => setNotice(null)}
                className="shrink-0 text-amber-500 hover:text-amber-700"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          )}

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

          {/* Pagination, in the same shape as the notes, tasks, calendar and
              timeline tables. Shown whenever there are rows, so a short list
              still reports its total and the page size stays reachable. */}
          {activeRows.length > 0 && (
            <div className="border-t border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">
                  Showing{" "}
                  <span className="font-medium">
                    {Math.min(pageStart + 1, activeRows.length)}
                  </span>
                  {"-"}
                  <span className="font-medium">
                    {Math.min(pageStart + pageSize, activeRows.length)}
                  </span>
                  {" of "}
                  <span className="font-medium">{activeRows.length}</span>
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-1.5 py-0.5 text-[10px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <div className="flex items-center gap-0.5 mx-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let n = i + 1;
                    if (totalPages > 5) {
                      if (page <= 3) n = i + 1;
                      else if (page >= totalPages - 2) n = totalPages - 4 + i;
                      else n = page - 2 + i;
                    }
                    return (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`w-6 h-6 text-[10px] font-medium rounded transition-colors ${
                          page === n
                            ? "bg-blue-600 text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingsPageContent>

      {/* Add/Edit Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
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

              {activeTab === "costItems" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Category
                    </label>
                    <SearchSelect
                      value={formCategoryId}
                      onChange={setFormCategoryId}
                      emptyLabel="No Category"
                      options={categories.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Unit *
                    </label>
                    <select
                      value={formUnitCode}
                      onChange={(e) => setFormUnitCode(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    >
                      <option value="sqft">Square Feet (sqft)</option>
                      <option value="rft">Running Feet (rft)</option>
                      <option value="unit">Unit</option>
                      <option value="nos">Numbers (nos)</option>
                      <option value="set">Set</option>
                      <option value="kg">Kilogram (kg)</option>
                      <option value="ltr">Litre (ltr)</option>
                    </select>
                  </div>
                  <div className={canViewCosts ? "grid grid-cols-2 gap-4" : ""}>
                    {canViewCosts && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Company Cost
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formCompanyCost}
                        onChange={(e) => setFormCompanyCost(e.target.value)}
                        placeholder="₹ 0.00"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                    </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Default Rate
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formDefaultRate}
                        onChange={(e) => setFormDefaultRate(e.target.value)}
                        placeholder="₹ 0.00"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                    </div>
                  </div>
                </>
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

              {/* Which spaces this component belongs in. Selecting none means
                  no restriction - a component nobody has classified is still
                  offered everywhere, which is safer than hiding it. */}
              {activeTab === "components" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Belongs in these spaces
                    <span className="ml-1 font-normal text-slate-400">
                      leave empty for any space
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                    {spaces
                      .filter((sp) => sp.is_active)
                      .map((sp) => {
                        const picked = formSpaceTypeIds.includes(sp.id);
                        return (
                          <button
                            key={sp.id}
                            type="button"
                            onClick={() =>
                              setFormSpaceTypeIds((prev) =>
                                picked
                                  ? prev.filter((x) => x !== sp.id)
                                  : [...prev, sp.id]
                              )
                            }
                            className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors ${
                              picked
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {sp.name}
                          </button>
                        );
                      })}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {formSpaceTypeIds.length === 0
                      ? "Offered in every space."
                      : `Offered only in ${formSpaceTypeIds.length} space${
                          formSpaceTypeIds.length === 1 ? "" : "s"
                        }.`}
                  </p>
                </div>
              )}

              {/* How the room sheet asks for this category, and which other
                  categories it is asked alongside. Both belong to the
                  category record, so they are edited here - they were once
                  rendered in the filter bar by mistake. */}
              {activeTab === "categories" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Question on the room sheet
                      <span className="ml-1 font-normal text-slate-400">optional</span>
                    </label>
                    <input
                      type="text"
                      value={formQuestion}
                      onChange={(e) => setFormQuestion(e.target.value)}
                      placeholder={formName ? `Which ${formName.toLowerCase()}?` : "Which …?"}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      How the seller is asked for this while sitting with the customer.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Asked together with
                      <span className="ml-1 font-normal text-slate-400">optional</span>
                    </label>
                    <input
                      type="text"
                      value={formDecision}
                      onChange={(e) => setFormDecision(e.target.value)}
                      placeholder="e.g. door_opening"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Categories sharing this word are asked as one question - handles and
                      profiles are both &quot;How do the doors open?&quot;. Blank gives it its own.
                    </p>
                  </div>
                </>
              )}
            </div>

            {modalError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs text-red-700">{modalError}</p>
              </div>
            )}

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
      {picturesOf && <CostItemPicturesDialog item={picturesOf} onClose={() => setPicturesOf(null)} onChanged={() => void fetchCostItems()} />}
      {presetEditing && (
        <PresetEditor
          preset={presetEditing === "new" ? null : presetEditing}
          spaceTypes={spaces.filter((sp) => sp.is_active).map((sp) => ({ id: sp.id, name: sp.name }))}
          componentTypes={components.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name, applicable_space_types: c.applicable_space_types ?? null }))}
          onClose={() => setPresetEditing(null)}
          onSaved={async () => {
            setPresetEditing(null);
            invalidateQuotationConfig();
            await fetchPresets();
          }}
        />
      )}
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
              {deleteError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-left">
                  <p className="text-xs text-red-700">{deleteError}</p>
                </div>
              )}
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
