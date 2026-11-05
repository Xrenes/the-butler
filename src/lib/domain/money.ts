/** Money is always integer poisha (৳1 = 100 poisha) so sums never drift. */
import { MAX_MINOR } from "./types";

export type ParseResult = { ok: true; minor: number } | { ok: false; error: string };

const AMOUNT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;
const MAX_WHOLE_DIGITS = 10;
const MAX_FRACTION_DIGITS = 2;
const grouping = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function parseAmount(input: string): ParseResult {
  const cleaned = input.replace(/[,\s৳]/g, "");
  if (cleaned === "") return { ok: false, error: "Enter an amount." };
  const match = AMOUNT_PATTERN.exec(cleaned);
  if (!match) return { ok: false, error: "Use numbers with up to 2 decimals." };
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(MAX_FRACTION_DIGITS, "0"));
  const minor = whole * 100 + fraction;
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) {
    return { ok: false, error: "That amount is too large." };
  }
  if (minor <= 0) return { ok: false, error: "The amount must be more than zero." };
  return { ok: true, minor };
}

export function formatMinor(minor: number, options: { signed?: boolean } = {}): string {
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100);
  const fraction = absolute % 100;
  const body = `৳${grouping.format(whole)}${fraction ? `.${String(fraction).padStart(2, "0")}` : ""}`;
  if (options.signed) return `${minor < 0 ? "−" : "+"}${body}`;
  return minor < 0 ? `−${body}` : body;
}

/** Turns a stored amount back into keypad text, e.g. 3270050 -> "32700.5". */
export function minorToInput(minor: number): string {
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  if (fraction === 0) return String(whole);
  return `${whole}.${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
}

/** On-screen keypad: applies one key press, refusing shapes that are not valid amounts. */
export function applyKeypadKey(current: string, key: string): string {
  if (key === "back") return current.slice(0, -1);
  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  if (!/^\d$/.test(key)) return current;
  const [whole, fraction] = current.split(".");
  if (fraction !== undefined) {
    return fraction.length >= MAX_FRACTION_DIGITS ? current : current + key;
  }
  if (whole.length >= MAX_WHOLE_DIGITS) return current;
  return current === "0" ? key : current + key;
}
