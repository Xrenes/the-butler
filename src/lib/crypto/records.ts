import { type Sealed, openJson, sealJson } from "./aead";

/** `main` records use the master key; `finance` records use the PIN-locked finance key. */
export type RecordScope = "main" | "finance";

/** Binds each ciphertext to its record id and scope so the server cannot swap records around. */
export function recordAad(scope: RecordScope, id: string): string {
  return `butler/v1/record/${scope}/${id}`;
}

export function encryptRecord(
  key: CryptoKey,
  scope: RecordScope,
  id: string,
  payload: unknown,
): Promise<Sealed> {
  return sealJson(key, payload, recordAad(scope, id));
}

export function decryptRecord(
  key: CryptoKey,
  scope: RecordScope,
  id: string,
  sealed: Sealed,
): Promise<unknown> {
  return openJson(key, sealed, recordAad(scope, id));
}
