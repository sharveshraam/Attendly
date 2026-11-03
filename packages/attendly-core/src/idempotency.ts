/**
 * Deterministic keys and content hashes for idempotent imports.
 * No crypto API, no randomness, no Date: identical input always produces the
 * same key on the website, on Android and inside a database constraint.
 */
import { normalizeCode, normalizeCourseName } from "./text.ts";

/** FNV-1a over the string's UTF-16 code units (stable across JS runtimes). */
export function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** FNV-1a over bytes, used as a fallback when SubtleCrypto is unavailable. */
export function hashBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function courseSourceKey(semesterId: string, code: string | null, name: string): string {
  const identity = code ? `code:${normalizeCode(code)}` : `name:${normalizeCourseName(name)}`;
  return `${semesterId}:course:${identity}`;
}

export function ruleSourceKey(
  semesterId: string,
  courseKey: string,
  weekday: number,
  startTime: string,
  sessionType: string,
  revision: string,
): string {
  return `${semesterId}:rule:${courseKey}:${weekday}:${startTime}:${sessionType}:${revision}`;
}

export function sessionSourceKey(
  semesterId: string,
  courseKey: string,
  date: string,
  startTime: string,
  sessionType: string,
): string {
  return `${semesterId}:session:${courseKey}:${date}:${startTime}:${sessionType}`;
}

export function exceptionSourceKey(semesterId: string, date: string, type: string, title: string): string {
  return `${semesterId}:exception:${date}:${type}:${hashText(title)}`;
}

export function documentFingerprint(
  ownerId: string,
  kind: string,
  contentHash: string,
): string {
  return `${ownerId}:${kind}:${contentHash}`;
}
