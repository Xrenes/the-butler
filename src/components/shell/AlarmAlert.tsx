"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TIME_ZONE, useDemo, useNow } from "@/components/demo/store";
import { Icon } from "@/components/icons/Icon";
import { GhostButton, PrimaryButton, readableOn } from "@/components/ui/primitives";
import {
  type AlarmMemory,
  EMPTY_ALARM_MEMORY,
  SNOOZE_MINUTES,
  alarmKey,
  describeLead,
  dueAlarms,
  dueCountdown,
} from "@/lib/domain/alarms";
import { dayKeyOf, formatDayLabel, formatTime } from "@/lib/domain/dates";
import type { Category, MarkedStatus, Task } from "@/lib/domain/types";
import { notifyBrowser, unlockAlarmAudio, useAlarmTone, useTabTitleFlash } from "./alarmSignals";

const MS_PER_MINUTE = 60_000;
/** Checked every second so the alarm appears on time without re-rendering the rest of the app. */
const TICK_MS = 1000;
const FALLBACK_COLOR = "#D83036";

/** Watches the clock and shows the earliest due reminder, with its category and details. */
export function AlarmWatcher() {
  const { state, dispatch } = useDemo();
  const now = useNow(TICK_MS);
  const [memory, setMemory] = useState<AlarmMemory>(EMPTY_ALARM_MEMORY);

  // Browsers only allow sound after the person interacts with the page; any tap or key unlocks it.
  useEffect(() => {
    window.addEventListener("pointerdown", unlockAlarmAudio, true);
    window.addEventListener("keydown", unlockAlarmAudio, true);
    return () => {
      window.removeEventListener("pointerdown", unlockAlarmAudio, true);
      window.removeEventListener("keydown", unlockAlarmAudio, true);
    };
  }, []);

  const due = state.settings.inAppAlarm ? dueAlarms(state.tasks, now, memory) : [];
  const task = due[0] ?? null;
  const category = task ? state.categories.find((item) => item.id === task.categoryId) : undefined;

  const dismiss = (current: Task) =>
    setMemory((previous) => ({ ...previous, dismissed: new Set(previous.dismissed).add(alarmKey(current)) }));
  const snooze = (current: Task) =>
    setMemory((previous) => ({
      ...previous,
      snoozedUntil: new Map(previous.snoozedUntil).set(alarmKey(current), Date.now() + SNOOZE_MINUTES * MS_PER_MINUTE),
    }));
  const mark = (current: Task, status: MarkedStatus) =>
    dispatch({ type: "task/status", id: current.id, status, now: new Date() });

  return (
    <AnimatePresence mode="wait">
      {task ? (
        <AlarmAlert
          key={alarmKey(task)}
          task={task}
          category={category}
          now={now}
          position={1}
          total={due.length}
          onDone={() => mark(task, "C")}
          onHold={() => mark(task, "H")}
          onSnooze={() => snooze(task)}
          onDismiss={() => dismiss(task)}
        />
      ) : null}
    </AnimatePresence>
  );
}

interface AlarmAlertProps {
  task: Task;
  category: Category | undefined;
  now: Date;
  position: number;
  total: number;
  onDone: () => void;
  onHold: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-fg-2">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  );
}

function AlarmAlert({ task, category, now, position, total, onDone, onHold, onSnooze, onDismiss }: AlarmAlertProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const color = category?.color ?? FALLBACK_COLOR;
  const due = new Date(task.dueAt);
  const dueDay = formatDayLabel(dayKeyOf(due, TIME_ZONE), dayKeyOf(now, TIME_ZONE));
  const categoryName = category?.name ?? "Task";

  useAlarmTone(true);
  useTabTitleFlash(`⏰ ${task.title}`);

  // A tab in the background can't be seen, so it also raises a system notification (if allowed).
  useEffect(() => {
    if (document.hidden) notifyBrowser(task.title, `${categoryName} · due ${formatTime(new Date(task.dueAt), TIME_ZONE)}`, alarmKey(task));
  }, [task, categoryName]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Escape dismisses only the alarm, even when another sheet is open underneath it.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      onDismiss();
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onDismiss]);

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 pb-[max(16px,env(safe-area-inset-bottom))] md:items-center md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div aria-hidden className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm" />
      <motion.section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ y: 48, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 32, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="surface-hero relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-[32px] p-6 pt-7 text-center outline-none"
      >
        {total > 1 ? (
          <span className="surface-raised absolute top-4 right-4 rounded-full px-2.5 py-1 text-xs text-fg-2">
            {position} of {total}
          </span>
        ) : null}

        <p className="flex items-center justify-center gap-2 text-xs font-semibold tracking-[0.16em] text-accent uppercase">
          <Icon name="bell" size={16} strokeWidth={2} />
          Reminder
        </p>

        <div className="relative mx-auto mt-8 grid h-24 w-24 place-items-center">
          {[0, 1].map((ring) => (
            <motion.span
              key={ring}
              aria-hidden
              className="absolute inset-0 rounded-[30%]"
              style={{ border: `2px solid ${color}` }}
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 2.2, repeat: Infinity, delay: ring * 1.1, ease: "easeOut" }}
            />
          ))}
          <span
            className="relative grid h-24 w-24 place-items-center rounded-[30%]"
            style={{
              background: color,
              color: readableOn(color),
              boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.3), 0 0 44px -8px ${color}`,
            }}
          >
            <Icon name={category?.icon ?? "bell"} size={44} />
          </span>
        </div>

        <h2 id={titleId} className="mt-8 text-2xl font-semibold tracking-tight break-words">
          {task.title}
        </h2>
        <p className="mt-1.5 text-sm font-medium text-accent" aria-live="polite">
          {dueCountdown(task, now)}
        </p>

        <dl className="surface-group mt-5 divide-y divide-[var(--card-edge)] rounded-3xl px-4 text-left">
          <DetailRow label="Category">
            <span className="inline-flex items-center justify-end gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: color, boxShadow: `0 0 8px ${color}` }}
              />
              {category?.name ?? "No category"}
            </span>
          </DetailRow>
          <DetailRow label="Due">
            {dueDay} · {formatTime(due, TIME_ZONE)}
          </DetailRow>
          <DetailRow label="Reminder">{describeLead(task.reminder.leadMinutes)}</DetailRow>
          {task.description ? (
            <div className="py-2.5 text-sm">
              <dt className="text-fg-2">Notes</dt>
              <dd className="mt-1 max-h-28 overflow-y-auto break-words whitespace-pre-wrap">{task.description}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-5 flex">
          <PrimaryButton onClick={onDone}>Done</PrimaryButton>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <GhostButton onClick={onHold} className="px-2! text-[13px]!">
            On hold
          </GhostButton>
          <GhostButton onClick={onSnooze} className="px-2! text-[13px]!">
            Snooze {SNOOZE_MINUTES} min
          </GhostButton>
          <GhostButton onClick={onDismiss} className="px-2! text-[13px]!">
            Dismiss
          </GhostButton>
        </div>
      </motion.section>
    </motion.div>
  );
}
