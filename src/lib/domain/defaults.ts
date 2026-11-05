import type { Category, Resource, Settings } from "./types";

/** Category colours drawn from the brand palette (reds, white, greys). */
export const CATEGORY_COLORS = [
  "#D83036",
  "#F0868A",
  "#FFFFFF",
  "#A6A6A6",
  "#8E1F23",
  "#E25B5F",
  "#555555",
  "#C9C9C9",
] as const;

export const DEFAULT_AUTO_LOCK_SECONDS = 60;

const STARTER_CATEGORIES: ReadonlyArray<Pick<Category, "name" | "icon" | "color">> = [
  { name: "Research", icon: "book", color: "#D83036" },
  { name: "Health", icon: "dumbbell", color: "#F0868A" },
  { name: "Work", icon: "briefcase", color: "#FFFFFF" },
  { name: "Home", icon: "home", color: "#A6A6A6" },
  { name: "Personal", icon: "sparkles", color: "#8E1F23" },
];

const STARTER_RESOURCES: ReadonlyArray<Pick<Resource, "name" | "icon">> = [
  { name: "Cash", icon: "cash" },
  { name: "Bank", icon: "bank" },
  { name: "bKash", icon: "mobile" },
];

export function defaultCategories(now: Date, newId: () => string): Category[] {
  return STARTER_CATEGORIES.map((starter, index) => ({
    kind: "category",
    id: newId(),
    ...starter,
    order: index,
    createdAt: now.toISOString(),
  }));
}

export function defaultResources(now: Date, newId: () => string): Resource[] {
  return STARTER_RESOURCES.map((starter, index) => ({
    kind: "resource",
    id: newId(),
    ...starter,
    order: index,
    archived: false,
    createdAt: now.toISOString(),
  }));
}

export function defaultSettings(id: string): Settings {
  return {
    kind: "settings",
    id,
    displayName: "",
    theme: "dark",
    reduceMotion: false,
    transfersEnabled: true,
    inAppAlarm: false,
    financeAutoLockSeconds: DEFAULT_AUTO_LOCK_SECONDS,
  };
}
