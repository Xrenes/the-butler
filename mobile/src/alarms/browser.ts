import { Platform } from "react-native";

/** Web only: the page can't ring when closed, but it can raise a system notification while open. */
const TITLE_FLASH_MS = 1000;

export function browserAlertsSupported(): boolean {
  return Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window;
}

/** A system notification from the browser, so an alarm in a background tab is still seen. */
export function showBrowserAlarm(title: string, body: string, tag: string): void {
  if (!browserAlertsSupported() || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, { body, tag, requireInteraction: true });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker. The page alarm still
    // rings and the tab title flashes, so nothing else is needed here.
  }
}

/** Flashes the tab title until the returned function is called. */
export function flashTabTitle(text: string): () => void {
  if (Platform.OS !== "web" || typeof document === "undefined") return () => undefined;
  const original = document.title;
  let showing = false;
  const timer = setInterval(() => {
    showing = !showing;
    document.title = showing ? text : original;
  }, TITLE_FLASH_MS);
  return () => {
    clearInterval(timer);
    document.title = original;
  };
}
