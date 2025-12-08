"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import {
  FormInput,
  FormSelect,
  FormTextarea,
  FormGroup,
  FormDivider,
} from "@/components/ui/FormControls";
import { MaterialSpecifications } from "@/types/stock";

// ============================================
// Types
// ============================================
interface Brand {
  id: string;
  name: string;
  code: string;
  quality_tier: string;
}

interface Vendor {
  id: string;
  name: string;
  code: string;
}

interface Material {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category: string | null;
  item_type: string;
  unit_of_measure: string;
  current_quantity: number;
  minimum_quantity: number;
  reorder_quantity: number;
  unit_cost: number;
  selling_price: number | null;
  storage_location: string | null;
  brand_id?: string | null;
  specifications?: MaterialSpecifications | null;
  preferred_vendor?: { name: string } | null;
  brand?: Brand | null;
}

interface VendorMaterial {
  id: string;
  vendor_id: string;
  material_id: string;
  vendor_sku?: string;
  vendor_item_name?: string;
  unit_price: number;
  currency: string;
  min_order_qty: number;
  lead_time_days: number;
  is_preferred: boolean;
  is_active: boolean;
  notes?: string;
  vendor?: Vendor;
}

interface MaterialFormData {
  name: string;
  sku: string;
  description: string;
  category: string;
  item_type: string;
  unit_of_measure: string;
  current_quantity: number;
  minimum_quantity: number;
  reorder_quantity: number;
  unit_cost: number;
  selling_price: string;
  storage_location: string;
  brand_id: string;
  // Specifications fields
  spec_length: string;
  spec_width: string;
  spec_thickness: string;
  spec_dimension_unit: string;
  spec_weight: string;
  spec_weight_unit: string;
  spec_color: string;
  spec_finish: string;
  spec_grade: string;
  spec_material: string;
}

interface VendorPricingFormData {
  vendor_id: string;
  vendor_sku: string;
  vendor_item_name: string;
  unit_price: string;
  currency: string;
  min_order_qty: string;
  lead_time_days: string;
  is_preferred: boolean;
  notes: string;
}

const initialFormData: MaterialFormData = {
  name: "",
  sku: "",
  description: "",
  category: "",
  item_type: "raw_material",
  unit_of_measure: "pcs",
  current_quantity: 0,
  minimum_quantity: 0,
  reorder_quantity: 0,
  unit_cost: 0,
  selling_price: "",
  storage_location: "",
  brand_id: "",
  spec_length: "",
  spec_width: "",
  spec_thickness: "",
  spec_dimension_unit: "mm",
  spec_weight: "",
  spec_weight_unit: "kg",
  spec_color: "",
  spec_finish: "",
  spec_grade: "",
  spec_material: "",
};

const initialVendorPricingFormData: VendorPricingFormData = {
  vendor_id: "",
  vendor_sku: "",
  vendor_item_name: "",
  unit_price: "",
  currency: "INR",
  min_order_qty: "1",
  lead_time_days: "7",
  is_preferred: false,
  notes: "",
};

const itemTypeOptions = [
  { value: "raw_material", label: "Raw Material" },
  { value: "finished_good", label: "Finished Good" },
  { value: "consumable", label: "Consumable" },
  { value: "service", label: "Service" },
  { value: "asset", label: "Asset" },
];

const unitOfMeasureOptions = [
  { value: "pcs", label: "Pieces" },
  { value: "sq_ft", label: "Square Feet" },
  { value: "sq_m", label: "Square Meters" },
  { value: "yards", label: "Yards" },
  { value: "meters", label: "Meters" },
  { value: "kg", label: "Kilograms" },
  { value: "lbs", label: "Pounds" },
  { value: "rolls", label: "Rolls" },
  { value: "sets", label: "Sets" },
];

const dimensionUnitOptions = [
  { value: "mm", label: "Millimeters (mm)" },
  { value: "cm", label: "Centimeters (cm)" },
  { value: "m", label: "Meters (m)" },
  { value: "in", label: "Inches (in)" },
  { value: "ft", label: "Feet (ft)" },
];

const weightUnitOptions = [
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "lbs", label: "Pounds (lbs)" },
  { value: "oz", label: "Ounces (oz)" },
];

// Helper to build specifications object from form data
function buildSpecifications(
  formData: MaterialFormData
): MaterialSpecifications | null {
  const specs: MaterialSpecifications = {};

  // Dimensions
  if (formData.spec_length || formData.spec_width || formData.spec_thickness) {
    specs.dimensions = {
      length: formData.spec_length
        ? parseFloat(formData.spec_length)
        : undefined,
      width: formData.spec_width ? parseFloat(formData.spec_width) : undefined,
      thickness: formData.spec_thickness
        ? parseFloat(formData.spec_thickness)
        : undefined,
      unit: formData.spec_dimension_unit,
    };
  }

  // Weight
  if (formData.spec_weight) {
    specs.weight = {
      value: parseFloat(formData.spec_weight),
      unit: formData.spec_weight_unit,
    };
  }

  // Other specs
  if (formData.spec_color) specs.color = formData.spec_color;
  if (formData.spec_finish) specs.finish = formData.spec_finish;
  if (formData.spec_grade) specs.grade = formData.spec_grade;
  if (formData.spec_material) specs.material = formData.spec_material;

  return Object.keys(specs).length > 0 ? specs : null;
}

// Helper to parse specifications from database format to form fields
function parseSpecifications(
  specs: MaterialSpecifications | null | undefined
): Partial<MaterialFormData> {
  if (!specs) return {};

  return {
    spec_length: specs.dimensions?.length?.toString() || "",
    spec_width: specs.dimensions?.width?.toString() || "",
    spec_thickness: specs.dimensions?.thickness?.toString() || "",
    spec_dimension_unit: specs.dimensions?.unit || "mm",
    spec_weight: specs.weight?.value?.toString() || "",
    spec_weight_unit: specs.weight?.unit || "kg",
    spec_color: specs.color || "",
    spec_finish: specs.finish || "",
    spec_grade: specs.grade || "",
    spec_material: specs.material || "",
  };
}

// ============================================
// Tab Types
// ============================================
type TabType = "basic" | "specifications" | "stock" | "vendors";

const tabs = [
  { id: "basic" as TabType, label: "Basic Info" },
  { id: "specifications" as TabType, label: "Specifications" },
  { id: "stock" as TabType, label: "Stock & Pricing" },
  { id: "vendors" as TabType, label: "Vendor Pricing" },
];

// ============================================
// Create Material Modal (Tabbed - Same as Edit)
// ============================================
interface CreateMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateMaterialModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateMaterialModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<MaterialFormData>(initialFormData);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);

  // Vendor pricing state for creation
  const [availableVendors, setAvailableVendors] = useState<Vendor[]>([]);
  const [loadingAvailableVendors, setLoadingAvailableVendors] = useState(false);
  const [pendingVendorPricings, setPendingVendorPricings] = useState<
    VendorPricingFormData[]
  >([]);
  const [showAddVendorForm, setShowAddVendorForm] = useState(false);
  const [vendorFormData, setVendorFormData] = useState<VendorPricingFormData>(
    initialVendorPricingFormData
  );
  const [vendorError, setVendorError] = useState<string | null>(null);

  // Fetch brands when modal opens
  const fetchBrands = useCallback(async () => {
    setLoadingBrands(true);
    try {
      const response = await fetch("/api/stock/brands?limit=100");
      if (response.ok) {
        const data = await response.json();
        setBrands(data.brands || []);
      }
    } catch (err) {
      console.error("Failed to fetch brands:", err);
    } finally {
      setLoadingBrands(false);
    }
  }, []);

  // Fetch available vendors
  const fetchAvailableVendors = useCallback(async () => {
    setLoadingAvailableVendors(true);
    try {
      const response = await fetch(
        "/api/stock/vendors?limit=100&is_active=true"
      );
      if (response.ok) {
        const data = await response.json();
        setAvailableVendors(data.vendors || []);
      }
    } catch (err) {
      console.error("Failed to fetch vendors:", err);
    } finally {
      setLoadingAvailableVendors(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchBrands();
      fetchAvailableVendors();
      setFormData(initialFormData);
      setPendingVendorPricings([]);
      setShowAddVendorForm(false);
      setVendorFormData(initialVendorPricingFormData);
      setVendorError(null);
      setError(null);
      setActiveTab("basic");
    }
  }, [isOpen, fetchBrands, fetchAvailableVendors]);

  const handleClose = () => {
    setFormData(initialFormData);
    setPendingVendorPricings([]);
    setShowAddVendorForm(false);
    setVendorFormData(initialVendorPricingFormData);
    setVendorError(null);
    setError(null);
    setActiveTab("basic");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const specifications = buildSpecifications(formData);

      // Create the material first
      const response = await fetch("/api/stock/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          sku: formData.sku,
          description: formData.description || null,
          category: formData.category || null,
          item_type: formData.item_type,
          unit_of_measure: formData.unit_of_measure,
          current_quantity: formData.current_quantity,
          minimum_quantity: formData.minimum_quantity,
          reorder_quantity: formData.reorder_quantity,
          unit_cost: formData.unit_cost,
          selling_price: formData.selling_price
            ? parseFloat(formData.selling_price)
            : null,
          storage_location: formData.storage_location || null,
          brand_id: formData.brand_id || null,
          specifications,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create material");
      }

      const createdMaterial = await response.json();

      // If there are pending vendor pricings, create them
      if (pendingVendorPricings.length > 0 && createdMaterial.material?.id) {
        const materialId = createdMaterial.material.id;

        // Create vendor pricing records (don't fail the whole operation if some fail)
        for (const vendorPricing of pendingVendorPricings) {
          try {
            await fetch("/api/stock/material-vendors", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                material_id: materialId,
                vendor_id: vendorPricing.vendor_id,
                vendor_sku: vendorPricing.vendor_sku || null,
                vendor_item_name: vendorPricing.vendor_item_name || null,
                unit_price: parseFloat(vendorPricing.unit_price),
                currency: vendorPricing.currency,
                min_order_qty: parseInt(vendorPricing.min_order_qty) || 1,
                lead_time_days: parseInt(vendorPricing.lead_time_days) || 0,
                is_preferred: vendorPricing.is_preferred,
                notes: vendorPricing.notes || null,
              }),
            });
          } catch (vendorErr) {
            console.error("Failed to create vendor pricing:", vendorErr);
          }
        }
      }

      onSuccess();
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create material"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? (value ? parseFloat(value) : 0) : value,
    }));
  };

  // Vendor form handlers
  const handleVendorFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setVendorFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddPendingVendor = () => {
    setVendorError(null);

    if (!vendorFormData.vendor_id) {
      setVendorError("Please select a vendor");
      return;
    }
    if (
      !vendorFormData.unit_price ||
      parseFloat(vendorFormData.unit_price) <= 0
    ) {
      setVendorError("Please enter a valid unit price");
      return;
    }

    // Check if this vendor is already added
    if (
      pendingVendorPricings.some(
        (p) => p.vendor_id === vendorFormData.vendor_id
      )
    ) {
      setVendorError("This vendor has already been added");
      return;
    }

    setPendingVendorPricings((prev) => [...prev, { ...vendorFormData }]);
    setVendorFormData(initialVendorPricingFormData);
    setShowAddVendorForm(false);
  };

  const handleRemovePendingVendor = (vendorId: string) => {
    setPendingVendorPricings((prev) =>
      prev.filter((p) => p.vendor_id !== vendorId)
    );
  };

  const getVendorName = (vendorId: string) => {
    const vendor = availableVendors.find((v) => v.id === vendorId);
    return vendor?.name || "Unknown Vendor";
  };

  const brandOptions = [
    { value: "", label: "Select Brand (Optional)" },
    ...brands.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Material"
      size="wide"
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-200 mb-4">
          <div className="flex gap-6 px-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
                {tab.id === "vendors" && pendingVendorPricings.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                    {pendingVendorPricings.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <ModalBody maxHeight="480px">
          {/* Basic Info Tab */}
          {activeTab === "basic" && (
            <div className="space-y-4 pb-4">
              <FormGroup cols={2}>
                <FormInput
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Material name"
                />
                <FormInput
                  label="SKU"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  required
                  placeholder="Stock keeping unit"
                />
              </FormGroup>

              <FormTextarea
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                placeholder="Material description..."
              />

              <FormGroup cols={2}>
                <FormInput
                  label="Category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="Category"
                />
                <FormSelect
                  label="Brand"
                  name="brand_id"
                  value={formData.brand_id}
                  onChange={handleChange}
                  options={brandOptions}
                  disabled={loadingBrands}
                />
              </FormGroup>

              <FormGroup cols={2}>
                <FormSelect
                  label="Item Type"
                  name="item_type"
                  value={formData.item_type}
                  onChange={handleChange}
                  options={itemTypeOptions}
                />
                <FormSelect
                  label="Unit of Measure"
                  name="unit_of_measure"
                  value={formData.unit_of_measure}
                  onChange={handleChange}
                  options={unitOfMeasureOptions}
                />
              </FormGroup>
            </div>
          )}

          {/* Specifications Tab */}
          {activeTab === "specifications" && (
            <div className="space-y-4 pb-4">
              <div className="text-sm text-slate-600 mb-3">
                Enter physical specifications for this material.
              </div>

              <FormDivider label="Dimensions" />
              <FormGroup cols={4}>
                <FormInput
                  label="Length"
                  name="spec_length"
                  type="number"
                  value={formData.spec_length}
                  onChange={handleChange}
                  min={0}
                  step={0.1}
                  placeholder="L"
                />
                <FormInput
                  label="Width"
                  name="spec_width"
                  type="number"
                  value={formData.spec_width}
                  onChange={handleChange}
                  min={0}
                  step={0.1}
                  placeholder="W"
                />
                <FormInput
                  label="Thickness"
                  name="spec_thickness"
                  type="number"
                  value={formData.spec_thickness}
                  onChange={handleChange}
                  min={0}
                  step={0.1}
                  placeholder="T"
                />
                <FormSelect
                  label="Unit"
                  name="spec_dimension_unit"
                  value={formData.spec_dimension_unit}
                  onChange={handleChange}
                  options={dimensionUnitOptions}
                />
              </FormGroup>

              <FormDivider label="Weight & Appearance" />
              <FormGroup cols={4}>
                <FormInput
                  label="Weight"
                  name="spec_weight"
                  type="number"
                  value={formData.spec_weight}
                  onChange={handleChange}
                  min={0}
                  step={0.1}
                />
                <FormSelect
                  label="Unit"
                  name="spec_weight_unit"
                  value={formData.spec_weight_unit}
                  onChange={handleChange}
                  options={weightUnitOptions}
                />
                <FormInput
                  label="Color"
                  name="spec_color"
                  value={formData.spec_color}
                  onChange={handleChange}
                  placeholder="e.g., Natural Oak"
                />
                <FormInput
                  label="Finish"
                  name="spec_finish"
                  value={formData.spec_finish}
                  onChange={handleChange}
                  placeholder="e.g., Matte"
                />
              </FormGroup>

              <FormDivider label="Quality" />
              <FormGroup cols={2}>
                <FormInput
                  label="Grade"
                  name="spec_grade"
                  value={formData.spec_grade}
                  onChange={handleChange}
                  placeholder="e.g., E1, A-Grade"
                />
                <FormInput
                  label="Material Composition"
                  name="spec_material"
                  value={formData.spec_material}
                  onChange={handleChange}
                  placeholder="e.g., Engineered Wood"
                />
              </FormGroup>
            </div>
          )}

          {/* Stock & Pricing Tab */}
          {activeTab === "stock" && (
            <div className="space-y-4 pb-4">
              <FormDivider label="Quantity Settings" />
              <FormGroup cols={3}>
                <FormInput
                  label="Current Quantity"
                  name="current_quantity"
                  type="number"
                  value={formData.current_quantity}
                  onChange={handleChange}
                  min={0}
                />
                <FormInput
                  label="Minimum Quantity"
                  name="minimum_quantity"
                  type="number"
                  value={formData.minimum_quantity}
                  onChange={handleChange}
                  min={0}
                />
                <FormInput
                  label="Reorder Quantity"
                  name="reorder_quantity"
                  type="number"
                  value={formData.reorder_quantity}
                  onChange={handleChange}
                  min={0}
                />
              </FormGroup>

              <FormDivider label="Pricing & Location" />
              <FormGroup cols={3}>
                <FormInput
                  label="Unit Cost"
                  name="unit_cost"
                  type="number"
                  value={formData.unit_cost}
                  onChange={handleChange}
                  min={0}
                  step={0.01}
                />
                <FormInput
                  label="Selling Price"
                  name="selling_price"
                  type="number"
                  value={formData.selling_price}
                  onChange={handleChange}
                  min={0}
                  step={0.01}
                />
                <FormInput
                  label="Storage Location"
                  name="storage_location"
                  value={formData.storage_location}
                  onChange={handleChange}
                  placeholder="Warehouse, rack, shelf..."
                />
              </FormGroup>
            </div>
          )}

          {/* Vendor Pricing Tab */}
          {activeTab === "vendors" && (
            <div className="space-y-4 pb-4">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-slate-600">
                  Add vendor pricing information for this material. These will
                  be created after the material is saved.
                </div>
                {!showAddVendorForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddVendorForm(true)}
                    className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 flex items-center gap-1.5"
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add Vendor
                  </button>
                )}
              </div>

              {/* Add Vendor Form */}
              {showAddVendorForm && (
                <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium text-slate-900">
                      Add Vendor Pricing
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddVendorForm(false);
                        setVendorFormData(initialVendorPricingFormData);
                        setVendorError(null);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {vendorError && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      {vendorError}
                    </div>
                  )}

                  <div className="space-y-3">
                    {/* Row 1: Vendor, Unit Price, MOQ, Lead Time */}
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Vendor *
                        </label>
                        {loadingAvailableVendors ? (
                          <div className="text-xs text-slate-500">
                            Loading...
                          </div>
                        ) : (
                          <select
                            name="vendor_id"
                            value={vendorFormData.vendor_id}
                            onChange={handleVendorFormChange}
                            className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select vendor</option>
                            {availableVendors
                              .filter(
                                (v) =>
                                  !pendingVendorPricings.some(
                                    (p) => p.vendor_id === v.id
                                  )
                              )
                              .map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Unit Price *
                        </label>
                        <div className="flex">
                          <select
                            name="currency"
                            value={vendorFormData.currency}
                            onChange={handleVendorFormChange}
                            className="w-14 px-1 py-2 text-sm border border-r-0 border-slate-200 rounded-l bg-slate-50 shrink-0"
                          >
                            <option value="INR">₹</option>
                            <option value="USD">$</option>
                            <option value="EUR">€</option>
                          </select>
                          <input
                            type="number"
                            name="unit_price"
                            value={vendorFormData.unit_price}
                            onChange={handleVendorFormChange}
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="w-full min-w-0 px-2 py-2 text-sm border border-slate-200 rounded-r focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          MOQ
                        </label>
                        <input
                          type="number"
                          name="min_order_qty"
                          value={vendorFormData.min_order_qty}
                          onChange={handleVendorFormChange}
                          min="1"
                          className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Lead Time (days)
                        </label>
                        <input
                          type="number"
                          name="lead_time_days"
                          value={vendorFormData.lead_time_days}
                          onChange={handleVendorFormChange}
                          min="0"
                          className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Row 2: Vendor SKU, Vendor Item Name */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Vendor SKU
                        </label>
                        <input
                          type="text"
                          name="vendor_sku"
                          value={vendorFormData.vendor_sku}
                          onChange={handleVendorFormChange}
                          placeholder="Optional"
                          className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Vendor Item Name
                        </label>
                        <input
                          type="text"
                          name="vendor_item_name"
                          value={vendorFormData.vendor_item_name}
                          onChange={handleVendorFormChange}
                          placeholder="Optional"
                          className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Row 3: Preferred & Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          name="is_preferred"
                          checked={vendorFormData.is_preferred}
                          onChange={handleVendorFormChange}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        Mark as preferred vendor
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddVendorForm(false);
                            setVendorFormData(initialVendorPricingFormData);
                            setVendorError(null);
                          }}
                          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddPendingVendor}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Vendor Pricings List */}
              {pendingVendorPricings.length === 0 && !showAddVendorForm ? (
                <div className="text-center py-8 text-slate-500">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 text-slate-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <p className="mb-2">No vendor pricing added yet.</p>
                  <p className="text-sm">
                    Click &quot;Add Vendor&quot; to configure vendor-specific
                    pricing.
                  </p>
                </div>
              ) : (
                pendingVendorPricings.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                      <div className="col-span-3">Vendor</div>
                      <div className="col-span-2">Unit Price</div>
                      <div className="col-span-1">MOQ</div>
                      <div className="col-span-2">Lead Time</div>
                      <div className="col-span-2">Vendor SKU</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {/* Table Rows */}
                    {pendingVendorPricings.map((pricing) => (
                      <div
                        key={pricing.vendor_id}
                        className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center text-sm border-b border-slate-100 last:border-b-0 ${
                          pricing.is_preferred ? "bg-blue-50/50" : "bg-white"
                        }`}
                      >
                        <div className="col-span-3 flex items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {getVendorName(pricing.vendor_id)}
                          </span>
                          {pricing.is_preferred && (
                            <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                              Preferred
                            </span>
                          )}
                        </div>
                        <div className="col-span-2 text-slate-700">
                          {pricing.currency === "INR"
                            ? "₹"
                            : pricing.currency === "USD"
                            ? "$"
                            : "€"}
                          {parseFloat(pricing.unit_price).toLocaleString()}
                        </div>
                        <div className="col-span-1 text-slate-600">
                          {pricing.min_order_qty}
                        </div>
                        <div className="col-span-2 text-slate-600">
                          {pricing.lead_time_days} days
                        </div>
                        <div className="col-span-2 text-slate-500 truncate">
                          {pricing.vendor_sku || "-"}
                        </div>
                        <div className="col-span-2 flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleRemovePendingVendor(pricing.vendor_id)
                            }
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Remove"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Material"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// ============================================
// Edit Material Modal (Tabbed)
// ============================================
interface EditMaterialModalProps {
  isOpen: boolean;
  material: Material | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditMaterialModal({
  isOpen,
  material,
  onClose,
  onSuccess,
}: EditMaterialModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<MaterialFormData>(initialFormData);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);

  // Vendor pricing state
  const [vendorMaterials, setVendorMaterials] = useState<VendorMaterial[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [availableVendors, setAvailableVendors] = useState<Vendor[]>([]);
  const [loadingAvailableVendors, setLoadingAvailableVendors] = useState(false);
  const [showAddVendorForm, setShowAddVendorForm] = useState(false);
  const [vendorFormData, setVendorFormData] = useState<VendorPricingFormData>(
    initialVendorPricingFormData
  );
  const [addingVendor, setAddingVendor] = useState(false);
  const [vendorError, setVendorError] = useState<string | null>(null);

  // Edit vendor state
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [savingVendor, setSavingVendor] = useState(false);

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    vendorMaterialId: string | null;
    vendorName: string;
  }>({ isOpen: false, vendorMaterialId: null, vendorName: "" });

  // Fetch brands when modal opens
  const fetchBrands = useCallback(async () => {
    setLoadingBrands(true);
    try {
      const response = await fetch("/api/stock/brands?limit=100");
      if (response.ok) {
        const data = await response.json();
        setBrands(data.brands || []);
      }
    } catch (err) {
      console.error("Failed to fetch brands:", err);
    } finally {
      setLoadingBrands(false);
    }
  }, []);

  // Fetch vendor pricing for this material
  const fetchVendorMaterials = useCallback(async (materialId: string) => {
    setLoadingVendors(true);
    try {
      const response = await fetch(
        `/api/stock/material-vendors?material_id=${materialId}`
      );
      if (response.ok) {
        const data = await response.json();
        setVendorMaterials(data.vendorMaterials || []);
      }
    } catch (err) {
      console.error("Failed to fetch vendor materials:", err);
    } finally {
      setLoadingVendors(false);
    }
  }, []);

  // Fetch available vendors for the add form
  const fetchAvailableVendors = useCallback(async () => {
    setLoadingAvailableVendors(true);
    try {
      const response = await fetch(
        "/api/stock/vendors?limit=100&is_active=true"
      );
      if (response.ok) {
        const data = await response.json();
        setAvailableVendors(data.vendors || []);
      }
    } catch (err) {
      console.error("Failed to fetch vendors:", err);
    } finally {
      setLoadingAvailableVendors(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && material) {
      fetchBrands();
      fetchVendorMaterials(material.id);
      fetchAvailableVendors();

      const specFields = parseSpecifications(material.specifications);

      setFormData({
        name: material.name,
        sku: material.sku,
        description: material.description || "",
        category: material.category || "",
        item_type: material.item_type,
        unit_of_measure: material.unit_of_measure,
        current_quantity: material.current_quantity,
        minimum_quantity: material.minimum_quantity,
        reorder_quantity: material.reorder_quantity,
        unit_cost: material.unit_cost,
        selling_price: material.selling_price?.toString() || "",
        storage_location: material.storage_location || "",
        brand_id: material.brand_id || "",
        spec_length: specFields.spec_length || "",
        spec_width: specFields.spec_width || "",
        spec_thickness: specFields.spec_thickness || "",
        spec_dimension_unit: specFields.spec_dimension_unit || "mm",
        spec_weight: specFields.spec_weight || "",
        spec_weight_unit: specFields.spec_weight_unit || "kg",
        spec_color: specFields.spec_color || "",
        spec_finish: specFields.spec_finish || "",
        spec_grade: specFields.spec_grade || "",
        spec_material: specFields.spec_material || "",
      });
      setError(null);
      setActiveTab("basic");
      setShowAddVendorForm(false);
      setVendorFormData(initialVendorPricingFormData);
      setVendorError(null);
    }
  }, [
    isOpen,
    material,
    fetchBrands,
    fetchVendorMaterials,
    fetchAvailableVendors,
  ]);

  if (!material) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const specifications = buildSpecifications(formData);

      // Build the update payload - only include fields that exist in the database
      const updatePayload: Record<string, unknown> = {
        name: formData.name,
        sku: formData.sku,
        description: formData.description || null,
        category: formData.category || null,
        item_type: formData.item_type,
        unit_of_measure: formData.unit_of_measure,
        current_quantity: formData.current_quantity,
        minimum_quantity: formData.minimum_quantity,
        reorder_quantity: formData.reorder_quantity,
        unit_cost: formData.unit_cost,
        selling_price: formData.selling_price
          ? parseFloat(formData.selling_price)
          : null,
        storage_location: formData.storage_location || null,
      };

      // Only include brand_id and specifications if they have values
      // These columns may not exist if migrations weren't run
      if (formData.brand_id) {
        updatePayload.brand_id = formData.brand_id;
      }
      if (specifications && Object.keys(specifications).length > 0) {
        updatePayload.specifications = specifications;
      }

      console.log("[EditMaterialModal] Submitting update:", updatePayload);

      const response = await fetch(`/api/stock/materials/${material.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("[EditMaterialModal] Update failed:", data);
        const errorDetails = data.details ? `: ${data.details}` : "";
        throw new Error(
          `${data.error || "Failed to update material"}${errorDetails}`
        );
      }

      console.log("[EditMaterialModal] Update successful:", data);
      onSuccess();
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update material";
      console.error("[EditMaterialModal] Error:", errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? (value ? parseFloat(value) : 0) : value,
    }));
  };

  // Vendor form handlers
  const handleVendorFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setVendorFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddVendor = async () => {
    setVendorError(null);

    if (!vendorFormData.vendor_id) {
      setVendorError("Please select a vendor");
      return;
    }

    if (
      !vendorFormData.unit_price ||
      parseFloat(vendorFormData.unit_price) <= 0
    ) {
      setVendorError("Please enter a valid unit price");
      return;
    }

    setAddingVendor(true);

    try {
      const response = await fetch("/api/stock/material-vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_id: material.id,
          vendor_id: vendorFormData.vendor_id,
          vendor_sku: vendorFormData.vendor_sku || null,
          vendor_item_name: vendorFormData.vendor_item_name || null,
          unit_price: parseFloat(vendorFormData.unit_price),
          currency: vendorFormData.currency,
          min_order_qty: parseInt(vendorFormData.min_order_qty) || 1,
          lead_time_days: parseInt(vendorFormData.lead_time_days) || 7,
          is_preferred: vendorFormData.is_preferred,
          notes: vendorFormData.notes || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add vendor pricing");
      }

      // Refresh the vendor list and reset form
      fetchVendorMaterials(material.id);
      setVendorFormData(initialVendorPricingFormData);
      setShowAddVendorForm(false);
    } catch (err) {
      console.error("Error adding vendor pricing:", err);
      setVendorError(
        err instanceof Error ? err.message : "Failed to add vendor pricing"
      );
    } finally {
      setAddingVendor(false);
    }
  };

  // Start editing a vendor pricing entry
  const handleStartEditVendor = (vm: VendorMaterial) => {
    setEditingVendorId(vm.id);
    setVendorFormData({
      vendor_id: vm.vendor_id,
      vendor_sku: vm.vendor_sku || "",
      vendor_item_name: vm.vendor_item_name || "",
      unit_price: vm.unit_price.toString(),
      currency: vm.currency,
      min_order_qty: vm.min_order_qty.toString(),
      lead_time_days: vm.lead_time_days.toString(),
      is_preferred: vm.is_preferred,
      notes: vm.notes || "",
    });
    setShowAddVendorForm(false);
    setVendorError(null);
  };

  // Cancel editing
  const handleCancelEditVendor = () => {
    setEditingVendorId(null);
    setVendorFormData(initialVendorPricingFormData);
    setVendorError(null);
  };

  // Save edited vendor pricing
  const handleSaveEditVendor = async () => {
    if (!editingVendorId) return;

    setVendorError(null);

    if (
      !vendorFormData.unit_price ||
      parseFloat(vendorFormData.unit_price) <= 0
    ) {
      setVendorError("Please enter a valid unit price");
      return;
    }

    setSavingVendor(true);

    try {
      const response = await fetch(
        `/api/stock/material-vendors/${editingVendorId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendor_sku: vendorFormData.vendor_sku || null,
            vendor_item_name: vendorFormData.vendor_item_name || null,
            unit_price: parseFloat(vendorFormData.unit_price),
            currency: vendorFormData.currency,
            min_order_qty: parseInt(vendorFormData.min_order_qty) || 1,
            lead_time_days: parseInt(vendorFormData.lead_time_days) || 7,
            is_preferred: vendorFormData.is_preferred,
            notes: vendorFormData.notes || null,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update vendor pricing");
      }

      // Refresh the vendor list and reset form
      fetchVendorMaterials(material.id);
      setEditingVendorId(null);
      setVendorFormData(initialVendorPricingFormData);
    } catch (err) {
      console.error("Error updating vendor pricing:", err);
      setVendorError(
        err instanceof Error ? err.message : "Failed to update vendor pricing"
      );
    } finally {
      setSavingVendor(false);
    }
  };

  // Show delete confirmation
  const handleRequestDeleteVendor = (vm: VendorMaterial) => {
    setDeleteConfirmation({
      isOpen: true,
      vendorMaterialId: vm.id,
      vendorName: vm.vendor?.name || "this vendor",
    });
  };

  // Confirm and execute delete
  const handleConfirmDeleteVendor = async () => {
    if (!deleteConfirmation.vendorMaterialId) return;

    try {
      const response = await fetch(
        `/api/stock/material-vendors/${deleteConfirmation.vendorMaterialId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete vendor pricing");
      }

      fetchVendorMaterials(material.id);
    } catch (err) {
      console.error("Error deleting vendor pricing:", err);
      setVendorError(
        err instanceof Error ? err.message : "Failed to delete vendor pricing"
      );
    } finally {
      setDeleteConfirmation({
        isOpen: false,
        vendorMaterialId: null,
        vendorName: "",
      });
    }
  };

  const brandOptions = [
    { value: "", label: "No Brand" },
    ...brands.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Material: ${material.name}`}
      subtitle={material.sku}
      size="wide"
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-200 mb-4">
          <div className="flex gap-6 px-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <ModalBody maxHeight="480px">
          {/* Basic Info Tab */}
          {activeTab === "basic" && (
            <div className="space-y-4 pb-4">
              <FormGroup cols={2}>
                <FormInput
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Material name"
                />
                <FormInput
                  label="SKU"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  required
                  placeholder="Stock keeping unit"
                />
              </FormGroup>

              <FormTextarea
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                placeholder="Material description..."
              />

              <FormGroup cols={2}>
                <FormInput
                  label="Category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="Category"
                />
                <FormSelect
                  label="Brand"
                  name="brand_id"
                  value={formData.brand_id}
                  onChange={handleChange}
                  options={brandOptions}
                  disabled={loadingBrands}
                />
              </FormGroup>

              <FormGroup cols={2}>
                <FormSelect
                  label="Item Type"
                  name="item_type"
                  value={formData.item_type}
                  onChange={handleChange}
                  options={itemTypeOptions}
                />
                <FormSelect
                  label="Unit of Measure"
                  name="unit_of_measure"
                  value={formData.unit_of_measure}
                  onChange={handleChange}
                  options={unitOfMeasureOptions}
                />
              </FormGroup>
            </div>
          )}

          {/* Specifications Tab */}
          {activeTab === "specifications" && (
            <div className="space-y-4 pb-4">
              <div className="text-sm text-slate-600 mb-3">
                Enter physical specifications for this material.
              </div>

              <FormDivider label="Dimensions" />
              <FormGroup cols={4}>
                <FormInput
                  label="Length"
                  name="spec_length"
                  type="number"
                  value={formData.spec_length}
                  onChange={handleChange}
                  min={0}
                  step={0.1}
                  placeholder="L"
                />
                <FormInput
                  label="Width"
                  name="spec_width"
                  type="number"
                  value={formData.spec_width}
                  onChange={handleChange}
                  min={0}
                  step={0.1}
                  placeholder="W"
                />
                <FormInput
                  label="Thickness"
                  name="spec_thickness"
                  type="number"
                  value={formData.spec_thickness}
                  onChange={handleChange}
                  min={0}
                  step={0.1}
                  placeholder="T"
                />
                <FormSelect
                  label="Unit"
                  name="spec_dimension_unit"
                  value={formData.spec_dimension_unit}
                  onChange={handleChange}
                  options={dimensionUnitOptions}
                />
              </FormGroup>

              <FormDivider label="Weight & Appearance" />
              <FormGroup cols={4}>
                <FormInput
                  label="Weight"
                  name="spec_weight"
                  type="number"
                  value={formData.spec_weight}
                  onChange={handleChange}
                  min={0}
                  step={0.1}
                />
                <FormSelect
                  label="Unit"
                  name="spec_weight_unit"
                  value={formData.spec_weight_unit}
                  onChange={handleChange}
                  options={weightUnitOptions}
                />
                <FormInput
                  label="Color"
                  name="spec_color"
                  value={formData.spec_color}
                  onChange={handleChange}
                  placeholder="e.g., Natural Oak"
                />
                <FormInput
                  label="Finish"
                  name="spec_finish"
                  value={formData.spec_finish}
                  onChange={handleChange}
                  placeholder="e.g., Matte"
                />
              </FormGroup>

              <FormDivider label="Quality" />
              <FormGroup cols={2}>
                <FormInput
                  label="Grade"
                  name="spec_grade"
                  value={formData.spec_grade}
                  onChange={handleChange}
                  placeholder="e.g., E1, A-Grade"
                />
                <FormInput
                  label="Material Composition"
                  name="spec_material"
                  value={formData.spec_material}
                  onChange={handleChange}
                  placeholder="e.g., Engineered Wood"
                />
              </FormGroup>
            </div>
          )}

          {/* Stock & Pricing Tab */}
          {activeTab === "stock" && (
            <div className="space-y-4 pb-4">
              <FormDivider label="Quantity Settings" />
              <FormGroup cols={3}>
                <FormInput
                  label="Current Quantity"
                  name="current_quantity"
                  type="number"
                  value={formData.current_quantity}
                  onChange={handleChange}
                  min={0}
                />
                <FormInput
                  label="Minimum Quantity"
                  name="minimum_quantity"
                  type="number"
                  value={formData.minimum_quantity}
                  onChange={handleChange}
                  min={0}
                />
                <FormInput
                  label="Reorder Quantity"
                  name="reorder_quantity"
                  type="number"
                  value={formData.reorder_quantity}
                  onChange={handleChange}
                  min={0}
                />
              </FormGroup>

              <FormDivider label="Pricing & Location" />
              <FormGroup cols={3}>
                <FormInput
                  label="Unit Cost"
                  name="unit_cost"
                  type="number"
                  value={formData.unit_cost}
                  onChange={handleChange}
                  min={0}
                  step={0.01}
                />
                <FormInput
                  label="Selling Price"
                  name="selling_price"
                  type="number"
                  value={formData.selling_price}
                  onChange={handleChange}
                  min={0}
                  step={0.01}
                />
                <FormInput
                  label="Storage Location"
                  name="storage_location"
                  value={formData.storage_location}
                  onChange={handleChange}
                  placeholder="Warehouse, rack, shelf..."
                />
              </FormGroup>
            </div>
          )}

          {/* Vendor Pricing Tab */}
          {activeTab === "vendors" && (
            <div className="space-y-4 pb-4">
              {/* Header with Add Button */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Configure vendor-specific pricing for this material.
                </div>
                {!showAddVendorForm && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                    onClick={() => setShowAddVendorForm(true)}
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add Vendor
                  </button>
                )}
              </div>

              {/* Add Vendor Form (Inline) */}
              {showAddVendorForm && (
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-slate-900">
                      Add New Vendor Pricing
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddVendorForm(false);
                        setVendorFormData(initialVendorPricingFormData);
                        setVendorError(null);
                      }}
                      className="text-slate-400 hover:text-slate-600"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {vendorError && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      {vendorError}
                    </div>
                  )}

                  <div className="space-y-3">
                    {/* Row 1: Vendor, Unit Price, MOQ, Lead Time */}
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Vendor *
                        </label>
                        {loadingAvailableVendors ? (
                          <div className="text-xs text-slate-500">
                            Loading...
                          </div>
                        ) : (
                          <select
                            name="vendor_id"
                            value={vendorFormData.vendor_id}
                            onChange={handleVendorFormChange}
                            className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select vendor</option>
                            {availableVendors.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Unit Price *
                        </label>
                        <div className="flex">
                          <select
                            name="currency"
                            value={vendorFormData.currency}
                            onChange={handleVendorFormChange}
                            className="w-14 px-1 py-2 text-sm border border-r-0 border-slate-200 rounded-l bg-slate-50 shrink-0"
                          >
                            <option value="INR">₹</option>
                            <option value="USD">$</option>
                            <option value="EUR">€</option>
                          </select>
                          <input
                            type="number"
                            name="unit_price"
                            value={vendorFormData.unit_price}
                            onChange={handleVendorFormChange}
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="w-full min-w-0 px-2 py-2 text-sm border border-slate-200 rounded-r focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          MOQ
                        </label>
                        <input
                          type="number"
                          name="min_order_qty"
                          value={vendorFormData.min_order_qty}
                          onChange={handleVendorFormChange}
                          min="1"
                          className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Lead Time (days)
                        </label>
                        <input
                          type="number"
                          name="lead_time_days"
                          value={vendorFormData.lead_time_days}
                          onChange={handleVendorFormChange}
                          min="0"
                          className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Row 2: Vendor SKU, Vendor Item Name */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Vendor SKU
                        </label>
                        <input
                          type="text"
                          name="vendor_sku"
                          value={vendorFormData.vendor_sku}
                          onChange={handleVendorFormChange}
                          placeholder="Optional"
                          className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Vendor Item Name
                        </label>
                        <input
                          type="text"
                          name="vendor_item_name"
                          value={vendorFormData.vendor_item_name}
                          onChange={handleVendorFormChange}
                          placeholder="Optional"
                          className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Row 3: Preferred checkbox & actions */}
                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          name="is_preferred"
                          checked={vendorFormData.is_preferred}
                          onChange={handleVendorFormChange}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        Mark as preferred vendor
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddVendorForm(false);
                            setVendorFormData(initialVendorPricingFormData);
                            setVendorError(null);
                          }}
                          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddVendor}
                          disabled={addingVendor}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {addingVendor ? "Adding..." : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Vendor List */}
              {loadingVendors ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : vendorMaterials.length === 0 && !showAddVendorForm ? (
                <div className="text-center py-8 text-slate-500">
                  <p className="mb-2">No vendor pricing configured yet.</p>
                  <p className="text-sm">
                    Click &quot;Add Vendor&quot; to track different pricing and
                    lead times.
                  </p>
                </div>
              ) : (
                vendorMaterials.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                      <div className="col-span-3">Vendor</div>
                      <div className="col-span-2">Unit Price</div>
                      <div className="col-span-1">MOQ</div>
                      <div className="col-span-2">Lead Time</div>
                      <div className="col-span-2">Vendor SKU</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {/* Table Rows */}
                    {vendorMaterials.map((vm) => (
                      <div key={vm.id}>
                        {editingVendorId === vm.id ? (
                          // Inline Edit Form
                          <div className="p-3 bg-amber-50/50 border-b border-slate-100">
                            {vendorError && (
                              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                {vendorError}
                              </div>
                            )}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-slate-900">
                                  Editing: {vm.vendor?.name}
                                </span>
                              </div>
                              {/* Row 1: Unit Price, MOQ, Lead Time */}
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Unit Price *
                                  </label>
                                  <div className="flex">
                                    <select
                                      name="currency"
                                      value={vendorFormData.currency}
                                      onChange={handleVendorFormChange}
                                      className="px-2 py-2 text-sm border border-r-0 border-slate-200 rounded-l bg-slate-50"
                                    >
                                      <option value="INR">₹</option>
                                      <option value="USD">$</option>
                                      <option value="EUR">€</option>
                                    </select>
                                    <input
                                      type="number"
                                      name="unit_price"
                                      value={vendorFormData.unit_price}
                                      onChange={handleVendorFormChange}
                                      step="0.01"
                                      min="0"
                                      className="flex-1 px-2 py-2 text-sm border border-slate-200 rounded-r focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    MOQ
                                  </label>
                                  <input
                                    type="number"
                                    name="min_order_qty"
                                    value={vendorFormData.min_order_qty}
                                    onChange={handleVendorFormChange}
                                    min="1"
                                    className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Lead Time (days)
                                  </label>
                                  <input
                                    type="number"
                                    name="lead_time_days"
                                    value={vendorFormData.lead_time_days}
                                    onChange={handleVendorFormChange}
                                    min="0"
                                    className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                </div>
                              </div>
                              {/* Row 2: Vendor SKU & Vendor Item Name */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Vendor SKU
                                  </label>
                                  <input
                                    type="text"
                                    name="vendor_sku"
                                    value={vendorFormData.vendor_sku}
                                    onChange={handleVendorFormChange}
                                    placeholder="Optional"
                                    className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Vendor Item Name
                                  </label>
                                  <input
                                    type="text"
                                    name="vendor_item_name"
                                    value={vendorFormData.vendor_item_name}
                                    onChange={handleVendorFormChange}
                                    placeholder="Optional"
                                    className="w-full px-2 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                </div>
                              </div>
                              {/* Row 3: Preferred & Actions */}
                              <div className="flex items-center justify-between pt-2">
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    name="is_preferred"
                                    checked={vendorFormData.is_preferred}
                                    onChange={handleVendorFormChange}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                  />
                                  Mark as preferred vendor
                                </label>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={handleCancelEditVendor}
                                    className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveEditVendor}
                                    disabled={savingVendor}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50"
                                  >
                                    {savingVendor ? "Saving..." : "Save"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Normal Row Display
                          <div
                            className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center text-sm border-b border-slate-100 last:border-b-0 ${
                              vm.is_preferred ? "bg-blue-50/50" : "bg-white"
                            }`}
                          >
                            <div className="col-span-3 flex items-center gap-2">
                              <span className="font-medium text-slate-900">
                                {vm.vendor?.name || "Unknown"}
                              </span>
                              {vm.is_preferred && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                                  Preferred
                                </span>
                              )}
                            </div>
                            <div className="col-span-2 text-slate-700">
                              {vm.currency} {vm.unit_price.toFixed(2)}
                            </div>
                            <div className="col-span-1 text-slate-600">
                              {vm.min_order_qty}
                            </div>
                            <div className="col-span-2 text-slate-600">
                              {vm.lead_time_days} days
                            </div>
                            <div className="col-span-2 text-slate-600">
                              {vm.vendor_sku || "-"}
                            </div>
                            <div className="col-span-2 text-right flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditVendor(vm)}
                                className="text-blue-600 hover:text-blue-700 text-xs"
                              >
                                Edit
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteVendor(vm)}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </ModalFooter>
      </form>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmation.isOpen}
        onClose={() =>
          setDeleteConfirmation({
            isOpen: false,
            vendorMaterialId: null,
            vendorName: "",
          })
        }
        title="Confirm Remove"
        size="sm"
      >
        <ModalBody>
          <div className="text-center py-4">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg
                className="h-6 w-6 text-red-600"
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
            <p className="text-slate-700">
              Are you sure you want to remove pricing for{" "}
              <span className="font-semibold">
                {deleteConfirmation.vendorName}
              </span>
              ?
            </p>
            <p className="text-sm text-slate-500 mt-2">
              This action cannot be undone.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={() =>
              setDeleteConfirmation({
                isOpen: false,
                vendorMaterialId: null,
                vendorName: "",
              })
            }
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmDeleteVendor}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Remove
          </button>
        </ModalFooter>
      </Modal>
    </Modal>
  );
}
