import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { zonedParts } from "@domain/dates";
import { durationOf, sortByDue } from "@domain/tasks";
import type { Category, Task } from "@domain/types";
import { TIME_ZONE } from "../store";
import { useTheme } from "../theme";
import { StatusSquare, tap } from "../ui";

const HOUR_WIDTH = 84;
const PLOT_HEIGHT = 200;
const Y_AXIS_WIDTH = 44;
const X_AXIS_HEIGHT = 22;
const TOP_PAD = 30;
const BAR_WIDTH = 30;
const STEP_MINUTES = 30;
const MIN_SCALE_MINUTES = 120;
const MINUTES_PER_HOUR = 60;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;
const LEAD_IN_PX = 40;
const TITLE_WIDTH = 72;

function minutesOf(date: Date): number {
  const parts = zonedParts(date, TIME_ZONE);
  return parts.hour * MINUTES_PER_HOUR + parts.minute;
}

function hourLabel(hour: number): string {
  const clock = hour % 12 === 0 ? 12 : hour % 12;
  return `${clock}${hour % 24 < 12 ? "a" : "p"}`;
}

function durationLabel(minutes: number): string {
  if (minutes === 0) return "0";
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}.5h`;
}

interface DayScheduleProps {
  tasks: readonly Task[];
  categories: readonly Category[];
  /** Minutes since midnight to draw the "now" line at, or null for other days. */
  nowMinutes: number | null;
  onEdit: (task: Task) => void;
  onStatus: (task: Task) => void;
}

/**
 * The day as a bar chart: time of day along the bottom (x), duration up the side (y) in 30-minute
 * steps. Each task is a bar standing at its start time, as tall as it takes.
 */
export function DaySchedule({ tasks, categories, nowMinutes, onEdit, onStatus }: DayScheduleProps) {
  const t = useTheme();
  const bars = sortByDue(tasks).map((task) => ({ task, start: minutesOf(new Date(task.dueAt)), minutes: durationOf(task) }));
  const colorOf = new Map(categories.map((category) => [category.id, category.color]));

  const longest = Math.max(MIN_SCALE_MINUTES, ...bars.map((bar) => bar.minutes));
  const scale = Math.ceil(longest / STEP_MINUTES) * STEP_MINUTES;
  const steps = Array.from({ length: scale / STEP_MINUTES + 1 }, (_, index) => index * STEP_MINUTES);
  const y = (minutes: number) => TOP_PAD + PLOT_HEIGHT - (minutes / scale) * PLOT_HEIGHT;

  const startHour = Math.min(DEFAULT_START_HOUR, ...bars.map((bar) => Math.floor(bar.start / MINUTES_PER_HOUR)));
  const endHour = Math.max(DEFAULT_END_HOUR, ...bars.map((bar) => Math.ceil(bar.start / MINUTES_PER_HOUR) + 1));
  const x = (minutes: number) => ((minutes - startHour * MINUTES_PER_HOUR) / MINUTES_PER_HOUR) * HOUR_WIDTH + BAR_WIDTH;
  const width = x(Math.min(24, endHour) * MINUTES_PER_HOUR) + BAR_WIDTH;
  const hours = Array.from({ length: Math.min(24, endHour) - startHour + 1 }, (_, index) => startHour + index);
  const height = TOP_PAD + PLOT_HEIGHT + X_AXIS_HEIGHT;
  const focus = nowMinutes ?? bars[0]?.start ?? startHour * MINUTES_PER_HOUR;
  const showNow = nowMinutes !== null && nowMinutes >= startHour * MINUTES_PER_HOUR && nowMinutes <= endHour * MINUTES_PER_HOUR;

  return (
    <View style={{ flexDirection: "row", height }}>
      <View style={{ width: Y_AXIS_WIDTH, height }}>
        {steps.map((minutes) => (
          <Text key={minutes} style={{ position: "absolute", top: y(minutes) - 7, right: 8, color: t.fg3, fontSize: 11, fontVariant: ["tabular-nums"] }}>
            {durationLabel(minutes)}
          </Text>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentOffset={{ x: Math.max(0, x(focus) - LEAD_IN_PX), y: 0 }}>
        <View style={{ width, height }}>
          {steps.map((minutes) => (
            <View
              key={minutes}
              pointerEvents="none"
              style={{ position: "absolute", left: 0, right: 0, top: y(minutes), height: StyleSheet.hairlineWidth, backgroundColor: minutes === 0 ? t.fg3 : t.line }}
            />
          ))}
          {hours.map((hour) => (
            <Text
              key={hour}
              style={{ position: "absolute", top: TOP_PAD + PLOT_HEIGHT + 6, left: x(hour * MINUTES_PER_HOUR) - 12, width: 24, textAlign: "center", color: t.fg2, fontSize: 11 }}
            >
              {hourLabel(hour)}
            </Text>
          ))}

          {showNow ? (
            <View pointerEvents="none" style={{ position: "absolute", left: x(nowMinutes), top: TOP_PAD - 6, height: PLOT_HEIGHT + 6, width: 1.5, backgroundColor: t.accent }} />
          ) : null}

          {bars.map(({ task, start, minutes }) => {
            const color = colorOf.get(task.categoryId) ?? t.accent;
            const top = y(Math.min(minutes, scale));
            return (
              <View key={task.id} style={{ position: "absolute", left: x(start) - TITLE_WIDTH / 2, width: TITLE_WIDTH, top: top - 26, alignItems: "center" }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Change status of ${task.title}`} hitSlop={8} onPress={() => { tap(); onStatus(task); }}>
                  <StatusSquare status={task.status} size={14} />
                </Pressable>
                <Text style={{ color: t.fg2, fontSize: 10, maxWidth: TITLE_WIDTH }} numberOfLines={1}>
                  {task.title}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${task.title}, ${durationLabel(minutes)}`}
                  onPress={() => {
                    tap();
                    onEdit(task);
                  }}
                  style={({ pressed }) => ({
                    width: BAR_WIDTH,
                    height: Math.max(TOP_PAD + PLOT_HEIGHT - top, 4),
                    marginTop: 0,
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                    backgroundColor: color,
                    opacity: pressed ? 0.75 : 0.9,
                  })}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
