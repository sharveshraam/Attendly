/** Content hashing used to make repeated uploads of the same file idempotent. */
import { hashBytes } from "../idempotency.ts";

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return `fnv:${hashBytes(bytes)}`;
  // Copy into a fresh ArrayBuffer so the typed-array view is always acceptable.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
