"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
  RectangleStackIcon,
  CheckCircleIcon,
  SparklesIcon,
  CurrencyRupeeIcon,
} from "@heroicons/react/24/outline";

// Template quality tier styling
const QUALITY_TIERS = {
  luxury: {
    label: "Luxury",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    badge: "bg-purple-600",
  },
  premium: {
    label: "Premium",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    badge: "bg-blue-600",
  },
  standard: {
    label: "Standard",
    color: "bg-green-100 text-green-700 border-green-200",
    badge: "bg-green-600",
  },
  basic: {
    label: "Basic",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    badge: "bg-slate-600",
  },
};

// Property type labels
const PROPERTY_TYPES: Record<string, string> = {
  "1bhk": "1BHK",
  "2bhk": "2BHK",
  "3bhk": "3BHK",
  "4bhk": "4BHK",
  studio: "Studio",
  villa: "Villa",
  penthouse: "Penthouse",
  office: "Office",
  retail: "Retail",
};

export interface Template {
  id: string;
  name: string;
  description?: string;
  property_type?: string;
  quality_tier: string;
  base_price?: number;
  spaces_count?: number;
  components_count?: number;
  usage_count?: number;
  is_featured?: boolean;
}

interface TemplateSelectorProps {
  templates: Template[];
  isLoading?: boolean;
  onSelect: (template: Template) => void;
  onSearch?: (query: string) => void;
  selectedId?: string;
  showFilters?: boolean;
  className?: string;
}

export function TemplateSelector({
  templates,
  isLoading,
  onSelect,
  onSearch,
  selectedId,
  showFilters = true,
  className = "",
}: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>("");
  const [qualityFilter, setQualityFilter] = useState<string>("");

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      onSearch?.(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, onSearch]);

  // Filter templates locally if not using server-side filtering
  const filteredTemplates = templates.filter((template) => {
    if (propertyFilter && template.property_type !== propertyFilter)
      return false;
    if (qualityFilter && template.quality_tier !== qualityFilter) return false;
    return true;
  });

  // Group by quality tier for better organization
  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const tier = template.quality_tier || "standard";
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  const formatCurrency = (amount?: number) => {
    if (!amount) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Search and Filters */}
      <div className="flex-shrink-0 space-y-3 p-4 border-b border-slate-200">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-2">
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Property Types</option>
              {Object.entries(PROPERTY_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Quality Tiers</option>
              {Object.entries(QUALITY_TIERS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {(propertyFilter || qualityFilter) && (
              <button
                onClick={() => {
                  setPropertyFilter("");
                  setQualityFilter("");
                }}
                className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Template List */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-8">
            <RectangleStackIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No templates found</p>
            {(searchQuery || propertyFilter || qualityFilter) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setPropertyFilter("");
                  setQualityFilter("");
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Featured templates first */}
            {filteredTemplates.some((t) => t.is_featured) && (
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4 text-amber-500" />
                  Featured Templates
                </h3>
                <div className="grid gap-3">
                  {filteredTemplates
                    .filter((t) => t.is_featured)
                    .map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        isSelected={selectedId === template.id}
                        onSelect={() => onSelect(template)}
                        formatCurrency={formatCurrency}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Group by quality tier */}
            {Object.entries(QUALITY_TIERS).map(([tier, config]) => {
              const tierTemplates = groupedTemplates[tier]?.filter(
                (t) => !t.is_featured
              );
              if (!tierTemplates?.length) return null;

              return (
                <div key={tier}>
                  <h3 className="text-sm font-medium text-slate-500 mb-3">
                    {config.label} Templates
                  </h3>
                  <div className="grid gap-3">
                    {tierTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        isSelected={selectedId === template.id}
                        onSelect={() => onSelect(template)}
                        formatCurrency={formatCurrency}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Individual template card
interface TemplateCardProps {
  template: Template;
  isSelected: boolean;
  onSelect: () => void;
  formatCurrency: (amount?: number) => string;
}

function TemplateCard({
  template,
  isSelected,
  onSelect,
  formatCurrency,
}: TemplateCardProps) {
  const tierConfig =
    QUALITY_TIERS[template.quality_tier as keyof typeof QUALITY_TIERS] ||
    QUALITY_TIERS.standard;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-slate-900 truncate">
              {template.name}
            </h4>
            {template.is_featured && (
              <SparklesIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
            )}
          </div>

          {template.description && (
            <p className="text-sm text-slate-500 line-clamp-2 mb-2">
              {template.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${tierConfig.color}`}
            >
              {tierConfig.label}
            </span>
            {template.property_type && (
              <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                {PROPERTY_TYPES[template.property_type] ||
                  template.property_type}
              </span>
            )}
            {template.spaces_count !== undefined && (
              <span className="text-xs text-slate-400">
                {template.spaces_count} spaces
              </span>
            )}
            {template.components_count !== undefined && (
              <span className="text-xs text-slate-400">
                {template.components_count} components
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {template.base_price ? (
            <span className="text-sm font-semibold text-slate-900">
              {formatCurrency(template.base_price)}
            </span>
          ) : null}
          {isSelected && <CheckCircleIcon className="w-5 h-5 text-blue-600" />}
        </div>
      </div>
    </button>
  );
}

// Template Modal for use in quotation builder
interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  isLoading?: boolean;
  onSelectTemplate: (template: Template) => void;
  onSearch?: (query: string) => void;
}

export function TemplateModal({
  isOpen,
  onClose,
  templates,
  isLoading,
  onSelectTemplate,
  onSearch,
}: TemplateModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );

  if (!isOpen) return null;

  const handleApply = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Choose a Template
            </h2>
            <p className="text-sm text-slate-500">
              Start with a pre-built quotation template
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Template selector */}
        <TemplateSelector
          templates={templates}
          isLoading={isLoading}
          onSelect={setSelectedTemplate}
          onSearch={onSearch}
          selectedId={selectedTemplate?.id}
          className="flex-1 min-h-0"
        />

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!selectedTemplate}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply Template
          </button>
        </div>
      </div>
    </div>
  );
}
