import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { askForAlarmPermissions } from "../alarms/permissions";
import { clearPin } from "../pin";
import { useStore } from "../store";
import { useTheme } from "../theme";
import { Chip, GhostButton, type IconName, Sheet, Toggle } from "../ui";
import { AlarmCheck } from "./AlarmCheck";

/** Fixed alarm colours to choose from instead of each task's category colour. */
const ALARM_COLORS = ["#D83036", "#F97316", "#EAB308", "#16A34A", "#0EA5E9", "#8B5CF6", "#EC4899"] as const;

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

  const setPhoneAlarm = (phoneAlarm: boolean) => {
    dispatch({ type: "settings/update", patch: { phoneAlarm } });
    // Turning it back on asks for anything still missing; the alarm sync then follows the setting.
    if (phoneAlarm) askForAlarmPermissions().catch(() => undefined);
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

        <Group title="Alarm check">{open ? <AlarmCheck /> : null}</Group>

        <Group title="Alarms">
          <Toggle
            icon="alarm-outline"
            label="Phone alarm"
            description="Rings when a task starts or ends, even when the app is closed."
            value={settings.phoneAlarm}
            onChange={setPhoneAlarm}
          />
          <Toggle
            icon="phone-portrait-outline"
            label="On-screen alarm"
            description="While the app is open, show the task full screen with Done, Snooze and On hold."
            value={settings.inAppAlarm}
            onChange={(inAppAlarm) => dispatch({ type: "settings/update", patch: { inAppAlarm } })}
          />
          <Toggle
            icon="volume-high-outline"
            label="Loud alarm sound"
            description="In the app, loops until you answer, even on silent."
            value={settings.alarmSound}
            onChange={(alarmSound) => dispatch({ type: "settings/update", patch: { alarmSound } })}
          />
          <Toggle
            icon="flash-outline"
            label="Flashing colour"
            value={settings.alarmFlash}
            onChange={(alarmFlash) => dispatch({ type: "settings/update", patch: { alarmFlash } })}
          />
          <Toggle
            icon="pulse-outline"
            label="Vibrate"
            value={settings.alarmVibrate}
            onChange={(alarmVibrate) => dispatch({ type: "settings/update", patch: { alarmVibrate } })}
          />
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            <GhostButton
              onPress={() => {
                onClose();
                dispatch({ type: "alarm/preview", on: true });
              }}
            >
              Preview alarm screen
            </GhostButton>
          </View>
          <Text style={{ color: t.fg2, fontSize: 12, marginTop: 12, marginBottom: 8 }}>Alarm colour</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip active={settings.alarmColor === "category"} onPress={() => dispatch({ type: "settings/update", patch: { alarmColor: "category" } })}>
              Category colour
            </Chip>
            {ALARM_COLORS.map((color) => (
              <Pressable
                key={color}
                accessibilityRole="radio"
                accessibilityLabel={`Alarm colour ${color}`}
                accessibilityState={{ checked: settings.alarmColor === color }}
                onPress={() => dispatch({ type: "settings/update", patch: { alarmColor: color } })}
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color, borderWidth: settings.alarmColor === color ? 3 : 1, borderColor: settings.alarmColor === color ? t.fg : t.edge }}
              />
            ))}
          </View>
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
