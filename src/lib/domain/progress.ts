import { type DayKey, addDays, dayKeyOf, formatDayMonth } from "./dates";
import type { Task } from "./types";

const DAYS_PER_LABEL = 7;

/** Completed tasks per day for the `days` days ending on `endDay` (oldest first). */
export function completedPerDay(
  tasks: readonly Task[],
  endDay: DayKey,
  days: number,
  timeZone: string,
): number[] {
  const start = addDays(endDay, -(days - 1));
  const counts = new Map<DayKey, number>();
  for (const task of tasks) {
    if (task.status !== "C") continue;
    const day = dayKeyOf(new Date(task.dueAt), timeZone);
    if (day < start || day > endDay) continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, index) => counts.get(addDays(start, index)) ?? 0);
}

/** One axis label per week, aligned with `completedPerDay`. */
export function weeklyLabels(endDay: DayKey, days: number): string[] {
  const start = addDays(endDay, -(days - 1));
  return Array.from({ length: days }, (_, index) =>
    index % DAYS_PER_LABEL === 0 ? formatDayMonth(addDays(start, index)) : "",
  );
}

export interface Progress {
  done: number;
  total: number;
  percent: number;
}

/** Only Completed counts toward the numerator; NC, H and pending stay in the denominator. */
export function progressOf(tasks: readonly Task[]): Progress {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "C").length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}

export function motivationLine(progress: Progress): string {
  if (progress.total === 0) return "A clear day. Plan one thing that moves you forward.";
  if (progress.percent === 100) return "Everything done. That is how momentum is built.";
  if (progress.percent >= 60) return "Strong pace. Finish the last few and own the day.";
  if (progress.done > 0) return "Good start. Keep stacking small wins.";
  return "Start with the easiest task and build from there.";
}
