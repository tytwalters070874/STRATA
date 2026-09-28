import 'react-native-url-polyfill/auto';

import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Check apps/mobile/.env and restart Metro.',
  );
}

// Some platforms reject SecureStore values above ~2048 bytes, and a Supabase
// session (JWTs + user object) regularly exceeds that. Values are split into
// chunks small enough to stay under the limit even if every char is 3 bytes
// in UTF-8. The base key stores the chunk count; chunks live at `${key}.${i}`.
const CHUNK_SIZE = 600;

const chunkKey = (key: string, index: number) => `${key}.${index}`;

async function readChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(key);
  const count = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(count) ? count : 0;
}

async function deleteChunks(key: string, from: number, to: number) {
  const deletes: Promise<void>[] = [];
  for (let i = from; i < to; i++) {
    deletes.push(SecureStore.deleteItemAsync(chunkKey(key, i)));
  }
  await Promise.all(deletes);
}

const secureStoreAdapter: SupportedStorage = {
  async getItem(key) {
    const count = await readChunkCount(key);
    if (count === 0) return null;

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );
    // A missing chunk means a partial write; treat the session as absent.
    if (chunks.some((chunk) => chunk === null)) return null;
    return chunks.join('');
  },

  async setItem(key, value) {
    const previousCount = await readChunkCount(key);
    const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));

    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.setItemAsync(
          chunkKey(key, i),
          value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        ),
      ),
    );
    await SecureStore.setItemAsync(key, String(count));

    if (previousCount > count) await deleteChunks(key, count, previousCount);
  },

  async removeItem(key) {
    const count = await readChunkCount(key);
    await SecureStore.deleteItemAsync(key);
    await deleteChunks(key, 0, count);
  },
};

const isWeb = Platform.OS === 'web';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // SecureStore has no web implementation; supabase-js falls back to localStorage.
    storage: isWeb ? undefined : secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Timers don't run reliably while a native app is backgrounded, so only
// refresh tokens while the app is in the foreground.
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
