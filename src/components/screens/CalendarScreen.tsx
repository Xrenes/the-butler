"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { TIME_ZONE, useDemo } from "@/components/demo/store";
import { StatusRow } from "@/components/tasks/rows";
import { CountUp, TickProgress } from "@/components/ui/charts";
import { Card, ChipButton, CircleButton, EmptyState, SectionTitle, Stat } from "@/components/ui/primitives";
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
} from "@/lib/domain/dates";
import { motivationLine, progressOf } from "@/lib/domain/progress";
import { tasksOnDay } from "@/lib/domain/tasks";
import type { Category, Task } from "@/lib/domain/types";

const SWIPE_DISTANCE = 50;
const MAX_DOTS = 3;
const DAYS_PER_WEEK = 7;

function categoryColors(tasks: readonly Task[], categoryById: ReadonlyMap<string, Category>): string[] {
  const colors = tasks
    .map((task) => categoryById.get(task.categoryId)?.color)
    .filter((color): color is string => Boolean(color));
  return [...new Set(colors)].slice(0, MAX_DOTS);
}

interface CalendarScreenProps {
  now: Date;
  onStatus: (task: Task) => void;
}

/** Weekly only: Mon–Sun strip, selected day's progress and tasks. No task creation here. */
export function CalendarScreen({ now, onStatus }: CalendarScreenProps) {
  const { state } = useDemo();
  const today = dayKeyOf(now, TIME_ZONE);
  const [selectedDay, setSelectedDay] = useState<DayKey>(today);
  const weekStart = startOfWeek(selectedDay);
  const dayTasks = tasksOnDay(state.tasks, selectedDay, TIME_ZONE);
  const progress = progressOf(dayTasks);
  const categoryById = new Map(state.categories.map((category) => [category.id, category]));
  const shiftWeek = (weeks: number) => setSelectedDay((day) => addDays(day, weeks * DAYS_PER_WEEK));

  return (
    <div className="space-y-[clamp(20px,3vw,32px)]">
      <section className="flex items-center justify-between gap-3">
        <CircleButton icon="chevron-left" label="Previous week" onClick={() => shiftWeek(-1)} />
        <div className="min-w-0 text-center">
          <p className="text-sm text-fg-2">Week of</p>
          <h1 className="text-title">{formatWeekRange(weekStart)}</h1>
        </div>
        <CircleButton icon="chevron-right" label="Next week" onClick={() => shiftWeek(1)} />
      </section>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={(_, info) => {
          if (info.offset.x < -SWIPE_DISTANCE) shiftWeek(1);
          else if (info.offset.x > SWIPE_DISTANCE) shiftWeek(-1);
        }}
        className="grid touch-pan-y grid-cols-7 gap-1 rounded-[28px] bg-surface p-[clamp(6px,1.4vw,10px)]"
      >
        {weekDays(weekStart).map((day) => {
          const selected = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              aria-label={formatLongDate(day)}
              onClick={() => setSelectedDay(day)}
              className="relative flex flex-col items-center gap-1.5 rounded-[22px] py-[clamp(10px,2vw,16px)]"
            >
              {selected ? (
                <motion.span
                  layoutId="calendar-day"
                  className="absolute inset-0 rounded-[22px] bg-accent"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className={`relative text-xs ${selected ? "text-white/80" : "text-fg-2"}`}>
                {weekdayShort(day)}
              </span>
              <span
                className={`relative text-[clamp(1.15rem,1rem+0.8vw,1.5rem)] tabular-nums ${
                  selected ? "font-medium text-white" : "font-light"
                }`}
              >
                {dayOfMonth(day)}
              </span>
              <span className="relative flex h-1.5 gap-1">
                {categoryColors(tasksOnDay(state.tasks, day, TIME_ZONE), categoryById).map((color) => (
                  <span
                    key={color}
                    className="h-1.5 w-1.5 rounded-full ring-1 ring-line"
                    style={{ background: selected ? "#FFFFFF" : color }}
                  />
                ))}
              </span>
              {day === today && !selected ? (
                <span className="absolute top-1.5 h-1 w-1 rounded-full bg-accent" />
              ) : null}
            </button>
          );
        })}
      </motion.div>

      {startOfWeek(today) !== weekStart ? (
        <div className="-mt-3 flex justify-center">
          <ChipButton icon="calendar" onClick={() => setSelectedDay(today)}>
            Back to this week
          </ChipButton>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-[clamp(16px,2.4vw,28px)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="space-y-4 self-start">
          <p className="text-sm text-fg-2">{formatLongDate(selectedDay)}</p>
          <div className="flex items-end justify-between gap-4">
            <p className="text-display">
              <CountUp value={progress.percent} format={String} />
              <span className="ml-1 text-base font-normal tracking-normal text-fg-2">%</span>
            </p>
            <Stat label="Completed" value={`${progress.done}/${progress.total}`} unit="tasks" />
          </div>
          <TickProgress percent={progress.percent} />
          <p className="text-sm text-fg-2">{motivationLine(progress)}</p>
        </Card>
        <Card>
          <SectionTitle>Tasks</SectionTitle>
          {dayTasks.length === 0 ? (
            <EmptyState icon="calendar" title="Nothing on this day" hint="Plan new tasks from Home." />
          ) : (
            <ul>
              {dayTasks.map((task) => {
                const category = categoryById.get(task.categoryId);
                return category ? (
                  <StatusRow
                    key={task.id}
                    task={task}
                    category={category}
                    meta={formatTime(new Date(task.dueAt), TIME_ZONE)}
                    onStatus={() => onStatus(task)}
                  />
                ) : null;
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
