import { CacheManager } from '@/services/cache/cacheManager';

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

describe('CacheManager', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores and retrieves entries with metadata', () => {
    const storage = createMemoryStorage();
    const now = new Date('2026-04-07T10:00:00.000Z');
    const manager = new CacheManager({
      storage,
      now: () => now,
    });

    manager.set('cache_measurements_main', [{ id: 1 }]);
    const entry = manager.get<Array<{ id: number }>>('cache_measurements_main');

    expect(entry?.data).toEqual([{ id: 1 }]);
    expect(entry?.lastSync).toBe(now.toISOString());
  });

  it('clears a single key and all managed keys', () => {
    const storage = createMemoryStorage();
    const manager = new CacheManager({ storage });

    manager.set('cache_measurements_main', [1, 2, 3]);
    manager.set('cache_analytics_consumption_main', { ok: true });
    manager.clear('cache_analytics_consumption_main');
    expect(manager.get('cache_analytics_consumption_main')).toBeNull();

    manager.clearAll();
    expect(manager.get('cache_measurements_main')).toBeNull();
  });

  it('clears stale entries when the cache version changes', () => {
    const storage = createMemoryStorage();
    const versionOne = new CacheManager({ storage, version: '1.0.0' });

    versionOne.set('cache_measurements_main', [1, 2, 3]);

    const versionTwo = new CacheManager({ storage, version: '2.0.0' });
    expect(versionTwo.get('cache_measurements_main')).toBeNull();
  });

  it('reports expiration correctly', () => {
    const storage = createMemoryStorage();
    const initialTime = new Date('2026-04-07T10:00:00.000Z');
    const manager = new CacheManager({
      storage,
      now: () => initialTime,
    });

    manager.set('cache_measurements_main', [1]);

    const futureManager = new CacheManager({
      storage,
      now: () => new Date('2026-04-07T10:10:00.000Z'),
    });

    expect(futureManager.isExpired('cache_measurements_main', 1000)).toBe(true);
    expect(futureManager.isExpired('cache_measurements_main', 20 * 60 * 1000)).toBe(false);
  });

  it('prunes the oldest items when requested', () => {
    const storage = createMemoryStorage();
    const manager = new CacheManager({ storage });

    manager.set('cache_measurements_main', [1, 2, 3, 4]);
    manager.pruneOldest('cache_measurements_main', 2);

    expect(manager.get<number[]>('cache_measurements_main')?.data).toEqual([3, 4]);
  });

  it('handles QuotaExceededError by pruning the payload', () => {
    const backingStorage = createMemoryStorage();
    let firstWrite = true;
    const quotaStorage = {
      ...backingStorage,
      setItem(key: string, value: string) {
        if (firstWrite && key.endsWith('cache_measurements_main')) {
          const parsed = JSON.parse(value) as { data: number[] };
          if (parsed.data.length > 2) {
            firstWrite = false;
            throw new DOMException('Quota exceeded', 'QuotaExceededError');
          }
        }

        backingStorage.setItem(key, value);
      },
    };
    const manager = new CacheManager({ storage: quotaStorage });

    manager.set('cache_measurements_main', [1, 2, 3, 4]);

    expect(manager.get<number[]>('cache_measurements_main')?.data).toEqual([3, 4]);
  });
});
