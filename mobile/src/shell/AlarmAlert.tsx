import { Ionicons } from "@expo/vector-icons";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useEffect, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, Text, Vibration, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  type AlarmMemory,
  EMPTY_ALARM_MEMORY,
  SNOOZE_MINUTES,
  alarmKey,
  dueAlarms,
  dueCountdown,
  dueEndAlarms,
  endAlarmKey,
  endsAt,
} from "@domain/alarms";
import { formatTime } from "@domain/dates";
import type { Category, MarkedStatus, Task } from "@domain/types";
import { type Settings, TIME_ZONE, useNow, useStore } from "../store";
import { useTheme } from "../theme";
import { categoryIcon, tap } from "../ui";

const MS_PER_MINUTE = 60_000;
const FALLBACK_COLOR = "#D83036";
const FLASH_MS = 450;
const VIBRATION_PATTERN = [0, 700, 500];
const ALARM_SOUND = require("../../assets/alarm.wav");
/** How strongly the alarm colour washes over the dark background at the peak of each flash. */
const FLASH_MIN = 0.12;
const FLASH_MAX = 0.75;

type AlarmKind = "start" | "end";

/** A sample task for Settings → Preview alarm. Never saved. */
function previewTask(now: Date, categoryId: string): Task {
  const stamp = now.toISOString();
  return {
    kind: "task",
    id: "00000000-0000-4000-8000-000000000000",
    title: "Preview alarm",
    description: "This is how a task alarm looks and sounds. Tap any button to close it.",
    categoryId,
    dueAt: stamp,
    status: "pending",
    statusChangedAt: null,
    reminder: { enabled: true, leadMinutes: 0, includeTitle: true },
    sourceTaskId: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** Watches the clock and rings the earliest due alarm: a task starting, or a task's time running out. */
export function AlarmWatcher() {
  const { state, dispatch } = useStore();
  const now = useNow(1000);
  const [memory, setMemory] = useState<AlarmMemory>(EMPTY_ALARM_MEMORY);
  const enabled = state.settings.inAppAlarm;
  const starts = enabled ? dueAlarms(state.tasks, now, memory) : [];
  const ends = enabled ? dueEndAlarms(state.tasks, now, memory) : [];
  const current = starts[0]
    ? { task: starts[0], kind: "start" as AlarmKind, key: alarmKey(starts[0]) }
    : ends[0]
      ? { task: ends[0], kind: "end" as AlarmKind, key: endAlarmKey(ends[0]) }
      : null;

  if (state.alarmPreview) {
    const close = () => dispatch({ type: "alarm/preview", on: false });
    return (
      <AlarmScreen
        key="preview"
        task={previewTask(now, state.categories[0]?.id ?? "")}
        kind="start"
        category={state.categories[0]}
        waiting={0}
        settings={state.settings}
        now={now}
        onDone={close}
        onHold={close}
        onSnooze={close}
        onStop={close}
      />
    );
  }
  if (!current) return null;

  const { task, kind, key } = current;
  const remember = (update: (previous: AlarmMemory) => AlarmMemory) => setMemory(update);
  const stop = () => remember((previous) => ({ ...previous, dismissed: new Set(previous.dismissed).add(key) }));
  const snooze = () =>
    remember((previous) => ({
      ...previous,
      snoozedUntil: new Map(previous.snoozedUntil).set(key, Date.now() + SNOOZE_MINUTES * MS_PER_MINUTE),
    }));
  const mark = (status: MarkedStatus) => {
    stop();
    dispatch({ type: "task/status", id: task.id, status, now: new Date() });
  };

  return (
    <AlarmScreen
      key={key}
      task={task}
      kind={kind}
      category={state.categories.find((item) => item.id === task.categoryId)}
      waiting={starts.length + ends.length - 1}
      settings={state.settings}
      now={now}
      onDone={() => mark("C")}
      onHold={() => mark("H")}
      onSnooze={snooze}
      onStop={stop}
    />
  );
}

interface AlarmScreenProps {
  task: Task;
  kind: AlarmKind;
  category: Category | undefined;
  waiting: number;
  settings: Settings;
  now: Date;
  onDone: () => void;
  onHold: () => void;
  onSnooze: () => void;
  onStop: () => void;
}

/** Full-screen alarm, like the iPhone clock but in colour: flashing background, loud looping sound. */
function AlarmScreen({ task, kind, category, waiting, settings, now, onDone, onHold, onSnooze, onStop }: AlarmScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [flash] = useState(() => new Animated.Value(0));
  const color = settings.alarmColor === "category" ? (category?.color ?? FALLBACK_COLOR) : settings.alarmColor;
  const muted = t.fg2;

  // Loud looping sound, even with the ring/silent switch on, until the alarm is answered.
  useEffect(() => {
    if (!settings.alarmSound) return;
    const player = createAudioPlayer(ALARM_SOUND);
    player.loop = true;
    player.volume = 1;
    setAudioModeAsync({ playsInSilentMode: true })
      .catch(() => undefined)
      .finally(() => player.play());
    return () => player.remove();
  }, [settings.alarmSound]);

  useEffect(() => {
    if (!settings.alarmVibrate) return;
    Vibration.vibrate(VIBRATION_PATTERN, true);
    return () => Vibration.cancel();
  }, [settings.alarmVibrate]);

  useEffect(() => {
    if (!settings.alarmFlash) {
      flash.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: FLASH_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: FLASH_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [flash, settings.alarmFlash]);

  const headline = kind === "start" ? dueCountdown(task, now) : `Time's up · ended ${formatTime(endsAt(task), TIME_ZONE)}`;

  return (
    <Modal visible animationType="fade" onRequestClose={onStop} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: color,
            opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [FLASH_MIN, FLASH_MAX] }),
          }}
        />
        <View style={{ flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
          <View accessibilityRole="alert" style={{ alignItems: "center" }}>
            <Text style={{ color: t.accent, fontSize: 13, fontWeight: "700", letterSpacing: 3 }}>{kind === "start" ? "ALARM" : "TIME'S UP"}</Text>
            <Text style={{ color: t.fg, fontSize: 76, fontWeight: "200", letterSpacing: -2, marginTop: 6, fontVariant: ["tabular-nums"] }}>
              {formatTime(now, TIME_ZONE).replace(/\s?[AP]M$/, "")}
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.edge }}
            >
              <Ionicons name={category ? categoryIcon(category.icon) : "alarm-outline"} size={16} color={category?.color ?? t.accent} />
              <Text style={{ color: t.fg, fontSize: 14, fontWeight: "600" }}>{category?.name ?? "Task"}</Text>
              {waiting > 0 ? <Text style={{ color: muted, fontSize: 12 }}>+{waiting} more</Text> : null}
            </View>
          </View>

          <ScrollView style={{ flex: 1, marginTop: 28 }} contentContainerStyle={{ alignItems: "center", gap: 10 }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: t.fg, fontSize: 34, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 }}>{task.title}</Text>
            <Text style={{ color: muted, fontSize: 16, fontWeight: "500" }}>{headline}</Text>
            {task.description ? (
              <View style={{ alignSelf: "stretch", marginTop: 8, padding: 16, borderRadius: 24, backgroundColor: t.surface, borderWidth: 1, borderColor: t.edge }}>
                <Text style={{ color: t.fg, fontSize: 16, lineHeight: 23 }}>{task.description}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={{ gap: 12 }}>
            <AlarmButton label="Done" icon="checkmark" filled onPress={onDone} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <AlarmButton label={`Snooze ${SNOOZE_MINUTES} min`} icon="time-outline" onPress={onSnooze} />
              <AlarmButton label="On hold" icon="pause" onPress={onHold} />
            </View>
            <AlarmButton label="Stop" icon="stop-circle-outline" onPress={onStop} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Same shapes and colours as the app's own buttons: red primary, dark bordered secondary. */
function AlarmButton({ label, icon, filled, onPress }: { label: string; icon: React.ComponentProps<typeof Ionicons>["name"]; filled?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        height: 58,
        borderRadius: 29,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: filled ? t.accent : t.surface2,
        borderWidth: 1,
        borderColor: filled ? t.accentHi : t.edge,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={filled ? "#FFFFFF" : t.fg} />
      <Text style={{ color: filled ? "#FFFFFF" : t.fg, fontSize: 17, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
