import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type ComponentProps, useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  type AlarmMemory,
  SNOOZE_MINUTES,
  alarmKey,
  dueAlarms,
  dueCountdown,
  dueEndAlarms,
  endAlarmKey,
  endsAt,
  reminderFireAt,
  toAlarmMemory,
} from "@domain/alarms";
import { dayKeyOf, formatLongDate, formatTime } from "@domain/dates";
import { durationOf } from "@domain/tasks";
import type { Category, MarkedStatus, Task } from "@domain/types";
import { flashTabTitle, showBrowserAlarm } from "../alarms/browser";
import { useAlarmHealth } from "../alarms/health";
import { primeAlarmSound, startAlarmSound, stopAlarmSound } from "../alarms/sound";
import { type Settings, TIME_ZONE, useNow, useStore } from "../store";
import { readableOn, useTheme } from "../theme";
import { categoryIcon, tap } from "../ui";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const FALLBACK_COLOR = "#D83036";
/** First seen more than this long after its time, the alarm already rang while the app was closed. */
const LIVE_WINDOW_MS = 60_000;
const FLASH_MS = 520;
const PULSE_MS = 2400;
const DIM_GLOW = 0.35;
const STEADY_GLOW = 0.7;
const VIBRATION_PATTERN = [0, 700, 500];
const BADGE = 112;
const RING_COUNT = 3;

type AlarmKind = "start" | "end";
type IconName = ComponentProps<typeof Ionicons>["name"];

interface DueAlarm {
  task: Task;
  kind: AlarmKind;
  /** The alarm's own key (not a snooze's), so stop and snooze apply to the alarm itself. */
  key: string;
  /** When it started ringing: its time, or the end of its snooze. */
  fireAt: number;
}

function dueList(tasks: readonly Task[], now: Date, memory: AlarmMemory): DueAlarm[] {
  const starts = dueAlarms(tasks, now, memory).map((task): DueAlarm => {
    const key = alarmKey(task);
    return { task, kind: "start", key, fireAt: memory.snoozedUntil.get(key) ?? reminderFireAt(task).getTime() };
  });
  const ends = dueEndAlarms(tasks, now, memory).map((task): DueAlarm => {
    const key = endAlarmKey(task);
    return { task, kind: "end", key, fireAt: memory.snoozedUntil.get(key) ?? endsAt(task).getTime() };
  });
  return [...starts, ...ends].sort((a, b) => a.fireAt - b.fireAt);
}

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
    durationMinutes: 30,
    status: "pending",
    statusChangedAt: null,
    reminder: { enabled: true, leadMinutes: 0, includeTitle: true },
    sourceTaskId: null,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** Web: browsers block sound until the page is tapped, so the first tap unlocks the alarm sound. */
function usePrimeWebAudio() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const prime = () => primeAlarmSound();
    document.addEventListener("pointerdown", prime, { once: true, capture: true });
    return () => document.removeEventListener("pointerdown", prime, { capture: true });
  }, []);
}

/** Watches the clock and shows the earliest due alarm: a task starting, its time running out, or a snooze ending. */
export function AlarmWatcher() {
  const { state, dispatch } = useStore();
  const now = useNow(1000);
  const health = useAlarmHealth();
  const memory = useMemo(() => toAlarmMemory(state.alarmMemory), [state.alarmMemory]);
  usePrimeWebAudio();

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
        fireAt={now.getTime()}
        realAlarmRings={false}
        onDone={close}
        onHold={close}
        onSnooze={close}
        onStop={close}
      />
    );
  }

  const due = state.settings.inAppAlarm ? dueList(state.tasks, now, memory) : [];
  const current = due[0];
  if (!current) return null;

  const { task, kind, key } = current;
  const stop = () => dispatch({ type: "alarm/dismiss", key, at: Date.now() });
  const snooze = () => dispatch({ type: "alarm/snooze", key, until: Date.now() + SNOOZE_MINUTES * MS_PER_MINUTE });
  const mark = (status: MarkedStatus) => {
    dispatch({ type: "task/status", id: task.id, status, now: new Date() });
    stop();
  };

  return (
    <AlarmScreen
      key={`${key}|${current.fireAt}`}
      task={task}
      kind={kind}
      category={state.categories.find((item) => item.id === task.categoryId)}
      waiting={due.length - 1}
      settings={state.settings}
      now={now}
      fireAt={current.fireAt}
      // The iPhone's real alarm already rings with sound; the app adds the screen and buttons.
      realAlarmRings={health?.mode === "alarm"}
      onDone={() => mark("C")}
      onHold={() => mark("H")}
      onSnooze={snooze}
      onStop={stop}
    />
  );
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduce(value);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const byte = Math.round(Math.min(Math.max(alpha, 0), 1) * 255);
  return `${hex}${byte.toString(16).padStart(2, "0")}`;
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

interface AlarmScreenProps {
  task: Task;
  kind: AlarmKind;
  category: Category | undefined;
  waiting: number;
  settings: Settings;
  now: Date;
  fireAt: number;
  realAlarmRings: boolean;
  onDone: () => void;
  onHold: () => void;
  onSnooze: () => void;
  onStop: () => void;
}

/** Sound, vibration and the web's notification and tab title, for as long as the alarm is up. */
function useAlarmSignals(options: { sound: boolean; vibrate: boolean; web: { title: string; body: string; tag: string } | null }) {
  const { sound, vibrate, web } = options;
  useEffect(() => {
    if (!sound) return;
    void startAlarmSound();
    return () => stopAlarmSound();
  }, [sound]);

  useEffect(() => {
    if (!vibrate || Platform.OS === "web") return;
    Vibration.vibrate(VIBRATION_PATTERN, true);
    return () => Vibration.cancel();
  }, [vibrate]);

  const webTitle = web?.title;
  const webBody = web?.body;
  const webTag = web?.tag;
  useEffect(() => {
    if (Platform.OS !== "web" || !webTitle || !webTag) return;
    showBrowserAlarm(webTitle, webBody ?? "", webTag);
    return flashTabTitle(`⏰ ${webTitle}`);
  }, [webTitle, webBody, webTag]);
}

/** Full-screen alarm in the app's dark theme: a glowing colour wash, pulsing badge, big clock and clear actions. */
function AlarmScreen({ task, kind, category, waiting, settings, now, fireAt, realAlarmRings, onDone, onHold, onSnooze, onStop }: AlarmScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  // Decided once per alarm: one that went off while the app was closed is shown quietly.
  const [live] = useState(() => now.getTime() - fireAt < LIVE_WINDOW_MS);
  const color = settings.alarmColor === "category" ? (category?.color ?? FALLBACK_COLOR) : settings.alarmColor;
  const onColor = readableOn(color);

  const due = new Date(task.dueAt);
  const range = `${formatTime(due, TIME_ZONE)} – ${formatTime(endsAt(task), TIME_ZONE)}`;
  const headline = kind === "end" ? "Time is up" : dueCountdown(task, now);
  const [clock, meridiem] = formatTime(now, TIME_ZONE).split(" ");
  const where = category?.name ?? "Task";

  useAlarmSignals({
    sound: live && settings.alarmSound && !realAlarmRings,
    vibrate: live && settings.alarmVibrate,
    web: live ? { title: task.title, body: `${where} · ${headline}`, tag: `${task.id}|${kind}|${fireAt}` } : null,
  });

  const animate = live && !reduceMotion;
  const [glow] = useState(() => new Animated.Value(STEADY_GLOW));
  useEffect(() => {
    if (!animate || !settings.alarmFlash) {
      glow.setValue(STEADY_GLOW);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: FLASH_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: DIM_GLOW, duration: FLASH_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [animate, glow, settings.alarmFlash]);

  const wash: readonly [string, string, string] = [withAlpha(color, 0.9), withAlpha(color, 0.28), withAlpha(t.bg, 0)];

  return (
    <Modal visible animationType="fade" onRequestClose={onStop} statusBarTranslucent supportedOrientations={["portrait"]}>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: t.bg }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: glow }]}>
          <LinearGradient colors={wash} locations={[0, 0.42, 0.85]} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <View style={{ flex: 1, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 18, paddingHorizontal: 22 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.35)" }}>
              <Ionicons name={kind === "end" ? "flag" : "alarm"} size={14} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700", letterSpacing: 2 }}>{kind === "end" ? "TIME'S UP" : "ALARM"}</Text>
            </View>
            {waiting > 0 ? <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "600" }}>+{waiting} more</Text> : null}
          </View>

          <View style={{ alignItems: "center", marginTop: 10 }} accessible accessibilityLabel={`It is ${clock} ${meridiem ?? ""}`}>
            <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 84, fontWeight: "200", letterSpacing: -3, fontVariant: ["tabular-nums"] }}>{clock}</Text>
              {meridiem ? <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "500", marginBottom: 18, marginLeft: 6 }}>{meridiem}</Text> : null}
            </View>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, marginTop: -6 }}>{formatLongDate(dayKeyOf(now, TIME_ZONE))}</Text>
          </View>

          <View style={{ height: BADGE * 2.1, alignItems: "center", justifyContent: "center" }}>
            <PulseRings color={color} active={animate} />
            <View
              style={{
                width: BADGE,
                height: BADGE,
                borderRadius: BADGE * 0.3,
                backgroundColor: color,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.25)",
                shadowColor: color,
                shadowOpacity: 0.85,
                shadowRadius: 34,
                shadowOffset: { width: 0, height: 0 },
                elevation: 18,
              }}
            >
              <Ionicons name={category ? categoryIcon(category.icon) : "alarm"} size={52} color={onColor} />
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: "center", gap: 10, paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
            <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 30, fontWeight: "700", textAlign: "center", letterSpacing: -0.6 }} numberOfLines={3}>
              {task.title}
            </Text>
            <Text style={{ color: kind === "end" ? color : t.fg, fontSize: 16, fontWeight: "600" }}>{headline}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
              <InfoChip icon={category ? categoryIcon(category.icon) : "pricetag-outline"} tint={category?.color ?? t.fg2} label={where} />
              <InfoChip icon="time-outline" tint={t.fg2} label={range} />
              <InfoChip icon="hourglass-outline" tint={t.fg2} label={durationLabel(durationOf(task))} />
            </View>
            {!live ? (
              <Text style={{ color: t.fg3, fontSize: 13, textAlign: "center" }}>This alarm rang while the app was closed.</Text>
            ) : null}
            {task.description ? (
              <View style={{ alignSelf: "stretch", marginTop: 4, padding: 16, borderRadius: 22, backgroundColor: t.surface, borderWidth: 1, borderColor: t.edge }}>
                <Text style={{ color: t.fg2, fontSize: 12, fontWeight: "600", letterSpacing: 0.6, marginBottom: 6 }}>NOTES</Text>
                <Text style={{ color: t.fg, fontSize: 15, lineHeight: 22 }}>{task.description}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={{ gap: 10, paddingTop: 6 }}>
            <AlarmButton label="Done" icon="checkmark" color={color} textColor={onColor} onPress={onDone} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <AlarmButton label={`Snooze ${SNOOZE_MINUTES} min`} icon="time-outline" onPress={onSnooze} />
              <AlarmButton label="On hold" icon="pause" onPress={onHold} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop alarm"
              hitSlop={8}
              onPress={() => {
                tap();
                onStop();
              }}
              style={({ pressed }) => ({ alignSelf: "center", paddingVertical: 10, paddingHorizontal: 28, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ color: t.fg2, fontSize: 15, fontWeight: "600" }}>Stop alarm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Rounded squares that grow and fade out of the badge, one after another. */
function PulseRings({ color, active }: { color: string; active: boolean }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [phases] = useState(() =>
    Array.from({ length: RING_COUNT }, (_, ring) => Animated.modulo(Animated.add(progress, ring / RING_COUNT), 1)),
  );
  useEffect(() => {
    if (!active) return;
    progress.setValue(0);
    const loop = Animated.loop(Animated.timing(progress, { toValue: 1, duration: PULSE_MS, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [active, progress]);

  if (!active) return null;
  return (
    <>
      {phases.map((phase, ring) => (
        <Animated.View
          key={ring}
          pointerEvents="none"
          style={{
            position: "absolute",
            width: BADGE,
            height: BADGE,
            borderRadius: BADGE * 0.3,
            borderWidth: 2,
            borderColor: color,
            opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: phase.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
          }}
        />
      ))}
    </>
  );
}

function InfoChip({ icon, tint, label }: { icon: IconName; tint: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.edge }}>
      <Ionicons name={icon} size={14} color={tint} />
      <Text style={{ color: t.fg, fontSize: 13, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}

interface AlarmButtonProps {
  label: string;
  icon: IconName;
  /** Filled with this colour; without it, the app's dark secondary style. */
  color?: string;
  textColor?: string;
  onPress: () => void;
}

function AlarmButton({ label, icon, color, textColor, onPress }: AlarmButtonProps) {
  const t = useTheme();
  const filled = color !== undefined;
  const foreground = filled ? (textColor ?? "#FFFFFF") : t.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: filled ? undefined : 1,
        height: filled ? 62 : 56,
        borderRadius: filled ? 31 : 28,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: filled ? color : t.surface2,
        borderWidth: 1,
        borderColor: filled ? "rgba(255,255,255,0.25)" : t.edge,
        opacity: pressed ? 0.82 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Ionicons name={icon} size={filled ? 22 : 19} color={foreground} />
      <Text style={{ color: foreground, fontSize: filled ? 18 : 16, fontWeight: filled ? "700" : "600" }}>{label}</Text>
    </Pressable>
  );
}
