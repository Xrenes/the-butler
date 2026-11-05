import { useEffect, useState } from "react";
import { Alert, Linking, Text, TextInput, View } from "react-native";
import { describeLead } from "@domain/alarms";
import { dayKeyOf, formatDayLabel, formatTime } from "@domain/dates";
import { sortByDue } from "@domain/tasks";
import { type PermissionState, permissionState, requestPermission, sendTestAlarm } from "../notifications";
import { clearPin } from "../pin";
import { TIME_ZONE, useStore } from "../store";
import { useTheme } from "../theme";
import { CategoryBadge, Chip, EmptyState, GhostButton, Segmented, Sheet, Toggle, type IconName } from "../ui";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";

const REMINDER_WINDOW_MS = 48 * 60 * 60 * 1000;
const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

function Group({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.surface, borderColor: t.edge, borderWidth: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 }}>
      <Text style={{ color: t.fg3, fontSize: 12, fontWeight: "500", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 }}>{title}</Text>
      {children}
    </View>
  );
}

function Note({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.fg3, fontSize: 12, marginTop: 6 }}>{children}</Text>;
}

/** Settings live behind the gear in the top-right corner. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const { state, dispatch } = useStore();
  const settings = state.settings;
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [testSent, setTestSent] = useState(false);
  const refreshPermission = () =>
    permissionState()
      .then(setPermission)
      .catch(() => setPermission("denied"));

  useEffect(() => {
    if (open) refreshPermission();
  }, [open]);

  const setPhoneAlarm = async (value: boolean) => {
    dispatch({ type: "settings/update", patch: { phoneAlarm: value } });
    if (value) await requestPermission().catch(() => false);
    await refreshPermission();
  };

  const sendTest = async () => {
    const ok = await sendTestAlarm().catch(() => false);
    await refreshPermission();
    setTestSent(ok);
    if (!ok) {
      Alert.alert("Notifications are off", "Allow notifications for The Butler in your phone's settings to get alarms.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open settings", onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const confirmClear = () =>
    Alert.alert("Delete all tasks?", "Categories and settings stay. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "data/clear-tasks" }) },
    ]);

  const confirmEraseFinance = () =>
    Alert.alert("Erase finance?", "Deletes your accounts, entries and finance PIN from this phone. Tasks stay.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Erase",
        style: "destructive",
        onPress: async () => {
          await clearPin();
          dispatch({ type: "data/clear-finance", now: new Date() });
        },
      },
    ]);

  return (
    <Sheet open={open} title="Settings" onClose={onClose}>
      <View style={{ gap: 14 }}>
        <Group title="Profile">
          <Text style={{ color: t.fg2, fontSize: 12, marginVertical: 8 }}>Display name</Text>
          <TextInput
            value={settings.displayName}
            maxLength={40}
            onChangeText={(displayName) => dispatch({ type: "settings/update", patch: { displayName } })}
            placeholder="What should The Butler call you?"
            placeholderTextColor={t.fg3}
            selectionColor={t.accent}
            style={{ color: t.fg, backgroundColor: t.well, borderColor: t.edge, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, height: 48, fontSize: 15 }}
          />
        </Group>

        <Group title="Appearance">
          <View style={{ paddingVertical: 8 }}>
            <Segmented options={THEMES} value={settings.theme} onChange={(theme) => dispatch({ type: "settings/update", patch: { theme } })} />
          </View>
        </Group>

        <Group title="Alarms">
          <Toggle
            icon="alarm-outline"
            label="Phone alarm"
            description="A loud alert at each task's reminder time, even when the app is closed."
            value={settings.phoneAlarm}
            onChange={setPhoneAlarm}
          />
          <Toggle
            icon="phone-portrait-outline"
            label="On-screen alarm"
            description="While the app is open, show the task and its category full screen."
            value={settings.inAppAlarm}
            onChange={(inAppAlarm) => dispatch({ type: "settings/update", patch: { inAppAlarm } })}
          />
          {settings.phoneAlarm && permission === "denied" ? (
            <Note>{"Notifications are blocked for this app. Turn them on in your phone's settings, or no alarm can ring."}</Note>
          ) : null}
          {settings.phoneAlarm && permission === "undetermined" ? (
            <Note>{"Tap “Send a test alarm” and allow notifications so alarms can ring."}</Note>
          ) : null}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <GhostButton onPress={sendTest}>Send a test alarm</GhostButton>
          </View>
          {testSent ? <Note>Test alarm coming in 5 seconds. Lock your phone to see how it looks.</Note> : null}
          <Note>
            {"Reminders repeat after 1 and 3 minutes if you haven't marked the task. For the loudest result, allow Time " +
              "Sensitive notifications and add The Butler to your Focus modes."}
          </Note>
        </Group>

        <Group title="Finance">
          <Toggle
            icon="swap-horizontal"
            label="Transfers between accounts"
            value={settings.transfersEnabled}
            onChange={(transfersEnabled) => dispatch({ type: "settings/update", patch: { transfersEnabled } })}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            <Chip icon="lock-closed-outline" onPress={() => dispatch({ type: "finance/lock" })}>
              Lock now
            </Chip>
            <Chip icon="trash-outline" onPress={confirmEraseFinance}>
              Erase finance
            </Chip>
          </View>
          <Note>Finance locks when you leave it, after a minute idle, and whenever the app goes to the background.</Note>
        </Group>

        <Group title="Your data">
          <Note>
            {"Everything is stored on this phone only. Nothing is sent anywhere. Your finance PIN is kept as a salted hash " +
              "in the phone's secure keychain."}
          </Note>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            <Chip icon="sparkles-outline" onPress={() => dispatch({ type: "data/sample", now: new Date() })}>
              Load sample week
            </Chip>
            <Chip icon="trash-outline" onPress={confirmClear}>
              Delete all tasks
            </Chip>
          </View>
        </Group>

        <Group title="Coming next">
          <InfoRow icon="send-outline" title="Telegram" detail="Reminder texts and call alarms will be added later." />
        </Group>
      </View>
    </Sheet>
  );
}

function InfoRow({ icon, title, detail }: { icon: IconName; title: string; detail: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 8 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={18} color={t.fg2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.fg, fontSize: 14 }}>{title}</Text>
        <Text style={{ color: t.fg2, fontSize: 12 }}>{detail}</Text>
      </View>
    </View>
  );
}

/** Bell: reminders coming up in the next 48 hours. */
export function RemindersSheet({ open, onClose, now }: { open: boolean; onClose: () => void; now: Date }) {
  const t = useTheme();
  const { state } = useStore();
  const today = dayKeyOf(now, TIME_ZONE);
  const categoryById = new Map(state.categories.map((category) => [category.id, category]));
  const soon = sortByDue(
    state.tasks.filter((task) => {
      const due = new Date(task.dueAt).getTime();
      return task.status === "pending" && task.reminder.enabled && due >= now.getTime() && due <= now.getTime() + REMINDER_WINDOW_MS;
    }),
  );

  return (
    <Sheet open={open} title="Reminders" onClose={onClose}>
      {soon.length === 0 ? (
        <EmptyState icon="notifications-outline" title="No reminders soon" hint="Reminders for the next 48 hours show up here." />
      ) : (
        <View style={{ gap: 4 }}>
          {soon.map((task) => {
            const due = new Date(task.dueAt);
            const category = categoryById.get(task.categoryId);
            return (
              <View key={task.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomColor: t.line, borderBottomWidth: 1 }}>
                {category ? <CategoryBadge category={category} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.fg, fontSize: 15, fontWeight: "500" }} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text style={{ color: t.fg2, fontSize: 12 }} numberOfLines={1}>
                    {category?.name ?? "No category"} · {describeLead(task.reminder.leadMinutes)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: t.fg, fontSize: 14 }}>{formatTime(due, TIME_ZONE)}</Text>
                  <Text style={{ color: t.fg3, fontSize: 11 }}>{formatDayLabel(dayKeyOf(due, TIME_ZONE), today)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}
