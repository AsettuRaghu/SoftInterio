"use client";

/**
 * One notification, drawn the same way in the bell, the slider and the page.
 * A kind's tone colours the glyph; unread rows carry a blue dot and a faint
 * wash. Clicking marks it read and follows its link.
 */

import React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUturnLeftIcon,
  BellIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  DocumentCheckIcon,
  HomeModernIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  RocketLaunchIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { NOTIFICATION_KINDS, isNotificationKind } from "@/lib/notifications/kinds";
import type { AppNotification } from "@/types/notifications";
import { useNotifications } from "./NotificationsProvider";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  task_assigned: ClipboardDocumentListIcon,
  task_completed: CheckCircleIcon,
  task_reopened: ArrowUturnLeftIcon,
  lead_assigned: UserPlusIcon,
  quotation_approved: DocumentCheckIcon,
  lead_converted: RocketLaunchIcon,
  project_assigned: BriefcaseIcon,
  project_held: PauseCircleIcon,
  project_resumed: PlayCircleIcon,
  scope_changed: HomeModernIcon,
};

const TONES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-500",
};

export function kindGlyph(kind: string) {
  const Icon = ICONS[kind] ?? BellIcon;
  const tone = isNotificationKind(kind) ? NOTIFICATION_KINDS[kind].tone : "slate";
  return { Icon, toneClass: TONES[tone] ?? TONES.slate };
}

/** "just now", "4m", "2h", "3d", then a date. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function NotificationRow({
  n,
  compact = false,
  onNavigate,
  showRemove = false,
  onRemoved,
}: {
  n: AppNotification;
  compact?: boolean;
  onNavigate?: () => void;
  showRemove?: boolean;
  onRemoved?: () => void;
}) {
  const router = useRouter();
  const { markRead, remove } = useNotifications();
  const { Icon, toneClass } = kindGlyph(n.type);

  const open = async () => {
    if (!n.is_read) void markRead([n.id]);
    onNavigate?.();
    if (n.action_url) router.push(n.action_url);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void open();
        }
      }}
      className={cn(
        "group relative flex items-start gap-3 text-left w-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        compact ? "px-4 py-2.5" : "px-5 py-3.5",
        n.is_read ? "hover:bg-slate-50" : "bg-blue-50/40 hover:bg-blue-50/70",
      )}
    >
      <span className={cn("shrink-0 rounded-full flex items-center justify-center", compact ? "w-8 h-8 mt-0.5" : "w-9 h-9", toneClass)}>
        <Icon className={compact ? "w-4 h-4" : "w-[18px] h-[18px]"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cn("truncate text-sm", n.is_read ? "text-slate-700" : "font-semibold text-slate-900")}>{n.title}</span>
          <span className="ml-auto shrink-0 text-[11px] text-slate-400 tabular-nums">{timeAgo(n.created_at)}</span>
        </span>
        <span className={cn("block text-slate-600 leading-snug", compact ? "text-xs mt-0.5 line-clamp-2" : "text-sm mt-0.5")}>{n.message}</span>
        {!compact && n.triggered_user?.name && (
          <span className="block text-[11px] text-slate-400 mt-1">by {n.triggered_user.name}</span>
        )}
      </span>
      {!n.is_read && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-600" aria-label="Unread" />}
      {showRemove && (
        <button
          type="button"
          title="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemoved?.();
            void remove(n.id);
          }}
          className="absolute right-3 top-3 hidden group-hover:flex w-6 h-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
