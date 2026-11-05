"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { Icon, type IconName } from "@/components/icons/Icon";
import type { MarkedStatus, TaskStatus } from "@/lib/domain/types";

/** Status colours are locked by the product spec. */
export const STATUS_HEX: Record<MarkedStatus, string> = { C: "#087B43", NC: "#B91C1C", H: "#C66A0A" };
export const STATUS_LABEL: Record<MarkedStatus, string> = {
  C: "Completed",
  NC: "Not completed",
  H: "On hold",
};

const DEFAULT_ACCENT = "var(--accent)";

export const FIELD =
  "surface-well w-full rounded-2xl border border-[var(--card-edge)] px-4 py-3 text-fg outline-none transition-shadow placeholder:text-fg-3 focus:ring-2 focus:ring-accent";

const LIGHT_LUMINANCE = 0.6;

/** Black or white text for a solid background colour. */
export function readableOn(color: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return "#FFFFFF";
  const value = Number.parseInt(color.slice(1), 16);
  const luminance =
    (0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255)) / 255;
  return luminance > LIGHT_LUMINANCE ? "#1C1C1C" : "#FFFFFF";
}

type CircleVariant = "dark" | "accent" | "ghost" | "glass";
type CircleSize = "sm" | "md" | "lg" | "xl";

const CIRCLE_SIZE: Record<CircleSize, string> = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
  xl: "h-[clamp(56px,15vw,68px)] w-[clamp(56px,15vw,68px)]",
};
const CIRCLE_ICON: Record<CircleSize, number> = { sm: 16, md: 20, lg: 24, xl: 26 };
const CIRCLE_VARIANT: Record<CircleVariant, string> = {
  dark: "surface-raised text-fg hover:brightness-110",
  accent: "accent-fill hover:brightness-110",
  ghost: "border border-[var(--card-edge)] bg-fg/[0.03] text-fg-2 hover:bg-fg/[0.08] hover:text-fg",
  glass: "border border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/20",
};

interface CircleButtonProps {
  icon: IconName;
  label: string;
  onClick?: () => void;
  variant?: CircleVariant;
  size?: CircleSize;
  disabled?: boolean;
  className?: string;
}

export function CircleButton({
  icon,
  label,
  onClick,
  variant = "dark",
  size = "md",
  disabled = false,
  className = "",
}: CircleButtonProps) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid shrink-0 place-items-center rounded-full transition-[background-color,color,filter] disabled:cursor-not-allowed disabled:opacity-40 ${CIRCLE_SIZE[size]} ${CIRCLE_VARIANT[variant]} ${className}`}
    >
      <Icon name={icon} size={CIRCLE_ICON[size]} />
    </motion.button>
  );
}

export function Pill({ children, icon }: { children: ReactNode; icon?: IconName }) {
  return (
    <span className="surface-raised inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-fg">
      {icon ? <Icon name={icon} size={14} strokeWidth={2} className="text-accent" /> : null}
      {children}
    </span>
  );
}

interface ChipButtonProps {
  children: ReactNode;
  onClick: () => void;
  icon?: IconName;
  active?: boolean;
}

export function ChipButton({ children, onClick, icon, active = false }: ChipButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm transition-[filter,color] ${
        active
          ? "accent-fill border border-transparent font-medium"
          : "surface-card text-fg-2 hover:text-fg hover:brightness-110"
      }`}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`surface-card rounded-[28px] p-[clamp(16px,3.2vw,26px)] ${className}`}>{children}</section>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function Stat({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-fg-2">{label}</p>
      <p className="truncate text-[clamp(1.1rem,0.95rem+0.8vw,1.5rem)] font-semibold tabular-nums">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-fg-2">{unit}</span> : null}
      </p>
    </div>
  );
}

interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  /** Colour of the short line across the top of the tile. */
  color?: string;
  leading?: ReactNode;
  /** Bigger numerals, for tiles that are the main figure on a screen. */
  large?: boolean;
}

/** Small centred stat card with a coloured top line, as in the reference's "Active subs" row. */
export function StatTile({ label, value, unit, color = DEFAULT_ACCENT, leading, large = false }: StatTileProps) {
  return (
    <div
      className="tile-line surface-card relative min-w-0 overflow-hidden rounded-[20px] px-3 pt-4 pb-3.5 text-center"
      style={{ "--tile-line": color } as CSSProperties}
    >
      <p
        className={`flex items-center justify-center gap-1.5 text-[11px] leading-tight text-fg-2 sm:text-xs ${
          large ? "min-h-[2lh]" : ""
        }`}
      >
        {leading}
        <span className="min-w-0">{label}</span>
      </p>
      <p
        className={`mt-1.5 truncate font-semibold tabular-nums ${
          large ? "text-[clamp(1.75rem,1.4rem+1.6vw,2.4rem)] leading-none" : "text-[clamp(1.05rem,0.95rem+0.6vw,1.35rem)]"
        }`}
      >
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-fg-2">{unit}</span> : null}
      </p>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="surface-raised grid h-12 w-12 place-items-center rounded-full text-fg-2">
        <Icon name={icon} size={22} />
      </span>
      <p className="font-medium">{title}</p>
      {hint ? <p className="max-w-[17rem] text-sm text-fg-2">{hint}</p> : null}
    </div>
  );
}

export function StatusSquare({ status, size = 22 }: { status: TaskStatus; size?: number }) {
  if (status === "pending") {
    return (
      <span
        className="block rounded-[5px] border-[1.5px] border-dark-grey"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="grid place-items-center rounded-[5px] font-bold text-white"
      style={{ width: size, height: size, background: STATUS_HEX[status], fontSize: size * 0.42 }}
    >
      {status}
    </span>
  );
}

/** 22px status square inside a 44px touch target, as the spec requires. */
export function StatusChip({
  status,
  label,
  onClick,
}: {
  status: TaskStatus;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      aria-label={label}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
    >
      <StatusSquare status={status} />
    </motion.button>
  );
}

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accent?: string;
}

/** Pressed "well" track with a raised thumb, like the reference's Your subscriptions / Upcoming bills tabs. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  accent = DEFAULT_ACCENT,
}: SegmentedProps<T>) {
  const tinted = accent !== DEFAULT_ACCENT;
  const activeText = accent.startsWith("#") ? readableOn(accent) : "#FFFFFF";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="surface-well flex w-fit max-w-full flex-wrap gap-1 rounded-[22px] p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm transition-colors ${
              active ? (tinted ? "font-medium" : "surface-raised font-medium text-fg") : "text-fg-2 hover:text-fg"
            }`}
            style={
              active && tinted
                ? { background: accent, color: activeText, boxShadow: `0 6px 16px -8px ${accent}` }
                : undefined
            }
          >
            {option.icon ? <Icon name={option.icon} size={16} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  accent?: string;
  disabled?: boolean;
  icon?: IconName;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  accent = DEFAULT_ACCENT,
  disabled = false,
  icon,
}: ToggleProps) {
  return (
    <div className={`flex items-center gap-3 py-2 ${disabled ? "opacity-45" : ""}`}>
      {icon ? (
        <span className="surface-raised grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-2">
          <Icon name={icon} size={18} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-fg">{label}</span>
        {description ? <span className="block text-xs text-fg-2">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="surface-well relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed"
        style={checked ? { background: accent, boxShadow: `0 0 14px -4px ${accent}` } : undefined}
      >
        <motion.span
          className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      </button>
    </div>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  type = "button",
  className = "",
  color = DEFAULT_ACCENT,
}: ButtonProps & { color?: string }) {
  const tinted = color !== DEFAULT_ACCENT;
  const textColor = color.startsWith("#") ? readableOn(color) : "#FFFFFF";
  return (
    <motion.button
      type={type}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      style={tinted ? { background: color, color: textColor, boxShadow: `0 10px 24px -10px ${color}` } : undefined}
      className={`h-12 flex-1 rounded-full px-6 text-sm font-semibold transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${
        tinted ? "" : "accent-fill"
      } ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function GhostButton({ children, onClick, type = "button", className = "" }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`surface-card h-12 flex-1 rounded-full px-6 text-sm text-fg transition-[filter] hover:brightness-110 ${className}`}
    >
      {children}
    </button>
  );
}
