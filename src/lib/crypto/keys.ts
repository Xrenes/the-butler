/**
 * Account key hierarchy (all client-side; the server only ever sees wrapped keys).
 *
 *   password --argon2id--> stretched --HKDF--> authKey (login credential sent to server)
 *                                       \---> KEK (wraps master key)
 *                                        \--> financeBackupKey (wraps finance key)
 *   recovery key --HKDF--> recoveryAuthKey / recoveryKek / recoveryFinanceKey
 *   master key   --> encrypts tasks, categories, settings
 *   finance key  --> encrypts money records; unlocked day-to-day with the PIN
 */
import { type Sealed, importAesKey, unwrapKey, wrapKey } from "./aead";
import { type Bytes, base64ToBytes, bytesToBase64, randomBytes, wipe } from "./encoding";
import {
  type KdfParams,
  MIN_KDF_PARAMS,
  PASSWORD_KDF_PARAMS,
  argon2idBytes,
  assertKdfParams,
  hkdfBytes,
} from "./kdf";

/** Everything the server stores about a user's keys. Nothing here is usable without a secret. */
export interface KeyBundle {
  kdfSalt: string;
  kdfParams: KdfParams;
  wrappedMasterKey: Sealed;
  recoverySalt: string;
  wrappedMasterKeyRecovery: Sealed;
  wrappedFinanceKeyPassword: Sealed;
  wrappedFinanceKeyRecovery: Sealed;
}

export interface PasswordSecrets {
  /** Login credential. Derived one-way, so the server cannot recover the password or the KEK. */
  authKey: string;
  kek: CryptoKey;
  financeBackupKey: CryptoKey;
}

export interface RecoverySecrets {
  recoveryAuthKey: string;
  recoveryKek: CryptoKey;
  recoveryFinanceKey: CryptoKey;
}

export interface NewAccountKeys {
  bundle: KeyBundle;
  authKey: string;
  recoveryAuthKey: string;
  /** Shown to the user exactly once. Never sent to the server. */
  recoveryKey: string;
  masterKey: Bytes;
}

export interface PasswordRekey {
  authKey: string;
  kdfSalt: string;
  kdfParams: KdfParams;
  wrappedMasterKey: Sealed;
  wrappedFinanceKeyPassword: Sealed;
}

export const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 256;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const RECOVERY_KEY_BYTES = 20;
const RECOVERY_KEY_CHARS = 32;
const NO_SALT = new Uint8Array(0);
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export class InvalidRecoveryKeyError extends Error {
  constructor() {
    super("That recovery key is not valid");
    this.name = "InvalidRecoveryKeyError";
  }
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) return "That password is too long.";
  return null;
}

async function importAndWipe(raw: Bytes): Promise<CryptoKey> {
  try {
    return await importAesKey(raw);
  } finally {
    wipe(raw);
  }
}

export async function derivePasswordSecrets(
  password: string,
  kdfSalt: string,
  params: KdfParams,
  minimum: KdfParams = MIN_KDF_PARAMS,
): Promise<PasswordSecrets> {
  assertKdfParams(params, minimum);
  const stretched = await argon2idBytes(password.normalize("NFKC"), base64ToBytes(kdfSalt), params);
  try {
    const auth = await hkdfBytes(stretched, NO_SALT, "butler/v1/auth");
    const authKey = bytesToBase64(auth);
    wipe(auth);
    return {
      authKey,
      kek: await importAndWipe(await hkdfBytes(stretched, NO_SALT, "butler/v1/kek")),
      financeBackupKey: await importAndWipe(
        await hkdfBytes(stretched, NO_SALT, "butler/v1/finance-backup"),
      ),
    };
  } finally {
    wipe(stretched);
  }
}

export async function deriveRecoverySecrets(
  recoveryKey: Uint8Array,
  recoverySalt: string,
): Promise<RecoverySecrets> {
  const salt = base64ToBytes(recoverySalt);
  const auth = await hkdfBytes(recoveryKey, salt, "butler/v1/recovery-auth");
  const recoveryAuthKey = bytesToBase64(auth);
  wipe(auth);
  return {
    recoveryAuthKey,
    recoveryKek: await importAndWipe(await hkdfBytes(recoveryKey, salt, "butler/v1/recovery-kek")),
    recoveryFinanceKey: await importAndWipe(
      await hkdfBytes(recoveryKey, salt, "butler/v1/recovery-finance"),
    ),
  };
}

export async function createAccountKeys(
  password: string,
  params: KdfParams = PASSWORD_KDF_PARAMS,
  minimum: KdfParams = MIN_KDF_PARAMS,
): Promise<NewAccountKeys> {
  const problem = validatePassword(password);
  if (problem) throw new Error(problem);

  const masterKey = randomBytes(KEY_LENGTH);
  const financeKey = randomBytes(KEY_LENGTH);
  const recoveryKeyBytes = randomBytes(RECOVERY_KEY_BYTES);
  const kdfSalt = bytesToBase64(randomBytes(SALT_LENGTH));
  const recoverySalt = bytesToBase64(randomBytes(SALT_LENGTH));
  try {
    const pw = await derivePasswordSecrets(password, kdfSalt, params, minimum);
    const rec = await deriveRecoverySecrets(recoveryKeyBytes, recoverySalt);
    const bundle: KeyBundle = {
      kdfSalt,
      kdfParams: params,
      wrappedMasterKey: await wrapKey(pw.kek, masterKey, "master"),
      recoverySalt,
      wrappedMasterKeyRecovery: await wrapKey(rec.recoveryKek, masterKey, "master"),
      wrappedFinanceKeyPassword: await wrapKey(pw.financeBackupKey, financeKey, "finance"),
      wrappedFinanceKeyRecovery: await wrapKey(rec.recoveryFinanceKey, financeKey, "finance"),
    };
    return {
      bundle,
      authKey: pw.authKey,
      recoveryAuthKey: rec.recoveryAuthKey,
      recoveryKey: encodeRecoveryKey(recoveryKeyBytes),
      masterKey,
    };
  } finally {
    wipe(financeKey);
    wipe(recoveryKeyBytes);
  }
}

export function unwrapMasterKey(kek: CryptoKey, wrapped: Sealed): Promise<Bytes> {
  return unwrapKey(kek, wrapped, "master");
}

export function unwrapFinanceKey(wrappingKey: CryptoKey, wrapped: Sealed): Promise<Bytes> {
  return unwrapKey(wrappingKey, wrapped, "finance");
}

/** New password material for an existing master key + finance key (password change or reset). */
export async function rekeyForPassword(
  masterKey: Uint8Array,
  financeKey: Uint8Array,
  newPassword: string,
  params: KdfParams = PASSWORD_KDF_PARAMS,
  minimum: KdfParams = MIN_KDF_PARAMS,
): Promise<PasswordRekey> {
  const problem = validatePassword(newPassword);
  if (problem) throw new Error(problem);
  const kdfSalt = bytesToBase64(randomBytes(SALT_LENGTH));
  const pw = await derivePasswordSecrets(newPassword, kdfSalt, params, minimum);
  return {
    authKey: pw.authKey,
    kdfSalt,
    kdfParams: params,
    wrappedMasterKey: await wrapKey(pw.kek, masterKey, "master"),
    wrappedFinanceKeyPassword: await wrapKey(pw.financeBackupKey, financeKey, "finance"),
  };
}

/** 20 random bytes as Crockford base32 in groups of four, e.g. `7K2M-9QXA-...`. */
export function encodeRecoveryKey(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xfffff;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return (out.match(/.{1,4}/g) ?? []).join("-");
}

export function decodeRecoveryKey(input: string): Bytes {
  const normalized = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  if (normalized.length !== RECOVERY_KEY_CHARS) throw new InvalidRecoveryKeyError();

  const out = new Uint8Array(RECOVERY_KEY_BYTES);
  let bits = 0;
  let value = 0;
  let index = 0;
  for (const char of normalized) {
    const digit = CROCKFORD.indexOf(char);
    if (digit < 0) throw new InvalidRecoveryKeyError();
    value = ((value << 5) | digit) & 0xfffff;
    bits += 5;
    if (bits >= 8) {
      out[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return out;
}
