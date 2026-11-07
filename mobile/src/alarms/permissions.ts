import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";
import {
  type NativeAlarmAuthorization,
  nativeAlarmAuthorization,
  requestNativeAlarmAuthorization,
} from "../../modules/butler-alarms";
import { browserAlertsSupported } from "./browser";
import { ensureAlarmChannel } from "./notify";

/** Set once the launch-time permission prompts have been shown, so they are not repeated every launch. */
const ASKED_KEY = "butler/alarm-permissions-asked";

export type NotificationAccess = "granted" | "denied" | "undetermined" | "unsupported";
export type ExactAlarmAccess = "granted" | "denied" | "notNeeded";
export type BrowserAccess = "granted" | "denied" | "default" | "unsupported";

/** Everything that decides whether an alarm can ring, on every platform. */
export interface AlarmPermissions {
  /** iPhone: real alarms (AlarmKit). "unavailable" in Expo Go, on Android and on the web. */
  realAlarms: NativeAlarmAuthorization;
  /** iPhone and Android notifications. */
  notifications: NotificationAccess;
  /** Android 12+: whether alarms may fire at the exact minute. */
  exactAlarms: ExactAlarmAccess;
  /** Web: the browser's own notifications. */
  browser: BrowserAccess;
}

async function notificationAccess(): Promise<NotificationAccess> {
  if (Platform.OS === "web") return "unsupported";
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  return current.canAskAgain ? "undetermined" : "denied";
}

async function exactAlarmAccess(): Promise<ExactAlarmAccess> {
  if (Platform.OS !== "android") return "notNeeded";
  return (await Notifications.getExactAlarmPermissionsAsync()).granted ? "granted" : "denied";
}

function browserAccess(): BrowserAccess {
  return browserAlertsSupported() ? Notification.permission : "unsupported";
}

export async function readPermissions(): Promise<AlarmPermissions> {
  const [notifications, exactAlarms] = await Promise.all([
    notificationAccess().catch((): NotificationAccess => "denied"),
    exactAlarmAccess().catch((): ExactAlarmAccess => "denied"),
  ]);
  return { realAlarms: nativeAlarmAuthorization(), notifications, exactAlarms, browser: browserAccess() };
}

async function requestNotifications(): Promise<void> {
  // Android 13+ only shows the prompt once a channel exists.
  await ensureAlarmChannel();
  await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
}

/**
 * Asks for each permission that can be asked in place, one prompt at a time and before anything is
 * scheduled (two prompts at once can lose an answer). At launch ("once") the notification prompt is
 * only shown the first time, because Android would otherwise ask again on every launch after a
 * "no"; from a Settings switch ("now") it always asks.
 */
export async function askForAlarmPermissions(when: "once" | "now" = "now"): Promise<AlarmPermissions> {
  if (nativeAlarmAuthorization() === "notDetermined") {
    await requestNativeAlarmAuthorization().catch(() => undefined);
  }
  const askedBefore = when === "once" && (await AsyncStorage.getItem(ASKED_KEY).catch(() => null)) !== null;
  if (!askedBefore && (await notificationAccess().catch(() => "denied")) === "undetermined") {
    await requestNotifications().catch(() => undefined);
  }
  await AsyncStorage.setItem(ASKED_KEY, "1").catch(() => undefined);
  return readPermissions();
}

/** Settings → Allow: asks again while the system still can, otherwise opens The Butler's settings. */
export async function allowRealAlarms(): Promise<void> {
  if (nativeAlarmAuthorization() === "notDetermined") {
    await requestNativeAlarmAuthorization();
    return;
  }
  await Linking.openSettings();
}

export async function allowNotifications(): Promise<void> {
  if ((await notificationAccess()) === "undetermined") {
    await requestNotifications();
    return;
  }
  await Linking.openSettings();
}

/** Android: opens "Alarms & reminders" for the app. Falls back to the app's settings page. */
export async function allowExactAlarms(): Promise<void> {
  try {
    await Notifications.requestExactAlarmPermissionsAsync();
  } catch {
    await Linking.openSettings();
  }
}

export async function allowBrowserAlerts(): Promise<void> {
  if (!browserAlertsSupported()) return;
  await Notification.requestPermission();
}
