/**
 * useAutoSave Hook
 * Manages auto-save functionality for forms
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface UseAutoSaveOptions {
  delay?: number; // Delay before saving (ms)
  onSave: () => Promise<void>;
  disabled?: boolean;
}

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSave({
  delay = 3000,
  onSave,
  disabled = false,
}: UseAutoSaveOptions) {
  const [hasChanges, setHasChanges] = useState(false);
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  // Mark as changed
  const markAsChanged = useCallback(() => {
    setHasChanges(true);
    setStatus("idle");
  }, []);

  // Trigger save
  const save = useCallback(async () => {
    if (isSavingRef.current || disabled) return;

    try {
      isSavingRef.current = true;
      setStatus("saving");
      setError(null);

      await onSave();

      setStatus("saved");
      setHasChanges(false);
      setLastSavedAt(new Date());

      // Reset saved status after 2 seconds
      setTimeout(() => {
        setStatus("idle");
      }, 2000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      isSavingRef.current = false;
    }
  }, [onSave, disabled]);

  // Auto-save effect
  useEffect(() => {
    if (!hasChanges || disabled) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      save();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [hasChanges, delay, save, disabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    hasChanges,
    status,
    lastSavedAt,
    error,
    isSaving: status === "saving",

    // Actions
    markAsChanged,
    save,
    clearError: () => setError(null),
  };
}
