"use client";

import { type KeyboardEvent, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HISTORY_DAYS } from "@/components/demo/seed";
import { TIME_ZONE, useDemo } from "@/components/demo/store";
import { Icon } from "@/components/icons/Icon";
import { StatusRow } from "@/components/tasks/rows";
import { CountUp, DotMatrix } from "@/components/ui/charts";
import {
  Card,
  ChipButton,
  EmptyState,
  STATUS_LABEL,
  SectionTitle,
  StatusSquare,
  readableOn,
} from "@/components/ui/primitives";
import { dayKeyOf, formatDayMonth, formatTime } from "@/lib/domain/dates";
import { completedPerDay, weeklyLabels } from "@/lib/domain/progress";
import { categoryView } from "@/lib/domain/tasks";
import type { Category, MarkedStatus, Task } from "@/lib/domain/types";

const SWIPE_DISTANCE = 40;
const SLOT_OFFSETS = [-2, -1, 0, 1, 2] as const;
const SLOT_SIZE = ["clamp(84px,22vw,116px)", "clamp(56px,14vw,76px)", "clamp(40px,10vw,52px)"];
const SLOT_ICON = [36, 24, 18];
const HISTORY_PAGE = 12;

interface CarouselProps {
  categories: readonly Category[];
  index: number;
  onIndex: (index: number) => void;
}

/** Five positions, centre largest; swipe, tap or use the arrow keys. No arrow buttons. */
function CategoryCarousel({ categories, index, onIndex }: CarouselProps) {
  const count = categories.length;
  const go = (delta: number) => onIndex((index + delta + count) % count);
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") go(1);
    if (event.key === "ArrowLeft") go(-1);
  };

  return (
    <motion.div
      role="listbox"
      aria-label="Categories"
      tabIndex={0}
      onKeyDown={handleKey}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.25}
      onDragEnd={(_, info) => {
        if (info.offset.x < -SWIPE_DISTANCE) go(1);
        else if (info.offset.x > SWIPE_DISTANCE) go(-1);
      }}
      className="flex h-[clamp(124px,26vw,156px)] cursor-grab touch-pan-y items-center justify-center gap-[clamp(8px,2.5vw,22px)] rounded-[28px] select-none active:cursor-grabbing"
    >
      {SLOT_OFFSETS.map((offset) => {
        const category = categories[(((index + offset) % count) + count) % count];
        const distance = Math.abs(offset);
        const isCenter = offset === 0;
        return (
          <motion.button
            key={count >= SLOT_OFFSETS.length ? category.id : `${category.id}-${offset}`}
            type="button"
            layout
            role="option"
            aria-selected={isCenter}
            aria-label={category.name}
            onClick={() => go(offset)}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="grid shrink-0 place-items-center rounded-full ring-1 ring-line"
            style={{
              width: SLOT_SIZE[distance],
              height: SLOT_SIZE[distance],
              background: isCenter ? category.color : "var(--surface)",
              color: isCenter ? readableOn(category.color) : category.color,
              opacity: distance === 2 ? 0.55 : 1,
              boxShadow: isCenter ? `0 18px 44px -14px ${category.color}` : "none",
            }}
          >
            <Icon name={category.icon} size={SLOT_ICON[distance]} />
          </motion.button>
        );
      })}
    </motion.div>
  );
}

interface CategoriesScreenProps {
  now: Date;
  index: number;
  onIndex: (index: number) => void;
  onStatus: (task: Task) => void;
  onRepeat: (task: Task) => void;
}

export function CategoriesScreen({ now, index, onIndex, onStatus, onRepeat }: CategoriesScreenProps) {
  const { state } = useDemo();
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);
  const categories = [...state.categories].sort((a, b) => a.order - b.order);
  if (categories.length === 0) {
    return <EmptyState icon="grid" title="No categories yet" hint="Add one from Settings." />;
  }

  const safeIndex = ((index % categories.length) + categories.length) % categories.length;
  const category = categories[safeIndex];
  const view = categoryView(state.tasks, category.id, now);
  const today = dayKeyOf(now, TIME_ZONE);
  const when = (task: Task) => {
    const day = dayKeyOf(new Date(task.dueAt), TIME_ZONE);
    return day === today ? formatTime(new Date(task.dueAt), TIME_ZONE) : formatDayMonth(day);
  };
  const stats: ReadonlyArray<readonly [MarkedStatus, number]> = [
    ["C", view.stats.done],
    ["H", view.stats.hold],
    ["NC", view.stats.missed],
  ];
  const history = view.history.slice(0, historyLimit);

  return (
    <div className="space-y-[clamp(20px,3vw,32px)]">
      <h1 className="text-title">Categories</h1>
      <CategoryCarousel categories={categories} index={safeIndex} onIndex={onIndex} />

      <AnimatePresence mode="wait">
        <motion.div
          key={category.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-[clamp(20px,3vw,32px)]"
        >
          <div className="text-center">
            <p className="text-[clamp(1.5rem,1.2rem+1.2vw,2.1rem)] font-light">{category.name}</p>
            <p className="text-sm text-fg-2">
              {view.upcoming.length} upcoming · {view.history.length} in history
            </p>
          </div>

          <section className="grid grid-cols-3 gap-[clamp(8px,2vw,16px)]">
            {stats.map(([status, value]) => (
              <div key={status} className="rounded-3xl bg-surface p-[clamp(12px,3vw,20px)]">
                <div className="flex items-center gap-2 text-xs text-fg-2">
                  <StatusSquare status={status} size={14} />
                  <span className="truncate">{STATUS_LABEL[status]}</span>
                </div>
                <p className="text-display-sm mt-2">
                  <CountUp value={value} format={String} />
                </p>
              </div>
            ))}
          </section>

          <div className="grid grid-cols-1 gap-[clamp(16px,2.4vw,28px)] lg:grid-cols-2">
            <Card>
              <SectionTitle>Upcoming</SectionTitle>
              {view.upcoming.length === 0 ? (
                <EmptyState icon="calendar" title="Nothing scheduled" hint="New tasks are added from Home." />
              ) : (
                <ul>
                  {view.upcoming.map((task) => (
                    <StatusRow
                      key={task.id}
                      task={task}
                      category={category}
                      meta={when(task)}
                      onStatus={() => onStatus(task)}
                    />
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <SectionTitle>History</SectionTitle>
              {history.length === 0 ? (
                <EmptyState icon="clock" title="No history yet" />
              ) : (
                <ul>
                  {history.map((task) => (
                    <StatusRow
                      key={task.id}
                      task={task}
                      category={category}
                      meta={when(task)}
                      onStatus={() => onStatus(task)}
                      onRepeat={() => onRepeat(task)}
                    />
                  ))}
                </ul>
              )}
              {view.history.length > historyLimit ? (
                <div className="mt-3 flex justify-center">
                  <ChipButton onClick={() => setHistoryLimit((limit) => limit + HISTORY_PAGE)}>Show more</ChipButton>
                </div>
              ) : null}
            </Card>
          </div>

          <Card>
            <SectionTitle>Completed in {category.name}</SectionTitle>
            <DotMatrix
              counts={completedPerDay(
                state.tasks.filter((task) => task.categoryId === category.id),
                today,
                HISTORY_DAYS,
                TIME_ZONE,
              )}
              labels={weeklyLabels(today, HISTORY_DAYS)}
            />
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
