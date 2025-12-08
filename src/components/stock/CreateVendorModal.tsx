"use client";

import React, { useState } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import {
  FormInput,
  FormSelect,
  FormTextarea,
  FormGroup,
  FormDivider,
} from "@/components/ui/FormControls";
import type { CreateVendorInput } from "@/types/stock";

interface CreateVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (vendor: CreateVendorInput) => Promise<void>;
}

type TabId = "basic" | "contact" | "payment";

const initialFormData: CreateVendorInput = {
  name: "",
  display_name: "",
  contact_person: "",
  email: "",
  phone: "",
  alternate_phone: "",
  website: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  gst_number: "",
  pan_number: "",
  payment_terms: "",
  credit_days: 0,
  credit_limit: undefined,
  bank_name: "",
  bank_account_number: "",
  bank_ifsc: "",
  rating: 3,
  notes: "",
  is_preferred: false,
};

export function CreateVendorModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateVendorModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  const [formData, setFormData] = useState<CreateVendorInput>(initialFormData);

  const handleClose = () => {
    setFormData(initialFormData);
    setActiveTab("basic");
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Vendor name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create vendor");
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
      [name]: type === "number" ? (value ? Number(value) : undefined) : value,
    }));
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "basic", label: "Basic Info" },
    { id: "contact", label: "Contact & Address" },
    { id: "payment", label: "Payment & Banking" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Vendor"
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
              <FormGroup cols={2}>
                <FormInput
                  label="Vendor Name"
                  name="name"
                  value={formData.name}
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
                  id="is_preferred"
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
                <label htmlFor="is_preferred" className="flex-1">
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
        </ModalBody>

        {/* Footer */}
        <ModalFooter>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Creating..." : "Create Vendor"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
