/** Byte helpers shared by every crypto module. Works in browsers and Node 20+. */

/** A Uint8Array backed by a plain ArrayBuffer (what Web Crypto accepts). */
export type Bytes = Uint8Array<ArrayBuffer>;

const CHUNK_SIZE = 0x8000;

export function asBytes(bytes: Uint8Array): Bytes {
  return bytes.buffer instanceof ArrayBuffer ? (bytes as Bytes) : new Uint8Array(bytes);
}

export function randomBytes(length: number): Bytes {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Bytes {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function utf8Encode(text: string): Bytes {
  return asBytes(new TextEncoder().encode(text));
}

export function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Best-effort removal of key material from memory once it is no longer needed. */
export function wipe(bytes: Uint8Array): void {
  bytes.fill(0);
}
