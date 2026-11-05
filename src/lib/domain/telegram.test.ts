import { describe, expect, it } from "vitest";
import { parseChatId } from "./telegram";

describe("parseChatId", () => {
  it("accepts a personal chat ID and trims spaces", () => {
    expect(parseChatId("  123456789 ")).toEqual({ ok: true, chatId: "123456789" });
  });

  it("accepts a negative group ID", () => {
    expect(parseChatId("-1001234567890")).toEqual({ ok: true, chatId: "-1001234567890" });
  });

  it("drops leading zeros", () => {
    expect(parseChatId("00123")).toEqual({ ok: true, chatId: "123" });
    expect(parseChatId("-0042")).toEqual({ ok: true, chatId: "-42" });
  });

  it("rejects empty input", () => {
    expect(parseChatId("   ")).toEqual({ ok: false, error: "Enter your Telegram chat ID." });
  });

  it("rejects anything that is not a whole number", () => {
    for (const bad of ["@username", "12.5", "12 34", "1e9", "--5", "+5", "abc"]) {
      expect(parseChatId(bad).ok).toBe(false);
    }
  });

  it("rejects zero and oversized values", () => {
    expect(parseChatId("0").ok).toBe(false);
    expect(parseChatId("-000").ok).toBe(false);
    expect(parseChatId("12345678901234567").ok).toBe(false);
    expect(parseChatId("1234567890123456").ok).toBe(true);
  });

  it("does not accept a bot token", () => {
    expect(parseChatId("123456789:AAH-fake-token-value").ok).toBe(false);
  });
});
