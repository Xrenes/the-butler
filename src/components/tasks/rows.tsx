"use client";

import { motion } from "motion/react";
import { Icon } from "@/components/icons/Icon";
import { CircleButton, StatusChip, readableOn } from "@/components/ui/primitives";
import { formatTime } from "@/lib/domain/dates";
import type { Category, Task } from "@/lib/domain/types";

const rowMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
} as const;

export function CategoryBadge({ category, size = 40 }: { category: Category; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[30%] shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_6px_14px_-6px_rgba(0,0,0,0.6)]"
      style={{ width: size, height: size, background: category.color, color: readableOn(category.color) }}
    >
      <Icon name={category.icon} size={Math.round(size * 0.48)} />
    </span>
  );
}

interface UpcomingRowProps {
  task: Task;
  category: Category;
  timeZone: string;
  onOpen: () => void;
}

/** Home list row: a raised card with category icon, name, time on the right and a chevron. */
export function UpcomingRow({ task, category, timeZone, onOpen }: UpcomingRowProps) {
  return (
    <motion.li layout {...rowMotion}>
      <button
        type="button"
        onClick={onOpen}
        className="surface-card group flex w-full items-center gap-3 rounded-[20px] px-3 py-2.5 text-left transition-[filter] hover:brightness-110"
      >
        <CategoryBadge category={category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{task.title}</span>
          <span className="block truncate text-xs text-fg-2">{category.name}</span>
        </span>
        <span className="text-sm tabular-nums">{formatTime(new Date(task.dueAt), timeZone)}</span>
        <Icon name="chevron-right" size={18} className="text-fg-3 transition-colors group-hover:text-fg" />
      </button>
    </motion.li>
  );
}

interface StatusRowProps {
  task: Task;
  category: Category;
  meta: string;
  onStatus: () => void;
  /** Opens the same editor used to create a task, filled in with this one. */
  onEdit: () => void;
  onRepeat?: () => void;
}

/** Checklist row as a raised card: status square, then time and title, which open the editor. */
export function StatusRow({ task, category, meta, onStatus, onEdit, onRepeat }: StatusRowProps) {
  const dimmed = task.status === "NC" || task.status === "H";
  return (
    <motion.li
      layout
      {...rowMotion}
      className="surface-card flex items-center gap-1 rounded-[20px] pr-2 pl-1 transition-[filter] hover:brightness-110"
    >
      <StatusChip status={task.status} label={`Change status of ${task.title}`} onClick={onStatus} />
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${task.title}`}
        className="group flex h-11 min-w-0 flex-1 items-center gap-1 rounded-xl text-left"
      >
        <span className="w-[clamp(4.25rem,18vw,5.5rem)] shrink-0 text-sm tabular-nums text-fg-2">{meta}</span>
        <span className={`min-w-0 flex-1 truncate ${dimmed ? "text-fg-2" : "text-fg"}`}>{task.title}</span>
        <span
          aria-hidden
          className="mx-1 h-2 w-2 shrink-0 rounded-full"
          style={{ background: category.color, boxShadow: `0 0 8px ${category.color}` }}
        />
        <Icon name="chevron-right" size={18} className="shrink-0 text-fg-3 transition-colors group-hover:text-fg" />
      </button>
      {onRepeat ? (
        <CircleButton
          icon="repeat"
          label={`Repeat ${task.title}`}
          size="sm"
          variant="ghost"
          className="ml-1"
          onClick={onRepeat}
        />
      ) : null}
    </motion.li>
  );
}
