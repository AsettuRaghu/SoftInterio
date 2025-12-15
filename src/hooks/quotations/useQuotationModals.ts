/**
 * useQuotationModals Hook
 * Manages all modal visibility states for quotation pages
 */

import { useState, useCallback } from "react";

export function useQuotationModals() {
  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Edit page modals
  const [showAddSpaceModal, setShowAddSpaceModal] = useState(false);
  const [showAddComponentModal, setShowAddComponentModal] = useState<
    string | null
  >(null);
  const [showAddCostItemModal, setShowAddCostItemModal] = useState<{
    spaceId: string;
    componentId: string;
  } | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [showPricingScenariosModal, setShowPricingScenariosModal] =
    useState(false);

  // Toggle functions
  const toggleCreateModal = useCallback(() => {
    setShowCreateModal((prev) => !prev);
  }, []);

  const toggleAddSpaceModal = useCallback(() => {
    setShowAddSpaceModal((prev) => !prev);
  }, []);

  const openAddComponentModal = useCallback((spaceId: string) => {
    setShowAddComponentModal(spaceId);
  }, []);

  const closeAddComponentModal = useCallback(() => {
    setShowAddComponentModal(null);
  }, []);

  const openAddCostItemModal = useCallback(
    (spaceId: string, componentId: string) => {
      setShowAddCostItemModal({ spaceId, componentId });
    },
    []
  );

  const closeAddCostItemModal = useCallback(() => {
    setShowAddCostItemModal(null);
  }, []);

  const toggleTemplateModal = useCallback(() => {
    setShowTemplateModal((prev) => !prev);
  }, []);

  const toggleNewVersionModal = useCallback(() => {
    setShowNewVersionModal((prev) => !prev);
  }, []);

  const togglePricingScenariosModal = useCallback(() => {
    setShowPricingScenariosModal((prev) => !prev);
  }, []);

  // Close all modals
  const closeAllModals = useCallback(() => {
    setShowCreateModal(false);
    setShowAddSpaceModal(false);
    setShowAddComponentModal(null);
    setShowAddCostItemModal(null);
    setShowTemplateModal(false);
    setShowNewVersionModal(false);
    setShowPricingScenariosModal(false);
  }, []);

  return {
    // Create modal
    showCreateModal,
    setShowCreateModal,
    toggleCreateModal,

    // Add space modal
    showAddSpaceModal,
    setShowAddSpaceModal,
    toggleAddSpaceModal,

    // Add component modal
    showAddComponentModal,
    openAddComponentModal,
    closeAddComponentModal,

    // Add cost item modal
    showAddCostItemModal,
    openAddCostItemModal,
    closeAddCostItemModal,

    // Template modal
    showTemplateModal,
    setShowTemplateModal,
    toggleTemplateModal,

    // New version modal
    showNewVersionModal,
    setShowNewVersionModal,
    toggleNewVersionModal,

    // Pricing scenarios modal
    showPricingScenariosModal,
    setShowPricingScenariosModal,
    togglePricingScenariosModal,

    // Utility
    closeAllModals,
  };
}
