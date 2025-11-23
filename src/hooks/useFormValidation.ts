import { useState, useCallback } from "react";

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  message?: string;
}

interface FormValidation {
  [key: string]: ValidationRule[];
}

interface UseFormValidationReturn<T> {
  errors: { [key: string]: string };
  validateField: (fieldName: string, value: string) => boolean;
  validateForm: (formData: T) => boolean;
  clearError: (fieldName: string) => void;
  clearAllErrors: () => void;
}

export function useFormValidation<T extends Record<string, string>>(
  validation: FormValidation
): UseFormValidationReturn<T> {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateField = useCallback(
    (fieldName: string, value: string): boolean => {
      const rules = validation[fieldName] || [];

      for (const rule of rules) {
        if (rule.required && !value.trim()) {
          setErrors((prev) => ({
            ...prev,
            [fieldName]: rule.message || `${fieldName} is required`,
          }));
          return false;
        }

        if (rule.minLength && value.length < rule.minLength) {
          setErrors((prev) => ({
            ...prev,
            [fieldName]:
              rule.message ||
              `${fieldName} must be at least ${rule.minLength} characters`,
          }));
          return false;
        }

        if (rule.maxLength && value.length > rule.maxLength) {
          setErrors((prev) => ({
            ...prev,
            [fieldName]:
              rule.message ||
              `${fieldName} must be no more than ${rule.maxLength} characters`,
          }));
          return false;
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          setErrors((prev) => ({
            ...prev,
            [fieldName]: rule.message || `${fieldName} format is invalid`,
          }));
          return false;
        }
      }

      // Clear error if validation passes
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });

      return true;
    },
    [validation]
  );

  const validateForm = useCallback(
    (formData: T): boolean => {
      let isValid = true;
      const newErrors: { [key: string]: string } = {};

      for (const [fieldName, value] of Object.entries(formData)) {
        const rules = validation[fieldName] || [];

        for (const rule of rules) {
          if (rule.required && !value.trim()) {
            newErrors[fieldName] = rule.message || `${fieldName} is required`;
            isValid = false;
            break;
          }

          if (rule.minLength && value.length < rule.minLength) {
            newErrors[fieldName] =
              rule.message ||
              `${fieldName} must be at least ${rule.minLength} characters`;
            isValid = false;
            break;
          }

          if (rule.maxLength && value.length > rule.maxLength) {
            newErrors[fieldName] =
              rule.message ||
              `${fieldName} must be no more than ${rule.maxLength} characters`;
            isValid = false;
            break;
          }

          if (rule.pattern && !rule.pattern.test(value)) {
            newErrors[fieldName] =
              rule.message || `${fieldName} format is invalid`;
            isValid = false;
            break;
          }
        }
      }

      setErrors(newErrors);
      return isValid;
    },
    [validation]
  );

  const clearError = useCallback((fieldName: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    errors,
    validateField,
    validateForm,
    clearError,
    clearAllErrors,
  };
}
