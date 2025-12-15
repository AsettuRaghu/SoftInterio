/**
 * useLeadModals Hook
 * Manages all modal visibility states for lead pages
 */

import { useState, useCallback } from "react";

export function useLeadModals() {
  // List page modals
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Detail page modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);

  // Toggle functions
  const toggleCreateModal = useCallback(() => {
    setShowCreateModal((prev) => !prev);
  }, []);

  const toggleEditModal = useCallback(() => {
    setShowEditModal((prev) => !prev);
  }, []);

  const toggleNoteModal = useCallback(() => {
    setShowNoteModal((prev) => !prev);
  }, []);

  const toggleMeetingModal = useCallback(() => {
    setShowMeetingModal((prev) => !prev);
  }, []);

  const toggleDocumentModal = useCallback(() => {
    setShowDocumentModal((prev) => !prev);
  }, []);

  const toggleStageModal = useCallback(() => {
    setShowStageModal((prev) => !prev);
  }, []);

  // Close all modals
  const closeAllModals = useCallback(() => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowNoteModal(false);
    setShowMeetingModal(false);
    setShowDocumentModal(false);
    setShowStageModal(false);
  }, []);

  return {
    // Create modal
    showCreateModal,
    setShowCreateModal,
    toggleCreateModal,

    // Edit modal
    showEditModal,
    setShowEditModal,
    toggleEditModal,

    // Note modal
    showNoteModal,
    setShowNoteModal,
    toggleNoteModal,

    // Meeting modal
    showMeetingModal,
    setShowMeetingModal,
    toggleMeetingModal,

    // Document modal
    showDocumentModal,
    setShowDocumentModal,
    toggleDocumentModal,

    // Stage modal
    showStageModal,
    setShowStageModal,
    toggleStageModal,

    // Utility
    closeAllModals,
  };
}
