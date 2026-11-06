import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  type PressableProps,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import type { Category, CategoryIcon, MarkedStatus, TaskStatus } from "@domain/types";
import { STATUS_HEX, readableOn, useTheme } from "./theme";

export type IconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_ICON_MAP: Record<CategoryIcon, IconName> = {
  book: "book-outline",
  dumbbell: "barbell-outline",
  briefcase: "briefcase-outline",
  home: "home-outline",
  sparkles: "sparkles-outline",
  heart: "heart-outline",
  cart: "cart-outline",
  plane: "airplane-outline",
  music: "musical-notes-outline",
  code: "code-slash-outline",
  graduation: "school-outline",
  coffee: "cafe-outline",
  leaf: "leaf-outline",
  star: "star-outline",
  users: "people-outline",
  palette: "color-palette-outline",
  gamepad: "game-controller-outline",
  camera: "camera-outline",
};

export const categoryIcon = (icon: CategoryIcon): IconName => CATEGORY_ICON_MAP[icon];

export function tap() {
  Haptics.selectionAsync().catch(() => undefined);
}

/* ---------- text ---------- */

export function Title({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[{ color: t.fg, fontSize: 30, fontWeight: "600", letterSpacing: -0.6 }, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[{ color: t.fg2, fontSize: 13 }, style]}>{children}</Text>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text style={{ color: t.fg, fontSize: 18, fontWeight: "600" }}>{children}</Text>
      {action}
    </View>
  );
}

/* ---------- surfaces ---------- */

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.surface, borderColor: t.edge, borderWidth: 1, borderRadius: 24, padding: 16 }, style]}>
      {children}
    </View>
  );
}

export function Well({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.well, borderColor: t.edge, borderWidth: 1, borderRadius: 24 }, style]}>
      {children}
    </View>
  );
}

export function Hero({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <LinearGradient
      colors={t.mode === "dark" ? ["#323232", "#222222"] : ["#FFFFFF", "#F1F1F1"]}
      style={[{ borderRadius: 32, padding: 20, borderWidth: 1, borderColor: t.edge }, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function Pill({ icon, children }: { icon?: IconName; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: t.surface2, borderColor: t.edge }]}>
      {icon ? <Ionicons name={icon} size={14} color={t.fg2} /> : null}
      <Text style={{ color: t.fg2, fontSize: 12 }}>{children}</Text>
    </View>
  );
}

/* ---------- buttons ---------- */

interface CircleProps extends Omit<PressableProps, "children"> {
  icon: IconName;
  label: string;
  size?: number;
  variant?: "dark" | "accent";
  badge?: boolean;
}

export function CircleButton({ icon, label, size = 44, variant = "dark", badge, onPress, disabled, ...rest }: CircleProps) {
  const t = useTheme();
  const accent = variant === "accent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={6}
      onPress={(event) => {
        tap();
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: accent ? t.accent : t.surface2,
          borderColor: accent ? t.accentHi : t.edge,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
      ]}
      {...rest}
    >
      <Ionicons name={icon} size={Math.round(size * 0.46)} color={accent ? "#FFFFFF" : t.fg} />
      {badge ? <View style={[styles.badge, { backgroundColor: t.accent, borderColor: t.bg }]} /> : null}
    </Pressable>
  );
}

interface ButtonProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  color?: string;
  style?: ViewStyle;
}

export function PrimaryButton({ children, onPress, disabled, color, style }: ButtonProps) {
  const t = useTheme();
  const fill = color ?? t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: fill, opacity: disabled ? 0.4 : pressed ? 0.85 : 1, flex: 1 },
        style,
      ]}
    >
      <Text style={{ color: readableOn(fill), fontSize: 16, fontWeight: "600" }}>{children}</Text>
    </Pressable>
  );
}

export function GhostButton({ children, onPress, style }: ButtonProps) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: t.surface2, borderColor: t.edge, borderWidth: 1, opacity: pressed ? 0.8 : 1, flex: 1 },
        style,
      ]}
    >
      <Text style={{ color: t.fg, fontSize: 15, fontWeight: "500" }} numberOfLines={1}>
        {children}
      </Text>
    </Pressable>
  );
}

export function Chip({
  children,
  icon,
  active,
  color,
  onPress,
}: {
  children: ReactNode;
  icon?: IconName;
  active?: boolean;
  color?: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  const fill = color ?? t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={[
        styles.chip,
        active
          ? { backgroundColor: fill, borderColor: fill }
          : { backgroundColor: t.surface, borderColor: t.line },
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={active ? readableOn(fill) : t.fg2} /> : null}
      <Text style={{ color: active ? readableOn(fill) : t.fg2, fontSize: 14 }}>{children}</Text>
    </Pressable>
  );
}

/* ---------- inputs ---------- */

export function Toggle({
  label,
  description,
  icon,
  value,
  onChange,
  accent,
}: {
  label: string;
  description?: string;
  icon?: IconName;
  value: boolean;
  onChange: (value: boolean) => void;
  accent?: string;
}) {
  const t = useTheme();
  return (
    <View style={styles.toggle}>
      {icon ? (
        <View style={[styles.toggleIcon, { backgroundColor: t.surface2 }]}>
          <Ionicons name={icon} size={18} color={t.fg2} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.fg, fontSize: 15 }}>{label}</Text>
        {description ? <Text style={{ color: t.fg2, fontSize: 12, marginTop: 2 }}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(next) => {
          tap();
          onChange(next);
        }}
        trackColor={{ false: t.line, true: accent ?? t.accent }}
        thumbColor="#FFFFFF"
        // The web preview has its own default thumb colour; phones use thumbColor.
        {...(Platform.OS === "web" ? ({ activeThumbColor: "#FFFFFF" } as object) : {})}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accent,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accent?: string;
}) {
  const t = useTheme();
  const fill = accent ?? t.accent;
  return (
    <View style={[styles.segmented, { backgroundColor: t.well, borderColor: t.edge }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tap();
              onChange(option.value);
            }}
            style={[styles.segment, active && { backgroundColor: fill }]}
          >
            <Text style={{ color: active ? readableOn(fill) : t.fg2, fontSize: 13, fontWeight: active ? "600" : "400" }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatTile({
  label,
  value,
  unit,
  color,
  leading,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  leading?: ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: t.surface, borderColor: t.edge }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {leading}
        <Text style={{ color: t.fg2, fontSize: 12, flexShrink: 1 }} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={{ color: color ?? t.fg, fontSize: 22, fontWeight: "600", marginTop: 6 }}>
        {value}
        {unit ? <Text style={{ color: t.fg2, fontSize: 12, fontWeight: "400" }}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 24, gap: 6 }}>
      <View style={[styles.toggleIcon, { backgroundColor: t.surface2, width: 48, height: 48, borderRadius: 24 }]}>
        <Ionicons name={icon} size={22} color={t.fg2} />
      </View>
      <Text style={{ color: t.fg, fontSize: 15, fontWeight: "500" }}>{title}</Text>
      {hint ? <Text style={{ color: t.fg2, fontSize: 13, textAlign: "center" }}>{hint}</Text> : null}
    </View>
  );
}

/* ---------- task bits ---------- */

const STATUS_GLYPH: Record<Exclude<MarkedStatus, "H">, IconName> = { C: "checkmark-sharp", NC: "close-sharp" };

/**
 * Task status as an icon only: green tick (done), yellow circle (on hold), red cross (not done),
 * and a faint grey ring for a task not marked yet.
 */
export function StatusSquare({ status, size = 22 }: { status: TaskStatus; size?: number }) {
  const t = useTheme();
  const box = { width: size, height: size, alignItems: "center", justifyContent: "center" } as const;
  if (status === "pending") {
    return (
      <View style={box}>
        <View style={{ width: size * 0.82, height: size * 0.82, borderRadius: size, borderWidth: 1.5, borderColor: t.fg3 }} />
      </View>
    );
  }
  if (status === "H") {
    return (
      <View style={box}>
        <View style={{ width: size * 0.66, height: size * 0.66, borderRadius: size, backgroundColor: STATUS_HEX.H }} />
      </View>
    );
  }
  return (
    <View style={box}>
      <Ionicons name={STATUS_GLYPH[status]} size={Math.round(size * 1.15)} color={STATUS_HEX[status]} />
    </View>
  );
}

export function CategoryBadge({ category, size = 40 }: { category: Category; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: category.color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={categoryIcon(category.icon)} size={Math.round(size * 0.5)} color={readableOn(category.color)} />
    </View>
  );
}

/* ---------- sheet ---------- */

const SHEET_CLOSE_DISTANCE = 110;
const SHEET_CLOSE_VELOCITY = 0.9;
const CLOSE_ICON = 34;

/**
 * Bottom sheet: dimmed backdrop, centred title with a hollow ✕, scrolling body.
 * Pulling the top of the sheet down closes it, the same as the ✕.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [drag] = useState(() => new Animated.Value(0));
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (open) drag.setValue(0);
  }, [open, drag]);

  // The handlers read closeRef only while a finger is moving, never during render.
  const pull = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => drag.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > SHEET_CLOSE_DISTANCE || gesture.vy > SHEET_CLOSE_VELOCITY) {
            Keyboard.dismiss();
            closeRef.current();
            return;
          }
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        },
        onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [drag],
  );

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable
          accessibilityLabel="Dismiss"
          style={[StyleSheet.absoluteFill, { backgroundColor: t.overlay }]}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        />
        <View style={styles.sheetHost} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: t.canvas,
                borderColor: t.edge,
                paddingBottom: Math.max(insets.bottom, 16),
                transform: [{ translateY: drag }],
              },
            ]}
          >
            <View {...pull.panHandlers} style={{ paddingTop: 2 }}>
              <View style={[styles.grab, { backgroundColor: t.line }]} />
              <View style={styles.sheetHeader}>
                <View style={{ width: CLOSE_ICON }} />
                <Text style={{ color: t.fg, fontSize: 19, fontWeight: "600", flex: 1, textAlign: "center" }} numberOfLines={1}>
                  {title}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={10}
                  onPress={() => {
                    tap();
                    Keyboard.dismiss();
                    onClose();
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Ionicons name="close-circle-outline" size={CLOSE_ICON} color={t.fg2} />
                </Pressable>
              </View>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- gestures ---------- */

/** Lets a gesture inside a screen (the finance card stack) pause the page's own scrolling. */
export const ScrollLockContext = createContext<(locked: boolean) => void>(() => undefined);

export function useScrollLock(): (locked: boolean) => void {
  return useContext(ScrollLockContext);
}

/* ---------- charts ---------- */

const GAUGE = 260;
const GAUGE_R = 108;
/** Semicircle: from the left end, over the top, to the right end. */
const GAUGE_START = 180;
const GAUGE_SWEEP = 180;
const GAUGE_STROKE = 14;
const GAUGE_HEIGHT = GAUGE / 2 + GAUGE_STROKE;

function polar(deg: number, radius: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: GAUGE / 2 + radius * Math.cos(rad), y: GAUGE / 2 + radius * Math.sin(rad) };
}

function arc(radius: number): string {
  const a = polar(GAUGE_START, radius);
  const b = polar(GAUGE_START + GAUGE_SWEEP, radius);
  return `M${a.x} ${a.y} A${radius} ${radius} 0 1 1 ${b.x} ${b.y}`;
}

/** Semicircle progress bar with the value sitting inside the arch. */
export function ArcGauge({ percent, children }: { percent: number; children: ReactNode }) {
  const t = useTheme();
  const length = (GAUGE_R * GAUGE_SWEEP * Math.PI) / 180;
  const filled = Math.max(0, Math.min(100, percent)) / 100;
  return (
    <View style={{ width: GAUGE, height: GAUGE_HEIGHT, alignSelf: "center", alignItems: "center", justifyContent: "flex-end" }}>
      <Svg width={GAUGE} height={GAUGE_HEIGHT} style={StyleSheet.absoluteFill}>
        <Path d={arc(GAUGE_R)} stroke={t.dotOff} strokeWidth={GAUGE_STROKE} strokeLinecap="round" fill="none" />
        <Path d={arc(GAUGE_R - 24)} stroke={t.dotOff} strokeWidth={2} strokeDasharray="1 7" strokeLinecap="round" fill="none" />
        {filled > 0 ? (
          <Path
            d={arc(GAUGE_R)}
            stroke={t.accent}
            strokeWidth={GAUGE_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${length * filled} ${length}`}
          />
        ) : null}
      </Svg>
      <View style={{ alignItems: "center", marginBottom: 2 }}>{children}</View>
    </View>
  );
}

/** One column per week, one dot per task completed that day. */
export function DotMatrix({ counts }: { counts: readonly number[] }) {
  const t = useTheme();
  const columns = Math.ceil(counts.length / 7);
  const weeks = Array.from({ length: columns }, (_, week) => counts.slice(week * 7, week * 7 + 7));
  return (
    <View style={{ flexDirection: "row", gap: 6, justifyContent: "space-between" }}>
      {weeks.map((week, index) => (
        <View key={index} style={{ gap: 6, flex: 1, alignItems: "center" }}>
          {week.map((count, day) => (
            <View
              key={day}
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: count > 0 ? t.accent : t.dotOff,
                opacity: count > 0 ? Math.min(1, 0.5 + count * 0.18) : 1,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function TickProgress({ percent }: { percent: number }) {
  const t = useTheme();
  const ticks = 28;
  const lit = Math.round((percent / 100) * ticks);
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", height: 22, alignItems: "flex-end" }}>
      {Array.from({ length: ticks }, (_, index) => (
        <View
          key={index}
          style={{ width: 4, height: index < lit ? 22 : 14, borderRadius: 2, backgroundColor: index < lit ? t.accent : t.dotOff }}
        />
      ))}
    </View>
  );
}

const PULSE_W = 300;
const PULSE_H = 90;
const PEAK: Record<TaskStatus, number> = { C: 1, H: 0.6, NC: 0.3, pending: 0.8 };

/** Heartbeat line across the day: one spike per task, brighter for completed ones. */
export function DayPulse({ points, nowPercent }: { points: { percent: number; status: TaskStatus }[]; nowPercent: number }) {
  const t = useTheme();
  const base = PULSE_H * 0.62;
  const sorted = [...points].sort((a, b) => a.percent - b.percent);
  let d = `M0 ${base}`;
  for (const point of sorted) {
    const x = (point.percent / 100) * PULSE_W;
    const peak = PEAK[point.status] * (PULSE_H * 0.55);
    d += ` L${x - 14} ${base} L${x - 6} ${base + 8} L${x} ${base - peak} L${x + 7} ${base + 12} L${x + 14} ${base}`;
  }
  d += ` L${PULSE_W} ${base}`;
  const nowX = (nowPercent / 100) * PULSE_W;
  const labels = ["12 AM", "6 AM", "12 PM", "6 PM"];
  return (
    <View>
      <Svg width="100%" height={PULSE_H} viewBox={`0 0 ${PULSE_W} ${PULSE_H}`} preserveAspectRatio="none">
        <Path d={d} stroke={t.fg} strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={nowX} cy={base} r={7} fill={t.accent} />
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        {labels.map((label) => (
          <Text key={label} style={{ color: t.fg3, fontSize: 11 }}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Calls `onTick` once when mounted; used to focus nothing but keep hooks tidy in screens. */
export function useOnMount(callback: () => void) {
  const ref = useRef(callback);
  useEffect(() => ref.current(), []);
}

const styles = StyleSheet.create({
  sectionTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1 },
  circle: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  badge: { position: "absolute", top: 9, right: 10, width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  button: { height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  toggleIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  segmented: { flexDirection: "row", borderRadius: 20, borderWidth: 1, padding: 4 },
  segment: { flex: 1, height: 36, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tile: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 14 },
  sheetHost: { flex: 1, justifyContent: "flex-end" },
  sheet: { maxHeight: "92%", borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, paddingHorizontal: 20, paddingTop: 10 },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
});
