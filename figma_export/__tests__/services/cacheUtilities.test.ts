import { emitCacheUpdated, subscribeToCacheUpdates } from '@/services/cache/cacheEvents';
import { CacheManager } from '@/services/cache/cacheManager';
import {
  getCachedAnalytics,
  getCachedMeasurementEntry,
  getCachedMeasurementSyncState,
  getCachedMeasurements,
} from '@/services/cache/cacheSelectors';
import {
  getAnalyticsCacheKey,
  getMeasurementCacheKey,
  getMeasurementSyncStateCacheKey,
} from '@/services/cache/cacheKeys';

function createMemoryStorage() {
  const map = new Map<string, string>();

  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('cache utilities', () => {
  it('emits cache update events to subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToCacheUpdates(listener);

    emitCacheUpdated({
      key: 'cache_measurements_main',
      lastSync: '2026-04-07T00:00:00.000Z',
    });

    expect(listener).toHaveBeenCalledWith({
      key: 'cache_measurements_main',
      lastSync: '2026-04-07T00:00:00.000Z',
    });

    unsubscribe();
  });

  it('reads cached measurements and analytics through selectors', () => {
    const storage = createMemoryStorage();
    const manager = new CacheManager({ storage });

    manager.set(getMeasurementCacheKey('main'), [{ id: 1 }]);
    manager.set(getMeasurementSyncStateCacheKey('main'), {
      channel: 'main',
      status: 'fallback_stale',
      dataSource: 'api',
      latestMeasurementAt: '2026-04-07T00:00:00.000Z',
      lastFallbackCheckAt: '2026-04-07T00:00:00.000Z',
      lastApiAttemptAt: '2026-04-07T00:00:00.000Z',
      lastSuccessfulApiSyncAt: '2026-04-07T00:00:00.000Z',
      backupSnapshotGeneratedAt: null,
      message: 'API sem dados recentes; usando a ultima medicao disponivel.',
    });
    manager.set(getAnalyticsCacheKey('main', 'hourly_profile'), {
      channel: 'main',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-07T00:00:00.000Z',
      results: [{ hour: '08', sensor: 'freezer', avg_power_kw: 12 }],
    });

    expect(getCachedMeasurementEntry('main', manager)?.data).toEqual([{ id: 1 }]);
    expect(getCachedMeasurements('main', manager)).toEqual([{ id: 1 }]);
    expect(getCachedMeasurementSyncState('main', manager)?.status).toBe('fallback_stale');
    expect(getCachedAnalytics('main', 'hourly_profile', manager)?.results[0]).toEqual({
      hour: '08',
      sensor: 'freezer',
      avg_power_kw: 12,
    });
  });
});
