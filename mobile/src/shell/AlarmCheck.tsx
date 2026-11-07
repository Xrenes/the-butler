import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { dayKeyOf, formatDayLabel, formatTime } from "@domain/dates";
import { type AlarmHealth, type AlarmMode, useAlarmHealth } from "../alarms/health";
import { allowBrowserAlerts, allowExactAlarms, allowNotifications, allowRealAlarms } from "../alarms/permissions";
import { resyncAlarms, ringTestAlarm } from "../alarms/schedule";
import { TIME_ZONE, useNow } from "../store";
import { STATUS_HEX, useTheme } from "../theme";
import type { IconName } from "../ui";

/** Long enough to lock the phone, short enough to wait for. */
const TEST_DELAY_MS = 60_000;
const GOOD = STATUS_HEX.C;
const WARN = STATUS_HEX.H;
const BAD = STATUS_HEX.NC;
const MAX_ERRORS_SHOWN = 3;

interface Summary {
  icon: IconName;
  color: string;
  title: string;
  detail: string;
}

function summaryFor(mode: AlarmMode): Summary {
  switch (mode) {
    case "alarm":
      return {
        icon: "checkmark-circle",
        color: GOOD,
        title: "Real alarms are on",
        detail: "Tasks ring full screen like the Clock app, even on silent or in a Focus.",
      };
    case "notification":
      return {
        icon: "warning",
        color: WARN,
        title: "Notifications only",
        detail:
          Platform.OS === "ios"
            ? "These can be missed on silent or in a Focus. Allow real alarms below."
            : "Allow exact timing below so they arrive on the minute.",
      };
    case "screen":
      return {
        icon: "warning",
        color: WARN,
        title: Platform.OS === "web" ? "Rings while this page is open" : "Rings only while the app is open",
        detail:
          Platform.OS === "web"
            ? "Keep this tab open. Allow browser alerts to be told from other tabs."
            : "Allow notifications below so tasks ring when the app is closed.",
      };
    case "off":
      return { icon: "close-circle", color: BAD, title: "Phone alarm is off", detail: "Turn on Phone alarm below so tasks ring when the app is closed." };
  }
}

interface Check {
  key: string;
  label: string;
  ok: boolean;
  status: string;
  fix?: () => Promise<void>;
}

function checksFor(health: AlarmHealth): Check[] {
  const { realAlarms, notifications, exactAlarms, browser } = health.permissions;
  const checks: Check[] = [];
  if (Platform.OS === "ios") {
    checks.push(
      realAlarms === "unavailable"
        ? { key: "real", label: "Real alarms", ok: false, status: "Need the installed app (not Expo Go) on iOS 26.1 or newer" }
        : {
            key: "real",
            label: "Real alarms",
            ok: realAlarms === "authorized",
            status: realAlarms === "authorized" ? "Allowed" : "Not allowed: Settings → Apps → The Butler → Alarms",
            fix: allowRealAlarms,
          },
    );
  }
  if (Platform.OS !== "web") {
    checks.push({
      key: "notifications",
      label: "Notifications",
      ok: notifications === "granted",
      status: notifications === "granted" ? "Allowed" : "Not allowed",
      fix: allowNotifications,
    });
  }
  if (Platform.OS === "android") {
    checks.push({
      key: "exact",
      label: "Exact timing",
      ok: exactAlarms === "granted",
      status: exactAlarms === "granted" ? "Alarms arrive on the minute" : "Alarms can arrive late",
      fix: allowExactAlarms,
    });
  }
  if (Platform.OS === "web") {
    checks.push({
      key: "browser",
      label: "Browser alerts",
      ok: browser === "granted",
      status:
        browser === "granted"
          ? "Allowed"
          : browser === "unsupported"
            ? "Not supported in this browser"
            : browser === "denied"
              ? "Blocked: allow notifications in the site settings"
              : "Not asked yet",
      fix: browser === "default" ? allowBrowserAlerts : undefined,
    });
  }
  return checks;
}

function countsLine(health: AlarmHealth): string {
  if (Platform.OS === "web") return "Alarms ring here while this page is open.";
  if (health.realAlarms > 0) {
    return `${health.realAlarms} real alarm${health.realAlarms === 1 ? "" : "s"} set, with ${health.notifications} backup notification${health.notifications === 1 ? "" : "s"}.`;
  }
  if (health.notifications > 0) return `${health.notifications} notification${health.notifications === 1 ? "" : "s"} set on this phone.`;
  return health.upcoming > 0 ? "Nothing is set on the phone yet. Fix the items above." : "No upcoming alarms.";
}

/** Settings → Alarm check: what will ring, what is missing, and a real test. */
export function AlarmCheck() {
  const t = useTheme();
  const health = useAlarmHealth();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [testAt, setTestAt] = useState<number | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await action();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const fix = (check: Check) =>
    run(async () => {
      await check.fix?.();
      await resyncAlarms();
    });
  const ringTest = () =>
    run(async () => {
      setTestAt((await ringTestAlarm(TEST_DELAY_MS)).getTime());
    });
  const checkAgain = () =>
    run(async () => {
      await resyncAlarms();
    });

  if (!health) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }}>
        <ActivityIndicator color={t.accent} />
        <Text style={{ color: t.fg2, fontSize: 13 }}>Checking alarms…</Text>
      </View>
    );
  }

  const summary = summaryFor(health.mode);
  const today = dayKeyOf(now, TIME_ZONE);
  const next = health.next;
  const nextLine = next
    ? `Next: ${formatDayLabel(dayKeyOf(new Date(next.at), TIME_ZONE), today)} ${formatTime(new Date(next.at), TIME_ZONE)} · ${next.title}${next.real ? " · real alarm" : ""}`
    : "No upcoming alarms.";
  const testPending = testAt !== null && testAt > now.getTime();

  return (
    <View style={{ gap: 10, paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 14, borderRadius: 18, backgroundColor: t.well, borderWidth: 1, borderColor: t.edge }}>
        <Ionicons name={summary.icon} size={28} color={summary.color} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.fg, fontSize: 15, fontWeight: "700" }}>{summary.title}</Text>
          <Text style={{ color: t.fg2, fontSize: 12, marginTop: 2 }}>{summary.detail}</Text>
        </View>
      </View>

      {checksFor(health).map((check) => (
        <View key={check.key} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
          <Ionicons name={check.ok ? "checkmark-circle" : "alert-circle"} size={20} color={check.ok ? GOOD : WARN} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.fg, fontSize: 14 }}>{check.label}</Text>
            <Text style={{ color: t.fg2, fontSize: 12 }}>{check.status}</Text>
          </View>
          {!check.ok && check.fix ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Allow ${check.label}`}
              disabled={busy}
              onPress={() => fix(check)}
              style={({ pressed }) => ({ paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: "center", backgroundColor: t.accent, opacity: pressed || busy ? 0.7 : 1 })}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>Allow</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <View style={{ gap: 2 }}>
        <Text style={{ color: t.fg, fontSize: 13 }}>{nextLine}</Text>
        <Text style={{ color: t.fg3, fontSize: 12 }}>{countsLine(health)}</Text>
      </View>

      {[...(problem ? [problem] : []), ...health.errors.slice(0, MAX_ERRORS_SHOWN)].map((error) => (
        <Text key={error} style={{ color: BAD, fontSize: 12 }}>
          {error}
        </Text>
      ))}

      {testPending ? (
        <Text style={{ color: GOOD, fontSize: 13, fontWeight: "600" }}>
          {Platform.OS === "web"
            ? `Keep this tab open. The test rings at ${formatTime(new Date(testAt), TIME_ZONE)}.`
            : `Lock your phone now. The test rings at ${formatTime(new Date(testAt), TIME_ZONE)}.`}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
        <CheckButton icon="alarm-outline" label="Ring in 1 minute" primary disabled={busy} onPress={ringTest} />
        <CheckButton icon="refresh" label="Check again" disabled={busy} onPress={checkAgain} />
      </View>
    </View>
  );
}

function CheckButton({ icon, label, primary, disabled, onPress }: { icon: IconName; label: string; primary?: boolean; disabled: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 46,
        borderRadius: 23,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: primary ? t.accent : t.surface2,
        borderWidth: 1,
        borderColor: primary ? t.accentHi : t.edge,
        opacity: pressed || disabled ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={17} color={primary ? "#FFFFFF" : t.fg} />
      <Text style={{ color: primary ? "#FFFFFF" : t.fg, fontSize: 14, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
