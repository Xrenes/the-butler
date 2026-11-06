/**
 * Shapes of the decrypted records. Every record decrypted on the device is validated against
 * these schemas before use, because ciphertext comes back from an untrusted server.
 */
import { z } from "zod";

export const TASK_STATUSES = ["pending", "C", "NC", "H"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type MarkedStatus = Exclude<TaskStatus, "pending">;
export const MARKED_STATUSES: readonly MarkedStatus[] = ["C", "NC", "H"];

export const CATEGORY_ICONS = [
  "book",
  "dumbbell",
  "briefcase",
  "home",
  "sparkles",
  "heart",
  "cart",
  "plane",
  "music",
  "code",
  "graduation",
  "coffee",
  "leaf",
  "star",
  "users",
  "palette",
  "gamepad",
  "camera",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const RESOURCE_ICONS = ["cash", "bank", "mobile", "card", "wallet", "piggy"] as const;
export type ResourceIcon = (typeof RESOURCE_ICONS)[number];

export const FINANCE_CATEGORIES = [
  "Salary",
  "Business",
  "Gift",
  "Food",
  "Transport",
  "Bills",
  "Shopping",
  "Health",
  "Education",
  "Family",
  "Savings",
  "Other",
] as const;
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

export const REMINDER_LEAD_MINUTES = [0, 5, 10, 15, 30, 60] as const;
export const AUTO_LOCK_SECONDS = [30, 60, 120, 300] as const;

/** Largest amount accepted anywhere: ৳1,000,000,000.00 in poisha. */
export const MAX_MINOR = 100_000_000_000;

const isoDate = z.iso.datetime();
const recordId = z.uuid();
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const positiveMinor = z.number().int().positive().max(MAX_MINOR);
const balanceMinor = z.number().int().min(0).max(MAX_MINOR);

export const ReminderSchema = z.object({
  enabled: z.boolean(),
  leadMinutes: z.number().int().min(0).max(1440),
  includeTitle: z.boolean(),
  /** Also ring when the task's duration is over. Optional: older tasks have no end alarm. */
  atEnd: z.boolean().optional(),
});

export const TaskSchema = z.object({
  kind: z.literal("task"),
  id: recordId,
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000),
  categoryId: recordId,
  dueAt: isoDate,
  status: z.enum(TASK_STATUSES),
  statusChangedAt: isoDate.nullable(),
  reminder: ReminderSchema,
  /** How long the task takes. Optional: tasks saved before this existed have none. */
  durationMinutes: z.number().int().min(5).max(720).optional(),
  sourceTaskId: recordId.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const CategorySchema = z.object({
  kind: z.literal("category"),
  id: recordId,
  name: z.string().trim().min(1).max(32),
  color: hexColor,
  icon: z.enum(CATEGORY_ICONS),
  order: z.number().int(),
  createdAt: isoDate,
});

export const SettingsSchema = z.object({
  kind: z.literal("settings"),
  id: recordId,
  displayName: z.string().max(40),
  theme: z.enum(["dark", "light"]),
  reduceMotion: z.boolean(),
  transfersEnabled: z.boolean(),
  inAppAlarm: z.boolean(),
  financeAutoLockSeconds: z.number().int().min(15).max(900),
});

export const ResourceSchema = z.object({
  kind: z.literal("resource"),
  id: recordId,
  name: z.string().trim().min(1).max(24),
  icon: z.enum(RESOURCE_ICONS),
  order: z.number().int(),
  archived: z.boolean(),
  createdAt: isoDate,
});

const txnBase = {
  kind: z.literal("txn"),
  id: recordId,
  note: z.string().max(200),
  occurredAt: isoDate,
  createdAt: isoDate,
};

export const TxnSchema = z.discriminatedUnion("type", [
  z.object({
    ...txnBase,
    type: z.literal("credit"),
    resourceId: recordId,
    amount: positiveMinor,
    category: z.enum(FINANCE_CATEGORIES),
  }),
  z.object({
    ...txnBase,
    type: z.literal("debit"),
    resourceId: recordId,
    amount: positiveMinor,
    category: z.enum(FINANCE_CATEGORIES),
  }),
  z.object({
    ...txnBase,
    type: z.literal("adjustment"),
    resourceId: recordId,
    delta: z
      .number()
      .int()
      .refine((value) => value !== 0),
    previousBalance: balanceMinor,
    newBalance: balanceMinor,
  }),
  z.object({
    ...txnBase,
    type: z.literal("transfer"),
    fromId: recordId,
    toId: recordId,
    amount: positiveMinor,
  }),
]);

export type Reminder = z.infer<typeof ReminderSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Resource = z.infer<typeof ResourceSchema>;
export type Txn = z.infer<typeof TxnSchema>;
export type MainPayload = Task | Category | Settings;
export type FinancePayload = Resource | Txn;

function kindOf(value: unknown): unknown {
  return typeof value === "object" && value !== null ? (value as { kind?: unknown }).kind : undefined;
}

export function parseMainPayload(value: unknown): MainPayload | null {
  const kind = kindOf(value);
  const schema =
    kind === "task"
      ? TaskSchema
      : kind === "category"
        ? CategorySchema
        : kind === "settings"
          ? SettingsSchema
          : null;
  if (!schema) return null;
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseFinancePayload(value: unknown): FinancePayload | null {
  const kind = kindOf(value);
  const schema = kind === "resource" ? ResourceSchema : kind === "txn" ? TxnSchema : null;
  if (!schema) return null;
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}
