import { isRunningInExpoGo } from "expo";
import * as Notifications from "expo-notifications";
import {
  AndroidAudioContentType,
  AndroidAudioUsage,
  AndroidImportance,
  AndroidNotificationVisibility,
} from "expo-notifications";
import { Platform } from "react-native";

/** Channels can't be changed once created, so a new sound or importance needs a new id. */
export const ALARM_CHANNEL_ID = "butler-alarms-v2";
const RETIRED_CHANNEL_IDS = ["butler-alarm"] as const;
/** About 25 seconds of alarm tones, bundled by the expo-notifications plugin (see app.json). */
const LONG_SOUND = "alarm_long.wav";
/** Expo Go can't play bundled notification sounds, so it keeps the default tone. */
const bundledSounds = !isRunningInExpoGo();
const ID_PREFIX = "butler|";
const MS_PER_MINUTE = 60_000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Android: a channel that rings on the alarm volume, vibrates, shows on the lock screen and may pass Do Not Disturb. */
export async function ensureAlarmChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
    name: "Task alarms",
    description: "Rings when a task starts or ends.",
    importance: AndroidImportance.MAX,
    sound: bundledSounds ? LONG_SOUND : "default",
    enableVibrate: true,
    vibrationPattern: [0, 800, 400, 800, 400, 800],
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    audioAttributes: { usage: AndroidAudioUsage.ALARM, contentType: AndroidAudioContentType.SONIFICATION },
  });
  await Promise.all(
    RETIRED_CHANNEL_IDS.map((id) => Notifications.deleteNotificationChannelAsync(id).catch(() => undefined)),
  );
}

export interface NotificationAlarm {
  /** Stable for the same alarm and content, so an unchanged alarm keeps its notification. */
  id: string;
  fireAt: Date;
  title: string;
  body: string;
  taskId: string | null;
}

interface SyncOptions {
  /** Extra reminders after the first, in minutes (used when there is no real alarm). */
  followUpsMinutes: readonly number[];
  /** The long alarm tone instead of the short default one. */
  loud: boolean;
}

/**
 * Makes the phone hold exactly these notifications: missing ones are added and everything else is
 * removed (including ones left by older versions of the app). Unchanged ones are left alone, so a
 * sync never leaves a gap with nothing scheduled. Returns how many are waiting.
 */
export async function syncNotifications(
  alarms: readonly NotificationAlarm[],
  options: SyncOptions,
  now: Date,
): Promise<number> {
  const wanted = new Map<string, Notifications.NotificationRequestInput>();
  for (const alarm of alarms) {
    [0, ...options.followUpsMinutes].forEach((minutes, nag) => {
      const at = new Date(alarm.fireAt.getTime() + minutes * MS_PER_MINUTE);
      if (at.getTime() <= now.getTime()) return;
      const identifier = `${ID_PREFIX}${alarm.id}|${nag}`;
      wanted.set(identifier, {
        identifier,
        content: {
          title: nag === 0 ? alarm.title : `Still waiting · ${alarm.title}`,
          body: alarm.body,
          sound: options.loud && bundledSounds ? LONG_SOUND : "default",
          interruptionLevel: "timeSensitive",
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { taskId: alarm.taskId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: ALARM_CHANNEL_ID,
          // Android: setAlarmClock() is never deferred to save battery. Follow-ups can be best effort.
          delivery: nag === 0 ? "alarmClock" : "bestEffort",
        },
      });
    });
  }

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const existingIds = new Set(existing.map((request) => request.identifier));
  await Promise.all(
    existing
      .filter((request) => !wanted.has(request.identifier))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
  for (const [identifier, request] of wanted) {
    if (!existingIds.has(identifier)) await Notifications.scheduleNotificationAsync(request);
  }
  return wanted.size;
}
