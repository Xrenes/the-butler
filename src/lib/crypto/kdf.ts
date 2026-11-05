import { argon2id } from "hash-wasm";
import { type Bytes, asBytes, utf8Encode } from "./encoding";

export interface KdfParams {
  algorithm: "argon2id";
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

/** Account password stretching: roughly 0.5-1 s on a mid-range phone. */
export const PASSWORD_KDF_PARAMS: KdfParams = {
  algorithm: "argon2id",
  memoryKiB: 64 * 1024,
  iterations: 3,
  parallelism: 1,
};

/** PIN stretching is lighter because the PIN key is also bound to the master key. */
export const PIN_KDF_PARAMS: KdfParams = {
  algorithm: "argon2id",
  memoryKiB: 32 * 1024,
  iterations: 2,
  parallelism: 1,
};

/** OWASP minimum for Argon2id. Server-supplied params below this are refused. */
export const MIN_KDF_PARAMS: KdfParams = {
  algorithm: "argon2id",
  memoryKiB: 19 * 1024,
  iterations: 2,
  parallelism: 1,
};

const MAX_MEMORY_KIB = 512 * 1024;
const MAX_ITERATIONS = 10;
const MAX_PARALLELISM = 4;

export class WeakKdfParamsError extends Error {
  constructor() {
    super("Key derivation parameters are weaker than allowed");
    this.name = "WeakKdfParamsError";
  }
}

/**
 * A malicious server could hand out weak parameters to make password guessing cheaper,
 * or huge ones to freeze the device. Both are rejected before any work is done.
 */
export function assertKdfParams(params: KdfParams, minimum: KdfParams = MIN_KDF_PARAMS): void {
  const tooWeak =
    params.algorithm !== "argon2id" ||
    params.memoryKiB < minimum.memoryKiB ||
    params.iterations < minimum.iterations;
  const tooLarge =
    params.memoryKiB > MAX_MEMORY_KIB ||
    params.iterations > MAX_ITERATIONS ||
    params.parallelism < 1 ||
    params.parallelism > MAX_PARALLELISM;
  if (tooWeak || tooLarge) throw new WeakKdfParamsError();
}

export async function argon2idBytes(
  secret: string | Uint8Array,
  salt: Uint8Array,
  params: KdfParams,
  length = 32,
): Promise<Bytes> {
  const out = await argon2id({
    password: secret,
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memoryKiB,
    hashLength: length,
    outputType: "binary",
  });
  return new Uint8Array(out);
}

/** HKDF-SHA256: splits one strong secret into independent, purpose-bound keys. */
export async function hkdfBytes(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: string,
  length = 32,
): Promise<Bytes> {
  const baseKey = await crypto.subtle.importKey("raw", asBytes(ikm), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: asBytes(salt), info: utf8Encode(info) },
    baseKey,
    length * 8,
  );
  return new Uint8Array(bits);
}
