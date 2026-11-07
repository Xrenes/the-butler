import { requireOptionalNativeModule } from "expo";
import { z } from "zod";

/**
 * Real iPhone alarms (AlarmKit, iOS 26.1+), from the local native module in ./ios. Only present in
 * the installed iPhone app: in Expo Go, on Android and on the web every call reports "unavailable".
 */
export type NativeAlarmAuthorization = "authorized" | "denied" | "notDetermined" | "unavailable";

export interface NativeAlarmSpec {
  /** Stable for the same alarm; the native side turns it into the AlarmKit id. */
  key: string;
  fireAtMs: number;
  title: string;
  tint?: string;
}

const AuthorizationSchema = z.enum(["authorized", "denied", "notDetermined"]).catch("notDetermined");

const SyncReportSchema = z.object({
  authorization: AuthorizationSchema,
  scheduled: z.number(),
  kept: z.number(),
  cancelled: z.number(),
  activeKeys: z.array(z.string()),
  errors: z.array(z.string()),
});

export type NativeSyncReport = z.infer<typeof SyncReportSchema>;

interface ButlerAlarmsNative {
  authorizationStatus(): string;
  requestAuthorization(): Promise<string>;
  sync(specs: NativeAlarmSpec[]): Promise<string>;
  cancelAll(): Promise<number>;
}

const native = requireOptionalNativeModule<ButlerAlarmsNative>("ButlerAlarms");

export const nativeAlarmsAvailable = native !== null;

export function nativeAlarmAuthorization(): NativeAlarmAuthorization {
  return native ? AuthorizationSchema.parse(native.authorizationStatus()) : "unavailable";
}

/** Shows the system prompt if the person has not answered yet; otherwise just reports. */
export async function requestNativeAlarmAuthorization(): Promise<NativeAlarmAuthorization> {
  return native ? AuthorizationSchema.parse(await native.requestAuthorization()) : "unavailable";
}

/** Makes AlarmKit hold exactly these alarms. Null when real alarms are unavailable. */
export async function syncNativeAlarms(specs: readonly NativeAlarmSpec[]): Promise<NativeSyncReport | null> {
  if (!native) return null;
  const raw = await native.sync([...specs]);
  const parsed = SyncReportSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error(`Unexpected alarm report from iOS: ${raw.slice(0, 120)}`);
  return parsed.data;
}

export async function cancelAllNativeAlarms(): Promise<number> {
  return native ? native.cancelAll() : 0;
}
