import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MARKED_STATUSES, type MarkedStatus, type Task } from "@domain/types";
import { useStore } from "../store";
import { STATUS_LABEL, useTheme } from "../theme";
import { GhostButton, PrimaryButton, Sheet, StatusSquare, tap } from "../ui";

interface StatusEditorProps {
  task: Task | null;
  nonce: number;
  onClose: () => void;
}

/** Opened from a status square. Cancel never changes anything. */
export function StatusEditor({ task, nonce, onClose }: StatusEditorProps) {
  return (
    <Sheet open={task !== null} title={task?.title ?? "Status"} onClose={onClose}>
      {task ? <StatusForm key={nonce} task={task} onClose={onClose} /> : null}
    </Sheet>
  );
}

function StatusForm({ task, onClose }: { task: Task; onClose: () => void }) {
  const t = useTheme();
  const { dispatch } = useStore();
  const [selected, setSelected] = useState<MarkedStatus | null>(task.status === "pending" ? null : task.status);

  const save = () => {
    if (!selected) return;
    dispatch({ type: "task/status", id: task.id, status: selected, now: new Date() });
    onClose();
  };

  return (
    <View style={{ gap: 14 }}>
      <Text style={{ color: t.fg2, fontSize: 14 }}>How did it go?</Text>
      {MARKED_STATUSES.map((status) => {
        const active = selected === status;
        return (
          <Pressable
            key={status}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => {
              tap();
              setSelected(status);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              padding: 12,
              borderRadius: 18,
              borderWidth: active ? 1.5 : 1,
              borderColor: active ? t.accent : t.edge,
              backgroundColor: t.surface,
            }}
          >
            <StatusSquare status={status} size={32} />
            <Text style={{ color: t.fg, fontSize: 16, fontWeight: "500", flex: 1 }}>{STATUS_LABEL[status]}</Text>
            {active ? <Ionicons name="checkmark" size={20} color={t.fg} /> : null}
          </Pressable>
        );
      })}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
        <GhostButton onPress={onClose}>Cancel</GhostButton>
        <PrimaryButton disabled={!selected} onPress={save}>
          Save
        </PrimaryButton>
      </View>
    </View>
  );
}
