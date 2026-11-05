/**
 * Sample data for the UI demo. Everything lives in memory; nothing is saved or encrypted yet.
 */
import { addDays, dayKeyOf, zonedParts, zonedTimeToUtc } from "@/lib/domain/dates";
import { defaultCategories, defaultResources } from "@/lib/domain/defaults";
import {
  type LedgerContext,
  computeBalances,
  makeAdjustment,
  makeCredit,
  makeDebit,
} from "@/lib/domain/ledger";
import { createTask, withStatus } from "@/lib/domain/tasks";
import type { Category, MarkedStatus, Resource, Task, Txn } from "@/lib/domain/types";

export interface DemoSettings {
  displayName: string;
  theme: "dark" | "light";
  reduceMotion: boolean;
  transfersEnabled: boolean;
  /** Linked Telegram chat, or null. The bot token is a server secret and never lives here. */
  telegramChatId: string | null;
  /** Show a reminder on screen, with its category, when it comes due. */
  inAppAlarm: boolean;
}

export interface DemoData {
  categories: Category[];
  tasks: Task[];
  resources: Resource[];
  txns: Txn[];
  settings: DemoSettings;
}

export const HISTORY_DAYS = 56;
const MS_PER_DAY = 86_400_000;
const RANDOM_SEED = 20_261_103;
const TITLES: readonly (readonly string[])[] = [
  ["Read paper", "Literature notes", "Draft introduction", "Analyse survey data", "Supervisor check-in"],
  ["Morning run", "Gym session", "Yoga flow", "Meal prep", "Evening walk"],
  ["Team sync", "Client call", "Write weekly report", "Code review", "Plan the sprint"],
  ["Groceries", "Pay electricity bill", "Laundry", "Fix the desk lamp", "Clean the kitchen"],
  ["Journal", "Call family", "Read 20 pages", "Guitar practice", "Meditate"],
];

/** UUID v4; falls back to getRandomValues where randomUUID is unavailable (plain-HTTP LAN testing). */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedTasks(
  now: Date,
  timeZone: string,
  categories: readonly Category[],
  random: () => number,
): Task[] {
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const randomCategory = () => Math.floor(random() * categories.length);
  const reminder = { enabled: true, leadMinutes: 10, includeTitle: false };
  const make = (
    day: string,
    hour: number,
    minute: number,
    categoryIndex: number,
    status: MarkedStatus | null,
  ): Task => {
    const dueAt = zonedTimeToUtc(day, hour, minute, timeZone);
    const draft = {
      title: pick(TITLES[categoryIndex % TITLES.length]),
      description: "",
      categoryId: categories[categoryIndex].id,
      dueAt,
      reminder,
    };
    const task = createTask(draft, newId(), new Date(dueAt.getTime() - MS_PER_DAY));
    return status ? withStatus(task, status, dueAt) : task;
  };

  const today = dayKeyOf(now, timeZone);
  const history = Array.from({ length: HISTORY_DAYS }, (_, index) =>
    addDays(today, index - HISTORY_DAYS),
  ).flatMap((day) =>
    Array.from({ length: Math.floor(random() * 7) }, () => {
      const roll = random();
      const status: MarkedStatus = roll < 0.74 ? "C" : roll < 0.87 ? "H" : "NC";
      return make(day, 7 + Math.floor(random() * 14), pick([0, 15, 30, 45]), randomCategory(), status);
    }),
  );

  const hour = zonedParts(now, timeZone).hour;
  const todayPlan: ReadonlyArray<readonly [number, MarkedStatus | null]> = [
    [-6, "C"],
    [-4, "C"],
    [-2, "H"],
    [1, null],
    [3, null],
  ];
  const todayTasks = todayPlan
    .filter(([offset]) => hour + offset >= 0 && hour + offset <= 23)
    .map(([offset, status], index) =>
      make(today, hour + offset, index % 2 === 0 ? 0 : 30, index % categories.length, status),
    );

  const upcoming = Array.from({ length: 6 }, (_, index) => addDays(today, index + 1)).flatMap((day) =>
    Array.from({ length: 1 + Math.floor(random() * 3) }, () =>
      make(day, 8 + Math.floor(random() * 12), pick([0, 30]), randomCategory(), null),
    ),
  );
  return [...history, ...todayTasks, ...upcoming];
}

/** Ends at ৳4,200 cash + ৳25,000 bank + ৳3,500 bKash = ৳32,700 (the workbook fixture). */
function seedLedger(now: Date, timeZone: string, resources: readonly Resource[]): Txn[] {
  const today = dayKeyOf(now, timeZone);
  const [cash, bank, bkash] = resources;
  const at = (daysAgo: number, hour: number) =>
    zonedTimeToUtc(addDays(today, -daysAgo), hour, 0, timeZone);
  const opening = "Opening balance";
  const steps: ReadonlyArray<(context: LedgerContext) => Txn> = [
    (c) => makeAdjustment({ id: newId(), now: at(12, 9), note: opening }, { resourceId: cash.id, newBalance: 500_000 }, c),
    (c) => makeAdjustment({ id: newId(), now: at(12, 9), note: opening }, { resourceId: bank.id, newBalance: 2_000_000 }, c),
    (c) => makeAdjustment({ id: newId(), now: at(12, 9), note: opening }, { resourceId: bkash.id, newBalance: 400_000 }, c),
    (c) => makeCredit({ id: newId(), now: at(5, 10) }, { resourceId: bank.id, amount: 500_000, category: "Salary" }, c),
    (c) => makeDebit({ id: newId(), now: at(3, 13), note: "Lunch with the team" }, { resourceId: cash.id, amount: 80_000, category: "Food" }, c),
    (c) => makeDebit({ id: newId(), now: at(1, 18), note: "Internet" }, { resourceId: bkash.id, amount: 50_000, category: "Bills" }, c),
  ];
  return steps.reduce<Txn[]>(
    (txns, step) => [...txns, step({ resources, balances: computeBalances(resources, txns) })],
    [],
  );
}

export function createSeed(now: Date, timeZone: string): DemoData {
  const random = seededRandom(RANDOM_SEED);
  const categories = defaultCategories(now, newId);
  const resources = defaultResources(now, newId);
  return {
    categories,
    tasks: seedTasks(now, timeZone, categories, random),
    resources,
    txns: seedLedger(now, timeZone, resources),
    settings: {
      displayName: "",
      theme: "dark",
      reduceMotion: false,
      transfersEnabled: true,
      telegramChatId: null,
      inAppAlarm: true,
    },
  };
}
