import { type DayKey, dayKeyOf } from "./dates";
import type { Reminder, Task, TaskStatus } from "./types";

export interface TaskDraft {
  title: string;
  description: string;
  categoryId: string;
  dueAt: Date;
  reminder: Reminder;
  durationMinutes?: number;
}

/** Used wherever a task has no duration of its own (older tasks, web demo). */
export const DEFAULT_DURATION_MINUTES = 30;

export function durationOf(task: Task): number {
  return task.durationMinutes ?? DEFAULT_DURATION_MINUTES;
}

function durationField(draft: TaskDraft): { durationMinutes?: number } {
  return draft.durationMinutes ? { durationMinutes: draft.durationMinutes } : {};
}

export interface DayGroup {
  day: DayKey;
  tasks: Task[];
}

export interface CategoryView {
  upcoming: Task[];
  history: Task[];
  stats: { done: number; hold: number; missed: number };
}

const FUTURE_GRACE_MS = 60_000;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;

export function validateDraft(
  draft: TaskDraft,
  now: Date,
  options: { requireFuture: boolean },
): string | null {
  const title = draft.title.trim();
  if (title.length === 0) return "Give the task a name.";
  if (title.length > MAX_TITLE_LENGTH) return `Keep the name under ${MAX_TITLE_LENGTH} characters.`;
  if (draft.description.length > MAX_DESCRIPTION_LENGTH) return "The description is too long.";
  if (!draft.categoryId) return "Pick a category.";
  if (Number.isNaN(draft.dueAt.getTime())) return "Pick a valid date and time.";
  if (options.requireFuture && draft.dueAt.getTime() < now.getTime() - FUTURE_GRACE_MS) {
    return "Pick a time in the future.";
  }
  return null;
}

export function createTask(
  draft: TaskDraft,
  id: string,
  now: Date,
  sourceTaskId: string | null = null,
): Task {
  const stamp = now.toISOString();
  return {
    kind: "task",
    id,
    title: draft.title.trim(),
    description: draft.description.trim(),
    categoryId: draft.categoryId,
    dueAt: draft.dueAt.toISOString(),
    status: "pending",
    statusChangedAt: null,
    reminder: { ...draft.reminder },
    ...durationField(draft),
    sourceTaskId,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function updateTask(task: Task, draft: TaskDraft, now: Date): Task {
  return {
    ...task,
    title: draft.title.trim(),
    description: draft.description.trim(),
    categoryId: draft.categoryId,
    dueAt: draft.dueAt.toISOString(),
    reminder: { ...draft.reminder },
    ...durationField(draft),
    updatedAt: now.toISOString(),
  };
}

/** Repeating never touches the original: it creates a new task linked by `sourceTaskId`. */
export function repeatTask(source: Task, draft: TaskDraft, id: string, now: Date): Task {
  return createTask(draft, id, now, source.id);
}

export function draftFromTask(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    categoryId: task.categoryId,
    dueAt: new Date(task.dueAt),
    reminder: { ...task.reminder },
    ...(task.durationMinutes ? { durationMinutes: task.durationMinutes } : {}),
  };
}

export function changesDueTime(task: Task, draft: TaskDraft): boolean {
  return task.dueAt !== draft.dueAt.toISOString();
}

export function withStatus(task: Task, status: TaskStatus, now: Date): Task {
  if (task.status === status) return task;
  const stamp = now.toISOString();
  return {
    ...task,
    status,
    statusChangedAt: status === "pending" ? null : stamp,
    updatedAt: stamp,
  };
}

export function isOverdue(task: Task, now: Date): boolean {
  return task.status === "pending" && new Date(task.dueAt).getTime() < now.getTime();
}

/** ISO strings from toISOString() share one format, so string order equals time order. */
export function sortByDue(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function groupByDay(tasks: readonly Task[], timeZone: string): DayGroup[] {
  return sortByDue(tasks).reduce<DayGroup[]>((groups, task) => {
    const day = dayKeyOf(new Date(task.dueAt), timeZone);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      return [...groups.slice(0, -1), { day, tasks: [...last.tasks, task] }];
    }
    return [...groups, { day, tasks: [task] }];
  }, []);
}

/** Home list: pending tasks from today onward, including ones that slipped past earlier today. */
export function upcomingTasks(tasks: readonly Task[], now: Date, timeZone: string): Task[] {
  const today = dayKeyOf(now, timeZone);
  return sortByDue(
    tasks.filter(
      (task) => task.status === "pending" && dayKeyOf(new Date(task.dueAt), timeZone) >= today,
    ),
  );
}

export function tasksOnDay(tasks: readonly Task[], day: DayKey, timeZone: string): Task[] {
  return sortByDue(tasks.filter((task) => dayKeyOf(new Date(task.dueAt), timeZone) === day));
}

export function categoryView(tasks: readonly Task[], categoryId: string, now: Date): CategoryView {
  const nowMs = now.getTime();
  const mine = tasks.filter((task) => task.categoryId === categoryId);
  const isUpcoming = (task: Task): boolean =>
    task.status === "pending" && new Date(task.dueAt).getTime() >= nowMs;
  return {
    upcoming: sortByDue(mine.filter(isUpcoming)),
    history: sortByDue(mine.filter((task) => !isUpcoming(task))).reverse(),
    stats: {
      done: mine.filter((task) => task.status === "C").length,
      hold: mine.filter((task) => task.status === "H").length,
      missed: mine.filter((task) => task.status === "NC").length,
    },
  };
}
