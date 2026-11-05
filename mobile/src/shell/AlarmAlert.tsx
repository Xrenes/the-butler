import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { type AlarmMemory, EMPTY_ALARM_MEMORY, SNOOZE_MINUTES, alarmKey, describeLead, dueAlarms, dueCountdown } from "@domain/alarms";
import { dayKeyOf, formatDayLabel, formatTime } from "@domain/dates";
import type { MarkedStatus, Task } from "@domain/types";
import { TIME_ZONE, useNow, useStore } from "../store";
import { readableOn, useTheme } from "../theme";
import { GhostButton, PrimaryButton, categoryIcon } from "../ui";

const MS_PER_MINUTE = 60_000;
const FALLBACK_COLOR = "#D83036";

/** Watches the clock and shows the earliest due reminder, with its category and details. */
export function AlarmWatcher() {
  const { state, dispatch } = useStore();
  const now = useNow(1000);
  const [memory, setMemory] = useState<AlarmMemory>(EMPTY_ALARM_MEMORY);
  const t = useTheme();

  const due = state.settings.inAppAlarm ? dueAlarms(state.tasks, now, memory) : [];
  const task: Task | null = due[0] ?? null;
  const category = task ? state.categories.find((item) => item.id === task.categoryId) : undefined;
  const color = category?.color ?? FALLBACK_COLOR;
  const key = task ? alarmKey(task) : null;

  // A strong buzz each time a new alarm appears.
  useEffect(() => {
    if (key) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }, [key]);

  if (!task) return null;

  const dismiss = () => setMemory((previous) => ({ ...previous, dismissed: new Set(previous.dismissed).add(alarmKey(task)) }));
  const snooze = () =>
    setMemory((previous) => ({
      ...previous,
      snoozedUntil: new Map(previous.snoozedUntil).set(alarmKey(task), Date.now() + SNOOZE_MINUTES * MS_PER_MINUTE),
    }));
  const mark = (status: MarkedStatus) => dispatch({ type: "task/status", id: task.id, status, now: new Date() });

  const dueDate = new Date(task.dueAt);
  const dueDay = formatDayLabel(dayKeyOf(dueDate, TIME_ZONE), dayKeyOf(now, TIME_ZONE));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: t.overlay, justifyContent: "center", padding: 16 }}>
        <View
          accessibilityRole="alert"
          style={{
            maxHeight: "92%",
            backgroundColor: t.surface,
            borderRadius: 32,
            borderWidth: 1,
            borderColor: t.edge,
            padding: 22,
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: "center" }}>
            {due.length > 1 ? (
              <Text style={{ position: "absolute", right: 0, top: 0, color: t.fg2, fontSize: 12 }}>1 of {due.length}</Text>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="notifications" size={16} color={t.accent} />
              <Text style={{ color: t.accent, fontSize: 12, fontWeight: "600", letterSpacing: 2 }}>REMINDER</Text>
            </View>

            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 29,
                backgroundColor: color,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 26,
                shadowColor: color,
                shadowOpacity: 0.7,
                shadowRadius: 22,
                shadowOffset: { width: 0, height: 8 },
              }}
            >
              <Ionicons name={category ? categoryIcon(category.icon) : "notifications-outline"} size={46} color={readableOn(color)} />
            </View>

            <Text style={{ color: t.fg, fontSize: 26, fontWeight: "600", textAlign: "center", marginTop: 22 }}>{task.title}</Text>
            <Text style={{ color: t.accent, fontSize: 14, fontWeight: "500", marginTop: 6 }}>{dueCountdown(task, now)}</Text>

            <View style={{ alignSelf: "stretch", marginTop: 18, backgroundColor: t.well, borderRadius: 22, borderColor: t.edge, borderWidth: 1, paddingHorizontal: 16 }}>
              <Detail label="Category">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                  <Text style={{ color: t.fg, fontSize: 14, fontWeight: "500" }}>{category?.name ?? "No category"}</Text>
                </View>
              </Detail>
              <Detail label="Due">
                <Text style={{ color: t.fg, fontSize: 14, fontWeight: "500" }}>
                  {dueDay} · {formatTime(dueDate, TIME_ZONE)}
                </Text>
              </Detail>
              <Detail label="Reminder" last={!task.description}>
                <Text style={{ color: t.fg, fontSize: 14, fontWeight: "500" }}>{describeLead(task.reminder.leadMinutes)}</Text>
              </Detail>
              {task.description ? (
                <View style={{ paddingVertical: 12 }}>
                  <Text style={{ color: t.fg2, fontSize: 14 }}>Notes</Text>
                  <Text style={{ color: t.fg, fontSize: 14, marginTop: 4 }}>{task.description}</Text>
                </View>
              ) : null}
            </View>

            <View style={{ alignSelf: "stretch", flexDirection: "row", marginTop: 18 }}>
              <PrimaryButton onPress={() => mark("C")}>Done</PrimaryButton>
            </View>
            <View style={{ alignSelf: "stretch", flexDirection: "row", gap: 10, marginTop: 10 }}>
              <GhostButton onPress={snooze}>{`Snooze ${SNOOZE_MINUTES} min`}</GhostButton>
              <GhostButton onPress={() => mark("H")}>On hold</GhostButton>
            </View>
            <View style={{ alignSelf: "stretch", flexDirection: "row", marginTop: 10 }}>
              <GhostButton onPress={dismiss}>Dismiss</GhostButton>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Detail({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.line,
      }}
    >
      <Text style={{ color: t.fg2, fontSize: 14 }}>{label}</Text>
      {children}
    </View>
  );
}
