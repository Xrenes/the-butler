"use client";

import { type KeyboardEvent, useEffect, useLayoutEffect, useRef } from "react";

const ITEM_HEIGHT = 44;
const VISIBLE_HEIGHT = 220;
const SETTLE_DELAY_MS = 90;

interface TimeWheelProps {
  label: string;
  values: readonly number[];
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  accent: string;
}

/** Vertical scroll-snap wheel. Arrow keys step through values for keyboard users. */
export function TimeWheel({ label, values, value, format, onChange, accent }: TimeWheelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const index = Math.max(0, values.indexOf(value));

  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const target = index * ITEM_HEIGHT;
    if (Math.abs(node.scrollTop - target) > ITEM_HEIGHT / 2) node.scrollTop = target;
  }, [index]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const clampIndex = (next: number) => Math.min(values.length - 1, Math.max(0, next));

  const handleScroll = () => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const node = listRef.current;
      if (!node) return;
      const next = values[clampIndex(Math.round(node.scrollTop / ITEM_HEIGHT))];
      if (next !== value) onChange(next);
    }, SETTLE_DELAY_MS);
  };

  const step = (delta: number) => {
    const nextIndex = clampIndex(index + delta);
    onChange(values[nextIndex]);
    listRef.current?.scrollTo({ top: nextIndex * ITEM_HEIGHT, behavior: "smooth" });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      step(1);
    }
  };

  return (
    <div className="relative w-[clamp(3.75rem,16vw,4.75rem)]" style={{ height: VISIBLE_HEIGHT }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-11 -translate-y-1/2 rounded-2xl"
        style={{
          background: `color-mix(in srgb, ${accent} 16%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 50%, transparent)`,
        }}
      />
      <div
        ref={listRef}
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        aria-valuemin={values[0]}
        aria-valuemax={values[values.length - 1]}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        className="no-scrollbar relative h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-2xl [mask-image:linear-gradient(transparent,black_32%,black_68%,transparent)]"
        style={{ paddingBlock: (VISIBLE_HEIGHT - ITEM_HEIGHT) / 2 }}
      >
        {values.map((item) => (
          <div
            key={item}
            className={`grid snap-center place-items-center text-[1.6rem] tabular-nums transition-colors ${
              item === value ? "font-normal text-fg" : "font-light text-fg-3"
            }`}
            style={{ height: ITEM_HEIGHT }}
          >
            {format(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
