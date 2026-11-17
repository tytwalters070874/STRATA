import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, type Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long saved query results survive on the phone between launches. */
export const PERSIST_MAX_AGE_MS = 7 * DAY_MS;

// Only these survive restarts, so the map and catalog still show something
// in the field with no signal. Everything else is cheap or must be fresh.
const PERSISTED_QUERY_ROOTS = new Set(['formation', 'catalog']);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // React Query drops unused results after 5 minutes by default, which
      // threw away formations as soon as you walked on. Keep them a day.
      gcTime: DAY_MS,
    },
  },
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'strata-query-cache',
    // Batch writes; the cache changes on every GPS-driven lookup.
    throttleTime: 2000,
  }),
  maxAge: PERSIST_MAX_AGE_MS,
  // Bump when a persisted query's data shape changes, to discard old caches.
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === 'success' && PERSISTED_QUERY_ROOTS.has(String(query.queryKey[0])),
  },
};
