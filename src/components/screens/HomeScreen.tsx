"use client";

import { AnimatePresence } from "motion/react";
import { TIME_ZONE, useDemo } from "@/components/demo/store";
import { UpcomingRow } from "@/components/tasks/rows";
import { CountUp, DayPulse, DotMatrix } from "@/components/ui/charts";
import { Card, CircleButton, EmptyState, Pill, SectionTitle, Stat } from "@/components/ui/primitives";
import { dayKeyOf, formatDayLabel, formatLongDate, formatTime } from "@/lib/domain/dates";
import { completedPerDay, motivationLine, progressOf, weeklyLabels } from "@/lib/domain/progress";
import { groupByDay, tasksOnDay, upcomingTasks } from "@/lib/domain/tasks";
import type { Task } from "@/lib/domain/types";

const MAX_DAY_GROUPS = 4;
/** Five weeks keeps the dots large enough in the half-width card. */
const CONSISTENCY_DAYS = 35;

interface HomeScreenProps {
  now: Date;
  onAdd: () => void;
  onEdit: (task: Task) => void;
}

export function HomeScreen({ now, onAdd, onEdit }: HomeScreenProps) {
  const { state } = useDemo();
  const today = dayKeyOf(now, TIME_ZONE);
  const todays = tasksOnDay(state.tasks, today, TIME_ZONE);
  const progress = progressOf(todays);
  const upcoming = upcomingTasks(state.tasks, now, TIME_ZONE);
  const nextTask = upcoming.find((task) => new Date(task.dueAt).getTime() >= now.getTime());
  const groups = groupByDay(upcoming, TIME_ZONE).slice(0, MAX_DAY_GROUPS);
  const categoryById = new Map(state.categories.map((category) => [category.id, category]));
  const statusText =
    progress.total > 0 ? `In progress · ${progress.done} of ${progress.total}` : "Nothing planned yet";

  return (
    <div className="space-y-[clamp(22px,3.2vw,36px)]">
      <section className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-sm text-fg-2">{formatLongDate(today)}</p>
          <h1 className="text-title">Today&apos;s focus</h1>
          <Pill icon="clock">{statusText}</Pill>
        </div>
        <CircleButton icon="plus" label="Add task" variant="accent" size="xl" onClick={onAdd} />
      </section>

      <DayPulse tasks={todays} now={now} timeZone={TIME_ZONE} />

      <section className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-x-[clamp(12px,4vw,56px)]">
        <div>
          <p className="mb-1 text-sm">Completed</p>
          <p className="text-display">
            <CountUp value={progress.percent} format={String} />
            <span className="ml-1 text-base font-normal tracking-normal text-fg-2">%</span>
          </p>
        </div>
        <Stat label="Done today" value={`${progress.done}/${progress.total}`} unit="tasks" />
        <Stat label="Next up" value={nextTask ? formatTime(new Date(nextTask.dueAt), TIME_ZONE) : "—"} />
      </section>
      <p className="-mt-3 text-sm text-fg-2">{motivationLine(progress)}</p>

      <div className="grid grid-cols-1 gap-[clamp(16px,2.4vw,28px)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card>
          <SectionTitle>Up next</SectionTitle>
          {groups.length === 0 ? (
            <EmptyState icon="sparkles" title="You're all clear" hint="Add a task that moves you forward." />
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.day}>
                  <p className="mb-1 px-2 text-xs font-medium tracking-wide text-fg-3 uppercase">
                    {formatDayLabel(group.day, today)}
                  </p>
                  <ul>
                    <AnimatePresence initial={false}>
                      {group.tasks.map((task) => {
                        const category = categoryById.get(task.categoryId);
                        return category ? (
                          <UpcomingRow
                            key={task.id}
                            task={task}
                            category={category}
                            timeZone={TIME_ZONE}
                            onOpen={() => onEdit(task)}
                          />
                        ) : null;
                      })}
                    </AnimatePresence>
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle
            action={
              <span className="text-xs text-fg-3">
                <span className="md:hidden">Last 4 weeks</span>
                <span className="hidden md:inline">Last 5 weeks</span>
              </span>
            }
          >
            Consistency
          </SectionTitle>
          <DotMatrix
            counts={completedPerDay(state.tasks, today, CONSISTENCY_DAYS, TIME_ZONE)}
            labels={weeklyLabels(today, CONSISTENCY_DAYS)}
          />
          <p className="mt-4 text-sm text-fg-2">Each column is a day. Every red dot is a task you completed.</p>
        </Card>
      </div>
    </div>
  );
}
