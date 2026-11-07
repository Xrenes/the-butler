import { useSyncExternalStore } from "react";
import type { AlarmPermissions } from "./permissions";

/** What will actually ring when a task is due. */
export type AlarmMode =
  /** Real iPhone alarms: full screen, through silent mode and Focus. */
  | "alarm"
  /** Phone notifications only: they can be missed on silent or in a Focus. */
  | "notification"
  /** Only the app's own alarm screen, while it is open (web, or nothing else allowed). */
  | "screen"
  /** Phone alarms are switched off in Settings. */
  | "off";

/** The result of the last alarm sync, shown in Settings → Alarm check. */
export interface AlarmHealth {
  checkedAt: number;
  mode: AlarmMode;
  permissions: AlarmPermissions;
  /** Future alarms the tasks need right now. */
  upcoming: number;
  /** How many of them iOS holds as real alarms. */
  realAlarms: number;
  /** Notifications waiting to be delivered (backups next to real alarms, or the alarms themselves). */
  notifications: number;
  next: { title: string; at: number; real: boolean } | null;
  errors: string[];
}

let current: AlarmHealth | null = null;
const listeners = new Set<() => void>();

export function publishHealth(health: AlarmHealth): void {
  current = health;
  listeners.forEach((listener) => listener());
}

function readHealth(): AlarmHealth | null {
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAlarmHealth(): AlarmHealth | null {
  return useSyncExternalStore(subscribe, readHealth, readHealth);
}
