'use client';

import { useState, useCallback } from 'react';

interface ModalStates {
  createCostItem: boolean;
  editCostItem: boolean;
  deleteCostItem: boolean;
  createPO: boolean;
  editPO: boolean;
  createVendor: boolean;
  editVendor: boolean;
  createBrand: boolean;
  editBrand: boolean;
}

/**
 * Hook for managing all stock module modal states
 */
export function useStockModals() {
  const [modals, setModals] = useState<ModalStates>({
    createCostItem: false,
    editCostItem: false,
    deleteCostItem: false,
    createPO: false,
    editPO: false,
    createVendor: false,
    editVendor: false,
    createBrand: false,
    editBrand: false,
  });

  const openModal = useCallback((modal: keyof ModalStates) => {
    setModals((prev) => ({ ...prev, [modal]: true }));
  }, []);

  const closeModal = useCallback((modal: keyof ModalStates) => {
    setModals((prev) => ({ ...prev, [modal]: false }));
  }, []);

  const toggleModal = useCallback((modal: keyof ModalStates) => {
    setModals((prev) => ({ ...prev, [modal]: !prev[modal] }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals({
      createCostItem: false,
      editCostItem: false,
      deleteCostItem: false,
      createPO: false,
      editPO: false,
      createVendor: false,
      editVendor: false,
      createBrand: false,
      editBrand: false,
    });
  }, []);

  return {
    modals,
    openModal,
    closeModal,
    toggleModal,
    closeAllModals,
  };
}
