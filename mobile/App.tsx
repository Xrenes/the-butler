import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from "react-native";
import { FINANCE_IDLE_MS, FinanceScreen } from "./src/finance/FinanceScreen";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import type { Task } from "@domain/types";
import { type EditorMode, TaskEditor } from "./src/editors/TaskEditor";
import { StatusEditor } from "./src/editors/StatusEditor";
import { type PermissionState, permissionState, requestPermission, syncAlarms } from "./src/notifications";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { CategoriesScreen } from "./src/screens/CategoriesScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { AlarmWatcher } from "./src/shell/AlarmAlert";
import { SettingsSheet } from "./src/shell/Settings";
import { StoreProvider, TIME_ZONE, useNow, useStore } from "./src/store";
import { ThemeProvider, useTheme } from "./src/theme";
import { CircleButton, type IconName, ScrollLockContext, tap } from "./src/ui";
import { dayKeyOf, formatLongDate } from "@domain/dates";

type Tab = "home" | "categories" | "calendar" | "finance";
const TAB_META: Record<Tab, { label: string; icon: IconName; active: IconName }> = {
  home: { label: "Home", icon: "home-outline", active: "home" },
  categories: { label: "Categories", icon: "grid-outline", active: "grid" },
  calendar: { label: "Calendar", icon: "calendar-outline", active: "calendar" },
  finance: { label: "Finance", icon: "wallet-outline", active: "wallet" },
};
/** Keeps the phone's scheduled alarms in step with the tasks, whatever changed them. */
function useAlarmSync() {
  const { state, ready } = useStore();
  const { tasks, categories, settings } = state;
  const [permission, setPermission] = useState<PermissionState | null>(null);

  // Alarms are the core of the app, so ask for notification permission once, on first launch.
  useEffect(() => {
    if (!ready || !settings.phoneAlarm) return;
    permissionState()
      .then(async (current) => {
        if (current !== "undetermined") return current;
        return (await requestPermission()) ? "granted" : await permissionState();
      })
      .then(setPermission)
      .catch(() => setPermission("denied"));
  }, [ready, settings.phoneAlarm]);

  useEffect(() => {
    if (!ready) return;
    syncAlarms(tasks, categories, settings.phoneAlarm).catch(() => undefined);
  }, [ready, tasks, categories, settings.phoneAlarm, permission]);
}

const SETTINGS_BUTTON = 44;

/** Day and date in the centre, settings on the right. */
function Header({ now, onSettings }: { now: Date; onSettings: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [weekday, date] = formatLongDate(dayKeyOf(now, TIME_ZONE)).split(", ");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 20 }}>
      <View style={{ width: SETTINGS_BUTTON }} />
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ color: t.fg, fontSize: 21, fontWeight: "600", letterSpacing: -0.3 }}>{weekday}</Text>
        <Text style={{ color: t.fg2, fontSize: 13, marginTop: 1 }}>{date}</Text>
      </View>
      <CircleButton icon="settings-outline" label="Settings" size={SETTINGS_BUTTON} onPress={onSettings} />
    </View>
  );
}

function BottomNav({ tab, onChange, onAdd }: { tab: Tab; onChange: (tab: Tab) => void; onAdd: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const item = (key: Tab) => {
    const active = key === tab;
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityLabel={TAB_META[key].label}
        accessibilityState={{ selected: active }}
        onPress={() => {
          tap();
          onChange(key);
        }}
        style={{ flex: 1, height: 56, alignItems: "center", justifyContent: "center", gap: 3 }}
      >
        <Ionicons name={active ? TAB_META[key].active : TAB_META[key].icon} size={22} color={active ? t.fg : t.fg3} />
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: active ? t.accent : "transparent" }} />
      </Pressable>
    );
  };
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingBottom: Math.max(insets.bottom, 12) }}>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.surface, borderRadius: 32, borderWidth: 1, borderColor: t.edge, paddingHorizontal: 6, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 12 }}>
        {item("home")}
        {item("categories")}
        <View style={{ width: 78 }} />
        {item("calendar")}
        {item("finance")}
      </View>
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: -30, alignItems: "center" }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add task"
            onPress={() => {
              tap();
              onAdd();
            }}
            style={({ pressed }) => ({
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: t.accent,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.93 : 1 }],
              shadowColor: t.accent,
              shadowOpacity: 0.7,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 10,
            })}
          >
            <Ionicons name="add" size={30} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Finance locks when you leave its tab, after a minute without touching it, or when the app is hidden. */
function useFinanceAutoLock(tab: Tab): () => void {
  const { state, dispatch } = useStore();
  const unlocked = state.financeUnlocked;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lock = useCallback(() => dispatch({ type: "finance/lock" }), [dispatch]);

  const restart = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(lock, FINANCE_IDLE_MS);
  }, [lock]);

  useEffect(() => {
    if (tab !== "finance") lock();
  }, [tab, lock]);

  useEffect(() => {
    if (!unlocked) return;
    restart();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") lock();
    });
    return () => {
      subscription.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [unlocked, restart, lock]);

  return restart;
}

function Shell() {
  const t = useTheme();
  const { state, ready } = useStore();
  const now = useNow();
  const [tab, setTab] = useState<Tab>("home");
  const onFinanceActivity = useFinanceAutoLock(tab);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [editor, setEditor] = useState<{ mode: EditorMode | null; nonce: number }>({ mode: null, nonce: 0 });
  const [statusTask, setStatusTask] = useState<{ task: Task | null; nonce: number }>({ task: null, nonce: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(false);
  useAlarmSync();

  const openEditor = useCallback((mode: EditorMode) => setEditor((current) => ({ mode, nonce: current.nonce + 1 })), []);
  const closeEditor = useCallback(() => setEditor((current) => ({ ...current, mode: null })), []);
  const openStatus = useCallback((task: Task) => setStatusTask((current) => ({ task, nonce: current.nonce + 1 })), []);
  const closeStatus = useCallback(() => setStatusTask((current) => ({ ...current, task: null })), []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  const screen = () => {
    switch (tab) {
      case "home":
        return <HomeScreen now={now} onEdit={(task) => openEditor({ kind: "edit", task })} />;
      case "categories":
        return (
          <CategoriesScreen
            now={now}
            index={categoryIndex}
            onIndex={setCategoryIndex}
            onStatus={openStatus}
            onEdit={(task) => openEditor({ kind: "edit", task })}
            onRepeat={(task) => openEditor({ kind: "repeat", task })}
          />
        );
      case "calendar":
        return <CalendarScreen now={now} onStatus={openStatus} onEdit={(task) => openEditor({ kind: "edit", task })} />;
      case "finance":
        return <FinanceScreen onActivity={onFinanceActivity} />;
    }
  };

  // The "+" works from any tab, but new tasks are created from Home (same as the web app).
  const addFromNav = () => {
    if (tab !== "home") setTab("home");
    openEditor({ kind: "new" });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.mode === "dark" ? "light" : "dark"} />
      <Header now={now} onSettings={() => setSettingsOpen(true)} />
      <ScrollLockContext value={setScrollLocked}>
        <ScrollView
          key={tab}
          scrollEnabled={!scrollLocked}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}
        >
          {screen()}
        </ScrollView>
      </ScrollLockContext>
      <BottomNav tab={tab} onChange={setTab} onAdd={addFromNav} />

      <TaskEditor mode={editor.mode} nonce={editor.nonce} onClose={closeEditor} />
      <StatusEditor task={statusTask.task} nonce={statusTask.nonce} onClose={closeStatus} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AlarmWatcher />
    </View>
  );
}

/** The app is dark only. */
function Themed() {
  return (
    <ThemeProvider mode="dark">
      <Shell />
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Themed />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
