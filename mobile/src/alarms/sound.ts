import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";

/** One shared player for the in-app alarm, so the web can unlock it once and reuse it. */
const ALARM_SOUND = require("../../assets/alarm.wav");
const PRIME_MS = 150;

let player: AudioPlayer | null = null;

function sharedPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(ALARM_SOUND);
    player.loop = true;
  }
  return player;
}

/** Loud, looping, and on iPhone even with the ring/silent switch on. */
export async function startAlarmSound(): Promise<void> {
  await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "doNotMix" }).catch(() => undefined);
  const shared = sharedPlayer();
  shared.volume = 1;
  await shared.seekTo(0).catch(() => undefined);
  shared.play();
}

export function stopAlarmSound(): void {
  player?.pause();
}

/**
 * Web: browsers only let a page play sound after the person has tapped it, so the first tap
 * anywhere plays the alarm silently for a moment. Later alarms on the same page can then ring.
 */
export function primeAlarmSound(): void {
  const shared = sharedPlayer();
  shared.volume = 0;
  shared.play();
  setTimeout(() => {
    shared.pause();
    shared.volume = 1;
  }, PRIME_MS);
}
