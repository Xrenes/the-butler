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
import { AlarmWatcher } from "./AlarmAlert";
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

interface BottomNavProps extends NavProps {
  onAdd: () => void;
}

/** Phones and tablets: floating bar with a raised "+" in the middle, after the reference. */
function BottomNav({ tab, onChange, onAdd }: BottomNavProps) {
  const item = (key: Tab) => {
    const active = key === tab;
    return (
      <button
        key={key}
        type="button"
        aria-current={active ? "page" : undefined}
        onClick={() => onChange(key)}
        className="relative grid h-12 place-items-center rounded-2xl"
      >
        {active ? (
          <motion.span
            layoutId="nav-active"
            className="surface-well absolute inset-x-1 inset-y-0 rounded-2xl"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
          </motion.span>
        ) : null}
        <Icon
          name={TAB_META[key].icon}
          size={22}
          className={`relative transition-colors ${active ? "text-fg" : "text-fg-2"}`}
        />
        <span className="sr-only">{TAB_META[key].label}</span>
      </button>
    );
  };
  const middle = TABS.length / 2;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 px-[clamp(12px,4vw,24px)] pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="relative mx-auto max-w-md">
        <div className="surface-nav grid grid-cols-5 items-center rounded-[30px] p-2">
          {TABS.slice(0, middle).map(item)}
          <span aria-hidden />
          {TABS.slice(middle).map(item)}
        </div>
        <div className="surface-well absolute top-0 left-1/2 grid h-[76px] w-[76px] -translate-x-1/2 -translate-y-[42%] place-items-center rounded-full border border-[var(--card-edge)]">
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={onAdd}
            aria-label="Add task"
            className="accent-fill grid h-[58px] w-[58px] place-items-center rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_0_26px_-2px_var(--accent-glow)]"
          >
            <Icon name="plus" size={26} strokeWidth={2} />
          </motion.button>
        </div>
      </div>
    </nav>
  );
}

/** Desktop: side rail with labels and a brand panel. */
function SideRail({ tab, onChange }: NavProps) {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-10 border-r border-[var(--card-edge)] bg-bg px-[clamp(16px,1.6vw,28px)] py-8 lg:flex">
      <div>
        <p className="text-xl font-semibold tracking-tight">The Butler</p>
        <p className="mt-1 text-sm text-fg-2">{TAGLINE}</p>
      </div>
      <nav aria-label="Main" className="flex flex-col gap-1.5">
        {TABS.map((key) => {
          const active = key === tab;
          return (
            <button
              key={key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(key)}
              className={`relative flex h-12 items-center gap-3 rounded-2xl px-4 text-sm transition-colors ${
                active ? "font-medium text-fg" : "text-fg-2 hover:text-fg"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="rail-active"
                  className="surface-raised absolute inset-0 rounded-2xl"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <Icon name={TAB_META[key].icon} size={20} className={`relative ${active ? "text-accent" : ""}`} />
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
      <div className="flex shrink-0 gap-2.5">
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

  // The nav's "+" works from any tab, but new tasks are always created from Home.
  const addFromNav = () => {
    if (tab !== "home") setTab("home");
    editor.open({ kind: "new" });
  };

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
            onEdit={(task) => editor.open({ kind: "edit", task })}
            onRepeat={(task) => editor.open({ kind: "repeat", task })}
          />
        );
      case "calendar":
        return (
          <CalendarScreen
            now={now}
            onStatus={statusEditor.open}
            onEdit={(task) => editor.open({ kind: "edit", task })}
          />
        );
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
        <BottomNav tab={tab} onChange={setTab} onAdd={addFromNav} />
      </div>
      <TaskEditor overlay={editor.overlay} onClose={editor.close} />
      <StatusEditor overlay={statusEditor.overlay} onClose={statusEditor.close} />
      <SettingsSheet open={panelOpen("settings")} onClose={panel.close} />
      <RemindersSheet open={panelOpen("reminders")} onClose={panel.close} now={now} />
      <AlarmWatcher />
    </MotionConfig>
  );
}
