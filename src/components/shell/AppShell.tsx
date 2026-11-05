"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type Tab, TABS, TIME_ZONE, useDemo, useNow, useTab } from "@/components/demo/store";
import { FinanceScreen } from "@/components/finance/FinanceScreen";
import { Icon, type IconName } from "@/components/icons/Icon";
import { CalendarScreen } from "@/components/screens/CalendarScreen";
import { CategoriesScreen } from "@/components/screens/CategoriesScreen";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { StatusEditor } from "@/components/tasks/StatusEditor";
import { type EditorMode, TaskEditor } from "@/components/tasks/TaskEditor";
import { useOverlay } from "@/components/ui/Sheet";
import { CircleButton } from "@/components/ui/primitives";
import { zonedParts } from "@/lib/domain/dates";
import type { Task } from "@/lib/domain/types";
import { RemindersSheet, SettingsSheet } from "./AppSheets";

const TAB_META: Record<Tab, { label: string; icon: IconName }> = {
  home: { label: "Home", icon: "home" },
  categories: { label: "Categories", icon: "grid" },
  calendar: { label: "Calendar", icon: "calendar" },
  finance: { label: "Finance", icon: "wallet" },
};
const NOON = 12;
const EVENING = 17;
const TAGLINE = "Small wins, every day.";

function greeting(now: Date): string {
  const hour = zonedParts(now, TIME_ZONE).hour;
  if (hour < NOON) return "Good morning";
  return hour < EVENING ? "Good afternoon" : "Good evening";
}

interface NavProps {
  tab: Tab;
  onChange: (tab: Tab) => void;
}

/** Phones and tablets: floating bottom bar. */
function BottomNav({ tab, onChange }: NavProps) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 px-[clamp(12px,4vw,24px)] pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-center justify-between rounded-[30px] border border-line bg-surface/95 p-2 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur">
        {TABS.map((key) => {
          const active = key === tab;
          return (
            <button
              key={key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(key)}
              className="flex flex-1 flex-col items-center gap-1 py-1"
            >
              <span className={`relative grid h-10 w-10 place-items-center rounded-full ${active ? "text-white" : "text-fg-2"}`}>
                {active ? (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full bg-accent"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <Icon name={TAB_META[key].icon} size={20} className="relative" />
              </span>
              <span className={`text-[11px] ${active ? "text-fg" : "text-fg-3"}`}>{TAB_META[key].label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Desktop: side rail with labels and a brand panel. */
function SideRail({ tab, onChange }: NavProps) {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-10 border-r border-line bg-bg px-[clamp(16px,1.6vw,28px)] py-8 lg:flex">
      <div>
        <p className="text-xl font-semibold tracking-tight">The Butler</p>
        <p className="mt-1 text-sm text-fg-2">{TAGLINE}</p>
      </div>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {TABS.map((key) => {
          const active = key === tab;
          return (
            <button
              key={key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(key)}
              className={`relative flex h-12 items-center gap-3 rounded-full px-4 text-sm transition-colors ${
                active ? "text-white" : "text-fg-2 hover:text-fg"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="rail-active"
                  className="absolute inset-0 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <Icon name={TAB_META[key].icon} size={20} className="relative" />
              <span className="relative">{TAB_META[key].label}</span>
            </button>
          );
        })}
      </nav>
      <div className="ribbed relative isolate mt-auto overflow-hidden rounded-3xl bg-brand-gradient p-5 text-white">
        <div className="relative z-10">
          <Icon name="shield" size={22} />
          <p className="mt-3 text-sm font-medium">Private by design</p>
          <p className="mt-1 text-xs text-white/70">Built for end-to-end encryption. This demo keeps data in memory.</p>
        </div>
      </div>
    </aside>
  );
}

interface HeaderProps {
  now: Date;
  name: string;
  onBell: () => void;
  onSettings: () => void;
}

function Header({ now, name, onBell, onSettings }: HeaderProps) {
  const hello = name.trim() ? `${greeting(now)}, ${name.trim()}` : greeting(now);
  return (
    <header className="flex items-center justify-between gap-4 pt-[max(18px,env(safe-area-inset-top))] pb-[clamp(16px,3vw,28px)] lg:pt-8">
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold tracking-tight lg:hidden">The Butler</p>
        <p className="truncate text-sm text-fg-2 lg:hidden">
          {hello}. {TAGLINE}
        </p>
        <p className="hidden truncate text-2xl font-light lg:block">{hello}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <CircleButton icon="bell" label="Reminders" onClick={onBell} />
        <CircleButton icon="settings" label="Settings" onClick={onSettings} />
      </div>
    </header>
  );
}

export function AppShell() {
  const { state, dispatch } = useDemo();
  const [tab, setTab] = useTab();
  const now = useNow();
  const [categoryIndex, setCategoryIndex] = useState(0);
  const editor = useOverlay<EditorMode>();
  const statusEditor = useOverlay<Task>();
  const panel = useOverlay<"settings" | "reminders">();

  // Leaving the Finance tab always locks it again.
  useEffect(() => {
    if (tab !== "finance") dispatch({ type: "pin/lock" });
  }, [tab, dispatch]);

  const renderScreen = () => {
    switch (tab) {
      case "home":
        return (
          <HomeScreen
            now={now}
            onAdd={() => editor.open({ kind: "new" })}
            onEdit={(task) => editor.open({ kind: "edit", task })}
          />
        );
      case "categories":
        return (
          <CategoriesScreen
            now={now}
            index={categoryIndex}
            onIndex={setCategoryIndex}
            onStatus={statusEditor.open}
            onRepeat={(task) => editor.open({ kind: "repeat", task })}
          />
        );
      case "calendar":
        return <CalendarScreen now={now} onStatus={statusEditor.open} />;
      case "finance":
        return <FinanceScreen />;
    }
  };

  const panelOpen = (value: "settings" | "reminders") =>
    panel.overlay?.open === true && panel.overlay.value === value;

  return (
    <MotionConfig reducedMotion={state.settings.reduceMotion ? "always" : "user"}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[clamp(220px,18vw,280px)_minmax(0,1fr)]">
        <SideRail tab={tab} onChange={setTab} />
        <div className="mx-auto w-full max-w-[1240px] px-[clamp(16px,4.5vw,48px)] pb-[calc(112px+env(safe-area-inset-bottom))] lg:pb-14">
          <Header
            now={now}
            name={state.settings.displayName}
            onBell={() => panel.open("reminders")}
            onSettings={() => panel.open("settings")}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.main
              key={tab}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {renderScreen()}
            </motion.main>
          </AnimatePresence>
        </div>
        <BottomNav tab={tab} onChange={setTab} />
      </div>
      <TaskEditor overlay={editor.overlay} onClose={editor.close} />
      <StatusEditor overlay={statusEditor.overlay} onClose={statusEditor.close} />
      <SettingsSheet open={panelOpen("settings")} onClose={panel.close} />
      <RemindersSheet open={panelOpen("reminders")} onClose={panel.close} now={now} />
    </MotionConfig>
  );
}
