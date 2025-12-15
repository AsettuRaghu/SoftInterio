"use client";

interface ProcessingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export function ProcessingOverlay({
  isVisible,
  message = "Processing...",
}: ProcessingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-60">
      <div className="bg-white rounded-xl p-6 shadow-xl flex items-center gap-4">
        <svg
          className="w-6 h-6 animate-spin text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-sm font-medium text-slate-700">{message}</span>
      </div>
    </div>
  );
}
