import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { formatTime } from "@domain/dates";
import type { Category, Task } from "@domain/types";
import { TIME_ZONE } from "./store";
import { useTheme } from "./theme";
import { CategoryBadge, CircleButton, StatusSquare, tap } from "./ui";

/** Home list row: category badge, name, time on the right and a chevron. */
export function UpcomingRow({ task, category, onOpen }: { task: Task; category: Category; onOpen: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${task.title}`}
      onPress={() => {
        tap();
        onOpen();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: t.edge,
        backgroundColor: t.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <CategoryBadge category={category} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.fg, fontSize: 16, fontWeight: "500" }} numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={{ color: t.fg2, fontSize: 12 }} numberOfLines={1}>
          {category.name}
        </Text>
      </View>
      <Text style={{ color: t.fg, fontSize: 14, fontVariant: ["tabular-nums"] }}>
        {formatTime(new Date(task.dueAt), TIME_ZONE)}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={t.fg3} />
    </Pressable>
  );
}

interface StatusRowProps {
  task: Task;
  category: Category;
  meta: string;
  onStatus: () => void;
  /** Opens the same editor used to create a task, filled in with this one. */
  onEdit: () => void;
  onRepeat?: () => void;
}

/** Checklist row: status square, then time and title (which open the editor), then a category dot. */
export function StatusRow({ task, category, meta, onStatus, onEdit, onRepeat }: StatusRowProps) {
  const t = useTheme();
  const dimmed = task.status === "NC" || task.status === "H";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: t.edge,
        backgroundColor: t.surface,
        paddingRight: 8,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Change status of ${task.title}`}
        onPress={() => {
          tap();
          onStatus();
        }}
        style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}
      >
        <StatusSquare status={task.status} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${task.title}`}
        onPress={() => {
          tap();
          onEdit();
        }}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, height: 52 }}
      >
        <Text style={{ color: t.fg2, fontSize: 13, width: 66, fontVariant: ["tabular-nums"] }} numberOfLines={1}>
          {meta}
        </Text>
        <Text style={{ color: dimmed ? t.fg2 : t.fg, fontSize: 15, flex: 1 }} numberOfLines={1}>
          {task.title}
        </Text>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: category.color, marginHorizontal: 4 }} />
        <Ionicons name="chevron-forward" size={18} color={t.fg3} />
      </Pressable>
      {onRepeat ? <CircleButton icon="repeat" label={`Repeat ${task.title}`} size={36} onPress={onRepeat} /> : null}
    </View>
  );
}
