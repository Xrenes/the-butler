import AsyncStorage from "@react-native-async-storage/async-storage";
import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * The finance PIN is never stored. Only a salted SHA-256 of it is kept, in the phone's keychain
 * (iOS) or keystore (Android). The web preview has no keychain, so it falls back to local storage.
 */
const PIN_KEY = "butler.finance-pin";
export const PIN_LENGTH = 6;

interface StoredPin {
  salt: string;
  hash: string;
}

const storage = {
  get: (key: string) => (Platform.OS === "web" ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key)),
  set: (key: string, value: string) =>
    Platform.OS === "web" ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  remove: (key: string) => (Platform.OS === "web" ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key)),
};

const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const hashPin = (salt: string, pin: string) => digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

async function readPin(): Promise<StoredPin | null> {
  const raw = await storage.get(PIN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPin>;
    return typeof parsed.salt === "string" && typeof parsed.hash === "string" ? { salt: parsed.salt, hash: parsed.hash } : null;
  } catch {
    return null;
  }
}

export async function hasPin(): Promise<boolean> {
  return (await readPin()) !== null;
}

export async function savePin(pin: string): Promise<void> {
  const salt = toHex(getRandomBytes(16));
  await storage.set(PIN_KEY, JSON.stringify({ salt, hash: await hashPin(salt, pin) }));
}

export async function checkPin(pin: string): Promise<boolean> {
  const stored = await readPin();
  if (!stored) return false;
  return (await hashPin(stored.salt, pin)) === stored.hash;
}

export async function clearPin(): Promise<void> {
  await storage.remove(PIN_KEY);
}

export type OwnerCheck = "verified" | "failed" | "unavailable";

/** Face ID, fingerprint or the phone's own passcode: proves the owner is holding the phone. */
export async function verifyOwner(reason: string): Promise<OwnerCheck> {
  if (Platform.OS === "web") return "unavailable";
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) return "unavailable";
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: reason, disableDeviceFallback: false });
  return result.success ? "verified" : "failed";
}
