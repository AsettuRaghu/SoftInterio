"use client";

/**
 * The card an Overview tab is made of, and the field inside it.
 *
 * The lead's Overview and the project's Overview are built from exactly the
 * same eight classes - a white `rounded-lg` card, a tinted gradient strip
 * across the top, a small square icon badge, a bold title - written out by hand
 * in both. This is that card, so a third page copies a component instead of the
 * classes, and so restyling Overview means editing one file.
 *
 * `tone` is the strip and badge colour. It carries no meaning beyond telling one
 * card from the next down a long page - the lead and project pages read blue,
 * purple, green in that order - so pick by position, not by severity. Semantic
 * colour on a detail page belongs on a `StatusPill`, not on the furniture.
 *
 * The lead and project Overviews still hold their own copies; they are long,
 * working, and were not worth rewriting in the same change that introduced
 * this. Migrate them when one of them is next touched.
 */

import React from "react";
import { cn } from "@/utils/cn";

type Tone = "blue" | "purple" | "green" | "amber" | "violet" | "slate";

const TONE: Record<Tone, { strip: string; badge: string }> = {
  blue: { strip: "from-blue-50 to-blue-50", badge: "bg-blue-500" },
  purple: { strip: "from-purple-50 to-purple-50", badge: "bg-purple-500" },
  green: { strip: "from-green-50 to-green-50", badge: "bg-green-500" },
  amber: { strip: "from-amber-50 to-amber-50", badge: "bg-amber-500" },
  violet: { strip: "from-violet-50 to-violet-50", badge: "bg-violet-500" },
  slate: { strip: "from-slate-50 to-slate-50", badge: "bg-slate-400" },
};

export function DetailCard({
  title,
  icon,
  tone = "blue",
  action,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  /** A heroicon at `w-3 h-3`; it sits in a 20px badge. */
  icon?: React.ReactNode;
  tone?: Tone;
  /** A button or link on the right of the strip. */
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div className={cn("bg-white rounded-lg border border-slate-200 overflow-hidden", className)}>
      <div
        className={cn(
          "bg-linear-to-r px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3",
          t.strip
        )}
      >
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          {icon && (
            <div className={cn("w-5 h-5 rounded-lg text-white flex items-center justify-center shrink-0", t.badge)}>
              {icon}
            </div>
          )}
          {title}
        </h3>
        {action}
      </div>
      <div className={cn("px-4 py-4", bodyClassName)}>{children}</div>
    </div>
  );
}

/**
 * One fact in a card: "Phone : 98765 43210".
 *
 * The separated colon is how the lead and project Overviews read, and it is
 * what makes a two- or three-column grid of facts scannable without rules
 * between them. An em dash stands in for a value nobody has filled, because a
 * blank reads as a broken layout.
 */
export function DetailField({
  label,
  value,
  href,
  className,
}: {
  label: string;
  value?: React.ReactNode;
  /** Renders the value as a link - a tel:, mailto: or an internal record. */
  href?: string | null;
  className?: string;
}) {
  const empty = value == null || value === "" || (typeof value === "string" && !value.trim());
  return (
    <div className={className}>
      <p className="text-sm font-medium text-slate-900 break-words">
        <span className="text-slate-500">{label}</span>{" "}:{" "}
        {empty ? (
          <span className="text-slate-300">—</span>
        ) : href ? (
          <a href={href} className="text-blue-600 hover:underline break-all">
            {value}
          </a>
        ) : (
          value
        )}
      </p>
    </div>
  );
}

/** The grid the fields sit in - the same one both Overview tabs use. */
export function DetailFields({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)}>{children}</div>
  );
}

export default DetailCard;
