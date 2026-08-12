"use client";

import { useCallback, useEffect, useState } from "react";
import { getCachedData, setCachedData } from "./data-cache";

/**
 * Cache-or-fetch-once per key, for the lifetime of the browser session. Repeated visits to the
 * same route/tab read from cache instantly (no refetch, no loading flash); call `reload()`
 * after a mutation elsewhere to refresh the cache in place.
 */
export function useCachedFetch<T>(key: string, fetcher: () => Promise<T>) {
  const [loadedKey, setLoadedKey] = useState(key);
  const [data, setData] = useState<T | undefined>(() => getCachedData<T>(key));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => getCachedData<T>(key) === undefined);

  // Sanctioned React pattern for "adjust state when a prop changes" — runs during render, not
  // in an effect, so switching to an already-cached key re-derives instantly with no flash.
  if (loadedKey !== key) {
    setLoadedKey(key);
    setData(getCachedData<T>(key));
    setError(null);
    setIsLoading(getCachedData<T>(key) === undefined);
  }

  // For local mutations (e.g. removing a deleted row) — writes through to the cache too, so a
  // later remount doesn't resurrect the stale pre-mutation snapshot.
  const mutate = useCallback(
    (updater: T | ((current: T | undefined) => T)) => {
      setData((current) => {
        const next = typeof updater === "function" ? (updater as (current: T | undefined) => T)(current) : updater;
        setCachedData(key, next);
        return next;
      });
    },
    [key],
  );

  const reload = useCallback(() => {
    return fetcher()
      .then((result) => {
        setCachedData(key, result);
        setData(result);
        setError(null);
        return result;
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load.");
        throw caughtError;
      })
      .finally(() => {
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (getCachedData<T>(key) === undefined) {
      reload().catch(() => undefined);
    }
  }, [key, reload]);

  return { data, error, isLoading, reload, mutate };
}
