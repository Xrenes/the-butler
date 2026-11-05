"use client";

import { type CSSProperties, useState } from "react";
import { TIME_ZONE, useDemo } from "@/components/demo/store";
import { newId } from "@/components/demo/seed";
import { Icon } from "@/components/icons/Icon";
import { type Overlay, Sheet } from "@/components/ui/Sheet";
import {
  GhostButton,
  PrimaryButton,
  STATUS_LABEL,
  Segmented,
  StatusSquare,
  Toggle,
  readableOn,
} from "@/components/ui/primitives";
import {
  type DayKey,
  type Meridiem,
  addDays,
  dayKeyOf,
  dayOfMonth,
  formatShortDate,
  to12Hour,
  to24Hour,
  weekdayShort,
  zonedParts,
  zonedTimeToUtc,
} from "@/lib/domain/dates";
import {
  type TaskDraft,
  changesDueTime,
  createTask,
  repeatTask,
  updateTask,
  validateDraft,
} from "@/lib/domain/tasks";
import { type Category, REMINDER_LEAD_MINUTES, type Reminder, type Task } from "@/lib/domain/types";
import { TimeWheel } from "./TimeWheel";

export type EditorMode = { kind: "new" } | { kind: "edit"; task: Task } | { kind: "repeat"; task: Task };

const SHEET_TITLES: Record<EditorMode["kind"], string> = {
  new: "New task",
  edit: "Edit task",
  repeat: "Repeat task",
};
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const MERIDIEMS: readonly Meridiem[] = ["AM", "PM"];
const DATE_CHOICES = 14;
const MS_PER_HOUR = 3_600_000;
const LEAD_LABELS: Record<number, string> = {
  0: "At time",
  5: "5 min",
  10: "10 min",
  15: "15 min",
  30: "30 min",
  60: "1 hour",
};
const LEAD_OPTIONS = REMINDER_LEAD_MINUTES.map((minutes) => ({
  value: String(minutes),
  label: LEAD_LABELS[minutes],
}));
const DEFAULT_REMINDER: Reminder = { enabled: true, leadMinutes: 10, includeTitle: false };

interface FormState {
  title: string;
  description: string;
  categoryId: string;
  day: DayKey;
  hour12: number;
  minute: number;
  meridiem: Meridiem;
  reminder: Reminder;
}

function initialForm(mode: EditorMode, categories: readonly Category[], now: Date): FormState {
  if (mode.kind === "new") {
    const nextHour = new Date(now.getTime() + MS_PER_HOUR);
    const clock = to12Hour(zonedParts(nextHour, TIME_ZONE).hour);
    return {
      title: "",
      description: "",
      categoryId: categories[0]?.id ?? "",
      day: dayKeyOf(nextHour, TIME_ZONE),
      hour12: clock.hour12,
      minute: 0,
      meridiem: clock.meridiem,
      reminder: DEFAULT_REMINDER,
    };
  }
  const due = new Date(mode.task.dueAt);
  const parts = zonedParts(due, TIME_ZONE);
  const clock = to12Hour(parts.hour);
  return {
    title: mode.task.title,
    description: mode.task.description,
    categoryId: mode.task.categoryId,
    day: mode.kind === "repeat" ? addDays(dayKeyOf(now, TIME_ZONE), 1) : dayKeyOf(due, TIME_ZONE),
    hour12: clock.hour12,
    minute: parts.minute,
    meridiem: clock.meridiem,
    reminder: { ...mode.task.reminder },
  };
}

function choiceStyle(active: boolean, accent: string) {
  return active
    ? { background: accent, borderColor: accent, color: readableOn(accent) }
    : { borderColor: "var(--line)", color: "var(--fg-2)" };
}

/** The one shared editor: new tasks (Home only), edits, and repeats from history. */
export function TaskEditor({ overlay, onClose }: { overlay: Overlay<EditorMode> | null; onClose: () => void }) {
  return (
    <Sheet open={overlay?.open ?? false} title={overlay ? SHEET_TITLES[overlay.value.kind] : ""} onClose={onClose}>
      {overlay ? <EditorForm key={overlay.nonce} mode={overlay.value} onClose={onClose} /> : null}
    </Sheet>
  );
}

function EditorForm({ mode, onClose }: { mode: EditorMode; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const [openedAt] = useState(() => new Date());
  const [form, setForm] = useState<FormState>(() => initialForm(mode, state.categories, openedAt));
  // The day the form opened on stays in the list, so a past task's own date can be picked again.
  const [openingDay] = useState(form.day);
  const [error, setError] = useState<string | null>(null);
  const category = state.categories.find((item) => item.id === form.categoryId);
  const accent = category?.color ?? "#D83036";
  const today = dayKeyOf(openedAt, TIME_ZONE);
  const upcomingDays = Array.from({ length: DATE_CHOICES }, (_, index) => addDays(today, index));
  const days = upcomingDays.includes(openingDay) ? upcomingDays : [openingDay, ...upcomingDays];

  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));
  const updateReminder = (patch: Partial<Reminder>) =>
    setForm((current) => ({ ...current, reminder: { ...current.reminder, ...patch } }));

  const handleSave = () => {
    const dueAt = zonedTimeToUtc(form.day, to24Hour(form.hour12, form.meridiem), form.minute, TIME_ZONE);
    const draft: TaskDraft = {
      title: form.title,
      description: form.description,
      categoryId: form.categoryId,
      dueAt,
      reminder: form.reminder,
    };
    const now = new Date();
    // Only a task that is still pending has to move to the future. A task already marked
    // (done, missed, on hold) can be corrected to any time, including one in the past.
    const requireFuture = mode.kind !== "edit" || (mode.task.status === "pending" && changesDueTime(mode.task, draft));
    const problem = validateDraft(draft, now, { requireFuture });
    if (problem) {
      setError(problem);
      return;
    }
    const task =
      mode.kind === "new"
        ? createTask(draft, newId(), now)
        : mode.kind === "repeat"
          ? repeatTask(mode.task, draft, newId(), now)
          : updateTask(mode.task, draft, now);
    dispatch({ type: "task/save", task });
    onClose();
  };

  return (
    <form
      className="space-y-6 pb-2"
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
    >
      <div
        className="surface-well space-y-2 rounded-3xl border border-[var(--card-edge)] px-4 py-3.5 transition-shadow focus-within:ring-2"
        style={{ "--tw-ring-color": accent } as CSSProperties}
      >
        <input
          autoFocus={mode.kind === "new"}
          value={form.title}
          onChange={(event) => update({ title: event.target.value })}
          placeholder="What needs doing?"
          maxLength={120}
          aria-label="Task name"
          className="w-full bg-transparent text-[clamp(1.4rem,1.2rem+1vw,1.75rem)] font-medium tracking-tight outline-none placeholder:text-fg-3"
          style={{ caretColor: accent }}
        />
        <textarea
          value={form.description}
          onChange={(event) => update({ description: event.target.value })}
          placeholder="Add details (optional)"
          rows={2}
          maxLength={2000}
          aria-label="Description"
          className="w-full resize-none bg-transparent text-sm text-fg-2 outline-none placeholder:text-fg-3"
        />
      </div>

      {mode.kind === "edit" && mode.task.status !== "pending" ? (
        <p className="-mt-3 flex items-center gap-2 text-xs text-fg-2">
          <StatusSquare status={mode.task.status} size={16} />
          Marked {STATUS_LABEL[mode.task.status].toLowerCase()}. Saving keeps that status; change it from the
          status square.
        </p>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-xs text-fg-2">Category</legend>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {state.categories.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === form.categoryId}
              onClick={() => update({ categoryId: item.id })}
              className="surface-card inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm transition-colors"
              style={choiceStyle(item.id === form.categoryId, item.color)}
            >
              <Icon name={item.icon} size={16} />
              {item.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs text-fg-2">Date</legend>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {days.map((day) => {
            // Past dates show the month, since a bare weekday would be ambiguous.
            const label =
              day === today
                ? "Today"
                : day === addDays(today, 1)
                  ? "Tmrw"
                  : day < today
                    ? formatShortDate(day).split(" ")[0]
                    : weekdayShort(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={day === form.day}
                aria-label={day}
                onClick={() => update({ day })}
                className="surface-card flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs transition-colors"
                style={choiceStyle(day === form.day, accent)}
              >
                <span>{label}</span>
                <span className="text-lg font-light tabular-nums">{dayOfMonth(day)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs text-fg-2">Time</legend>
        <div className="surface-well flex items-center justify-center gap-[clamp(6px,2vw,14px)] rounded-3xl p-3">
          <TimeWheel
            label="Hour"
            values={HOURS}
            value={form.hour12}
            format={String}
            onChange={(hour12) => update({ hour12 })}
            accent={accent}
          />
          <span className="text-2xl text-fg-3">:</span>
          <TimeWheel
            label="Minute"
            values={MINUTES}
            value={form.minute}
            format={(minute) => String(minute).padStart(2, "0")}
            onChange={(minute) => update({ minute })}
            accent={accent}
          />
          <div className="ml-1 flex flex-col gap-2">
            {MERIDIEMS.map((meridiem) => (
              <button
                key={meridiem}
                type="button"
                aria-pressed={form.meridiem === meridiem}
                onClick={() => update({ meridiem })}
                className="surface-card h-11 w-14 rounded-full text-sm font-medium transition-colors"
                style={choiceStyle(form.meridiem === meridiem, accent)}
              >
                {meridiem}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <ReminderSection reminder={form.reminder} onChange={updateReminder} accent={accent} />

      {error ? (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3 pt-1">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton type="submit" color={accent}>
          {mode.kind === "edit" ? "Save changes" : "Save task"}
        </PrimaryButton>
      </div>
    </form>
  );
}

interface ReminderSectionProps {
  reminder: Reminder;
  onChange: (patch: Partial<Reminder>) => void;
  accent: string;
}

function ReminderSection({ reminder, onChange, accent }: ReminderSectionProps) {
  return (
    <section className="surface-group rounded-3xl px-4 py-3">
      <Toggle
        icon="send"
        label="Telegram reminder"
        description="A message with Done, Snooze and Hold buttons."
        checked={reminder.enabled}
        onChange={(enabled) => onChange({ enabled })}
        accent={accent}
      />
      {reminder.enabled ? (
        <div className="mt-2 space-y-3">
          <Segmented
            label="Remind me before"
            options={LEAD_OPTIONS}
            value={String(reminder.leadMinutes)}
            onChange={(value) => onChange({ leadMinutes: Number(value) })}
            accent={accent}
          />
          <Toggle
            label="Show the task name in Telegram"
            description="Off keeps it private: the bot only says you have a task at that time."
            checked={reminder.includeTitle}
            onChange={(includeTitle) => onChange({ includeTitle })}
            accent={accent}
          />
          <div className="flex items-center gap-3 py-2 opacity-50">
            <span className="surface-raised grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-2">
              <Icon name="phone" size={18} />
            </span>
            <span className="flex-1 text-sm">Call alarm</span>
            <span className="surface-raised rounded-full px-2.5 py-1 text-xs text-fg">Experimental · not available</span>
          </div>
        </div>
      ) : null}
      <p className="mt-1 pb-1 text-xs text-fg-3">Demo: reminders start sending once the server is connected.</p>
    </section>
  );
}
