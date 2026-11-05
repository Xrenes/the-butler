"use client";

import type { ReactNode } from "react";
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

export const FIELD =
  "w-full rounded-2xl bg-surface-2 px-4 py-3 text-fg outline-none transition-shadow placeholder:text-fg-3 focus:ring-2 focus:ring-accent";

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
  dark: "bg-surface-2 text-fg hover:bg-line",
  accent: "bg-accent text-white shadow-[0_10px_30px_-8px_rgba(216,48,54,0.7)] hover:brightness-110",
  ghost: "border border-line text-fg-2 hover:bg-surface-2 hover:text-fg",
  glass: "bg-black/25 text-white hover:bg-black/40",
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
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-dark-grey/80 px-2.5 py-1 text-xs font-medium text-white">
      {icon ? <Icon name={icon} size={14} strokeWidth={2} /> : null}
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
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${
        active ? "border-accent bg-accent text-white" : "border-line text-fg-2 hover:bg-surface-2 hover:text-fg"
      }`}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[28px] bg-surface p-[clamp(16px,3.2vw,26px)] ${className}`}>{children}</section>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-medium">{children}</h2>
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

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-fg-2">
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

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  accent = "var(--accent)",
}: SegmentedProps<T>) {
  const activeText = accent.startsWith("#") ? readableOn(accent) : "#FFFFFF";
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors ${
              active ? "border-transparent" : "border-line text-fg-2 hover:text-fg"
            }`}
            style={active ? { background: accent, color: activeText } : undefined}
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
  accent = "var(--accent)",
  disabled = false,
  icon,
}: ToggleProps) {
  return (
    <div className={`flex items-center gap-3 py-2 ${disabled ? "opacity-45" : ""}`}>
      {icon ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-fg-2">
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
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed"
        style={{ background: checked ? accent : "var(--line)" }}
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
  color = "var(--accent)",
}: ButtonProps & { color?: string }) {
  const textColor = color.startsWith("#") ? readableOn(color) : "#FFFFFF";
  return (
    <motion.button
      type={type}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      style={{ background: color, color: textColor }}
      className={`h-12 flex-1 rounded-full px-6 text-sm font-semibold transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
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
      className={`h-12 flex-1 rounded-full border border-line px-6 text-sm text-fg transition-colors hover:bg-surface-2 ${className}`}
    >
      {children}
    </button>
  );
}
