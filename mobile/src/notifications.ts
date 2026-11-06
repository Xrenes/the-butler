import * as Notifications from "expo-notifications";
import { AndroidImportance, AndroidNotificationVisibility } from "expo-notifications";
import { Platform } from "react-native";
import { describeLead, endsAt, reminderFireAt } from "@domain/alarms";
import { TIME_ZONE } from "./store";
import { formatTime } from "@domain/dates";
import type { Category, Task } from "@domain/types";

const CHANNEL_ID = "butler-alarm";
/** iOS keeps at most 64 pending notifications, so only the nearest reminders are scheduled. */
const MAX_TASKS = 20;
/** After the first alert, nag again so a missed one is hard to ignore. */
const FOLLOW_UPS_MINUTES = [1, 3] as const;
const MS_PER_MINUTE = 60_000;

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

/**
 * Replaces every scheduled alert with the ones the current tasks need. Called whenever tasks or
 * the alarm setting change, so a task marked done or edited never rings from an old schedule.
 */
export async function syncAlarms(
  tasks: readonly Task[],
  categories: readonly Category[],
  enabled: boolean,
  now: Date = new Date(),
): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled || !(await permissionGranted())) return 0;
  await ensureAlarmChannel();

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const upcoming = tasks
    .filter((task) => task.status === "pending")
    .flatMap((task) => [
      ...(task.reminder.enabled ? [{ task, fireAt: reminderFireAt(task), end: false }] : []),
      ...(task.reminder.atEnd ? [{ task, fireAt: endsAt(task), end: true }] : []),
    ])
    .filter(({ fireAt }) => fireAt.getTime() > now.getTime())
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
    .slice(0, MAX_TASKS);

  let scheduled = 0;
  for (const { task, fireAt, end } of upcoming) {
    const category = categoryById.get(task.categoryId);
    const times = [0, ...FOLLOW_UPS_MINUTES].map((minutes, nag) => ({
      nag,
      at: new Date(fireAt.getTime() + minutes * MS_PER_MINUTE),
    }));
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

/** Fires one alert in a few seconds so the person can hear what a reminder sounds like. */
export async function sendTestAlarm(): Promise<boolean> {
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
