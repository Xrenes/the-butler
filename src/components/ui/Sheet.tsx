"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { CircleButton } from "./primitives";

/** Sheet state that keeps its content during the closing animation. */
export interface Overlay<T> {
  value: T;
  open: boolean;
  nonce: number;
}

export function useOverlay<T>() {
  const [overlay, setOverlay] = useState<Overlay<T> | null>(null);
  const open = useCallback(
    (value: T) => setOverlay((current) => ({ value, open: true, nonce: (current?.nonce ?? 0) + 1 })),
    [],
  );
  const close = useCallback(
    () => setOverlay((current) => (current ? { ...current, open: false } : current)),
    [],
  );
  return { overlay, open, close };
}

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 600;

/** Bottom sheet on phones, centred dialog from tablet width up. Drag the header to dismiss. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="sheet"
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div aria-hidden className="absolute inset-0 bg-[var(--overlay)]" onClick={onClose} />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_VELOCITY) onClose();
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="surface-card relative flex max-h-[92dvh] w-full flex-col rounded-t-[32px] pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.7)] md:max-w-[34rem] md:rounded-[32px]"
          >
            <div
              className="cursor-grab touch-none px-5 pt-3 active:cursor-grabbing"
              onPointerDown={(event) => dragControls.start(event)}
            >
              <div className="mx-auto h-1.5 w-10 rounded-full bg-fg/20 md:hidden" />
              <div className="flex items-center justify-between gap-3 pt-3 pb-2">
                <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
                <CircleButton icon="close" label="Close" size="sm" onClick={onClose} />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">{children}</div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
