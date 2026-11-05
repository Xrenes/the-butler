"use client";

import { useEffect, type CSSProperties } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { Icon } from "@/components/icons/Icon";
import { zonedParts } from "@/lib/domain/dates";
import type { Task, TaskStatus } from "@/lib/domain/types";

const PULSE_WIDTH = 1000;
const PULSE_HEIGHT = 120;
const BASELINE = 80;
const MINUTES_PER_DAY = 1440;
const RULER_TICKS = 96;
const RULER_LABELS = ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00", "24:00"];
/** Taller spikes for finished work, smaller ones for what is still ahead. */
const PEAKS: Record<TaskStatus, number> = { C: 6, pending: 26, H: 34, NC: 44 };

function minutesOfDay(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

interface Beat {
  x: number;
  peak: number;
}

function pulsePath(beats: readonly Beat[]): string {
  const points: Array<[number, number]> = [[0, BASELINE]];
  let cursor = 0;
  let wobble = 0;
  const drift = (until: number) => {
    for (let x = cursor + 36; x < until; x += 36) {
      wobble += 1;
      points.push([x, BASELINE + ((wobble % 3) - 1) * 3]);
    }
  };
  for (const beat of beats) {
    if (beat.x - 20 <= cursor) continue;
    drift(beat.x - 20);
    points.push(
      [beat.x - 20, BASELINE],
      [beat.x - 11, BASELINE + 9],
      [beat.x - 4, beat.peak],
      [beat.x + 3, PULSE_HEIGHT - 4],
      [beat.x + 9, BASELINE - 12],
      [beat.x + 17, BASELINE],
    );
    cursor = beat.x + 17;
  }
  drift(PULSE_WIDTH);
  points.push([PULSE_WIDTH, BASELINE]);
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

export function TickRuler() {
  return (
    <div aria-hidden className="mt-2">
      <svg viewBox="0 0 1000 20" preserveAspectRatio="none" className="block h-4 w-full">
        {Array.from({ length: RULER_TICKS + 1 }, (_, index) => {
          const x = (index / RULER_TICKS) * 1000;
          const major = index % 4 === 0;
          return (
            <line
              key={index}
              x1={x}
              x2={x}
              y1={major ? 2 : 10}
              y2={18}
              stroke={major ? "var(--fg-2)" : "var(--fg-3)"}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-fg-3">
        {RULER_LABELS.map((label, index) => (
          <span key={label} className={index % 2 === 1 ? "hidden sm:inline" : ""}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

interface DayPulseProps {
  tasks: readonly Task[];
  now: Date;
  timeZone: string;
}

/** The day as a heartbeat line: one spike per task, with a marker at the current time. */
export function DayPulse({ tasks, now, timeZone }: DayPulseProps) {
  const beats = tasks
    .map((task) => ({
      x: (minutesOfDay(new Date(task.dueAt), timeZone) / MINUTES_PER_DAY) * PULSE_WIDTH,
      peak: PEAKS[task.status],
    }))
    .sort((a, b) => a.x - b.x);
  const nowPercent = (minutesOfDay(now, timeZone) / MINUTES_PER_DAY) * 100;
  const futureMask = `linear-gradient(90deg, black ${nowPercent}%, rgba(0,0,0,0.35) ${nowPercent}%)`;

  return (
    <figure aria-label="Today's timeline" className="m-0">
      <div className="relative">
        <motion.div
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
          style={{ maskImage: futureMask, WebkitMaskImage: futureMask }}
        >
          <svg
            viewBox={`0 0 ${PULSE_WIDTH} ${PULSE_HEIGHT}`}
            preserveAspectRatio="none"
            className="block h-[clamp(84px,16vw,150px)] w-full overflow-visible"
            aria-hidden
          >
            <path
              d={pulsePath(beats)}
              fill="none"
              stroke="var(--fg)"
              strokeWidth={1.4}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </motion.div>
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.1, type: "spring", stiffness: 300, damping: 18 }}
          className="absolute grid h-[clamp(28px,6vw,36px)] w-[clamp(28px,6vw,36px)] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-accent shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
          style={{ left: `${nowPercent}%`, top: `${(BASELINE / PULSE_HEIGHT) * 100}%` }}
        >
          <Icon name="clock" size={16} strokeWidth={2} />
        </motion.span>
      </div>
      <TickRuler />
    </figure>
  );
}

/** Progress drawn as a row of ticks, echoing the timeline ruler. */
export function TickProgress({ percent, ticks = 48 }: { percent: number; ticks?: number }) {
  const filled = Math.round((percent / 100) * ticks);
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="flex h-8 items-end gap-[3px]"
    >
      {Array.from({ length: ticks }, (_, index) => {
        const on = index < filled;
        return (
          <motion.span
            key={index}
            className={`flex-1 rounded-full ${on ? "bg-accent" : "bg-line"}`}
            initial={{ height: 6 }}
            animate={{ height: on ? (index % 4 === 0 ? 30 : 22) : 8 }}
            transition={{ delay: index * 0.012, type: "spring", stiffness: 260, damping: 22 }}
          />
        );
      })}
    </div>
  );
}

interface DotMatrixProps {
  counts: readonly number[];
  labels: readonly string[];
  rows?: number;
  compactColumns?: number;
}

/** Dot-matrix history: one column per day, one red dot per completed task. */
export function DotMatrix({ counts, labels, rows = 8, compactColumns = 28 }: DotMatrixProps) {
  const hiddenBefore = Math.max(0, counts.length - compactColumns);
  const columns = {
    "--cols-sm": counts.length - hiddenBefore,
    "--cols-md": counts.length,
  } as CSSProperties;
  const gridClass =
    "grid [grid-template-columns:repeat(var(--cols-sm),minmax(0,1fr))] md:[grid-template-columns:repeat(var(--cols-md),minmax(0,1fr))]";

  return (
    <div role="img" aria-label={`Completed tasks per day over the last ${counts.length} days`}>
      <div className={`${gridClass} gap-x-[clamp(2px,0.45vw,5px)]`} style={columns}>
        {counts.map((count, column) => (
          <div
            key={column}
            className={`${column < hiddenBefore ? "hidden md:flex" : "flex"} flex-col-reverse gap-[clamp(2px,0.45vw,5px)]`}
          >
            {Array.from({ length: rows }, (_, row) => {
              const on = row < Math.min(count, rows);
              return (
                <span
                  key={row}
                  className={`block aspect-square w-full rounded-full ${on ? "dot-on bg-accent" : "bg-dot-off"}`}
                  style={on ? ({ "--i": column + row } as CSSProperties) : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className={`${gridClass} mt-3`} style={columns}>
        {labels.map((label, column) => (
          <span
            key={column}
            className={`${column < hiddenBefore ? "hidden md:block" : "block"} whitespace-nowrap text-[10px] text-fg-3`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  const motionValue = useMotionValue(0);
  const text = useTransform(motionValue, (latest) => format(Math.round(latest)));
  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.9, ease: "easeOut" });
    return () => controls.stop();
  }, [motionValue, value]);
  return <motion.span>{text}</motion.span>;
}
