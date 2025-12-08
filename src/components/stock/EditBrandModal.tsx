"use client";

import React, { useState, useEffect } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import {
  FormInput,
  FormSelect,
  FormTextarea,
  FormGroup,
} from "@/components/ui/FormControls";
import type { Brand, UpdateBrandInput, BrandQualityTier } from "@/types/stock";

interface EditBrandModalProps {
  isOpen: boolean;
  brand: Brand | null;
  onClose: () => void;
  onSubmit: (brandId: string, updates: UpdateBrandInput) => Promise<void>;
}

const qualityTierOptions = [
  { value: "budget", label: "Budget" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxury" },
];

const categoryOptions = [
  "Plywood",
  "MDF",
  "Laminates",
  "Hardware",
  "Adhesives",
  "Paints",
  "Fabrics",
  "Glass",
  "Stone",
  "Tiles",
  "Lighting",
  "Furniture",
  "Accessories",
];

export function EditBrandModal({
  isOpen,
  brand,
  onClose,
  onSubmit,
}: EditBrandModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<UpdateBrandInput>({});

  // Initialize form when brand changes
  useEffect(() => {
    if (brand) {
      setFormData({
        name: brand.name,
        display_name: brand.display_name || "",
        logo_url: brand.logo_url || "",
        website: brand.website || "",
        country: brand.country || "India",
        description: brand.description || "",
        categories: brand.categories || [],
        quality_tier: brand.quality_tier || "standard",
        is_active: brand.is_active,
        is_preferred: brand.is_preferred || false,
      });
      setError(null);
    }
  }, [brand]);

  if (!brand) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name?.trim()) {
      setError("Brand name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(brand.id, formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update brand");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCategoryToggle = (category: string) => {
    setFormData((prev) => {
      const categories = prev.categories || [];
      if (categories.includes(category)) {
        return {
          ...prev,
          categories: categories.filter((c) => c !== category),
        };
      } else {
        return { ...prev, categories: [...categories, category] };
      }
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Brand" size="xl">
      <form onSubmit={handleSubmit}>
        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <ModalBody maxHeight="450px">
          <div className="space-y-4">
            {/* Status Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <span className="text-sm font-medium text-slate-900">
                  Brand Status
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inactive brands won&apos;t appear in material selections
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    is_active: !prev.is_active,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.is_active ? "bg-green-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.is_active ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Basic Info */}
            <FormGroup cols={2}>
              <FormInput
                label="Brand Name"
                name="name"
                value={formData.name || ""}
                onChange={handleChange}
                placeholder="e.g., Century Ply"
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
              <FormSelect
                label="Quality Tier"
                name="quality_tier"
                value={formData.quality_tier || "standard"}
                onChange={handleChange}
                options={qualityTierOptions}
              />
              <FormInput
                label="Country"
                name="country"
                value={formData.country || ""}
                onChange={handleChange}
                placeholder="e.g., India"
              />
            </FormGroup>

            {/* Preferred Brand Toggle */}
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
                  Mark as Preferred Brand
                </span>
                <p className="text-xs text-amber-700 mt-0.5">
                  Preferred brands are highlighted to help your team prioritize
                  them when selecting materials
                </p>
              </label>
            </div>

            <FormGroup cols={2}>
              <FormInput
                label="Website"
                name="website"
                type="url"
                value={formData.website || ""}
                onChange={handleChange}
                placeholder="https://www.example.com"
              />
              <FormInput
                label="Logo URL"
                name="logo_url"
                type="url"
                value={formData.logo_url || ""}
                onChange={handleChange}
                placeholder="https://www.example.com/logo.png"
              />
            </FormGroup>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Categories
              </label>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryToggle(category)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      formData.categories?.includes(category)
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <FormTextarea
              label="Description"
              name="description"
              value={formData.description || ""}
              onChange={handleChange}
              rows={3}
              placeholder="Brief description about the brand..."
            />
          </div>
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
