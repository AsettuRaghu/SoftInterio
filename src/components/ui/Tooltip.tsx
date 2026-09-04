"use client";

/**
 * Instant hover tooltip.
 *
 * The native title attribute waits about a second before appearing, which on
 * small icon buttons reads as "there is no tooltip". This shows immediately.
 *
 * Rendered through a portal because the task tables sit inside
 * overflow-hidden containers, which would clip an absolutely positioned
 * tooltip at the row edge.
 */

import React, { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  label: React.ReactNode;
  children: React.ReactElement;
  placement?: "top" | "bottom";
  /** Skip rendering entirely (e.g. no message to show). */
  disabled?: boolean;
}

export function Tooltip({
  label,
  children,
  placement = "top",
  disabled = false,
}: TooltipProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (disabled || !label) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({
      top: placement === "top" ? rect.top - 8 : rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
  }, [disabled, label, placement]);

  const hide = useCallback(() => setCoords(null), []);

  return (
    <>
      <span
        ref={wrapperRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>

      {coords &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-9999 pointer-events-none px-2 py-1 rounded-md bg-slate-800 text-white text-[11px] font-medium whitespace-nowrap shadow-lg"
            style={{
              top: coords.top,
              left: coords.left,
              transform:
                placement === "top"
                  ? "translate(-50%, -100%)"
                  : "translate(-50%, 0)",
            }}
          >
            {label}
          </div>,
          document.body
        )}
    </>
  );
}

export default Tooltip;
