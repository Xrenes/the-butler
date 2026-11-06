import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MARKED_STATUSES, type MarkedStatus, type Task } from "@domain/types";
import { useStore } from "../store";
import { STATUS_HEX, STATUS_LABEL, useTheme } from "../theme";
import { GhostButton, PrimaryButton, Sheet, StatusSquare, tap } from "../ui";

const CHOICE_SIZE = 76;

interface StatusEditorProps {
  task: Task | null;
  nonce: number;
  onClose: () => void;
}

/** Opened from a status icon. Three icons, no words. Cancel never changes anything. */
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
    <View style={{ gap: 22 }}>
      <Text style={{ color: t.fg2, fontSize: 14, textAlign: "center" }}>How did it go?</Text>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 18 }}>
        {MARKED_STATUSES.map((status) => {
          const active = selected === status;
          return (
            <Pressable
              key={status}
              accessibilityRole="radio"
              accessibilityLabel={STATUS_LABEL[status]}
              accessibilityState={{ checked: active }}
              onPress={() => {
                tap();
                setSelected(status);
              }}
              style={({ pressed }) => ({
                width: CHOICE_SIZE,
                height: CHOICE_SIZE,
                borderRadius: CHOICE_SIZE / 2,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: active ? 2 : 1,
                borderColor: active ? STATUS_HEX[status] : t.edge,
                backgroundColor: active ? `${STATUS_HEX[status]}26` : t.surface,
                transform: [{ scale: pressed ? 0.94 : active ? 1.06 : 1 }],
              })}
            >
              <StatusSquare status={status} size={34} />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <GhostButton onPress={onClose}>Cancel</GhostButton>
        <PrimaryButton disabled={!selected} onPress={save}>
          Save
        </PrimaryButton>
      </View>
    </View>
  );
}
