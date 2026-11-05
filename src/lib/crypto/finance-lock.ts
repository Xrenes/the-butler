/**
 * Finance lock: the finance key is wrapped under a key derived from the 6-digit PIN AND the
 * user's master key. The server holds the wrapped blob but not the master key, so it cannot
 * brute-force the PIN offline. The account password is the fallback when the PIN is forgotten.
 */
import { type Sealed, importAesKey, unwrapKey, wrapKey } from "./aead";
import { type Bytes, base64ToBytes, bytesToBase64, randomBytes, wipe } from "./encoding";
import {
  type KdfParams,
  MIN_KDF_PARAMS,
  PIN_KDF_PARAMS,
  argon2idBytes,
  assertKdfParams,
  hkdfBytes,
} from "./kdf";

export interface PinBundle {
  pinSalt: string;
  pinParams: KdfParams;
  wrappedFinanceKey: Sealed;
}

export const PIN_LENGTH = 6;
const PIN_PATTERN = /^\d{6}$/;
const SALT_LENGTH = 16;
const NO_SALT = new Uint8Array(0);

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function deriveFinanceRoot(masterKey: Uint8Array): Promise<Bytes> {
  return hkdfBytes(masterKey, NO_SALT, "butler/v1/finance-root");
}

async function derivePinKey(
  pin: string,
  financeRoot: Uint8Array,
  pinSalt: string,
  params: KdfParams,
): Promise<CryptoKey> {
  const stretched = await argon2idBytes(pin, base64ToBytes(pinSalt), params);
  const raw = await hkdfBytes(stretched, financeRoot, "butler/v1/finance-pin");
  wipe(stretched);
  try {
    return await importAesKey(raw);
  } finally {
    wipe(raw);
  }
}

export async function createPinBundle(
  financeKey: Uint8Array,
  pin: string,
  financeRoot: Uint8Array,
  params: KdfParams = PIN_KDF_PARAMS,
): Promise<PinBundle> {
  if (!isValidPin(pin)) throw new Error(`The PIN must be ${PIN_LENGTH} digits`);
  const pinSalt = bytesToBase64(randomBytes(SALT_LENGTH));
  const pinKey = await derivePinKey(pin, financeRoot, pinSalt, params);
  return {
    pinSalt,
    pinParams: params,
    wrappedFinanceKey: await wrapKey(pinKey, financeKey, "finance-pin"),
  };
}

/** Throws DecryptError when the PIN is wrong. */
export async function unlockFinanceKey(
  bundle: PinBundle,
  pin: string,
  financeRoot: Uint8Array,
  minimum: KdfParams = MIN_KDF_PARAMS,
): Promise<Bytes> {
  assertKdfParams(bundle.pinParams, minimum);
  const pinKey = await derivePinKey(pin, financeRoot, bundle.pinSalt, bundle.pinParams);
  return unwrapKey(pinKey, bundle.wrappedFinanceKey, "finance-pin");
}
