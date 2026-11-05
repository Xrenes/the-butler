import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import type { ResourceIcon } from "@domain/types";
import { useTheme } from "../theme";
import { tap } from "../ui";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const KEY = 72;

type MciName = keyof typeof MaterialCommunityIcons.glyphMap;

const RESOURCE_ICON_MAP: Record<ResourceIcon, MciName> = {
  cash: "cash",
  bank: "bank-outline",
  mobile: "cellphone",
  card: "credit-card-outline",
  wallet: "wallet-outline",
  piggy: "piggy-bank-outline",
};

export function ResourceGlyph({ icon, size = 20, color }: { icon: ResourceIcon; size?: number; color: string }) {
  return <MaterialCommunityIcons name={RESOURCE_ICON_MAP[icon]} size={size} color={color} />;
}

interface KeypadProps {
  onKey: (key: string) => void;
  allowDecimal?: boolean;
  disabled?: boolean;
  corner?: ReactNode;
}

/** Round keypad shared by the PIN lock and amount entry. */
export function Keypad({ onKey, allowDecimal = false, disabled = false, corner }: KeypadProps) {
  const t = useTheme();
  const key = (value: string, label: ReactNode, accessibilityLabel?: string, bare = false) => (
    <Pressable
      key={value}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? value}
      disabled={disabled}
      onPress={() => {
        tap();
        onKey(value);
      }}
      style={({ pressed }) => ({
        width: KEY,
        height: KEY,
        borderRadius: KEY / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bare ? "transparent" : pressed ? t.line : t.surface2,
        borderWidth: bare ? 0 : 1,
        borderColor: t.edge,
        opacity: disabled ? 0.4 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      {typeof label === "string" ? <Text style={{ color: t.fg, fontSize: 26, fontWeight: "500" }}>{label}</Text> : label}
    </Pressable>
  );
  const rows = [DIGITS.slice(0, 3), DIGITS.slice(3, 6), DIGITS.slice(6, 9)];
  return (
    <View style={{ alignSelf: "center", gap: 14 }}>
      {rows.map((row) => (
        <View key={row[0]} style={{ flexDirection: "row", gap: 22 }}>
          {row.map((digit) => key(digit, digit))}
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 22 }}>
        {allowDecimal ? (
          key(".", ".", "Decimal point")
        ) : (
          <View style={{ width: KEY, height: KEY, alignItems: "center", justifyContent: "center" }}>{corner}</View>
        )}
        {key("0", "0")}
        {key("back", <Ionicons name="backspace-outline" size={26} color={t.fg} />, "Delete", true)}
      </View>
    </View>
  );
}
