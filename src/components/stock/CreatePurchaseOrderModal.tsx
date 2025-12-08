"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import type { Vendor, Material, Project, POCostType } from "@/types/stock";
import { POCostTypeLabels } from "@/types/stock";
import {
  TrashIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

interface POItem {
  material_id: string;
  material_name: string;
  material_sku: string;
  unit: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  discount_percent: number;
  total_amount: number;
  project_id?: string;
  cost_type: POCostType;
  cost_code?: string;
}

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreatePurchaseOrderModal({
  isOpen,
  onClose,
  onSuccess,
}: CreatePurchaseOrderModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [vendorId, setVendorId] = useState("");
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [items, setItems] = useState<POItem[]>([]);

  // Material search
  const [materialSearch, setMaterialSearch] = useState("");
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track added material IDs
  const addedMaterialIds = useMemo(
    () => new Set(items.map((item) => item.material_id)),
    [items]
  );

  // Fetch vendors, materials, and projects
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [vendorsRes, materialsRes, projectsRes] = await Promise.all([
          fetch("/api/stock/vendors?limit=1000&is_active=true"),
          fetch("/api/stock/materials?limit=1000&is_active=true"),
          fetch("/api/projects?limit=1000&is_active=true"),
        ]);

        if (vendorsRes.ok) {
          const data = await vendorsRes.json();
          setVendors(data.vendors || []);
        }

        if (materialsRes.ok) {
          const data = await materialsRes.json();
          setMaterials(data.materials || []);
        }

        if (projectsRes.ok) {
          const data = await projectsRes.json();
          setProjects(data.projects || []);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen]);

  // Calculate dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both the input container and the portal dropdown
      const portalDropdown = document.getElementById(
        "material-dropdown-portal"
      );
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        (!portalDropdown || !portalDropdown.contains(target))
      ) {
        setShowMaterialDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setVendorId("");
      setOrderDate(new Date().toISOString().split("T")[0]);
      setExpectedDelivery("");
      setPaymentTerms("");
      setNotes("");
      setShippingAddress("");
      setItems([]);
      setError(null);
      setMaterialSearch("");
      setShowMaterialDropdown(false);
      setDropdownPosition(null);
    }
  }, [isOpen]);

  // Calculate item total
  const calculateItemTotal = (item: POItem): number => {
    const subtotal = item.quantity * item.unit_price;
    const discount = subtotal * (item.discount_percent / 100);
    const taxable = subtotal - discount;
    const tax = taxable * (item.tax_percent / 100);
    return taxable + tax;
  };

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const totalDiscount = items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unit_price * (item.discount_percent / 100),
    0
  );
  const taxableAmount = subtotal - totalDiscount;
  const totalTax = items.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unit_price;
    const itemDiscount = itemSubtotal * (item.discount_percent / 100);
    const itemTaxable = itemSubtotal - itemDiscount;
    return sum + itemTaxable * (item.tax_percent / 100);
  }, 0);
  const totalAmount = taxableAmount + totalTax;

  // Filter materials - EXCLUDE already added materials
  const availableMaterials = useMemo(() => {
    return materials.filter((material) => !addedMaterialIds.has(material.id));
  }, [materials, addedMaterialIds]);

  // Filter by search
  const filteredMaterials = useMemo(() => {
    if (!materialSearch.trim()) {
      return availableMaterials.slice(0, 10);
    }
    return availableMaterials
      .filter(
        (material) =>
          material.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
          material.sku.toLowerCase().includes(materialSearch.toLowerCase())
      )
      .slice(0, 10);
  }, [availableMaterials, materialSearch]);

  // Add material to items
  const addMaterial = (material: Material) => {
    const newItem: POItem = {
      material_id: material.id,
      material_name: material.name,
      material_sku: material.sku,
      unit: material.unit_of_measure || "pcs",
      quantity: 1,
      unit_price: material.unit_cost || 0,
      tax_percent: 18,
      discount_percent: 0,
      total_amount: 0,
      cost_type: "project", // Default to project so user can select project immediately
    };

    newItem.total_amount = calculateItemTotal(newItem);
    setItems([...items, newItem]);
    setMaterialSearch("");
    setShowMaterialDropdown(false);
    // Focus back on search input for quick adding
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Update item
  const updateItem = (
    index: number,
    field: keyof POItem,
    value: string | number
  ) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

    // Auto-set cost_code to "NP" when cost_type is not project
    if (field === "cost_type" && value !== "project") {
      updatedItems[index].project_id = undefined;
      updatedItems[index].cost_code = "NP";
    } else if (field === "cost_type" && value === "project") {
      updatedItems[index].cost_code = undefined;
    }

    updatedItems[index].total_amount = calculateItemTotal(updatedItems[index]);
    setItems(updatedItems);
  };

  // Remove item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!vendorId) {
      setError("Please select a vendor");
      return;
    }

    if (items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/stock/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: vendorId,
          order_date: orderDate,
          expected_delivery: expectedDelivery || null,
          payment_terms: paymentTerms,
          notes: notes,
          shipping_address: shippingAddress,
          items: items.map((item) => ({
            material_id: item.material_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_percent: item.tax_percent,
            discount_percent: item.discount_percent,
            project_id: item.project_id || null,
            cost_type: item.cost_type,
            cost_code: item.cost_code || null,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create purchase order");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create purchase order"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Purchase Order"
      size="wide"
    >
      <form onSubmit={handleSubmit}>
        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <ModalBody maxHeight="calc(80vh - 180px)">
          <div className="space-y-5">
            {/* Basic Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Vendor <span className="text-red-500">*</span>
                </label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Order Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expected Delivery
                </label>
                <input
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Terms</option>
                  <option value="Advance">100% Advance</option>
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                  <option value="50% Advance">50% Advance, 50% Delivery</option>
                  <option value="COD">Cash on Delivery</option>
                </select>
              </div>
            </div>

            {/* Line Items Section */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Line Items
                </h3>
                <span className="text-xs text-slate-500">
                  {items.length} item{items.length !== 1 ? "s" : ""} added
                </span>
              </div>

              {/* Add Material Search */}
              <div className="p-4 border-b border-slate-200 bg-white">
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={materialSearch}
                      onChange={(e) => {
                        setMaterialSearch(e.target.value);
                        setShowMaterialDropdown(true);
                        updateDropdownPosition();
                      }}
                      onFocus={() => {
                        setShowMaterialDropdown(true);
                        updateDropdownPosition();
                      }}
                      placeholder="Search materials to add (by name or SKU)..."
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Dropdown Portal - Renders outside modal to avoid overflow clipping */}
              {showMaterialDropdown &&
                dropdownPosition &&
                typeof document !== "undefined" &&
                createPortal(
                  <div
                    id="material-dropdown-portal"
                    className="bg-white border border-slate-200 rounded-lg shadow-2xl max-h-72 overflow-y-auto"
                    style={{
                      position: "fixed",
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                      width: dropdownPosition.width,
                      zIndex: 99999,
                    }}
                  >
                    {filteredMaterials.length > 0 ? (
                      <div>
                        {filteredMaterials.map((material) => (
                          <button
                            key={material.id}
                            type="button"
                            onClick={() => addMaterial(material)}
                            className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-slate-100 last:border-b-0 flex items-center justify-between group transition-colors"
                          >
                            <div>
                              <div className="text-sm font-medium text-slate-900 group-hover:text-blue-700">
                                {material.name}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                SKU: {material.sku} •{" "}
                                {material.unit_of_measure || "pcs"} •{" "}
                                {formatCurrency(material.unit_cost || 0)}
                              </div>
                            </div>
                            <PlusIcon className="h-5 w-5 text-slate-400 group-hover:text-blue-600" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        {availableMaterials.length === 0
                          ? "All materials have been added"
                          : "No materials found"}
                      </div>
                    )}
                  </div>,
                  document.body
                )}

              {/* Items Table */}
              {items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">
                          Material
                        </th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase w-32">
                          Project
                        </th>
                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase w-24">
                          Cost Type
                        </th>
                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase w-20">
                          Qty
                        </th>
                        <th className="px-2 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase w-24">
                          Price
                        </th>
                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase w-16">
                          Tax%
                        </th>
                        <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-600 uppercase w-16">
                          Disc%
                        </th>
                        <th className="px-2 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase w-24">
                          Total
                        </th>
                        <th className="px-2 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, index) => (
                        <tr
                          key={item.material_id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-4 py-2">
                            <div className="text-sm font-medium text-slate-900">
                              {item.material_name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {item.material_sku} • {item.unit}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={item.project_id || ""}
                              onChange={(e) =>
                                updateItem(index, "project_id", e.target.value)
                              }
                              disabled={item.cost_type !== "project"}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <option value="">None</option>
                              {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.project_number}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={item.cost_type}
                              onChange={(e) =>
                                updateItem(index, "cost_type", e.target.value)
                              }
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                            >
                              {Object.entries(POCostTypeLabels).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                )
                              )}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(
                                  index,
                                  "quantity",
                                  parseFloat(e.target.value) || 1
                                )
                              }
                              min="1"
                              step="1"
                              className="w-full px-2 py-1 text-sm text-center border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) =>
                                updateItem(
                                  index,
                                  "unit_price",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              min="0"
                              step="0.01"
                              className="w-full px-2 py-1 text-sm text-right border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.tax_percent}
                              onChange={(e) =>
                                updateItem(
                                  index,
                                  "tax_percent",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              min="0"
                              max="28"
                              step="1"
                              className="w-full px-2 py-1 text-sm text-center border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.discount_percent}
                              onChange={(e) =>
                                updateItem(
                                  index,
                                  "discount_percent",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              min="0"
                              max="100"
                              step="1"
                              className="w-full px-2 py-1 text-sm text-center border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <span className="text-sm font-semibold text-slate-900">
                              {formatCurrency(item.total_amount)}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove item"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-4 py-10 text-center">
                  <div className="text-slate-400 mb-2">
                    <svg
                      className="w-10 h-10 mx-auto"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500">
                    No items added yet. Search and add materials above.
                  </p>
                </div>
              )}

              {/* Totals */}
              {items.length > 0 && (
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                  <div className="flex justify-end">
                    <div className="w-72 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Subtotal:</span>
                        <span className="font-medium text-slate-900">
                          {formatCurrency(subtotal)}
                        </span>
                      </div>
                      {totalDiscount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Discount:</span>
                          <span className="font-medium text-green-600">
                            -{formatCurrency(totalDiscount)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Tax (GST):</span>
                        <span className="font-medium text-slate-900">
                          {formatCurrency(totalTax)}
                        </span>
                      </div>
                      <div className="flex justify-between text-base font-semibold border-t border-slate-300 pt-2 mt-2">
                        <span className="text-slate-900">Grand Total:</span>
                        <span className="text-blue-600">
                          {formatCurrency(totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Shipping Address & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Shipping Address
                </label>
                <textarea
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter delivery address..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add any additional notes or instructions..."
                />
              </div>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || items.length === 0 || !vendorId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Creating..." : "Create Purchase Order"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
