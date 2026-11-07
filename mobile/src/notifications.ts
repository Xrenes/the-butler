import * as Notifications from "expo-notifications";
import { AndroidImportance, AndroidNotificationVisibility } from "expo-notifications";
import { Platform } from "react-native";
import { describeLead, endsAt, reminderFireAt } from "@domain/alarms";
import { TIME_ZONE } from "./store";
import { formatTime } from "@domain/dates";
import type { Category, Task } from "@domain/types";
import { addKitAlarms, alarmKitAvailable, cancelKitAlarms, replaceKitAlarms, requestAlarmKit } from "./alarmKit";

const CHANNEL_ID = "butler-alarm";
/** iOS keeps at most 64 pending notifications, so only the nearest reminders are scheduled. */
const MAX_TASKS = 20;
/** After the first alert, nag again so a missed one is hard to ignore. */
const FOLLOW_UPS_MINUTES = [1, 3] as const;
const MS_PER_MINUTE = 60_000;
const TEST_DELAY_MS = 10_000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureAlarmChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Task alarms",
    importance: AndroidImportance.MAX,
    vibrationPattern: [0, 400, 250, 400, 250, 800],
    sound: "default",
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });
}

/** Asks once; returns whether alerts are allowed. */
export async function requestPermission(): Promise<boolean> {
  await ensureAlarmChannel();
  // Real alarms first (installed iPhone app); notifications stay as the backup everywhere.
  await requestAlarmKit().catch(() => false);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function permissionGranted(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

export type PermissionState = "granted" | "denied" | "undetermined";

/** "denied" means the phone will not show the prompt again; the person must use system settings. */
export async function permissionState(): Promise<PermissionState> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  return current.canAskAgain ? "undetermined" : "denied";
}

function content(task: Task, category: Category | undefined, nag: number, end: boolean) {
  const due = formatTime(new Date(task.dueAt), TIME_ZONE);
  const where = category?.name ?? "Task";
  const title = end ? `⏰ Time's up · ${where}` : nag === 0 ? `⏰ ${where}` : `⏰ Still pending · ${where}`;
  return {
    title,
    body: `${task.title}\nDue ${due} · ${describeLead(task.reminder.leadMinutes)}`,
    sound: "default" as const,
    interruptionLevel: "timeSensitive" as const,
    priority: Notifications.AndroidNotificationPriority.MAX,
    data: { taskId: task.id },
  };
}

function alarmTitle(task: Task, category: Category | undefined, end: boolean): string {
  const where = category?.name ?? "Task";
  return end ? `Time's up · ${task.title}` : `${task.title} · ${where}`;
}

/** Real alarms have no 64-alert cap like notifications, so more of the future is covered. */
const MAX_KIT_ALARMS = 64;

type Upcoming = { task: Task; fireAt: Date; end: boolean };

function upcomingAlarms(tasks: readonly Task[], now: Date): Upcoming[] {
  return tasks
    .filter((task) => task.status === "pending")
    .flatMap((task) => [
      ...(task.reminder.enabled ? [{ task, fireAt: reminderFireAt(task), end: false }] : []),
      ...(task.reminder.atEnd ? [{ task, fireAt: endsAt(task), end: true }] : []),
    ])
    .filter(({ fireAt }) => fireAt.getTime() > now.getTime())
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

async function scheduleNotifications(items: readonly Upcoming[], categoryById: Map<string, Category>, followUps: readonly number[]): Promise<number> {
  let scheduled = 0;
  for (const { task, fireAt, end } of items) {
    const category = categoryById.get(task.categoryId);
    const times = [0, ...followUps].map((minutes, nag) => ({ nag, at: new Date(fireAt.getTime() + minutes * MS_PER_MINUTE) }));
    for (const { nag, at } of times) {
      await Notifications.scheduleNotificationAsync({
        content: content(task, category, nag, end),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
      });
      scheduled += 1;
    }
  }
  return scheduled;
}

async function syncNow(tasks: readonly Task[], categories: readonly Category[], enabled: boolean, now: Date): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) {
    await cancelKitAlarms().catch(() => undefined);
    return 0;
  }
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const upcoming = upcomingAlarms(tasks, now);
  const notificationsAllowed = await permissionGranted();
  if (notificationsAllowed) await ensureAlarmChannel();

  // Installed iPhone app: real alarms that ring full screen like the Clock app, until stopped,
  // plus a plain notification at the same moment as a backup in case an alarm ever fails.
  if (alarmKitAvailable() && (await requestAlarmKit().catch(() => false))) {
    const count = await replaceKitAlarms(
      upcoming.slice(0, MAX_KIT_ALARMS).map(({ task, fireAt, end }) => {
        const category = categoryById.get(task.categoryId);
        return { at: fireAt, title: alarmTitle(task, category, end), color: category?.color };
      }),
    );
    if (notificationsAllowed) await scheduleNotifications(upcoming.slice(0, MAX_TASKS), categoryById, []);
    return count;
  }

  if (!notificationsAllowed) return 0;
  return scheduleNotifications(upcoming.slice(0, MAX_TASKS), categoryById, FOLLOW_UPS_MINUTES);
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Replaces every scheduled alarm with the ones the current tasks need. Called whenever tasks or
 * the alarm setting change and when the app opens, so nothing rings from an old schedule. Runs one
 * at a time: two overlapping runs could otherwise cancel each other's alarms.
 */
export function syncAlarms(
  tasks: readonly Task[],
  categories: readonly Category[],
  enabled: boolean,
  now: Date = new Date(),
): Promise<number> {
  const run = queue.then(
    () => syncNow(tasks, categories, enabled, now),
    () => syncNow(tasks, categories, enabled, now),
  );
  queue = run.catch(() => undefined);
  return run;
}

export type AlarmMode = "alarm" | "notification" | "off";

/** What will actually ring: a real alarm, only a notification, or nothing. */
export async function alarmMode(): Promise<AlarmMode> {
  if (alarmKitAvailable() && (await requestAlarmKit().catch(() => false))) return "alarm";
  return (await permissionGranted()) ? "notification" : "off";
}

/** Fires one alert in a few seconds so the person can hear what a reminder sounds like. */
export async function sendTestAlarm(): Promise<boolean> {
  if (alarmKitAvailable() && (await requestAlarmKit().catch(() => false))) {
    const count = await addKitAlarms([{ at: new Date(Date.now() + TEST_DELAY_MS), title: "The Butler · Test alarm" }]);
    return count > 0;
  }
  if (!(await requestPermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "⏰ The Butler",
      body: "This is how your task reminders will look and sound.",
      sound: "default",
      interruptionLevel: "timeSensitive",
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_ID },
  });
  return true;
}
