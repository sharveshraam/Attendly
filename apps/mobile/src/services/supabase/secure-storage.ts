import * as SecureStore from 'expo-secure-store';

/**
 * Supabase session storage backed by the platform keystore/keychain.
 * SecureStore caps a single value at ~2048 bytes, while a Supabase session can
 * exceed that, so values are transparently chunked. Only the auth session is
 * stored here; non-sensitive caches live in AsyncStorage/SQLite.
 */
const CHUNK_SIZE = 1800;
const META_SUFFIX = '__chunks';

function chunkKey(key: string, index: number): string {
  return `${key}__${index}`;
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const meta = await SecureStore.getItemAsync(key + META_SUFFIX);
    if (meta === null) {
      // Legacy single-value entry.
      return SecureStore.getItemAsync(key);
    }
    const count = Number.parseInt(meta, 10);
    if (!Number.isFinite(count) || count <= 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    // Clear any previous chunks first.
    await this.removeItem(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(key + META_SUFFIX, String(count));
  },

  async removeItem(key: string): Promise<void> {
    const meta = await SecureStore.getItemAsync(key + META_SUFFIX);
    if (meta !== null) {
      const count = Number.parseInt(meta, 10);
      if (Number.isFinite(count)) {
        for (let i = 0; i < count; i += 1) {
          await SecureStore.deleteItemAsync(chunkKey(key, i));
        }
      }
      await SecureStore.deleteItemAsync(key + META_SUFFIX);
    }
    await SecureStore.deleteItemAsync(key);
  },
};
