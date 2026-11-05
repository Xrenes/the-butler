"use client";

import { useState } from "react";
import { useDemo } from "@/components/demo/store";
import { Icon } from "@/components/icons/Icon";
import { type Overlay, Sheet } from "@/components/ui/Sheet";
import { GhostButton, PrimaryButton, STATUS_LABEL, StatusSquare } from "@/components/ui/primitives";
import { MARKED_STATUSES, type MarkedStatus, type Task } from "@/lib/domain/types";

/** Floating status editor opened from a C/NC/H square. Cancel never changes anything. */
export function StatusEditor({ overlay, onClose }: { overlay: Overlay<Task> | null; onClose: () => void }) {
  return (
    <Sheet open={overlay?.open ?? false} title={overlay?.value.title ?? "Status"} onClose={onClose}>
      {overlay ? <StatusForm key={overlay.nonce} task={overlay.value} onClose={onClose} /> : null}
    </Sheet>
  );
}

function StatusForm({ task, onClose }: { task: Task; onClose: () => void }) {
  const { dispatch } = useDemo();
  const [selected, setSelected] = useState<MarkedStatus | null>(task.status === "pending" ? null : task.status);

  const handleSave = () => {
    if (!selected) return;
    dispatch({ type: "task/status", id: task.id, status: selected, now: new Date() });
    onClose();
  };

  return (
    <div className="space-y-4 pb-2">
      <p className="text-sm text-fg-2">How did it go?</p>
      <div role="radiogroup" aria-label="Status" className="grid gap-2">
        {MARKED_STATUSES.map((status) => {
          const active = selected === status;
          return (
            <button
              key={status}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(status)}
              className={`flex items-center gap-4 rounded-2xl border p-3 text-left transition-colors ${
                active ? "border-fg bg-surface" : "border-line hover:bg-surface"
              }`}
            >
              <StatusSquare status={status} size={32} />
              <span className="flex-1 font-medium">{STATUS_LABEL[status]}</span>
              {active ? <Icon name="check" size={20} /> : null}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton disabled={!selected} onClick={handleSave}>
          Save
        </PrimaryButton>
      </div>
    </div>
  );
}
