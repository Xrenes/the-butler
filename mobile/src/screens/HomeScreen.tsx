import { Text, View } from "react-native";
import { dayKeyOf, formatDayLabel, formatTime } from "@domain/dates";
import { motivationLine, progressOf } from "@domain/progress";
import { groupByDay, tasksOnDay, upcomingTasks } from "@domain/tasks";
import type { Task } from "@domain/types";
import { UpcomingRow } from "../rows";
import { TIME_ZONE, useStore } from "../store";
import { STATUS_HEX, useTheme } from "../theme";
import { ArcGauge, Card, EmptyState, Hero, Pill, SectionTitle, StatTile } from "../ui";

const MAX_DAY_GROUPS = 7;

/** Home: today's progress at a glance, then what's coming up next, grouped by day. */
export function HomeScreen({ now, onEdit }: { now: Date; onEdit: (task: Task) => void }) {
  const t = useTheme();
  const { state } = useStore();
  const today = dayKeyOf(now, TIME_ZONE);
  const progress = progressOf(tasksOnDay(state.tasks, today, TIME_ZONE));
  const upcoming = upcomingTasks(state.tasks, now, TIME_ZONE);
  const nextTask = upcoming.find((task) => new Date(task.dueAt).getTime() >= now.getTime());
  const groups = groupByDay(upcoming, TIME_ZONE).slice(0, MAX_DAY_GROUPS);
  const categoryById = new Map(state.categories.map((category) => [category.id, category]));
  const statusText = progress.total > 0 ? `In progress · ${progress.done} of ${progress.total}` : "Nothing planned yet";

  return (
    <View style={{ gap: 24 }}>
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

      <View>
        <SectionTitle>Up next</SectionTitle>
        {groups.length === 0 ? (
          <Card>
            <EmptyState icon="sparkles-outline" title="You're all clear" hint="Tap + to add a task that moves you forward." />
          </Card>
        ) : (
          <View style={{ gap: 18 }}>
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
    </View>
  );
}
