import { getDb } from './db';

export function cacheGet<T>(key: string): T | null {
  try {
    const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM cache WHERE key = ?', [key]);
    return row ? (JSON.parse(row.value) as T) : null;
  } catch {
    return null;
  }
}

export function cacheSet(key: string, value: unknown): void {
  try {
    getDb().runSync(
      'INSERT INTO cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [key, JSON.stringify(value), new Date().toISOString()],
    );
  } catch {
    // Cache writes are best-effort; never break the UI.
  }
}

export function cacheUpdatedAt(key: string): string | null {
  try {
    const row = getDb().getFirstSync<{ updated_at: string }>('SELECT updated_at FROM cache WHERE key = ?', [key]);
    return row?.updated_at ?? null;
  } catch {
    return null;
  }
}

export function cacheClearPrefix(prefix: string): void {
  try {
    getDb().runSync('DELETE FROM cache WHERE key LIKE ?', [`${prefix}%`]);
  } catch {
    // ignore
  }
}
