"use client";

import { useEffect } from "react";

/**
 * How the website's alarm gets attention: beeps from Web Audio (no sound file needed), a system
 * notification when the tab is in the background, and a flashing tab title.
 */
const BEEP_HZ = [880, 1320] as const;
const BEEP_S = 0.16;
const BEEP_GAP_S = 0.04;
const BEEPS_PER_BURST = 4;
const BURST_EVERY_MS = 1400;
const PEAK_GAIN = 0.32;
const SILENT_GAIN = 0.0001;
const ATTACK_S = 0.01;
const LEAD_IN_S = 0.02;
const TITLE_FLASH_MS = 1000;

type AudioContextConstructor = typeof AudioContext;

let sharedContext: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Constructor: AudioContextConstructor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!Constructor) return null;
  sharedContext ??= new Constructor();
  return sharedContext;
}

/** Browsers keep audio suspended until the person interacts, so call this from a tap or key press. */
export function unlockAlarmAudio(): void {
  const context = audioContext();
  if (context?.state === "suspended") context.resume().catch(() => undefined);
}

function ringBurst(context: AudioContext): void {
  const start = context.currentTime + LEAD_IN_S;
  for (let beep = 0; beep < BEEPS_PER_BURST; beep += 1) {
    const at = start + beep * (BEEP_S + BEEP_GAP_S);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = BEEP_HZ[beep % BEEP_HZ.length];
    gain.gain.setValueAtTime(SILENT_GAIN, at);
    gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, at + ATTACK_S);
    gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, at + BEEP_S);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + BEEP_S + LEAD_IN_S);
  }
}

/** Rings while `active` is true: a burst of four beeps every 1.4 seconds. */
export function useAlarmTone(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const context = audioContext();
    if (!context) return;
    context.resume().catch(() => undefined);
    ringBurst(context);
    const timer = window.setInterval(() => ringBurst(context), BURST_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [active]);
}

export type BrowserAlerts = "granted" | "denied" | "default" | "unsupported";

export function browserAlerts(): BrowserAlerts {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Shows the browser's own prompt. Must be called from a click. */
export async function requestBrowserAlerts(): Promise<BrowserAlerts> {
  if (browserAlerts() === "unsupported") return "unsupported";
  return Notification.requestPermission();
}

/** A system notification, so an alarm that goes off in a background tab is still seen. */
export function notifyBrowser(title: string, body: string, tag: string): void {
  if (browserAlerts() !== "granted") return;
  try {
    const notification = new Notification(title, { body, tag, requireInteraction: true });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some mobile browsers only allow notifications from a service worker. The on-page alarm still
    // rings and the tab title flashes, so nothing more is needed here.
  }
}

/** Flashes the tab title while `text` is set. */
export function useTabTitleFlash(text: string | null): void {
  useEffect(() => {
    if (!text) return;
    const original = document.title;
    let showing = false;
    const timer = window.setInterval(() => {
      showing = !showing;
      document.title = showing ? text : original;
    }, TITLE_FLASH_MS);
    return () => {
      window.clearInterval(timer);
      document.title = original;
    };
  }, [text]);
}
