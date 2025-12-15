/**
 * useTemplates Hook
 * Manages template fetching, selection, and loading
 */

import { useState, useCallback } from "react";

export interface Template {
  id: string;
  name: string;
  description?: string;
  property_type?: string;
  quality_tier?: string;
  is_active?: boolean;
  spaces_count?: number;
  components_count?: number;
}

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Fetch templates with optional search
  const fetchTemplates = useCallback(async (search: string = "") => {
    try {
      setLoadingTemplates(true);
      setTemplateError(null);

      const searchParams = new URLSearchParams();
      if (search) {
        searchParams.append("search", search);
      }

      const response = await fetch(
        `/api/quotations/templates?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setTemplateError(errorMessage);
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // Handle search
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      await fetchTemplates(query);
    },
    [fetchTemplates]
  );

  // Reset search
  const resetSearch = useCallback(() => {
    setSearchQuery("");
    setSelectedTemplateId(null);
  }, []);

  // Get selected template
  const getSelectedTemplate = useCallback(() => {
    if (!selectedTemplateId) return null;
    return templates.find((t) => t.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  return {
    // State
    templates,
    loadingTemplates,
    selectedTemplateId,
    loadingTemplate,
    searchQuery,
    templateError,

    // Setters
    setTemplates,
    setLoadingTemplates,
    setSelectedTemplateId,
    setLoadingTemplate,
    setSearchQuery,

    // Methods
    fetchTemplates,
    handleSearch,
    resetSearch,
    getSelectedTemplate,
  };
}
