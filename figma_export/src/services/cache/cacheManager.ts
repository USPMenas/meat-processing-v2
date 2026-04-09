import { emitCacheUpdated } from './cacheEvents';
import { CACHE_VERSION, getVersionStorageKey, STORAGE_PREFIX } from './cacheKeys';

export interface CacheEntry<T> {
  version: string;
  updatedAt: string;
  lastSync: string;
  data: T;
}

interface StorageLike {
  readonly length: number;
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

interface CacheManagerOptions {
  storage?: StorageLike;
  prefix?: string;
  version?: string;
  limitBytes?: number;
  now?: () => Date;
}

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();

  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.get(key) ?? null;
    },
    key(index) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    setItem(key, value) {
      map.set(key, value);
    },
  };
}

function safeStorage(): StorageLike {
  if (typeof window !== 'undefined') {
    const storageCandidate = window.localStorage as StorageLike | undefined;

    if (
      storageCandidate &&
      typeof storageCandidate.getItem === 'function' &&
      typeof storageCandidate.setItem === 'function' &&
      typeof storageCandidate.removeItem === 'function'
    ) {
      return storageCandidate;
    }
  }

  return createMemoryStorage();
}

function byteSize(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014)
  );
}

function hasMeasurementsArray(value: unknown): value is { measurements: unknown[] } {
  return typeof value === 'object' && value !== null && Array.isArray((value as { measurements?: unknown[] }).measurements);
}

function hasArrayPayload(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export class CacheManager {
  private storage: StorageLike;

  private prefix: string;

  private version: string;

  private limitBytes: number;

  private now: () => Date;

  constructor(options: CacheManagerOptions = {}) {
    this.storage = options.storage ?? safeStorage();
    this.prefix = options.prefix ?? STORAGE_PREFIX;
    this.version = options.version ?? CACHE_VERSION;
    this.limitBytes = options.limitBytes ?? 5 * 1024 * 1024;
    this.now = options.now ?? (() => new Date());
    this.ensureVersion();
  }

  get<T>(key: string): CacheEntry<T> | null {
    this.ensureVersion();

    const rawValue = this.storage.getItem(this.withPrefix(key));
    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as CacheEntry<T>;
    } catch (error) {
      console.error(`[CacheManager] Failed to parse key ${key}`, error);
      this.storage.removeItem(this.withPrefix(key));
      return null;
    }
  }

  set<T>(key: string, data: T): void {
    this.ensureVersion();

    const entry: CacheEntry<T> = {
      version: this.version,
      updatedAt: this.now().toISOString(),
      lastSync: this.now().toISOString(),
      data,
    };

    this.persist(key, entry);
  }

  getLastSync(key: string): string | null {
    return this.get(key)?.lastSync ?? null;
  }

  clear(key: string): void {
    this.storage.removeItem(this.withPrefix(key));
  }

  clearAll(): void {
    const prefixedKeys = this.getPrefixedKeys();

    prefixedKeys.forEach((key) => {
      this.storage.removeItem(key);
    });

    this.storage.setItem(this.withPrefix(getVersionStorageKey()), this.version);
  }

  isExpired(key: string, maxAgeMs: number): boolean {
    const entry = this.get(key);
    if (!entry) {
      return true;
    }

    return this.now().getTime() - new Date(entry.updatedAt).getTime() > maxAgeMs;
  }

  getStorageUsage(): { used: number; limit: number } {
    const used = this.getPrefixedKeys().reduce((total, key) => {
      const value = this.storage.getItem(key) ?? '';
      return total + byteSize(value);
    }, 0);

    return {
      used,
      limit: this.limitBytes,
    };
  }

  pruneOldest(key: string, keepCount: number): void {
    const currentEntry = this.get<unknown>(key);
    if (!currentEntry) {
      return;
    }

    if (hasArrayPayload(currentEntry.data)) {
      this.persist(key, {
        ...currentEntry,
        updatedAt: this.now().toISOString(),
        lastSync: currentEntry.lastSync,
        data: currentEntry.data.slice(-keepCount),
      });
      return;
    }

    if (hasMeasurementsArray(currentEntry.data)) {
      this.persist(key, {
        ...currentEntry,
        updatedAt: this.now().toISOString(),
        lastSync: currentEntry.lastSync,
        data: {
          ...currentEntry.data,
          measurements: currentEntry.data.measurements.slice(-keepCount),
        },
      });
    }
  }

  private ensureVersion(): void {
    const versionKey = this.withPrefix(getVersionStorageKey());
    const storedVersion = this.storage.getItem(versionKey);

    if (storedVersion === this.version) {
      return;
    }

    this.clearAll();
  }

  private persist<T>(key: string, entry: CacheEntry<T>): void {
    const serialized = this.safeStringify(key, entry);

    try {
      this.storage.setItem(this.withPrefix(key), serialized);
      emitCacheUpdated({ key, lastSync: entry.lastSync });
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        throw error;
      }

      console.error(`[CacheManager] Quota exceeded while saving ${key}`, error);
      this.handleQuotaExceeded(key, entry);
    }
  }

  private handleQuotaExceeded<T>(key: string, entry: CacheEntry<T>): void {
    const itemCount = this.extractItemCount(entry.data);

    if (itemCount > 1) {
      const keepCount = Math.max(1, Math.floor(itemCount / 2));
      this.pruneOldest(key, keepCount);

      const prunedEntry = this.pruneEntry(entry, keepCount);
      const serialized = this.safeStringify(key, prunedEntry);
      this.storage.setItem(this.withPrefix(key), serialized);
      emitCacheUpdated({ key, lastSync: prunedEntry.lastSync });
      return;
    }

    this.pruneLargestCache();
    this.storage.setItem(this.withPrefix(key), this.safeStringify(key, entry));
    emitCacheUpdated({ key, lastSync: entry.lastSync });
  }

  private pruneLargestCache(): void {
    const candidate = this.getPrefixedKeys()
      .filter((key) => key !== this.withPrefix(getVersionStorageKey()))
      .map((key) => ({
        key,
        size: byteSize(this.storage.getItem(key) ?? ''),
      }))
      .sort((left, right) => right.size - left.size)[0];

    if (candidate) {
      this.storage.removeItem(candidate.key);
    }
  }

  private pruneEntry<T>(entry: CacheEntry<T>, keepCount: number): CacheEntry<T> {
    if (hasArrayPayload(entry.data)) {
      return {
        ...entry,
        data: entry.data.slice(-keepCount) as T,
      };
    }

    if (hasMeasurementsArray(entry.data)) {
      return {
        ...entry,
        data: {
          ...(entry.data as object),
          measurements: entry.data.measurements.slice(-keepCount),
        } as T,
      };
    }

    return entry;
  }

  private extractItemCount(data: unknown): number {
    if (hasArrayPayload(data)) {
      return data.length;
    }

    if (hasMeasurementsArray(data)) {
      return data.measurements.length;
    }

    return 0;
  }

  private safeStringify<T>(key: string, entry: CacheEntry<T>): string {
    try {
      return JSON.stringify(entry);
    } catch (error) {
      console.error(`[CacheManager] Failed to serialize key ${key}`, error);
      throw error;
    }
  }

  private getPrefixedKeys(): string[] {
    const keys: string[] = [];

    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (key?.startsWith(this.prefix)) {
        keys.push(key);
      }
    }

    return keys;
  }

  private withPrefix(key: string): string {
    return key.startsWith(this.prefix) ? key : `${this.prefix}${key}`;
  }
}

export const cacheManager = new CacheManager();
