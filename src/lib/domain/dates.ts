/**
 * Timezone-aware calendar helpers. Instants are stored in UTC; days are `YYYY-MM-DD` keys in
 * the user's timezone (default Asia/Dhaka). Weeks run Monday to Sunday.
 */

export const DEFAULT_TIMEZONE = "Asia/Dhaka";

export type DayKey = string;
export type Meridiem = "AM" | "PM";

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_MINUTE = 60_000;
const DAYS_PER_WEEK = 7;

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = partsFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  partsFormatters.set(timeZone, formatter);
  return formatter;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Zones that keep one offset all year, in minutes ahead of UTC. Only used when the JavaScript
 * engine's Intl cannot work out time zone parts (some phone engines have partial Intl support).
 */
const FIXED_OFFSET_MINUTES: Readonly<Record<string, number>> = { "Asia/Dhaka": 360, UTC: 0 };

function intlParts(date: Date, timeZone: string): ZonedParts | null {
  try {
    const parts = partsFormatter(timeZone).formatToParts(date);
    const read = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value);
    const result = {
      year: read("year"),
      month: read("month"),
      day: read("day"),
      hour: read("hour") % 24,
      minute: read("minute"),
    };
    return Object.values(result).every(Number.isFinite) ? result : null;
  } catch {
    return null;
  }
}

function fixedOffsetParts(date: Date, timeZone: string): ZonedParts {
  const offset = FIXED_OFFSET_MINUTES[timeZone];
  if (offset === undefined) throw new Error(`Time zone not supported on this device: ${timeZone}`);
  const shifted = new Date(date.getTime() + offset * MS_PER_MINUTE);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  return intlParts(date, timeZone) ?? fixedOffsetParts(date, timeZone);
}

export function toDayKey(year: number, month: number, day: number): DayKey {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseDayKey(day: DayKey): { year: number; month: number; day: number } {
  const match = DAY_KEY_PATTERN.exec(day);
  if (!match) throw new Error(`Invalid day key: ${day}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function dayKeyOf(date: Date, timeZone: string): DayKey {
  const parts = zonedParts(date, timeZone);
  return toDayKey(parts.year, parts.month, parts.day);
}

/** Minutes the zone is ahead of UTC at the given instant (Asia/Dhaka: 360). */
function offsetMinutes(utcMs: number, timeZone: string): number {
  const parts = zonedParts(new Date(utcMs), timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const truncated = Math.floor(utcMs / MS_PER_MINUTE) * MS_PER_MINUTE;
  return Math.round((localAsUtc - truncated) / MS_PER_MINUTE);
}

/** Wall-clock time in a zone to the UTC instant. Two passes handle DST transitions. */
export function zonedTimeToUtc(day: DayKey, hour: number, minute: number, timeZone: string): Date {
  const parsed = parseDayKey(day);
  const naive = Date.UTC(parsed.year, parsed.month - 1, parsed.day, hour, minute);
  const firstGuess = naive - offsetMinutes(naive, timeZone) * MS_PER_MINUTE;
  return new Date(naive - offsetMinutes(firstGuess, timeZone) * MS_PER_MINUTE);
}

function dayKeyToUtcNoon(day: DayKey): Date {
  const parsed = parseDayKey(day);
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12));
}

export function addDays(day: DayKey, amount: number): DayKey {
  const parsed = parseDayKey(day);
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + amount));
  return toDayKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** 0 = Monday ... 6 = Sunday. */
export function mondayIndex(day: DayKey): number {
  return (dayKeyToUtcNoon(day).getUTCDay() + 6) % DAYS_PER_WEEK;
}

export function startOfWeek(day: DayKey): DayKey {
  return addDays(day, -mondayIndex(day));
}

export function weekDays(weekStart: DayKey): DayKey[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => addDays(weekStart, index));
}

export function to12Hour(hour24: number): { hour12: number; meridiem: Meridiem } {
  const meridiem: Meridiem = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, meridiem };
}

export function to24Hour(hour12: number, meridiem: Meridiem): number {
  if (!Number.isInteger(hour12) || hour12 < 1 || hour12 > 12) {
    throw new Error(`Invalid 12-hour value: ${hour12}`);
  }
  return meridiem === "AM" ? hour12 % 12 : (hour12 % 12) + 12;
}

export function formatTime(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(
      date,
    );
  } catch {
    // Same shape as en-US ("1:30 PM") when the engine cannot format in that time zone.
    const parts = zonedParts(date, timeZone);
    const clock = to12Hour(parts.hour);
    return `${clock.hour12}:${pad2(parts.minute)} ${clock.meridiem}`;
  }
}

function formatDay(day: DayKey, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(
    dayKeyToUtcNoon(day),
  );
}

export function formatDayLabel(day: DayKey, today: DayKey): string {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  if (day === addDays(today, -1)) return "Yesterday";
  return formatDay(day, { weekday: "short", month: "short", day: "numeric" });
}

export function formatShortDate(day: DayKey): string {
  return formatDay(day, { month: "short", day: "numeric" });
}

/** Short axis label such as "02 Jun". */
export function formatDayMonth(day: DayKey): string {
  return `${pad2(dayOfMonth(day))} ${formatDay(day, { month: "short" })}`;
}

export function formatLongDate(day: DayKey): string {
  return formatDay(day, { weekday: "long", month: "long", day: "numeric" });
}

export function weekdayShort(day: DayKey): string {
  return formatDay(day, { weekday: "short" });
}

export function dayOfMonth(day: DayKey): number {
  return parseDayKey(day).day;
}

export function formatWeekRange(weekStart: DayKey): string {
  const weekEnd = addDays(weekStart, DAYS_PER_WEEK - 1);
  const sameMonth = parseDayKey(weekStart).month === parseDayKey(weekEnd).month;
  return sameMonth
    ? `${formatShortDate(weekStart)} – ${dayOfMonth(weekEnd)}`
    : `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`;
}
