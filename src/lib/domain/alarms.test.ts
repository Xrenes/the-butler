import { describe, expect, it } from "vitest";
import {
  ALARM_GRACE_MS,
  EMPTY_ALARM_MEMORY,
  alarmKey,
  describeLead,
  dueAlarms,
  dueCountdown,
  reminderFireAt,
} from "./alarms";
import type { Task } from "./types";

const MIN = 60_000;
const DUE = new Date("2026-11-05T16:30:00.000Z");
const at = (minutesFromDue: number) => new Date(DUE.getTime() + minutesFromDue * MIN);

function task(overrides: Partial<Task> = {}): Task {
  return {
    kind: "task",
    id: "11111111-1111-4111-8111-111111111111",
    title: "Laundry",
    description: "",
    categoryId: "22222222-2222-4222-8222-222222222222",
    dueAt: DUE.toISOString(),
    status: "pending",
    statusChangedAt: null,
    reminder: { enabled: true, leadMinutes: 10, includeTitle: false },
    sourceTaskId: null,
    createdAt: at(-24 * 60).toISOString(),
    updatedAt: at(-24 * 60).toISOString(),
    ...overrides,
  };
}

describe("reminderFireAt", () => {
  it("is the due time minus the lead", () => {
    expect(reminderFireAt(task()).toISOString()).toBe(at(-10).toISOString());
  });
});

describe("dueAlarms", () => {
  it("is quiet before the reminder time and rings from it", () => {
    expect(dueAlarms([task()], at(-11), EMPTY_ALARM_MEMORY)).toHaveLength(0);
    expect(dueAlarms([task()], at(-10), EMPTY_ALARM_MEMORY)).toHaveLength(1);
    expect(dueAlarms([task()], at(0), EMPTY_ALARM_MEMORY)).toHaveLength(1);
  });

  it("stops ringing once the grace period after the due time is over", () => {
    expect(dueAlarms([task()], new Date(DUE.getTime() + ALARM_GRACE_MS), EMPTY_ALARM_MEMORY)).toHaveLength(1);
    expect(dueAlarms([task()], new Date(DUE.getTime() + ALARM_GRACE_MS + 1), EMPTY_ALARM_MEMORY)).toHaveLength(0);
  });

  it("ignores tasks that are already marked or have reminders off", () => {
    for (const status of ["C", "NC", "H"] as const) {
      expect(dueAlarms([task({ status })], at(0), EMPTY_ALARM_MEMORY)).toHaveLength(0);
    }
    const off = task({ reminder: { enabled: false, leadMinutes: 10, includeTitle: false } });
    expect(dueAlarms([off], at(0), EMPTY_ALARM_MEMORY)).toHaveLength(0);
  });

  it("does not ring for a task saved after its own reminder time", () => {
    const lateSave = task({ updatedAt: at(-5).toISOString() });
    expect(dueAlarms([lateSave], at(0), EMPTY_ALARM_MEMORY)).toHaveLength(0);
  });

  it("honours dismiss and snooze", () => {
    const t = task();
    const key = alarmKey(t);
    expect(dueAlarms([t], at(0), { dismissed: new Set([key]), snoozedUntil: new Map() })).toHaveLength(0);
    const snoozed = { dismissed: new Set<string>(), snoozedUntil: new Map([[key, at(5).getTime()]]) };
    expect(dueAlarms([t], at(4), snoozed)).toHaveLength(0);
    expect(dueAlarms([t], at(5), snoozed)).toHaveLength(1);
  });

  it("rings again when the due time changes", () => {
    const original = task();
    const memory = { dismissed: new Set([alarmKey(original)]), snoozedUntil: new Map<string, number>() };
    const moved = task({ dueAt: at(60).toISOString() });
    expect(alarmKey(moved)).not.toBe(alarmKey(original));
    expect(dueAlarms([moved], at(55), memory)).toHaveLength(1);
  });

  it("lists the earliest reminder first", () => {
    const later = task({ id: "33333333-3333-4333-8333-333333333333", title: "B", dueAt: at(5).toISOString() });
    const earlier = task({ title: "A" });
    expect(dueAlarms([later, earlier], at(0), EMPTY_ALARM_MEMORY).map((t) => t.title)).toEqual(["A", "B"]);
  });
});

describe("dueCountdown", () => {
  it("counts down, then up", () => {
    expect(dueCountdown(task(), at(-10))).toBe("Due in 10 min");
    expect(dueCountdown(task(), new Date(DUE.getTime() - 30_000))).toBe("Due in 1 min");
    expect(dueCountdown(task(), at(0))).toBe("Due now");
    expect(dueCountdown(task(), new Date(DUE.getTime() + 45_000))).toBe("Due now");
    expect(dueCountdown(task(), at(7))).toBe("7 min overdue");
  });
});

describe("describeLead", () => {
  it("reads naturally", () => {
    expect(describeLead(0)).toBe("At the time");
    expect(describeLead(10)).toBe("10 min before");
    expect(describeLead(60)).toBe("1 hour before");
  });
});
