/**
 * Telegram chat IDs are integers: positive for people, negative for groups and channels.
 * Kept as text so the value can later be stored in a `bigint` column without rounding.
 * The bot token is a server secret and is deliberately not handled anywhere in the client.
 */
export type ChatIdResult = { ok: true; chatId: string } | { ok: false; error: string };

const CHAT_ID_PATTERN = /^-?\d+$/;
const MAX_DIGITS = 16;

export function parseChatId(input: string): ChatIdResult {
  const text = input.trim();
  if (text === "") return { ok: false, error: "Enter your Telegram chat ID." };
  if (!CHAT_ID_PATTERN.test(text)) {
    return { ok: false, error: "Use the numeric chat ID, for example 123456789." };
  }
  const digits = text.replace("-", "");
  if (digits.length > MAX_DIGITS) return { ok: false, error: "That chat ID is too long." };
  if (/^0+$/.test(digits)) return { ok: false, error: "That is not a valid chat ID." };
  return { ok: true, chatId: text.replace(/^(-?)0+(?=\d)/, "$1") };
}
