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

export type PlannedAlarmKind = "start" | "end" | "snooze";

export interface PlannedAlarm {
  /** The same for the same alarm on every call, so a re-sync keeps an alarm instead of re-creating it. */
  key: string;
  task: Task;
  kind: PlannedAlarmKind;
  /** Whether it is (or, for a snooze, repeats) the end-of-task alarm. */
  end: boolean;
  fireAt: Date;
}

/**
 * Every alarm the phone should be holding, earliest first: the start and end alarms of pending
 * tasks, with a snoozed alarm replaced by its snooze and a dismissed one left out. Alarms that fired
 * less than `keepPastMs` ago stay in the plan, so a sync never cancels an alarm while it is ringing.
 */
export function planAlarms(
  tasks: readonly Task[],
  now: Date,
  memory: AlarmMemory = EMPTY_ALARM_MEMORY,
  keepPastMs = 0,
): PlannedAlarm[] {
  const fromMs = now.getTime() - keepPastMs;
  return tasks
    .filter((task) => task.status === "pending")
    .flatMap((task) => {
      const candidates = [
        ...(task.reminder.enabled ? [{ key: alarmKey(task), end: false, fireAt: reminderFireAt(task) }] : []),
        ...(task.reminder.atEnd ? [{ key: endAlarmKey(task), end: true, fireAt: endsAt(task) }] : []),
      ];
      return candidates.flatMap(({ key, end, fireAt }): PlannedAlarm[] => {
        if (memory.dismissed.has(key)) return [];
        const snoozedUntil = memory.snoozedUntil.get(key);
        if (snoozedUntil !== undefined) {
          return [{ key: `${key}|snooze|${snoozedUntil}`, task, kind: "snooze", end, fireAt: new Date(snoozedUntil) }];
        }
        return [{ key, task, kind: end ? "end" : "start", end, fireAt }];
      });
    })
    .filter((alarm) => alarm.fireAt.getTime() > fromMs)
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime() || a.key.localeCompare(b.key));
}

/** The person's answers to alarms, kept on the device: alarm key to when it was dismissed or snoozed until. */
export interface StoredAlarmMemory {
  dismissed: Readonly<Record<string, number>>;
  snoozed: Readonly<Record<string, number>>;
}

export const EMPTY_STORED_ALARM_MEMORY: StoredAlarmMemory = { dismissed: {}, snoozed: {} };

/** A dismissal only matters while its alarm could still ring, which is well under a day. */
const DISMISSAL_TTL_MS = 24 * MINUTES_PER_HOUR * MS_PER_MINUTE;

export function toAlarmMemory(stored: StoredAlarmMemory): AlarmMemory {
  return {
    dismissed: new Set(Object.keys(stored.dismissed)),
    snoozedUntil: new Map(Object.entries(stored.snoozed)),
  };
}

/** Forgets answers that can no longer matter: expired snoozes and day-old dismissals. */
export function pruneStoredAlarmMemory(stored: StoredAlarmMemory, now: Date): StoredAlarmMemory {
  const nowMs = now.getTime();
  const keep = (record: Readonly<Record<string, number>>, isLive: (value: number) => boolean) =>
    Object.fromEntries(Object.entries(record).filter(([, value]) => isLive(value)));
  return {
    dismissed: keep(stored.dismissed, (at) => at >= nowMs - DISMISSAL_TTL_MS),
    snoozed: keep(stored.snoozed, (until) => until >= nowMs - ALARM_GRACE_MS),
  };
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
