import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import {
  type Dispatch,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { EMPTY_STORED_ALARM_MEMORY, type StoredAlarmMemory, pruneStoredAlarmMemory } from "@domain/alarms";
import { DEFAULT_TIMEZONE, addDays, dayKeyOf, zonedTimeToUtc } from "@domain/dates";
import { defaultCategories, defaultResources } from "@domain/defaults";
import { type LedgerContext, computeBalances, makeAdjustment, makeCredit, makeDebit } from "@domain/ledger";
import { createTask, withStatus } from "@domain/tasks";
import type { Category, MarkedStatus, Resource, Task, Txn } from "@domain/types";

export const TIME_ZONE = DEFAULT_TIMEZONE;
const STORAGE_KEY = "butler/v1";
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_BASE_MS = 30_000;

export interface Settings {
  displayName: string;
  theme: "dark" | "light";
  /** Show the full-screen alarm card while the app is open. */
  inAppAlarm: boolean;
  /** Ring a loud phone notification at reminder time, even when the app is closed. */
  phoneAlarm: boolean;
  transfersEnabled: boolean;
  /** Full-screen alarm style: loud looping sound, flashing colour, vibration. */
  alarmSound: boolean;
  alarmFlash: boolean;
  alarmVibrate: boolean;
  /** "category" uses each task's category colour; otherwise a fixed hex colour. */
  alarmColor: string;
}

export interface FinanceLock {
  failures: number;
  lockedUntil: number | null;
}

/** Everything saved on the phone. */
export interface SavedState {
  categories: Category[];
  tasks: Task[];
  resources: Resource[];
  txns: Txn[];
  settings: Settings;
  financeLock: FinanceLock;
  /** Alarms the person stopped or snoozed. Saved, so a snooze still rings after the app is closed. */
  alarmMemory: StoredAlarmMemory;
}

/** Saved state plus this session's unlock flag, which is never saved: a restart always locks. */
export interface AppState extends SavedState {
  financeUnlocked: boolean;
  /** Settings → Preview alarm: shows a sample full-screen alarm. Never saved. */
  alarmPreview: boolean;
}

export type Action =
  | { type: "load"; saved: SavedState }
  | { type: "task/save"; task: Task }
  | { type: "task/status"; id: string; status: MarkedStatus; now: Date }
  | { type: "category/save"; category: Category }
  | { type: "alarm/preview"; on: boolean }
  | { type: "alarm/dismiss"; key: string; at: number }
  | { type: "alarm/snooze"; key: string; until: number }
  | { type: "txn/add"; txn: Txn }
  | { type: "resource/save"; resource: Resource }
  | { type: "settings/update"; patch: Partial<Settings> }
  | { type: "finance/unlock" }
  | { type: "finance/fail"; now: number }
  | { type: "finance/lock" }
  | { type: "data/sample"; now: Date }
  | { type: "data/clear-tasks" }
  | { type: "data/clear-finance"; now: Date };

/**
 * UUID v4. Browsers only offer randomUUID on secure pages (https or localhost), so the web preview
 * opened by IP address falls back to getRandomValues, which works everywhere.
 */
export function newId(): string {
  try {
    return randomUUID();
  } catch {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}

const DEFAULT_SETTINGS: Settings = {
  displayName: "",
  theme: "dark",
  inAppAlarm: true,
  phoneAlarm: true,
  transfersEnabled: true,
  alarmSound: true,
  alarmFlash: true,
  alarmVibrate: true,
  alarmColor: "#D83036",
};
const OPEN_LOCK: FinanceLock = { failures: 0, lockedUntil: null };

export function freshState(now: Date): AppState {
  return {
    categories: defaultCategories(now, newId),
    tasks: [],
    resources: defaultResources(now, newId),
    txns: [],
    settings: DEFAULT_SETTINGS,
    financeLock: OPEN_LOCK,
    alarmMemory: EMPTY_STORED_ALARM_MEMORY,
    financeUnlocked: false,
    alarmPreview: false,
  };
}

/** Saved alarm memory from an older or damaged save becomes empty instead of breaking alarms. */
function readAlarmMemory(value: unknown, now: Date): StoredAlarmMemory {
  const record = (input: unknown): Record<string, number> => {
    if (typeof input !== "object" || input === null) return {};
    return Object.fromEntries(
      Object.entries(input).filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
    );
  };
  if (typeof value !== "object" || value === null) return EMPTY_STORED_ALARM_MEMORY;
  const { dismissed, snoozed } = value as Partial<Record<keyof StoredAlarmMemory, unknown>>;
  return pruneStoredAlarmMemory({ dismissed: record(dismissed), snoozed: record(snoozed) }, now);
}

function rememberAlarm(memory: StoredAlarmMemory, action: { key: string; dismissedAt?: number; snoozedUntil?: number }): StoredAlarmMemory {
  const snoozed = Object.fromEntries(Object.entries(memory.snoozed).filter(([key]) => key !== action.key));
  const dismissed = Object.fromEntries(Object.entries(memory.dismissed).filter(([key]) => key !== action.key));
  return {
    dismissed: action.dismissedAt === undefined ? dismissed : { ...dismissed, [action.key]: action.dismissedAt },
    snoozed: action.snoozedUntil === undefined ? snoozed : { ...snoozed, [action.key]: action.snoozedUntil },
  };
}

function upsert<T extends { id: string }>(items: readonly T[], item: T): T[] {
  return items.some((existing) => existing.id === item.id)
    ? items.map((existing) => (existing.id === item.id ? item : existing))
    : [...items, item];
}

/** A small, believable week so the app is not empty on first look. */
function sampleTasks(now: Date, categories: readonly Category[]): Task[] {
  const today = dayKeyOf(now, TIME_ZONE);
  const reminder = { enabled: true, leadMinutes: 10, includeTitle: true };
  const plan: readonly (readonly [number, number, number, number, string, MarkedStatus | null])[] = [
    [-3, 8, 0, 1, "Morning run", "C"],
    [-2, 10, 30, 0, "Read paper", "C"],
    [-1, 18, 0, 3, "Pay electricity bill", "H"],
    [-1, 20, 0, 4, "Journal", "NC"],
    [0, 7, 0, 1, "Gym session", "C"],
    [0, 13, 30, 2, "Team sync", null],
    [0, 21, 0, 4, "Read 20 pages", null],
    [1, 9, 0, 2, "Write weekly report", null],
    [1, 17, 30, 3, "Groceries", null],
    [2, 8, 0, 1, "Yoga flow", null],
  ];
  return plan.map(([offset, hour, minute, categoryIndex, title, status]) => {
    const dueAt = zonedTimeToUtc(addDays(today, offset), hour, minute, TIME_ZONE);
    const category = categories[categoryIndex % categories.length];
    const task = createTask(
      { title, description: "", categoryId: category.id, dueAt, reminder },
      newId(),
      new Date(dueAt.getTime() - 86_400_000),
    );
    return status ? withStatus(task, status, dueAt) : task;
  });
}

/** Opening balances and a few entries, the same story as the web demo. */
function sampleLedger(now: Date, resources: readonly Resource[]): Txn[] {
  const [cash, bank, bkash] = resources;
  if (!cash || !bank || !bkash) return [];
  const today = dayKeyOf(now, TIME_ZONE);
  const at = (daysAgo: number, hour: number) => zonedTimeToUtc(addDays(today, -daysAgo), hour, 0, TIME_ZONE);
  const opening = "Opening balance";
  const steps: readonly ((context: LedgerContext) => Txn)[] = [
    (c) => makeAdjustment({ id: newId(), now: at(12, 9), note: opening }, { resourceId: cash.id, newBalance: 500_000 }, c),
    (c) => makeAdjustment({ id: newId(), now: at(12, 9), note: opening }, { resourceId: bank.id, newBalance: 2_000_000 }, c),
    (c) => makeAdjustment({ id: newId(), now: at(12, 9), note: opening }, { resourceId: bkash.id, newBalance: 400_000 }, c),
    (c) => makeCredit({ id: newId(), now: at(5, 10) }, { resourceId: bank.id, amount: 500_000, category: "Salary" }, c),
    (c) => makeDebit({ id: newId(), now: at(3, 13), note: "Lunch with the team" }, { resourceId: cash.id, amount: 80_000, category: "Food" }, c),
    (c) => makeDebit({ id: newId(), now: at(1, 18), note: "Internet" }, { resourceId: bkash.id, amount: 50_000, category: "Bills" }, c),
  ];
  return steps.reduce<Txn[]>((txns, step) => [...txns, step({ resources, balances: computeBalances(resources, txns) })], []);
}

function afterFailedPin(lock: FinanceLock, now: number): FinanceLock {
  const failures = lock.failures + 1;
  const lockedUntil = failures >= MAX_PIN_ATTEMPTS ? now + LOCKOUT_BASE_MS * 2 ** (failures - MAX_PIN_ATTEMPTS) : lock.lockedUntil;
  return { failures, lockedUntil };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "load":
      return { ...action.saved, financeUnlocked: false, alarmPreview: false };
    case "task/save":
      return { ...state, tasks: upsert(state.tasks, action.task) };
    case "task/status":
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.id ? withStatus(task, action.status, action.now) : task)),
      };
    case "alarm/preview":
      return { ...state, alarmPreview: action.on };
    case "alarm/dismiss":
      return { ...state, alarmMemory: rememberAlarm(state.alarmMemory, { key: action.key, dismissedAt: action.at }) };
    case "alarm/snooze":
      return { ...state, alarmMemory: rememberAlarm(state.alarmMemory, { key: action.key, snoozedUntil: action.until }) };
    case "category/save":
      return { ...state, categories: upsert(state.categories, action.category) };
    case "txn/add":
      return { ...state, txns: [...state.txns, action.txn] };
    case "resource/save":
      return { ...state, resources: upsert(state.resources, action.resource) };
    case "settings/update":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "finance/unlock":
      return { ...state, financeUnlocked: true, financeLock: OPEN_LOCK };
    case "finance/fail":
      return { ...state, financeLock: afterFailedPin(state.financeLock, action.now) };
    case "finance/lock":
      return state.financeUnlocked ? { ...state, financeUnlocked: false } : state;
    case "data/sample":
      return {
        ...state,
        tasks: sampleTasks(action.now, state.categories),
        txns: state.txns.length === 0 ? sampleLedger(action.now, state.resources) : state.txns,
      };
    case "data/clear-tasks":
      return { ...state, tasks: [] };
    case "data/clear-finance":
      return { ...state, resources: defaultResources(action.now, newId), txns: [], financeLock: OPEN_LOCK, financeUnlocked: false };
  }
}

function toSaved(state: AppState): SavedState {
  const { financeUnlocked: _session, alarmPreview: _preview, ...saved } = state;
  return saved;
}

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  ready: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => freshState(new Date()));
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  // Load what was saved on this phone, once. Missing fields (from older versions) get defaults.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<SavedState>;
        if (!saved.categories?.length || !saved.tasks || !saved.settings) return;
        const now = new Date();
        const fresh = freshState(now);
        dispatch({
          type: "load",
          saved: {
            categories: saved.categories,
            tasks: saved.tasks,
            resources: saved.resources?.length ? saved.resources : fresh.resources,
            txns: saved.txns ?? [],
            settings: { ...DEFAULT_SETTINGS, ...saved.settings },
            financeLock: saved.financeLock ?? OPEN_LOCK,
            alarmMemory: readAlarmMemory(saved.alarmMemory, now),
          },
        });
      })
      .catch(() => undefined)
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  // Save after every change, but never before the first load has finished.
  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSaved(state))).catch(() => undefined);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch, ready }), [state, ready]);
  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}

/** Current time, refreshed on an interval so countdowns and timelines stay live. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
