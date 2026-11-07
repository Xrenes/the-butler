import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

/**
 * Real iPhone alarms through Apple's AlarmKit (iOS 26+): full screen on the lock screen, loud,
 * rings until stopped, like the Clock app. Only present in the installed app; Expo Go, Android
 * and the web fall back to notifications.
 */
type AlarmKitModule = typeof import("expo-alarm-kit");

const APP_GROUP = "group.app.thebutler.mobile";
/** Our own record of scheduled alarm ids, so every old alarm can be cancelled before rescheduling. */
const IDS_KEY = "butler/alarmkit-ids";
const SNOOZE_SECONDS = 5 * 60;

export interface KitAlarm {
  at: Date;
  title: string;
  color?: string;
}

let cached: AlarmKitModule | null | undefined;

function kit(): AlarmKitModule | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (Platform.OS === "ios" && requireOptionalNativeModule("ExpoAlarmKit")) {
    // Loaded lazily: the package throws on import wherever its native part is missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require("expo-alarm-kit") as AlarmKitModule;
    loaded.configure(APP_GROUP);
    cached = loaded;
  }
  return cached;
}

export function alarmKitAvailable(): boolean {
  return kit() !== null;
}

/** Asks for alarm permission if needed. True when real alarms can be scheduled. */
export async function requestAlarmKit(): Promise<boolean> {
  const module = kit();
  if (!module) return false;
  return (await module.requestAuthorization()) === "authorized";
}

async function storedIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(IDS_KEY).catch(() => null);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Cancels every alarm this app scheduled before. */
export async function cancelKitAlarms(): Promise<void> {
  const module = kit();
  if (!module) return;
  const ids = new Set([...(await storedIds()), ...module.getAllAlarms()]);
  await Promise.all([...ids].map((id) => module.cancelAlarm(id).catch(() => false)));
  await AsyncStorage.setItem(IDS_KEY, "[]").catch(() => undefined);
}

/** Replaces all scheduled alarms with these. Returns how many were scheduled. */
export async function replaceKitAlarms(alarms: readonly KitAlarm[]): Promise<number> {
  await cancelKitAlarms();
  return addKitAlarms(alarms);
}

/** Schedules these alongside the existing ones. Returns how many were scheduled. */
export async function addKitAlarms(alarms: readonly KitAlarm[]): Promise<number> {
  const module = kit();
  if (!module) return 0;
  const ids: string[] = [];
  for (const alarm of alarms) {
    const id = module.generateUUID();
    const ok = await module
      .scheduleAlarm({
        id,
        epochSeconds: Math.floor(alarm.at.getTime() / 1000),
        title: alarm.title,
        doSnoozeIntent: true,
        snoozeDuration: SNOOZE_SECONDS,
        stopButtonLabel: "Stop",
        snoozeButtonLabel: "Snooze 5 min",
        tintColor: alarm.color ?? "#D83036",
      })
      .catch(() => false);
    if (ok) ids.push(id);
  }
  const all = [...(await storedIds()), ...ids];
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify(all)).catch(() => undefined);
  return ids.length;
}
