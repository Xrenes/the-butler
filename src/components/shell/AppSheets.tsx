"use client";

import type { ReactNode } from "react";
import type { DemoSettings } from "@/components/demo/seed";
import { TIME_ZONE, useDemo } from "@/components/demo/store";
import { Icon, type IconName } from "@/components/icons/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { ChipButton, EmptyState, FIELD, Segmented, Toggle } from "@/components/ui/primitives";
import { dayKeyOf, formatDayLabel, formatTime } from "@/lib/domain/dates";
import { sortByDue } from "@/lib/domain/tasks";

const REMINDER_WINDOW_MS = 48 * 60 * 60 * 1000;
const THEMES = [
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "light", label: "Light", icon: "sun" },
] as const;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface px-4 py-3">
      <h3 className="mb-1 text-xs font-medium tracking-wide text-fg-3 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function InfoRow({ icon, title, detail }: { icon: IconName; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-fg-2">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm">{title}</span>
        <span className="block text-xs text-fg-2">{detail}</span>
      </span>
    </div>
  );
}

/** Settings live behind the header gear; appearance is here, never in the header. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useDemo();
  const settings = state.settings;
  const update = (patch: Partial<DemoSettings>) => dispatch({ type: "settings/update", patch });

  return (
    <Sheet open={open} title="Settings" onClose={onClose}>
      <div className="space-y-4 pb-2">
        <Group title="Profile">
          <label className="block py-2">
            <span className="mb-2 block text-xs text-fg-2">Display name</span>
            <input
              value={settings.displayName}
              maxLength={40}
              onChange={(event) => update({ displayName: event.target.value })}
              placeholder="What should The Butler call you?"
              className={FIELD}
            />
          </label>
        </Group>
        <Group title="Appearance">
          <div className="py-2">
            <Segmented label="Theme" options={THEMES} value={settings.theme} onChange={(theme) => update({ theme })} />
          </div>
          <Toggle
            label="Reduce motion"
            description="Turns off non-essential animation."
            checked={settings.reduceMotion}
            onChange={(reduceMotion) => update({ reduceMotion })}
          />
        </Group>
        <Group title="Finance">
          <Toggle
            icon="transfer"
            label="Transfers between accounts"
            checked={settings.transfersEnabled}
            onChange={(transfersEnabled) => update({ transfersEnabled })}
          />
          <div className="flex flex-wrap gap-2 py-2">
            <ChipButton icon="lock" onClick={() => dispatch({ type: "pin/lock" })}>
              Lock now
            </ChipButton>
            <ChipButton icon="repeat" onClick={() => dispatch({ type: "pin/reset" })}>
              Reset demo PIN
            </ChipButton>
          </div>
        </Group>
        <Group title="Telegram">
          <InfoRow
            icon="send"
            title="Not connected"
            detail="Linking your Telegram account becomes available once the server is running."
          />
        </Group>
        <Group title="Security">
          <InfoRow
            icon="shield"
            title="End-to-end encryption"
            detail="Built into the app's core. This demo keeps sample data in memory only, so refreshing resets it."
          />
        </Group>
      </div>
    </Sheet>
  );
}

/** Bell: reminders coming up in the next 48 hours. */
export function RemindersSheet({ open, onClose, now }: { open: boolean; onClose: () => void; now: Date }) {
  const { state } = useDemo();
  const today = dayKeyOf(now, TIME_ZONE);
  const soon = sortByDue(
    state.tasks.filter((task) => {
      const due = new Date(task.dueAt).getTime();
      return (
        task.status === "pending" &&
        task.reminder.enabled &&
        due >= now.getTime() &&
        due <= now.getTime() + REMINDER_WINDOW_MS
      );
    }),
  );

  return (
    <Sheet open={open} title="Reminders" onClose={onClose}>
      {soon.length === 0 ? (
        <EmptyState icon="bell" title="No reminders soon" hint="Reminders for the next 48 hours show up here." />
      ) : (
        <ul className="divide-y divide-line pb-2">
          {soon.map((task) => {
            const due = new Date(task.dueAt);
            return (
              <li key={task.id} className="flex items-center gap-3 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white">
                  <Icon name="bell" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{task.title}</span>
                  <span className="block text-xs text-fg-2">
                    Telegram · {task.reminder.leadMinutes === 0 ? "at the time" : `${task.reminder.leadMinutes} min before`}
                  </span>
                </span>
                <span className="text-right text-sm tabular-nums">
                  {formatTime(due, TIME_ZONE)}
                  <span className="block text-[11px] text-fg-3">{formatDayLabel(dayKeyOf(due, TIME_ZONE), today)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
