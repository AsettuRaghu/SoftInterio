/**
 * useLeadFiltering Hook
 * Manages lead filtering, searching, and sorting logic
 */

import { useState, useCallback, useMemo } from "react";
import type { Lead, LeadStage } from "@/types/leads";
import { ACTIVE_LEAD_STAGES, TERMINAL_LEAD_STAGES } from "@/utils/leads";

export function useLeadFiltering(leads: Lead[]) {
  const [stageFilter, setStageFilter] = useState<"active" | "won" | "lost" | "disqualified">("active");
  const [searchValue, setSearchValue] = useState("");

  const filteredLeads = useMemo(() => {
    let result = leads;

    // Apply stage filter
    if (stageFilter === "active") {
      result = result.filter((lead) => ACTIVE_LEAD_STAGES.includes(lead.stage));
    } else {
      const stageMap: Record<"won" | "lost" | "disqualified", LeadStage> = {
        won: "won",
        lost: "lost",
        disqualified: "disqualified",
      };
      result = result.filter((lead) => lead.stage === stageMap[stageFilter]);
    }

    // Apply search filter
    if (searchValue) {
      const query = searchValue.toLowerCase();
      result = result.filter(
        (lead) =>
          lead.client?.name?.toLowerCase().includes(query) ||
          lead.client?.phone?.includes(query) ||
          lead.client?.email?.toLowerCase().includes(query) ||
          lead.property?.property_name?.toLowerCase().includes(query) ||
          lead.property?.address_line1?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [leads, stageFilter, searchValue]);

  const resetFilters = useCallback(() => {
    setStageFilter("active");
    setSearchValue("");
  }, []);

  const hasActiveFilters = stageFilter !== "active" || searchValue !== "";

  return {
    // State
    stageFilter,
    searchValue,
    filteredLeads,
    hasActiveFilters,

    // Setters
    setStageFilter,
    setSearchValue,
    resetFilters,

    // Stats
    totalCount: leads.length,
    filteredCount: filteredLeads.length,
    activeCount: leads.filter((l) => ACTIVE_LEAD_STAGES.includes(l.stage)).length,
    wonCount: leads.filter((l) => l.stage === "won").length,
    lostCount: leads.filter((l) => l.stage === "lost").length,
  };
}
