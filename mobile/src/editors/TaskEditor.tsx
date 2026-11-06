import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
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
} from "@domain/dates";
import {
  DEFAULT_DURATION_MINUTES,
  type TaskDraft,
  changesDueTime,
  createTask,
  repeatTask,
  updateTask,
  validateDraft,
} from "@domain/tasks";
import { type Category, REMINDER_LEAD_MINUTES, type Reminder, type Task } from "@domain/types";
import { TIME_ZONE, newId, useStore } from "../store";
import { readableOn, useTheme } from "../theme";
import { Chip, GhostButton, PrimaryButton, Sheet, StatusSquare, Toggle, Well, categoryIcon, tap } from "../ui";
import { TimeWheel } from "./TimeWheel";

export type EditorMode = { kind: "new" } | { kind: "edit"; task: Task } | { kind: "repeat"; task: Task };

const TITLES: Record<EditorMode["kind"], string> = { new: "New task", edit: "Edit task", repeat: "Repeat task" };
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const MERIDIEMS: readonly Meridiem[] = ["AM", "PM"];
const DATE_CHOICES = 14;
const MS_PER_HOUR = 3_600_000;
const LEADS: Record<number, string> = { 0: "At time", 5: "5 min", 10: "10 min", 15: "15 min", 30: "30 min", 60: "1 hour" };
const LEAD_OPTIONS = REMINDER_LEAD_MINUTES.map((minutes) => ({ value: String(minutes), label: LEADS[minutes] }));
const DEFAULT_REMINDER: Reminder = { enabled: true, leadMinutes: 10, includeTitle: true };
const DURATIONS: readonly { minutes: number; label: string }[] = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 45, label: "45 min" },
  { minutes: 60, label: "1 hr" },
  { minutes: 90, label: "1.5 hr" },
  { minutes: 120, label: "2 hr" },
  { minutes: 180, label: "3 hr" },
];

interface FormState {
  title: string;
  description: string;
  categoryId: string;
  day: DayKey;
  hour12: number;
  minute: number;
  meridiem: Meridiem;
  durationMinutes: number;
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
      durationMinutes: DEFAULT_DURATION_MINUTES,
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
    durationMinutes: mode.task.durationMinutes ?? DEFAULT_DURATION_MINUTES,
    reminder: { ...mode.task.reminder },
  };
}

interface TaskEditorProps {
  mode: EditorMode | null;
  nonce: number;
  onClose: () => void;
}

/** The one shared editor: new tasks, edits of any task (upcoming or past), and repeats from history. */
export function TaskEditor({ mode, nonce, onClose }: TaskEditorProps) {
  return (
    <Sheet open={mode !== null} title={mode ? TITLES[mode.kind] : ""} onClose={onClose}>
      {mode ? <EditorForm key={nonce} mode={mode} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Label({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={{ color: t.fg2, fontSize: 12, marginBottom: 8 }}>{children}</Text>;
}

function EditorForm({ mode, onClose }: { mode: EditorMode; onClose: () => void }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const [openedAt] = useState(() => new Date());
  const [form, setForm] = useState<FormState>(() => initialForm(mode, state.categories, openedAt));
  // The day the form opened on stays in the list, so a past task's own date can be picked again.
  const [openingDay] = useState(form.day);
  const [error, setError] = useState<string | null>(null);
  const category = state.categories.find((item) => item.id === form.categoryId);
  const accent = category?.color ?? t.accent;
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
      durationMinutes: form.durationMinutes,
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
    <View style={{ gap: 22 }}>
      <Well style={{ padding: 16, gap: 8, borderColor: accent }}>
        <TextInput
          value={form.title}
          onChangeText={(title) => update({ title })}
          placeholder="What needs doing?"
          placeholderTextColor={t.fg3}
          maxLength={120}
          accessibilityLabel="Task name"
          selectionColor={accent}
          style={{ color: t.fg, fontSize: 24, fontWeight: "500", padding: 0 }}
        />
        <TextInput
          value={form.description}
          onChangeText={(description) => update({ description })}
          placeholder="Add details (optional)"
          placeholderTextColor={t.fg3}
          maxLength={2000}
          multiline
          accessibilityLabel="Description"
          selectionColor={accent}
          style={{ color: t.fg2, fontSize: 14, padding: 0, minHeight: 36 }}
        />
      </Well>

      {mode.kind === "edit" && mode.task.status !== "pending" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: -8 }}>
          <StatusSquare status={mode.task.status} size={18} />
          <Text style={{ color: t.fg2, fontSize: 12, flex: 1 }}>Saving keeps this status. Change it from the status icon.</Text>
        </View>
      ) : null}

      <View>
        <Label>Category</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {state.categories.map((item) => (
            <Chip
              key={item.id}
              icon={categoryIcon(item.icon)}
              active={item.id === form.categoryId}
              color={item.color}
              onPress={() => update({ categoryId: item.id })}
            >
              {item.name}
            </Chip>
          ))}
        </ScrollView>
      </View>

      <View>
        <Label>Date</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {days.map((day) => {
            const active = day === form.day;
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
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={day}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  tap();
                  update({ day });
                }}
                style={{
                  width: 58,
                  height: 66,
                  borderRadius: 18,
                  borderWidth: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  backgroundColor: active ? accent : t.surface,
                  borderColor: active ? accent : t.line,
                }}
              >
                <Text style={{ color: active ? readableOn(accent) : t.fg2, fontSize: 12 }}>{label}</Text>
                <Text style={{ color: active ? readableOn(accent) : t.fg, fontSize: 20, fontWeight: "300" }}>
                  {dayOfMonth(day)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View>
        <Label>Time</Label>
        <Well style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 12 }}>
          <TimeWheel values={HOURS} value={form.hour12} format={String} onChange={(hour12) => update({ hour12 })} accent={accent} />
          <Text style={{ color: t.fg3, fontSize: 24 }}>:</Text>
          <TimeWheel
            values={MINUTES}
            value={form.minute}
            format={(minute) => String(minute).padStart(2, "0")}
            onChange={(minute) => update({ minute })}
            accent={accent}
          />
          <View style={{ gap: 8, marginLeft: 6 }}>
            {MERIDIEMS.map((meridiem) => (
              <Chip key={meridiem} active={form.meridiem === meridiem} color={accent} onPress={() => update({ meridiem })}>
                {meridiem}
              </Chip>
            ))}
          </View>
        </Well>
      </View>

      <View>
        <Label>Duration</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {DURATIONS.map((option) => (
            <Chip
              key={option.minutes}
              active={form.durationMinutes === option.minutes}
              color={accent}
              onPress={() => update({ durationMinutes: option.minutes })}
            >
              {option.label}
            </Chip>
          ))}
        </ScrollView>
      </View>

      <View style={{ backgroundColor: t.surface, borderColor: t.edge, borderWidth: 1, borderRadius: 24, padding: 14 }}>
        <Toggle
          icon="alarm-outline"
          label="Alarm at start"
          description="Rings at the reminder time before the task starts."
          value={form.reminder.enabled}
          onChange={(enabled) => updateReminder({ enabled })}
          accent={accent}
        />
        {form.reminder.enabled ? (
          <View style={{ marginTop: 6 }}>
            <Label>Remind me before</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {LEAD_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  active={String(form.reminder.leadMinutes) === option.value}
                  color={accent}
                  onPress={() => updateReminder({ leadMinutes: Number(option.value) })}
                >
                  {option.label}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}
        <Toggle
          icon="flag-outline"
          label="Alarm at end"
          description="Rings when the task's duration is over."
          value={Boolean(form.reminder.atEnd)}
          onChange={(atEnd) => updateReminder({ atEnd })}
          accent={accent}
        />
      </View>

      {error ? <Text style={{ color: t.accent, fontSize: 14 }}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <GhostButton onPress={onClose}>Cancel</GhostButton>
        <PrimaryButton color={accent} onPress={handleSave}>
          {mode.kind === "edit" ? "Save changes" : "Save task"}
        </PrimaryButton>
      </View>
    </View>
  );
}
