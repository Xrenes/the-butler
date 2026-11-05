import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  type DayKey,
  addDays,
  dayKeyOf,
  dayOfMonth,
  formatLongDate,
  formatTime,
  formatWeekRange,
  startOfWeek,
  weekDays,
  weekdayShort,
} from "@domain/dates";
import { motivationLine, progressOf } from "@domain/progress";
import { tasksOnDay } from "@domain/tasks";
import type { Category, Task } from "@domain/types";
import { StatusRow } from "../rows";
import { TIME_ZONE, useStore } from "../store";
import { useTheme } from "../theme";
import { Card, Chip, CircleButton, EmptyState, Muted, SectionTitle, TickProgress, Title, tap } from "../ui";

const MAX_DOTS = 3;
const DAYS_PER_WEEK = 7;

function categoryColors(tasks: readonly Task[], categoryById: ReadonlyMap<string, Category>): string[] {
  const colors = tasks
    .map((task) => categoryById.get(task.categoryId)?.color)
    .filter((color): color is string => Boolean(color));
  return [...new Set(colors)].slice(0, MAX_DOTS);
}

/** Weekly only: Mon–Sun strip, the selected day's progress and its tasks. */
export function CalendarScreen({ now, onStatus, onEdit }: { now: Date; onStatus: (task: Task) => void; onEdit: (task: Task) => void }) {
  const t = useTheme();
  const { state } = useStore();
  const today = dayKeyOf(now, TIME_ZONE);
  const [selectedDay, setSelectedDay] = useState<DayKey>(today);
  const weekStart = startOfWeek(selectedDay);
  const dayTasks = tasksOnDay(state.tasks, selectedDay, TIME_ZONE);
  const progress = progressOf(dayTasks);
  const categoryById = new Map(state.categories.map((category) => [category.id, category]));
  const shiftWeek = (weeks: number) => setSelectedDay((day) => addDays(day, weeks * DAYS_PER_WEEK));

  return (
    <View style={{ gap: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Muted>Week of</Muted>
          <Title style={{ fontSize: 26 }}>{formatWeekRange(weekStart)}</Title>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <CircleButton icon="chevron-back" label="Previous week" onPress={() => shiftWeek(-1)} />
          <CircleButton icon="chevron-forward" label="Next week" onPress={() => shiftWeek(1)} />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 6 }}>
        {weekDays(weekStart).map((day) => {
          const selected = day === selectedDay;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={formatLongDate(day)}
              accessibilityState={{ selected }}
              onPress={() => {
                tap();
                setSelectedDay(day);
              }}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 6,
                paddingVertical: 14,
                borderRadius: 20,
                borderWidth: selected ? 1.5 : 1,
                borderColor: selected ? t.accent : t.edge,
                backgroundColor: selected ? t.surface2 : t.surface,
              }}
            >
              <Text style={{ color: selected ? t.fg : t.fg3, fontSize: 11 }}>{weekdayShort(day)}</Text>
              <Text style={{ color: selected ? t.fg : t.fg2, fontSize: 19, fontWeight: selected ? "600" : "500" }}>{dayOfMonth(day)}</Text>
              <View style={{ flexDirection: "row", gap: 3, height: 6 }}>
                {categoryColors(tasksOnDay(state.tasks, day, TIME_ZONE), categoryById).map((color) => (
                  <View key={color} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                ))}
              </View>
              {day === today && !selected ? (
                <View style={{ position: "absolute", top: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: t.accent }} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {startOfWeek(today) !== weekStart ? (
        <View style={{ alignItems: "center", marginTop: -8 }}>
          <Chip icon="calendar-outline" onPress={() => setSelectedDay(today)}>
            Back to this week
          </Chip>
        </View>
      ) : null}

      <Card style={{ gap: 14 }}>
        <Muted>{formatLongDate(selectedDay)}</Muted>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <Text style={{ color: t.fg, fontSize: 44, fontWeight: "300", letterSpacing: -1.5 }}>
            {progress.percent}
            <Text style={{ color: t.fg2, fontSize: 16 }}>%</Text>
          </Text>
          <View style={{ alignItems: "flex-end" }}>
            <Muted>Completed</Muted>
            <Text style={{ color: t.fg, fontSize: 18, fontWeight: "600" }}>
              {progress.done}/{progress.total} <Text style={{ color: t.fg2, fontSize: 12, fontWeight: "400" }}>tasks</Text>
            </Text>
          </View>
        </View>
        <TickProgress percent={progress.percent} />
        <Muted>{motivationLine(progress)}</Muted>
      </Card>

      <View>
        <SectionTitle>Tasks</SectionTitle>
        {dayTasks.length === 0 ? (
          <Card>
            <EmptyState icon="calendar-outline" title="Nothing on this day" hint="Tap + to plan a task." />
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {dayTasks.map((task) => {
              const category = categoryById.get(task.categoryId);
              return category ? (
                <StatusRow
                  key={task.id}
                  task={task}
                  category={category}
                  meta={formatTime(new Date(task.dueAt), TIME_ZONE)}
                  onStatus={() => onStatus(task)}
                  onEdit={() => onEdit(task)}
                />
              ) : null;
            })}
          </View>
        )}
      </View>
    </View>
  );
}
