// Module-level — survives component unmount/remount across client-side navigation within the
// same page load, so switching between dashboard tabs/routes doesn't refetch data it already has.
const cache = new Map<string, unknown>();

export function getCachedData<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCachedData<T>(key: string, data: T): void {
  cache.set(key, data);
}

export function clearCachedData(key: string): void {
  cache.delete(key);
}
