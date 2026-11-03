import { useEffect } from 'react';
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { cacheGet, cacheSet, cacheUpdatedAt } from '@/database/cache';

/**
 * TanStack Query wrapper that persists successful results to SQLite and serves
 * the last-synced snapshot as placeholder data while offline or refetching.
 * The global QueryClient uses networkMode 'offlineFirst' so reads still resolve
 * from cache when there is no connection.
 */
export function useOfflineQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, 'queryKey' | 'queryFn'>,
): UseQueryResult<T, Error> & { cachedAt: string | null; isStale: boolean } {
  const cacheKey = JSON.stringify(queryKey);
  const cached = cacheGet<T>(cacheKey);
  const query = useQuery<T, Error, T, readonly unknown[]>({
    queryKey,
    queryFn,
    // TanStack Query v5's NonFunctionGuard<T> cannot be proven for an unconstrained
    // generic; cached data is always a plain object/array, so this cast is safe.
    placeholderData: (cached ?? undefined) as never,
    ...options,
  });

  useEffect(() => {
    if (query.data !== undefined && query.isSuccess) {
      cacheSet(cacheKey, query.data);
    }
  }, [query.data, query.isSuccess, cacheKey]);

  return {
    ...query,
    cachedAt: cacheUpdatedAt(cacheKey),
    isStale: Boolean(cached) && !query.isSuccess,
  };
}
