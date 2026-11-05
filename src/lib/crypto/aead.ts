import {
  type Bytes,
  asBytes,
  base64ToBytes,
  bytesToBase64,
  randomBytes,
  utf8Decode,
  utf8Encode,
} from "./encoding";

/** AES-256-GCM output as stored on the server: both fields are base64. */
export interface Sealed {
  iv: string;
  ct: string;
}

export class DecryptError extends Error {
  constructor() {
    super("Decryption failed: wrong key or tampered data");
    this.name = "DecryptError";
  }
}

const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== KEY_LENGTH) throw new Error("AES-256 keys must be 32 bytes");
  return crypto.subtle.importKey("raw", asBytes(raw), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Encrypts with a fresh random IV. `aad` binds the ciphertext to its purpose/location. */
export async function seal(key: CryptoKey, plaintext: Uint8Array, aad: string): Promise<Sealed> {
  const iv = randomBytes(IV_LENGTH);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: utf8Encode(aad) },
    key,
    asBytes(plaintext),
  );
  return { iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ct)) };
}

export async function open(key: CryptoKey, sealed: Sealed, aad: string): Promise<Bytes> {
  let iv: Bytes;
  let ct: Bytes;
  try {
    iv = base64ToBytes(sealed.iv);
    ct = base64ToBytes(sealed.ct);
  } catch {
    throw new DecryptError();
  }
  if (iv.length !== IV_LENGTH) throw new DecryptError();
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: utf8Encode(aad) },
      key,
      ct,
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new DecryptError();
  }
}

export async function sealJson(key: CryptoKey, value: unknown, aad: string): Promise<Sealed> {
  return seal(key, utf8Encode(JSON.stringify(value)), aad);
}

export async function openJson(key: CryptoKey, sealed: Sealed, aad: string): Promise<unknown> {
  const bytes = await open(key, sealed, aad);
  try {
    return JSON.parse(utf8Decode(bytes));
  } catch {
    throw new DecryptError();
  }
}

export async function wrapKey(
  wrappingKey: CryptoKey,
  keyBytes: Uint8Array,
  purpose: string,
): Promise<Sealed> {
  return seal(wrappingKey, keyBytes, `butler/v1/wrap/${purpose}`);
}

export async function unwrapKey(
  wrappingKey: CryptoKey,
  sealed: Sealed,
  purpose: string,
): Promise<Bytes> {
  const keyBytes = await open(wrappingKey, sealed, `butler/v1/wrap/${purpose}`);
  if (keyBytes.length !== KEY_LENGTH) throw new DecryptError();
  return keyBytes;
}
