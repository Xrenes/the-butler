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
      className="grid shrink-0 place-items-center rounded-full ring-1 ring-line"
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

/** Home list row: category icon, name, time on the right, chevron. */
export function UpcomingRow({ task, category, timeZone, onOpen }: UpcomingRowProps) {
  return (
    <motion.li layout {...rowMotion}>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2"
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
  onRepeat?: () => void;
}

/** Checklist row in the style of the reference: status square, time column, title. */
export function StatusRow({ task, category, meta, onStatus, onRepeat }: StatusRowProps) {
  const dimmed = task.status === "NC" || task.status === "H";
  return (
    <motion.li
      layout
      {...rowMotion}
      className="flex items-center gap-1 rounded-2xl pr-1 transition-colors hover:bg-surface-2/60"
    >
      <StatusChip status={task.status} label={`Change status of ${task.title}`} onClick={onStatus} />
      <span className="w-[clamp(4.25rem,18vw,5.5rem)] shrink-0 text-sm tabular-nums text-fg-2">{meta}</span>
      <span className={`min-w-0 flex-1 truncate ${dimmed ? "text-fg-2" : "text-fg"}`}>{task.title}</span>
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full ring-1 ring-line"
        style={{ background: category.color }}
      />
      {onRepeat ? (
        <CircleButton
          icon="repeat"
          label={`Repeat ${task.title}`}
          size="sm"
          variant="ghost"
          className="ml-2"
          onClick={onRepeat}
        />
      ) : (
        <span className="w-2" />
      )}
    </motion.li>
  );
}
