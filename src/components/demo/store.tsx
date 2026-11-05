"use client";

import {
  type Dispatch,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
} from "react";
import { DEFAULT_TIMEZONE } from "@/lib/domain/dates";
import { withStatus } from "@/lib/domain/tasks";
import type { MarkedStatus, Resource, Task, Txn } from "@/lib/domain/types";
import { type DemoData, type DemoSettings, createSeed } from "./seed";

export type Tab = "home" | "categories" | "calendar" | "finance";
export const TABS: readonly Tab[] = ["home", "categories", "calendar", "finance"];
export const TIME_ZONE = DEFAULT_TIMEZONE;

export interface FinanceLockState {
  /** Demo only: kept in memory. The real app wraps the finance key with the PIN instead. */
  pin: string | null;
  unlocked: boolean;
  failures: number;
  lockedUntil: number | null;
}

export interface DemoState extends DemoData {
  finance: FinanceLockState;
}

export type DemoAction =
  | { type: "task/save"; task: Task }
  | { type: "task/status"; id: string; status: MarkedStatus; now: Date }
  | { type: "txn/add"; txn: Txn }
  | { type: "resource/save"; resource: Resource }
  | { type: "settings/update"; patch: Partial<DemoSettings> }
  | { type: "pin/set"; pin: string }
  | { type: "pin/unlock" }
  | { type: "pin/fail"; now: number }
  | { type: "pin/lock" }
  | { type: "pin/reset" };

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_BASE_MS = 30_000;
const LOCKED_FINANCE: FinanceLockState = { pin: null, unlocked: false, failures: 0, lockedUntil: null };

function upsert<T extends { id: string }>(items: readonly T[], item: T): T[] {
  return items.some((existing) => existing.id === item.id)
    ? items.map((existing) => (existing.id === item.id ? item : existing))
    : [...items, item];
}

function afterFailedPin(finance: FinanceLockState, now: number): FinanceLockState {
  const failures = finance.failures + 1;
  const lockedUntil =
    failures >= MAX_PIN_ATTEMPTS
      ? now + LOCKOUT_BASE_MS * 2 ** (failures - MAX_PIN_ATTEMPTS)
      : finance.lockedUntil;
  return { ...finance, failures, lockedUntil };
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "task/save":
      return { ...state, tasks: upsert(state.tasks, action.task) };
    case "task/status":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id ? withStatus(task, action.status, action.now) : task,
        ),
      };
    case "txn/add":
      return { ...state, txns: [...state.txns, action.txn] };
    case "resource/save":
      return { ...state, resources: upsert(state.resources, action.resource) };
    case "settings/update":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "pin/set":
      return { ...state, finance: { pin: action.pin, unlocked: true, failures: 0, lockedUntil: null } };
    case "pin/unlock":
      return { ...state, finance: { ...state.finance, unlocked: true, failures: 0, lockedUntil: null } };
    case "pin/fail":
      return { ...state, finance: afterFailedPin(state.finance, action.now) };
    case "pin/lock":
      return state.finance.unlocked ? { ...state, finance: { ...state.finance, unlocked: false } } : state;
    case "pin/reset":
      return { ...state, finance: LOCKED_FINANCE };
  }
}

interface DemoContextValue {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
}

const DemoContext = createContext<DemoContextValue | null>(null);

function initialState(): DemoState {
  return { ...createSeed(new Date(), TIME_ZONE), finance: LOCKED_FINANCE };
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  return <DemoContext value={value}>{children}</DemoContext>;
}

export function useDemo(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemo must be used inside DemoProvider");
  return context;
}

/** Current time, refreshed on an interval so timelines and countdowns stay live. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readTab(): Tab {
  const hash = window.location.hash.slice(1);
  return TABS.find((tab) => tab === hash) ?? "home";
}

/** Active tab lives in the URL hash, so the back button and links like `/#finance` work. */
export function useTab(): [Tab, (tab: Tab) => void] {
  const tab = useSyncExternalStore(subscribeToHash, readTab, () => "home" as const);
  const setTab = useCallback((next: Tab) => {
    window.location.hash = next;
  }, []);
  return [tab, setTab];
}

const subscribeNever = () => () => undefined;

/** True only after hydration; the demo data is random, so it is rendered on the client. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
