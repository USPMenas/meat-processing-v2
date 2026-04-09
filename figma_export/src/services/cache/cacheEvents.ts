export const CACHE_UPDATED_EVENT = 'frigorifico:cache-updated';

export interface CacheUpdateDetail {
  key: string;
  lastSync: string;
}

export function emitCacheUpdated(detail: CacheUpdateDetail): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<CacheUpdateDetail>(CACHE_UPDATED_EVENT, { detail }));
}

export function subscribeToCacheUpdates(
  listener: (detail: CacheUpdateDetail) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = (event: Event) => {
    if (event instanceof CustomEvent) {
      listener(event.detail as CacheUpdateDetail);
    }
  };

  window.addEventListener(CACHE_UPDATED_EVENT, handler as EventListener);

  return () => {
    window.removeEventListener(CACHE_UPDATED_EVENT, handler as EventListener);
  };
}
