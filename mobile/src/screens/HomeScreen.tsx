import { Text, View } from "react-native";
import { dayKeyOf, formatDayLabel, formatLongDate, formatTime, zonedParts } from "@domain/dates";
import { completedPerDay, motivationLine, progressOf } from "@domain/progress";
import { groupByDay, tasksOnDay, upcomingTasks } from "@domain/tasks";
import type { Task } from "@domain/types";
import { UpcomingRow } from "../rows";
import { TIME_ZONE, useStore } from "../store";
import { STATUS_HEX, useTheme } from "../theme";
import { ArcGauge, Card, DayPulse, DotMatrix, EmptyState, Hero, Muted, Pill, SectionTitle, StatTile, Title } from "../ui";

const MAX_DAY_GROUPS = 4;
const CONSISTENCY_DAYS = 35;
const MINUTES_PER_DAY = 1440;

export function HomeScreen({ now, onEdit }: { now: Date; onEdit: (task: Task) => void }) {
  const t = useTheme();
  const { state } = useStore();
  const today = dayKeyOf(now, TIME_ZONE);
  const todays = tasksOnDay(state.tasks, today, TIME_ZONE);
  const progress = progressOf(todays);
  const upcoming = upcomingTasks(state.tasks, now, TIME_ZONE);
  const nextTask = upcoming.find((task) => new Date(task.dueAt).getTime() >= now.getTime());
  const groups = groupByDay(upcoming, TIME_ZONE).slice(0, MAX_DAY_GROUPS);
  const categoryById = new Map(state.categories.map((category) => [category.id, category]));
  const statusText = progress.total > 0 ? `In progress · ${progress.done} of ${progress.total}` : "Nothing planned yet";
  const minutesOf = (date: Date) => {
    const parts = zonedParts(date, TIME_ZONE);
    return parts.hour * 60 + parts.minute;
  };

  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 6 }}>
        <Muted>{formatLongDate(today)}</Muted>
        <Title>Today&apos;s focus</Title>
      </View>

      <Hero>
        <ArcGauge percent={progress.percent}>
          <Text style={{ color: t.fg2, fontSize: 14 }}>Completed</Text>
          <Text style={{ color: t.fg, fontSize: 52, fontWeight: "300", letterSpacing: -2 }}>
            {progress.percent}
            <Text style={{ color: t.fg2, fontSize: 18 }}>%</Text>
          </Text>
        </ArcGauge>
        <View style={{ alignItems: "center", marginTop: 4 }}>
          <Pill icon="time-outline">{statusText}</Pill>
        </View>
        <Text style={{ color: t.fg2, fontSize: 13, textAlign: "center", marginTop: 16 }}>{motivationLine(progress)}</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <StatTile label="Done today" value={`${progress.done}/${progress.total}`} unit="tasks" color={STATUS_HEX.C} />
          <StatTile label="Next up" value={nextTask ? formatTime(new Date(nextTask.dueAt), TIME_ZONE) : "—"} />
        </View>
      </Hero>

      <Card>
        <SectionTitle>Timeline</SectionTitle>
        <DayPulse
          points={todays.map((task) => ({
            percent: (minutesOf(new Date(task.dueAt)) / MINUTES_PER_DAY) * 100,
            status: task.status,
          }))}
          nowPercent={(minutesOf(now) / MINUTES_PER_DAY) * 100}
        />
      </Card>

      <View>
        <SectionTitle>Up next</SectionTitle>
        {groups.length === 0 ? (
          <Card>
            <EmptyState icon="sparkles-outline" title="You're all clear" hint="Tap + to add a task that moves you forward." />
          </Card>
        ) : (
          <View style={{ gap: 16 }}>
            {groups.map((group) => (
              <View key={group.day} style={{ gap: 8 }}>
                <Text style={{ color: t.fg3, fontSize: 12, fontWeight: "500", letterSpacing: 0.6, textTransform: "uppercase", paddingHorizontal: 4 }}>
                  {formatDayLabel(group.day, today)}
                </Text>
                {group.tasks.map((task) => {
                  const category = categoryById.get(task.categoryId);
                  return category ? <UpcomingRow key={task.id} task={task} category={category} onOpen={() => onEdit(task)} /> : null;
                })}
              </View>
            ))}
          </View>
        )}
      </View>

      <Card>
        <SectionTitle>Consistency</SectionTitle>
        <DotMatrix counts={completedPerDay(state.tasks, today, CONSISTENCY_DAYS, TIME_ZONE)} />
        <Muted style={{ marginTop: 14 }}>Each column is a week. Every red dot is a day you completed tasks.</Muted>
      </Card>
    </View>
  );
}
