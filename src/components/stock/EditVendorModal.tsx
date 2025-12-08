"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import {
  FormInput,
  FormSelect,
  FormTextarea,
  FormCheckbox,
  FormGroup,
  FormDivider,
} from "@/components/ui/FormControls";
import type {
  Vendor,
  UpdateVendorInput,
  VendorBrand,
  Brand,
} from "@/types/stock";
import {
  PlusIcon,
  TrashIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import { CheckBadgeIcon as CheckBadgeIconSolid } from "@heroicons/react/24/solid";

interface EditVendorModalProps {
  isOpen: boolean;
  vendor: Vendor | null;
  onClose: () => void;
  onSubmit: (vendorId: string, updates: UpdateVendorInput) => Promise<void>;
}

type TabId = "basic" | "contact" | "payment" | "brands";

export function EditVendorModal({
  isOpen,
  vendor,
  onClose,
  onSubmit,
}: EditVendorModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  const [formData, setFormData] = useState<UpdateVendorInput>({});

  // Brands tab state
  const [vendorBrands, setVendorBrands] = useState<VendorBrand[]>([]);
  const [availableBrands, setAvailableBrands] = useState<Brand[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [newBrandDiscount, setNewBrandDiscount] = useState<number>(0);
  const [newBrandAuthorized, setNewBrandAuthorized] = useState<boolean>(false);
  const [isAddingBrand, setIsAddingBrand] = useState(false);

  // Fetch vendor brands
  const fetchVendorBrands = useCallback(async () => {
    if (!vendor) return;

    setIsLoadingBrands(true);
    setBrandsError(null);

    try {
      const response = await fetch(
        `/api/stock/vendor-brands?vendor_id=${vendor.id}`
      );
      if (!response.ok) throw new Error("Failed to fetch vendor brands");
      const data = await response.json();
      setVendorBrands(data.vendorBrands || []);
    } catch (err) {
      setBrandsError(
        err instanceof Error ? err.message : "Failed to load brands"
      );
    } finally {
      setIsLoadingBrands(false);
    }
  }, [vendor]);

  // Fetch all available brands
  const fetchAvailableBrands = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/stock/brands?is_active=true&limit=500"
      );
      if (!response.ok) throw new Error("Failed to fetch brands");
      const data = await response.json();
      setAvailableBrands(data.brands || []);
    } catch (err) {
      console.error("Failed to fetch available brands:", err);
    }
  }, []);

  // Load brands when tab is activated
  useEffect(() => {
    if (activeTab === "brands" && vendor) {
      fetchVendorBrands();
      fetchAvailableBrands();
    }
  }, [activeTab, vendor, fetchVendorBrands, fetchAvailableBrands]);

  // Initialize form when vendor changes
  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name,
        display_name: vendor.display_name || "",
        contact_person: vendor.contact_person || "",
        email: vendor.email || "",
        phone: vendor.phone || "",
        alternate_phone: vendor.alternate_phone || "",
        website: vendor.website || "",
        address_line1: vendor.address_line1 || "",
        address_line2: vendor.address_line2 || "",
        city: vendor.city || "",
        state: vendor.state || "",
        pincode: vendor.pincode || "",
        country: vendor.country || "India",
        gst_number: vendor.gst_number || "",
        pan_number: vendor.pan_number || "",
        payment_terms: vendor.payment_terms || "",
        credit_days: vendor.credit_days || 0,
        credit_limit: vendor.credit_limit,
        bank_name: vendor.bank_name || "",
        bank_account_number: vendor.bank_account_number || "",
        bank_ifsc: vendor.bank_ifsc || "",
        rating: vendor.rating || 3,
        notes: vendor.notes || "",
        is_active: vendor.is_active,
        is_preferred: vendor.is_preferred || false,
      });
      setActiveTab("basic");
      setError(null);
      // Reset brands tab state
      setSelectedBrandId("");
      setNewBrandDiscount(0);
      setNewBrandAuthorized(false);
      setVendorBrands([]);
      setBrandsError(null);
    }
  }, [vendor]);

  if (!vendor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name?.trim()) {
      setError("Vendor name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(vendor.id, formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update vendor");
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
    const target = e.target as HTMLInputElement;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? target.checked
          : type === "number"
          ? value
            ? Number(value)
            : undefined
          : value,
    }));
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "basic", label: "Basic Info" },
    { id: "contact", label: "Contact & Address" },
    { id: "payment", label: "Payment & Banking" },
    { id: "brands", label: "Brands" },
  ];

  // Get brands not yet associated with this vendor
  const unassociatedBrands = availableBrands.filter(
    (brand) => !vendorBrands.some((vb) => vb.brand_id === brand.id)
  );

  // Add brand to vendor
  const handleAddBrand = async () => {
    if (!selectedBrandId || !vendor) return;

    setIsAddingBrand(true);
    setBrandsError(null);

    try {
      const response = await fetch("/api/stock/vendor-brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: vendor.id,
          brand_id: selectedBrandId,
          is_authorized_dealer: newBrandAuthorized,
          discount_percent: newBrandDiscount,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add brand");
      }

      // Refresh the list
      await fetchVendorBrands();

      // Reset form
      setSelectedBrandId("");
      setNewBrandDiscount(0);
      setNewBrandAuthorized(false);
    } catch (err) {
      setBrandsError(
        err instanceof Error ? err.message : "Failed to add brand"
      );
    } finally {
      setIsAddingBrand(false);
    }
  };

  // Remove brand from vendor
  const handleRemoveBrand = async (vendorBrandId: string) => {
    if (!confirm("Remove this brand from the vendor?")) return;

    try {
      const response = await fetch(
        `/api/stock/vendor-brands?id=${vendorBrandId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to remove brand");

      // Update local state
      setVendorBrands((prev) => prev.filter((vb) => vb.id !== vendorBrandId));
    } catch (err) {
      setBrandsError(
        err instanceof Error ? err.message : "Failed to remove brand"
      );
    }
  };

  // Toggle authorized dealer status
  const handleToggleAuthorized = async (vendorBrand: VendorBrand) => {
    try {
      const response = await fetch("/api/stock/vendor-brands", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: vendorBrand.id,
          is_authorized_dealer: !vendorBrand.is_authorized_dealer,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      const data = await response.json();
      setVendorBrands((prev) =>
        prev.map((vb) => (vb.id === vendorBrand.id ? data.vendorBrand : vb))
      );
    } catch (err) {
      setBrandsError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  // Update discount
  const handleUpdateDiscount = async (
    vendorBrand: VendorBrand,
    discount: number
  ) => {
    try {
      const response = await fetch("/api/stock/vendor-brands", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: vendorBrand.id,
          discount_percent: discount,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      const data = await response.json();
      setVendorBrands((prev) =>
        prev.map((vb) => (vb.id === vendorBrand.id ? data.vendorBrand : vb))
      );
    } catch (err) {
      setBrandsError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Vendor: ${vendor.display_name || vendor.name}`}
      subtitle={vendor.code}
      size="2xl"
    >
      <form onSubmit={handleSubmit}>
        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-200 mb-4">
          <nav className="flex gap-4">
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
          </nav>
        </div>

        {/* Tab Content */}
        <ModalBody maxHeight="400px">
          {/* Basic Info Tab */}
          {activeTab === "basic" && (
            <div className="space-y-4">
              <FormCheckbox
                name="is_active"
                checked={formData.is_active ?? true}
                onChange={handleChange}
                label="Active vendor"
                description="Can be used in new purchase orders"
              />

              <FormGroup cols={2}>
                <FormInput
                  label="Vendor Name"
                  name="name"
                  value={formData.name || ""}
                  onChange={handleChange}
                  placeholder="Enter vendor name"
                  required
                />
                <FormInput
                  label="Display Name"
                  name="display_name"
                  value={formData.display_name || ""}
                  onChange={handleChange}
                  placeholder="Display name (optional)"
                />
              </FormGroup>

              <FormGroup cols={2}>
                <FormInput
                  label="Contact Person"
                  name="contact_person"
                  value={formData.contact_person || ""}
                  onChange={handleChange}
                  placeholder="Primary contact"
                />
                <FormSelect
                  label="Rating"
                  name="rating"
                  value={formData.rating || 3}
                  onChange={handleChange}
                  options={[
                    { value: 1, label: "1 Star" },
                    { value: 2, label: "2 Stars" },
                    { value: 3, label: "3 Stars" },
                    { value: 4, label: "4 Stars" },
                    { value: 5, label: "5 Stars" },
                  ]}
                />
              </FormGroup>

              {/* Preferred Vendor Toggle */}
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <input
                  type="checkbox"
                  id="edit_is_preferred"
                  name="is_preferred"
                  checked={formData.is_preferred || false}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      is_preferred: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="edit_is_preferred" className="flex-1">
                  <span className="text-sm font-medium text-amber-900">
                    Mark as Preferred Vendor
                  </span>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Preferred vendors are highlighted to help your team
                    prioritize them for orders
                  </p>
                </label>
              </div>

              <FormGroup cols={2}>
                <FormInput
                  label="GST Number"
                  name="gst_number"
                  value={formData.gst_number || ""}
                  onChange={handleChange}
                  placeholder="GSTIN"
                />
                <FormInput
                  label="PAN Number"
                  name="pan_number"
                  value={formData.pan_number || ""}
                  onChange={handleChange}
                  placeholder="PAN"
                />
              </FormGroup>

              <FormTextarea
                label="Notes"
                name="notes"
                value={formData.notes || ""}
                onChange={handleChange}
                rows={3}
                placeholder="Additional notes..."
              />
            </div>
          )}

          {/* Contact Tab */}
          {activeTab === "contact" && (
            <div className="space-y-4">
              <FormGroup cols={2}>
                <FormInput
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={handleChange}
                  placeholder="email@example.com"
                />
                <FormInput
                  label="Website"
                  name="website"
                  type="url"
                  value={formData.website || ""}
                  onChange={handleChange}
                  placeholder="https://example.com"
                />
              </FormGroup>

              <FormGroup cols={2}>
                <FormInput
                  label="Phone"
                  name="phone"
                  type="tel"
                  value={formData.phone || ""}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                />
                <FormInput
                  label="Alternate Phone"
                  name="alternate_phone"
                  type="tel"
                  value={formData.alternate_phone || ""}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                />
              </FormGroup>

              <FormDivider label="Address" />

              <FormInput
                label="Address Line 1"
                name="address_line1"
                value={formData.address_line1 || ""}
                onChange={handleChange}
                placeholder="Street address"
              />

              <FormInput
                label="Address Line 2"
                name="address_line2"
                value={formData.address_line2 || ""}
                onChange={handleChange}
                placeholder="Area, landmark"
              />

              <FormGroup cols={3}>
                <FormInput
                  label="City"
                  name="city"
                  value={formData.city || ""}
                  onChange={handleChange}
                  placeholder="City"
                />
                <FormInput
                  label="State"
                  name="state"
                  value={formData.state || ""}
                  onChange={handleChange}
                  placeholder="State"
                />
                <FormInput
                  label="Pincode"
                  name="pincode"
                  value={formData.pincode || ""}
                  onChange={handleChange}
                  placeholder="Pincode"
                />
              </FormGroup>

              <FormInput
                label="Country"
                name="country"
                value={formData.country || "India"}
                onChange={handleChange}
                placeholder="Country"
              />
            </div>
          )}

          {/* Payment Tab */}
          {activeTab === "payment" && (
            <div className="space-y-4">
              <FormGroup cols={2}>
                <FormInput
                  label="Payment Terms"
                  name="payment_terms"
                  value={formData.payment_terms || ""}
                  onChange={handleChange}
                  placeholder="e.g., Net 30, 50% advance"
                />
                <FormInput
                  label="Credit Days"
                  name="credit_days"
                  type="number"
                  value={formData.credit_days || ""}
                  onChange={handleChange}
                  placeholder="0"
                  min={0}
                />
              </FormGroup>

              <FormInput
                label="Credit Limit (₹)"
                name="credit_limit"
                type="number"
                value={formData.credit_limit || ""}
                onChange={handleChange}
                placeholder="Maximum credit amount"
                min={0}
              />

              <FormDivider label="Bank Details" />

              <FormInput
                label="Bank Name"
                name="bank_name"
                value={formData.bank_name || ""}
                onChange={handleChange}
                placeholder="Bank name"
              />

              <FormGroup cols={2}>
                <FormInput
                  label="Account Number"
                  name="bank_account_number"
                  value={formData.bank_account_number || ""}
                  onChange={handleChange}
                  placeholder="Account number"
                />
                <FormInput
                  label="IFSC Code"
                  name="bank_ifsc"
                  value={formData.bank_ifsc || ""}
                  onChange={handleChange}
                  placeholder="IFSC code"
                />
              </FormGroup>
            </div>
          )}

          {/* Brands Tab */}
          {activeTab === "brands" && (
            <div className="space-y-4">
              {/* Error */}
              {brandsError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {brandsError}
                </div>
              )}

              {/* Add Brand Form */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <h4 className="text-sm font-medium text-slate-900 mb-3">
                  Add Brand to Vendor
                </h4>
                <div className="grid grid-cols-12 gap-3">
                  {/* Brand Select */}
                  <div className="col-span-5">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Brand
                    </label>
                    <select
                      value={selectedBrandId}
                      onChange={(e) => setSelectedBrandId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select a brand...</option>
                      {unassociatedBrands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name} ({brand.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Discount */}
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Discount %
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={newBrandDiscount}
                      onChange={(e) =>
                        setNewBrandDiscount(Number(e.target.value))
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Authorized Dealer */}
                  <div className="col-span-2 flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newBrandAuthorized}
                        onChange={(e) =>
                          setNewBrandAuthorized(e.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-600">Authorized</span>
                    </label>
                  </div>

                  {/* Add Button */}
                  <div className="col-span-2 flex items-end">
                    <button
                      type="button"
                      onClick={handleAddBrand}
                      disabled={!selectedBrandId || isAddingBrand}
                      className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <PlusIcon className="h-4 w-4" />
                      {isAddingBrand ? "..." : "Add"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Associated Brands List */}
              <div>
                <h4 className="text-sm font-medium text-slate-900 mb-3">
                  Associated Brands ({vendorBrands.length})
                </h4>

                {isLoadingBrands ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    Loading brands...
                  </div>
                ) : vendorBrands.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg">
                    No brands associated with this vendor yet.
                    <br />
                    <span className="text-xs">
                      Use the form above to add brands.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vendorBrands.map((vb) => (
                      <div
                        key={vb.id}
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                      >
                        {/* Brand Avatar */}
                        <div className="w-10 h-10 bg-linear-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-semibold text-xs shrink-0">
                          {vb.brand?.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase() || "BR"}
                        </div>

                        {/* Brand Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 truncate">
                              {vb.brand?.name || "Unknown Brand"}
                            </span>
                            {vb.is_authorized_dealer && (
                              <CheckBadgeIconSolid
                                className="h-4 w-4 text-blue-600"
                                title="Authorized Dealer"
                              />
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {vb.brand?.code}
                          </span>
                        </div>

                        {/* Authorized Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleAuthorized(vb)}
                          className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                            vb.is_authorized_dealer
                              ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                          title={
                            vb.is_authorized_dealer
                              ? "Remove authorized status"
                              : "Mark as authorized dealer"
                          }
                        >
                          {vb.is_authorized_dealer
                            ? "Authorized"
                            : "Not Authorized"}
                        </button>

                        {/* Discount Input */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={vb.discount_percent}
                            onChange={(e) =>
                              handleUpdateDiscount(vb, Number(e.target.value))
                            }
                            className="w-16 px-2 py-1 text-xs text-center border border-slate-300 rounded-md focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </div>

                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveBrand(vb.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Remove brand from vendor"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </ModalBody>

        {/* Footer */}
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
