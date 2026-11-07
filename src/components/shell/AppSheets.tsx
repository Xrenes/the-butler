"use client";

import { type ReactNode, useState, useSyncExternalStore } from "react";
import type { DemoSettings } from "@/components/demo/seed";
import { TIME_ZONE, useDemo } from "@/components/demo/store";
import { Icon, type IconName } from "@/components/icons/Icon";
import { CategoryBadge } from "@/components/tasks/rows";
import { Sheet } from "@/components/ui/Sheet";
import { ChipButton, EmptyState, FIELD, PrimaryButton, Segmented, Toggle } from "@/components/ui/primitives";
import { describeLead } from "@/lib/domain/alarms";
import { dayKeyOf, formatDayLabel, formatTime } from "@/lib/domain/dates";
import { parseChatId } from "@/lib/domain/telegram";
import { sortByDue } from "@/lib/domain/tasks";
import { type BrowserAlerts, browserAlerts, requestBrowserAlerts } from "./alarmSignals";

const REMINDER_WINDOW_MS = 48 * 60 * 60 * 1000;
const THEMES = [
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "light", label: "Light", icon: "sun" },
] as const;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface-group rounded-3xl px-4 py-3">
      <h3 className="mb-1 text-xs font-medium tracking-wide text-fg-3 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function InfoRow({ icon, title, detail }: { icon: IconName; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="surface-raised grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-2">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm">{title}</span>
        <span className="block text-xs text-fg-2">{detail}</span>
      </span>
    </div>
  );
}

/** Chat ID only. The bot token is a server secret (TELEGRAM_BOT_TOKEN) and is never asked for here. */
function TelegramSettings() {
  const { state, dispatch } = useDemo();
  const chatId = state.settings.telegramChatId;
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const connect = () => {
    const parsed = parseChatId(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    dispatch({ type: "settings/update", patch: { telegramChatId: parsed.chatId } });
    setDraft("");
    setError(null);
  };

  if (chatId) {
    return (
      <>
        <InfoRow
          icon="send"
          title="Connected"
          detail={`Chat ID ${chatId}. Reminders will be sent here once the server is running.`}
        />
        <div className="flex flex-wrap gap-2 py-2">
          <ChipButton
            icon="close"
            onClick={() => dispatch({ type: "settings/update", patch: { telegramChatId: null } })}
          >
            Disconnect
          </ChipButton>
        </div>
        <p className="pb-1 text-xs text-fg-3">Demo: nothing is sent yet, and the chat ID is forgotten on refresh.</p>
      </>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        connect();
      }}
    >
      <InfoRow
        icon="send"
        title="Not connected"
        detail="Add the numeric chat ID of the Telegram chat that should receive your reminders."
      />
      <label className="block">
        <span className="mb-2 block text-xs text-fg-2">Telegram chat ID</span>
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          inputMode="numeric"
          autoComplete="off"
          maxLength={20}
          placeholder="e.g. 123456789"
          aria-invalid={error ? true : undefined}
          className={FIELD}
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      ) : null}
      <div className="flex">
        <PrimaryButton type="submit" disabled={!draft.trim()}>
          Connect
        </PrimaryButton>
      </div>
      <p className="pb-1 text-xs text-fg-3">
        Your bot token is a secret, so it is never entered or kept in the browser. It goes in the server&apos;s{" "}
        <span className="font-medium text-fg-2">.env.local</span> as TELEGRAM_BOT_TOKEN. Demo: the chat ID is
        forgotten on refresh.
      </p>
    </form>
  );
}

const BROWSER_ALERT_TEXT: Record<BrowserAlerts, string> = {
  granted: "On: alarms also show as notifications when this tab is in the background.",
  default: "Allow notifications so an alarm is seen even when this tab is in the background.",
  denied: "Blocked by the browser. Allow notifications for this site in the browser's site settings.",
  unsupported: "This browser can't show notifications. Keep this tab open for alarms.",
};

const noSubscription = () => () => undefined;

/** Web alarms ring while the page is open; browser notifications make them visible from other tabs. */
function BrowserAlertsRow() {
  const current = useSyncExternalStore(noSubscription, browserAlerts, (): BrowserAlerts => "unsupported");
  const [answered, setAnswered] = useState<BrowserAlerts | null>(null);
  const state = answered ?? current;
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="surface-raised grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-2">
        <Icon name="bell" size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-fg">Browser alerts</span>
        <span className="block text-xs text-fg-2">{BROWSER_ALERT_TEXT[state]}</span>
      </span>
      {state === "default" ? (
        <ChipButton icon="bell" onClick={() => requestBrowserAlerts().then(setAnswered)}>
          Allow
        </ChipButton>
      ) : null}
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
        <Group title="Alarms">
          <Toggle
            icon="bell"
            label="On-screen alarm"
            description="When a reminder is due, show the task with its category on screen."
            checked={settings.inAppAlarm}
            onChange={(inAppAlarm) => update({ inAppAlarm })}
          />
          <BrowserAlertsRow />
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
          <TelegramSettings />
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
  const categoryById = new Map(state.categories.map((category) => [category.id, category]));
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
            const category = categoryById.get(task.categoryId);
            return (
              <li key={task.id} className="flex items-center gap-3 py-3">
                {category ? (
                  <CategoryBadge category={category} />
                ) : (
                  <span className="accent-fill grid h-10 w-10 shrink-0 place-items-center rounded-full">
                    <Icon name="bell" size={18} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{task.title}</span>
                  <span className="block truncate text-xs text-fg-2">
                    {category?.name ?? "No category"} · {describeLead(task.reminder.leadMinutes)}
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
