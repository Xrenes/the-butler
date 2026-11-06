/**
 * On-screen alarms: which reminders are due right now. Pure, so the timing rules can be tested.
 * Telegram delivery is separate and lives on the server.
 */
import { durationOf } from "./tasks";
import type { Task } from "./types";

const MS_PER_MINUTE = 60_000;
/** An alarm stays up to this long after the due time; after that the task is simply overdue. */
export const ALARM_GRACE_MS = 30 * MS_PER_MINUTE;
export const SNOOZE_MINUTES = 5;
const MINUTES_PER_HOUR = 60;

/** What the person has already answered this session. Keys come from `alarmKey`. */
export interface AlarmMemory {
  dismissed: ReadonlySet<string>;
  snoozedUntil: ReadonlyMap<string, number>;
}

export const EMPTY_ALARM_MEMORY: AlarmMemory = { dismissed: new Set(), snoozedUntil: new Map() };

/** Changing the due time or the lead time makes a new alarm, so an edited task can ring again. */
export function alarmKey(task: Task): string {
  return `${task.id}|${task.dueAt}|${task.reminder.leadMinutes}`;
}

export function reminderFireAt(task: Task): Date {
  return new Date(new Date(task.dueAt).getTime() - task.reminder.leadMinutes * MS_PER_MINUTE);
}

/**
 * Pending tasks whose reminder time has arrived, earliest first.
 * A task saved after its own reminder time had already passed does not ring: nothing was missed.
 */
export function dueAlarms(tasks: readonly Task[], now: Date, memory: AlarmMemory): Task[] {
  const nowMs = now.getTime();
  return tasks
    .filter((task) => {
      if (task.status !== "pending" || !task.reminder.enabled) return false;
      const key = alarmKey(task);
      if (memory.dismissed.has(key)) return false;
      const snoozedUntil = memory.snoozedUntil.get(key);
      if (snoozedUntil !== undefined) return snoozedUntil <= nowMs;
      const fireMs = reminderFireAt(task).getTime();
      if (fireMs > nowMs) return false;
      if (new Date(task.updatedAt).getTime() > fireMs) return false;
      return nowMs <= new Date(task.dueAt).getTime() + ALARM_GRACE_MS;
    })
    .sort((a, b) => reminderFireAt(a).getTime() - reminderFireAt(b).getTime() || a.title.localeCompare(b.title));
}

/** When the task's duration is over. */
export function endsAt(task: Task): Date {
  return new Date(new Date(task.dueAt).getTime() + durationOf(task) * MS_PER_MINUTE);
}

/** Separate from the start alarm's key, and changes when the time or duration changes. */
export function endAlarmKey(task: Task): string {
  return `${task.id}|${task.dueAt}|end|${durationOf(task)}`;
}

/** Pending tasks with an end alarm whose end time has arrived, earliest first. */
export function dueEndAlarms(tasks: readonly Task[], now: Date, memory: AlarmMemory): Task[] {
  const nowMs = now.getTime();
  return tasks
    .filter((task) => {
      if (task.status !== "pending" || !task.reminder.atEnd) return false;
      const key = endAlarmKey(task);
      if (memory.dismissed.has(key)) return false;
      const snoozedUntil = memory.snoozedUntil.get(key);
      if (snoozedUntil !== undefined) return snoozedUntil <= nowMs;
      const endMs = endsAt(task).getTime();
      if (endMs > nowMs) return false;
      if (new Date(task.updatedAt).getTime() > endMs) return false;
      return nowMs <= endMs + ALARM_GRACE_MS;
    })
    .sort((a, b) => endsAt(a).getTime() - endsAt(b).getTime() || a.title.localeCompare(b.title));
}

/** "Due in 10 min", "Due now" or "5 min overdue". */
export function dueCountdown(task: Task, now: Date): string {
  const dueMs = new Date(task.dueAt).getTime();
  const minutesLeft = Math.ceil((dueMs - now.getTime()) / MS_PER_MINUTE);
  if (minutesLeft > 0) return `Due in ${minutesLeft} min`;
  const minutesLate = Math.floor((now.getTime() - dueMs) / MS_PER_MINUTE);
  return minutesLate < 1 ? "Due now" : `${minutesLate} min overdue`;
}

/** How far ahead the reminder fires, e.g. "At the time" or "10 min before". */
export function describeLead(leadMinutes: number): string {
  if (leadMinutes === 0) return "At the time";
  if (leadMinutes === MINUTES_PER_HOUR) return "1 hour before";
  return `${leadMinutes} min before`;
}
