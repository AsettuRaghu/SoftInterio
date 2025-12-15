/**
 * useQuotationForm Hook
 * Manages basic quotation form state
 */

import { useState, useCallback } from "react";

export interface UseQuotationFormOptions {
  initialQuotationNumber?: string;
  initialQuotationName?: string;
  initialValidUntil?: string;
  initialNotes?: string;
  initialTaxPercent?: number;
}

export function useQuotationForm(options: UseQuotationFormOptions = {}) {
  const {
    initialQuotationNumber = "",
    initialQuotationName = "",
    initialValidUntil = "",
    initialNotes = "",
    initialTaxPercent = 18,
  } = options;

  const [quotationNumber, setQuotationNumber] = useState(
    initialQuotationNumber
  );
  const [quotationName, setQuotationName] = useState(initialQuotationName);
  const [validUntil, setValidUntil] = useState(initialValidUntil);
  const [notes, setNotes] = useState(initialNotes);
  const [taxPercent, setTaxPercent] = useState(initialTaxPercent);

  // Check if form has unsaved changes
  const hasChanges =
    quotationNumber !== initialQuotationNumber ||
    quotationName !== initialQuotationName ||
    validUntil !== initialValidUntil ||
    notes !== initialNotes ||
    taxPercent !== initialTaxPercent;

  // Reset form to initial values
  const resetForm = useCallback(() => {
    setQuotationNumber(initialQuotationNumber);
    setQuotationName(initialQuotationName);
    setValidUntil(initialValidUntil);
    setNotes(initialNotes);
    setTaxPercent(initialTaxPercent);
  }, [
    initialQuotationNumber,
    initialQuotationName,
    initialValidUntil,
    initialNotes,
    initialTaxPercent,
  ]);

  // Clear form
  const clearForm = useCallback(() => {
    setQuotationNumber("");
    setQuotationName("");
    setValidUntil("");
    setNotes("");
    setTaxPercent(18);
  }, []);

  // Get form data as object
  const getFormData = useCallback(
    () => ({
      quotationNumber,
      quotationName,
      validUntil,
      notes,
      taxPercent,
    }),
    [quotationNumber, quotationName, validUntil, notes, taxPercent]
  );

  // Set all form values at once
  const setFormData = useCallback(
    (data: Partial<ReturnType<typeof getFormData>>) => {
      if (data.quotationNumber !== undefined)
        setQuotationNumber(data.quotationNumber);
      if (data.quotationName !== undefined)
        setQuotationName(data.quotationName);
      if (data.validUntil !== undefined) setValidUntil(data.validUntil);
      if (data.notes !== undefined) setNotes(data.notes);
      if (data.taxPercent !== undefined) setTaxPercent(data.taxPercent);
    },
    []
  );

  return {
    // Form fields
    quotationNumber,
    quotationName,
    validUntil,
    notes,
    taxPercent,

    // Field setters
    setQuotationNumber,
    setQuotationName,
    setValidUntil,
    setNotes,
    setTaxPercent,

    // Form state
    hasChanges,

    // Form methods
    resetForm,
    clearForm,
    getFormData,
    setFormData,
  };
}
