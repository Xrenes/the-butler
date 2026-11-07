import { Platform } from "react-native";
import { ALARM_GRACE_MS, type PlannedAlarm, type StoredAlarmMemory, planAlarms, toAlarmMemory } from "@domain/alarms";
import { formatTime } from "@domain/dates";
import type { Category, Task } from "@domain/types";
import { type NativeSyncReport, syncNativeAlarms } from "../../modules/butler-alarms";
import { TIME_ZONE } from "../store";
import { type AlarmHealth, type AlarmMode, publishHealth } from "./health";
import { type NotificationAlarm, ensureAlarmChannel, syncNotifications } from "./notify";
import { readPermissions } from "./permissions";

export interface AlarmSyncInput {
  tasks: readonly Task[];
  categories: readonly Category[];
  /** Settings → Phone alarm. */
  enabled: boolean;
  memory: StoredAlarmMemory;
}

/** AlarmKit has an undocumented cap on alarms per app; shipping apps keep to 30. */
const MAX_REAL_ALARMS = 30;
/** iOS keeps at most 64 pending notifications per app. */
const MAX_NOTIFICATIONS = 60;
/** Without a real alarm, a missed notification is repeated after 1 and 3 minutes. */
const FOLLOW_UPS_MINUTES = [1, 3] as const;
const NO_FOLLOW_UPS: readonly number[] = [];
/** A sync that reported errors is tried again a little later, a couple of times. */
const RETRY_AFTER_MS = 30_000;
const MAX_RETRIES = 2;

/** One ring, with the words for the real alarm and for its notification. */
interface Ring {
  /** Changes whenever the alarm's time or wording changes, so only changed alarms are re-created. */
  id: string;
  fireAt: Date;
  alarmTitle: string;
  title: string;
  body: string;
  tint?: string;
  taskId: string | null;
}

let lastInput: AlarmSyncInput | null = null;
let testRing: Ring | null = null;
let queue: Promise<unknown> = Promise.resolve();
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retriesUsed = 0;

/** After a sync with errors, tries again later; a clean sync resets the count. */
function retryIfNeeded(health: AlarmHealth): void {
  if (health.errors.length === 0) {
    retriesUsed = 0;
    return;
  }
  if (retryTimer || retriesUsed >= MAX_RETRIES) return;
  retriesUsed += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    resyncAlarms().catch(() => undefined);
  }, RETRY_AFTER_MS);
}

/** Short, stable fingerprint of text (djb2), for ids that change when the wording changes. */
function fingerprint(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return (hash >>> 0).toString(36);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ringFor(alarm: PlannedAlarm, categoryById: ReadonlyMap<string, Category>): Ring {
  const category = categoryById.get(alarm.task.categoryId);
  const where = category?.name ?? "Task";
  const starts = formatTime(new Date(alarm.task.dueAt), TIME_ZONE);
  const snoozed = alarm.kind === "snooze" ? " (snoozed)" : "";
  const alarmTitle = alarm.end ? `Time's up · ${alarm.task.title}${snoozed}` : `${alarm.task.title} · ${where}${snoozed}`;
  const title = alarm.end ? `⏰ Time's up · ${alarm.task.title}` : `⏰ ${alarm.task.title}`;
  const body = alarm.end ? `${where} · time is over` : `${where} · starts ${starts}${snoozed}`;
  return {
    id: `${alarm.key}|${fingerprint(`${alarmTitle}|${title}|${body}|${category?.color ?? ""}`)}`,
    fireAt: alarm.fireAt,
    alarmTitle,
    title,
    body,
    tint: category?.color,
    taskId: alarm.task.id,
  };
}

function plannedRings(input: AlarmSyncInput, now: Date): Ring[] {
  const categoryById = new Map(input.categories.map((category) => [category.id, category]));
  const planned = input.enabled
    ? planAlarms(input.tasks, now, toAlarmMemory(input.memory), ALARM_GRACE_MS).map((alarm) => ringFor(alarm, categoryById))
    : [];
  const test = testRing && testRing.fireAt.getTime() > now.getTime() - ALARM_GRACE_MS ? [testRing] : [];
  return [...planned, ...test].sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

function toNotification(ring: Ring): NotificationAlarm {
  return { id: ring.id, fireAt: ring.fireAt, title: ring.title, body: ring.body, taskId: ring.taskId };
}

async function syncNow(input: AlarmSyncInput): Promise<AlarmHealth> {
  const now = new Date();
  const errors: string[] = [];
  const permissions = await readPermissions();
  const rings = plannedRings(input, now);
  const upcoming = rings.filter((ring) => ring.fireAt.getTime() > now.getTime());
  // Alarms that fired moments ago stay wanted, so one that is ringing right now is not cancelled.
  const justFired = rings.filter((ring) => ring.fireAt.getTime() <= now.getTime());

  // 1. Real iPhone alarms (installed app on iOS 26.1+). Elsewhere this reports null.
  let report: NativeSyncReport | null = null;
  try {
    const specs = [...justFired, ...upcoming.slice(0, MAX_REAL_ALARMS)].map((ring) => ({
      key: ring.id,
      fireAtMs: ring.fireAt.getTime(),
      title: ring.alarmTitle,
      tint: ring.tint,
    }));
    report = await syncNativeAlarms(specs);
    errors.push(...(report?.errors ?? []));
  } catch (error) {
    errors.push(`Real alarms: ${message(error)}`);
  }
  const realActive = report?.authorization === "authorized";
  const realIds = new Set(report?.activeKeys ?? []);

  // 2. Notifications: a backup next to each real alarm, or the alarm itself (with follow-ups) without one.
  let notifications = 0;
  if (Platform.OS !== "web") {
    try {
      await ensureAlarmChannel();
      const allowed = permissions.notifications === "granted";
      const covered = realActive ? upcoming.slice(0, MAX_NOTIFICATIONS) : upcoming.slice(0, MAX_NOTIFICATIONS / 3);
      notifications = await syncNotifications(
        allowed ? covered.map(toNotification) : [],
        { followUpsMinutes: realActive ? NO_FOLLOW_UPS : FOLLOW_UPS_MINUTES, loud: !realActive },
        now,
      );
    } catch (error) {
      errors.push(`Notifications: ${message(error)}`);
    }
  }

  const mode: AlarmMode = !input.enabled
    ? "off"
    : realActive
      ? "alarm"
      : permissions.notifications === "granted"
        ? "notification"
        : "screen";
  const next = upcoming[0];
  const health: AlarmHealth = {
    checkedAt: now.getTime(),
    mode,
    permissions,
    upcoming: upcoming.length,
    realAlarms: realIds.size,
    notifications,
    next: next ? { title: next.alarmTitle, at: next.fireAt.getTime(), real: realIds.has(next.id) } : null,
    errors,
  };
  publishHealth(health);
  return health;
}

/**
 * Makes the phone hold exactly the alarms the tasks need. Runs one at a time, in order, so the
 * last call always reflects the latest tasks. Safe to call often: unchanged alarms are kept.
 */
export function syncAlarms(input: AlarmSyncInput): Promise<AlarmHealth> {
  lastInput = input;
  const run = queue
    .then(
      () => syncNow(input),
      () => syncNow(input),
    )
    .then((health) => {
      retryIfNeeded(health);
      return health;
    });
  queue = run.catch(() => undefined);
  return run;
}

/** Re-runs the last sync, e.g. after a permission changed in Settings. */
export function resyncAlarms(): Promise<AlarmHealth | null> {
  return lastInput ? syncAlarms(lastInput) : Promise.resolve(null);
}

/** Settings → Ring in 1 minute: a test through the same path as real task alarms. */
export async function ringTestAlarm(delayMs: number): Promise<Date> {
  const fireAt = new Date(Date.now() + delayMs);
  testRing = {
    id: `test|${fireAt.getTime()}`,
    fireAt,
    alarmTitle: "The Butler · Test alarm",
    title: "⏰ The Butler · Test alarm",
    body: "Your alarms are working.",
    taskId: null,
  };
  await resyncAlarms();
  return fireAt;
}
