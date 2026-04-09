import type { ApiEndpoints } from '@/services/api/endpoints';
import type {
  ChannelMeasurementsResponse,
  ConsumptionResponse,
  CurrentBySensorResponse,
  DemandPeaksResponse,
  ElectricalHealthResponse,
  HourlyProfileResponse,
} from '@/services/api/types';
import { CacheManager } from '@/services/cache/cacheManager';
import {
  getAnalyticsCacheKey,
  getMeasurementCacheKey,
  getMeasurementSyncStateCacheKey,
} from '@/services/cache/cacheKeys';
import { SyncStrategy } from '@/services/cache/syncStrategy';
import type { MeasurementSyncState } from '@/services/cache/types';
import emptyWindowFixture from '../../analise-banco-de-dados/fixtures/channel-lab-default-empty-24h.json';
import type { BackupChannelSnapshot } from '@/domain/types';

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

function createAnalyticsResponse<
  T extends
    | ConsumptionResponse
    | DemandPeaksResponse
    | ElectricalHealthResponse
    | HourlyProfileResponse
    | CurrentBySensorResponse,
>(response: T): T {
  return response;
}

function createEndpoints(): ApiEndpoints {
  return {
    getChannelMeasurements: vi.fn(),
    getSensorMeasurements: vi.fn(),
    getConsumption: vi.fn().mockResolvedValue(
      createAnalyticsResponse({
        channel: 'main',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-04-07T00:00:00.000Z',
        results: [{ sensor: 'freezer', total_kwh: 10, min_demand_kw: 1, max_demand_kw: 2 }],
      }),
    ),
    getDemandPeaks: vi.fn().mockResolvedValue(
      createAnalyticsResponse({
        channel: 'main',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-04-07T00:00:00.000Z',
        results: [{ sensor: 'freezer', peak_kw: 2, timestamp: '2026-04-07T00:00:00.000Z' }],
      }),
    ),
    getElectricalHealth: vi.fn().mockResolvedValue(
      createAnalyticsResponse({
        channel: 'main',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-04-07T00:00:00.000Z',
        results: [{ sensor: 'freezer', avg_voltage: 220, avg_power_factor: 0.95 }],
      }),
    ),
    getHourlyProfile: vi.fn().mockResolvedValue(
      createAnalyticsResponse({
        channel: 'main',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-04-07T00:00:00.000Z',
        results: [{ hour: '08', sensor: 'freezer', avg_power_kw: 12 }],
      }),
    ),
    getCurrentBySensor: vi.fn().mockResolvedValue(
      createAnalyticsResponse({
        channel: 'main',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-04-07T00:00:00.000Z',
        results: [{ sensor: 'freezer', avg_current: 5 }],
      }),
    ),
  };
}

function measurementResponse(measurements: ChannelMeasurementsResponse['measurements']): ChannelMeasurementsResponse {
  return {
    channel: 'main',
    from: measurements[0]?.timestamp ?? '2026-01-01T00:00:00.000Z',
    to: measurements[measurements.length - 1]?.timestamp ?? '2026-01-01T00:00:00.000Z',
    count: measurements.length,
    measurements,
  };
}

function createBackupSnapshot(channel = 'main'): BackupChannelSnapshot {
  return {
    channel,
    generatedAt: '2026-04-09T14:06:48Z',
    source: 'backup_2026-03-31.db',
    sensors: ['fase1', 'fase2', 'fase3'],
    latestMeasurementAt: '2026-03-31T10:24:17',
    measurementRange: {
      from: '2025-12-01T19:20:42',
      to: '2026-03-31T10:24:17',
    },
    operational: {
      recentMeasurements: [
        {
          channel,
          sensor: 'fase1',
          apparent_power: 5,
          active_power: 5,
          reactive_power: 1,
          power_factor: 0.95,
          current: 0.08,
          voltage: 127,
          timestamp: '2026-03-31T10:24:17',
        },
        {
          channel,
          sensor: 'fase2',
          apparent_power: 3,
          active_power: 3,
          reactive_power: 1,
          power_factor: 0.95,
          current: 0.05,
          voltage: 128,
          timestamp: '2026-03-31T10:24:17',
        },
        {
          channel,
          sensor: 'fase3',
          apparent_power: 6,
          active_power: 6,
          reactive_power: 1,
          power_factor: 0.95,
          current: 0.06,
          voltage: 129,
          timestamp: '2026-03-31T10:24:17',
        },
      ],
      histories: {
        '24h': {
          anchorMeasurementAt: '2026-03-31T10:24:17',
          period: '24h',
          points: [
            {
              freezerEnergy: 6,
              equipmentEnergy: 8,
              temperature: -19,
              occupancy: 62,
              timestamp: '2026-03-31T10:24:17',
            },
          ],
        },
        '7d': {
          anchorMeasurementAt: '2026-03-31T10:24:17',
          period: '7d',
          points: [
            {
              freezerEnergy: 6,
              equipmentEnergy: 8,
              temperature: -19,
              occupancy: 62,
              timestamp: '2026-03-31T10:24:17',
            },
          ],
        },
        '30d': {
          anchorMeasurementAt: '2026-03-31T10:24:17',
          period: '30d',
          points: [
            {
              freezerEnergy: 6,
              equipmentEnergy: 8,
              temperature: -19,
              occupancy: 62,
              timestamp: '2026-03-31T10:24:17',
            },
          ],
        },
      },
    },
    logistics: {
      hourlyProfile: {
        channel,
        from: '2026-03-01T00:00:00',
        to: '2026-03-31T10:24:17',
        results: [{ hour: '08', sensor: 'fase3', avg_power_kw: 6 }],
      },
      currentBySensor: {
        channel,
        from: '2026-03-01T00:00:00',
        to: '2026-03-31T10:24:17',
        results: [{ sensor: 'fase1', avg_current: 0.08 }],
      },
    },
    business: {
      consumption: {
        channel,
        from: '2026-03-01T00:00:00',
        to: '2026-03-31T10:24:17',
        results: [{ sensor: 'fase3', total_kwh: 120, min_demand_kw: 2, max_demand_kw: 7 }],
      },
      demandPeaks: {
        channel,
        from: '2026-03-01T00:00:00',
        to: '2026-03-31T10:24:17',
        results: [{ sensor: 'fase3', peak_kw: 7, timestamp: '2026-03-31T10:24:17' }],
      },
      electricalHealth: {
        channel,
        from: '2026-03-01T00:00:00',
        to: '2026-03-31T10:24:17',
        results: [{ sensor: 'fase3', avg_voltage: 128, avg_power_factor: 0.95 }],
      },
    },
  };
}

describe('SyncStrategy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects whether a cold start is needed', () => {
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({ storage });
    const syncStrategy = new SyncStrategy({
      cacheManager,
      endpoints: createEndpoints(),
    });

    expect(syncStrategy.needsColdStart('main')).toBe(true);
    cacheManager.set(getMeasurementCacheKey('main'), [
      {
        channel: 'main',
        sensor: 'freezer',
        apparent_power: 1,
        active_power: 1,
        reactive_power: 1,
        power_factor: 1,
        current: 1,
        voltage: 220,
        timestamp: '2026-04-07T00:00:00.000Z',
      },
    ]);
    expect(syncStrategy.needsColdStart('main')).toBe(false);
  });

  it('performs a cold start with a short recent raw window', async () => {
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({ storage });
    const endpoints = createEndpoints();
    const channelMeasurements = endpoints.getChannelMeasurements as ReturnType<typeof vi.fn>;
    channelMeasurements
      .mockResolvedValueOnce(
        measurementResponse([
          {
            channel: 'main',
            sensor: 'freezer',
            apparent_power: 12,
            active_power: 12,
            reactive_power: 1,
            power_factor: 0.95,
            current: 5,
            voltage: 220,
            timestamp: '2026-04-06T23:45:00.000Z',
          },
        ]),
      );
    const progress: number[] = [];
    const syncStrategy = new SyncStrategy({
      cacheManager,
      endpoints,
      now: () => new Date('2026-04-07T00:00:00.000Z'),
      measurementCacheWindowHours: 1,
    });

    await syncStrategy.coldStart('main', (value) => progress.push(value));

    expect(channelMeasurements).toHaveBeenCalledTimes(1);
    expect(cacheManager.get(getMeasurementCacheKey('main'))?.data).toHaveLength(1);
    expect(progress[0]).toBe(0);
    expect(progress[progress.length - 1]).toBe(100);
  });

  it('merges delta measurements with the cached payload', async () => {
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({
      storage,
      now: () => new Date('2026-04-07T00:00:30.000Z'),
    });
    cacheManager.set(getMeasurementCacheKey('main'), [
      {
        channel: 'main',
        sensor: 'freezer',
        apparent_power: 10,
        active_power: 10,
        reactive_power: 1,
        power_factor: 0.95,
        current: 5,
        voltage: 220,
        timestamp: '2026-04-07T00:00:00.000Z',
      },
    ]);

    const endpoints = createEndpoints();
    const channelMeasurements = endpoints.getChannelMeasurements as ReturnType<typeof vi.fn>;
    channelMeasurements.mockResolvedValue(
      measurementResponse([
        {
          channel: 'main',
          sensor: 'freezer',
          apparent_power: 10,
          active_power: 10,
          reactive_power: 1,
          power_factor: 0.95,
          current: 5,
          voltage: 220,
          timestamp: '2026-04-07T00:00:00.000Z',
        },
        {
          channel: 'main',
          sensor: 'equipment',
          apparent_power: 8,
          active_power: 8,
          reactive_power: 1,
          power_factor: 0.95,
          current: 4,
          voltage: 219,
          timestamp: '2026-04-07T00:01:00.000Z',
        },
      ]),
    );
    const syncStrategy = new SyncStrategy({
      cacheManager,
      endpoints,
      now: () => new Date('2026-04-07T00:02:00.000Z'),
    });

    await syncStrategy.syncDelta('main');

    expect(cacheManager.get(getMeasurementCacheKey('main'))?.data).toHaveLength(2);
  });

  it('falls back to the latest available API data when the recent delta is empty', async () => {
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({
      storage,
      now: () => new Date('2026-04-07T00:00:30.000Z'),
    });
    cacheManager.set(getMeasurementCacheKey('main'), [
      {
        channel: 'main',
        sensor: 'freezer',
        apparent_power: 10,
        active_power: 10,
        reactive_power: 1,
        power_factor: 0.95,
        current: 5,
        voltage: 220,
        timestamp: '2026-03-01T00:00:00.000Z',
      },
    ]);

    const endpoints = createEndpoints();
    const channelMeasurements = endpoints.getChannelMeasurements as ReturnType<typeof vi.fn>;
    channelMeasurements
      .mockResolvedValueOnce(emptyWindowFixture)
      .mockResolvedValueOnce(emptyWindowFixture)
      .mockResolvedValueOnce(
        measurementResponse([
          {
            channel: 'main',
            sensor: 'equipment',
            apparent_power: 8,
            active_power: 8,
            reactive_power: 1,
            power_factor: 0.95,
            current: 4,
            voltage: 219,
            timestamp: '2026-03-15T12:00:00.000Z',
          },
        ]),
      );
    const syncStrategy = new SyncStrategy({
      cacheManager,
      endpoints,
      now: () => new Date('2026-04-07T12:00:00.000Z'),
      staleFallbackProbeOffsetsDays: [1, 30],
    });

    await syncStrategy.syncDelta('main');

    expect(channelMeasurements).toHaveBeenCalledTimes(3);
    expect(cacheManager.get(getMeasurementCacheKey('main'))?.data).toHaveLength(2);
    expect(
      cacheManager.get<MeasurementSyncState>(getMeasurementSyncStateCacheKey('main'))?.data,
    ).toMatchObject({
      status: 'fallback_stale',
      dataSource: 'api',
      latestMeasurementAt: '2026-03-15T12:00:00.000Z',
    });
  });

  it('reuses the cached stale fallback state to avoid repeated historical searches', async () => {
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({
      storage,
      now: () => new Date('2026-04-07T11:55:00.000Z'),
    });
    cacheManager.set(getMeasurementCacheKey('main'), [
      {
        channel: 'main',
        sensor: 'freezer',
        apparent_power: 10,
        active_power: 10,
        reactive_power: 1,
        power_factor: 0.95,
        current: 5,
        voltage: 220,
        timestamp: '2026-03-15T12:00:00.000Z',
      },
    ]);
    cacheManager.set<MeasurementSyncState>(getMeasurementSyncStateCacheKey('main'), {
      channel: 'main',
      status: 'fallback_stale',
      dataSource: 'api',
      latestMeasurementAt: '2026-03-15T12:00:00.000Z',
      lastFallbackCheckAt: '2026-04-07T11:50:00.000Z',
      lastApiAttemptAt: '2026-04-07T11:50:00.000Z',
      lastSuccessfulApiSyncAt: '2026-04-07T11:50:00.000Z',
      backupSnapshotGeneratedAt: null,
      message: 'API sem dados recentes; usando a ultima medicao disponivel em 2026-03-15T12:00:00.000Z.',
    });

    const endpoints = createEndpoints();
    const channelMeasurements = endpoints.getChannelMeasurements as ReturnType<typeof vi.fn>;
    channelMeasurements.mockResolvedValueOnce(measurementResponse([]));
    const syncStrategy = new SyncStrategy({
      cacheManager,
      endpoints,
      now: () => new Date('2026-04-07T12:00:00.000Z'),
      staleFallbackRecheckMs: 15 * 60 * 1000,
      staleFallbackProbeOffsetsDays: [1, 30],
    });

    await syncStrategy.syncDelta('main');

    expect(channelMeasurements).toHaveBeenCalledTimes(1);
    expect(
      cacheManager.get<MeasurementSyncState>(getMeasurementSyncStateCacheKey('main'))?.data,
    ).toMatchObject({
      status: 'fallback_stale',
      dataSource: 'api',
      latestMeasurementAt: '2026-03-15T12:00:00.000Z',
    });
  });

  it('falls back to the bundled backup snapshot when the API is offline', async () => {
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({ storage });
    const endpoints = createEndpoints();
    (endpoints.getChannelMeasurements as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('offline'),
    );
    const syncStrategy = new SyncStrategy({
      cacheManager,
      endpoints,
      backupSnapshotLoader: async () => createBackupSnapshot('main'),
      now: () => new Date('2026-04-07T12:00:00.000Z'),
    });

    await expect(syncStrategy.coldStart('main')).rejects.toThrow(/backup local/i);

    expect(cacheManager.get(getMeasurementCacheKey('main'))?.data).toHaveLength(3);
    expect(cacheManager.get(getAnalyticsCacheKey('main', 'consumption'))?.data).toMatchObject({
      results: [{ sensor: 'fase3', total_kwh: 120, min_demand_kw: 2, max_demand_kw: 7 }],
    });
    expect(
      cacheManager.get<MeasurementSyncState>(getMeasurementSyncStateCacheKey('main'))?.data,
    ).toMatchObject({
      status: 'backup',
      dataSource: 'backup',
      latestMeasurementAt: '2026-03-31T10:24:17',
      backupSnapshotGeneratedAt: '2026-04-09T14:06:48Z',
    });
  });

  it('reuses analytics cache while the TTL is valid', async () => {
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({ storage });
    const endpoints = createEndpoints();
    const syncStrategy = new SyncStrategy({
      cacheManager,
      endpoints,
      now: () => new Date('2026-04-07T00:00:00.000Z'),
      analyticsTtlMs: 60 * 60 * 1000,
    });

    await syncStrategy.syncAnalytics('main');
    await syncStrategy.syncAnalytics('main');

    expect(endpoints.getConsumption).toHaveBeenCalledTimes(1);
    expect(endpoints.getDemandPeaks).toHaveBeenCalledTimes(1);
    expect(cacheManager.get(getAnalyticsCacheKey('main', 'hourly_profile'))).not.toBeNull();
  });

  it('keeps the previous analytics payload when the backend returns empty results', async () => {
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({
      storage,
      now: () => new Date('2026-04-07T00:00:00.000Z'),
    });
    cacheManager.set(getAnalyticsCacheKey('main', 'consumption'), {
      channel: 'main',
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-31T23:59:59.999Z',
      results: [{ sensor: 'freezer', total_kwh: 42, min_demand_kw: 1, max_demand_kw: 3 }],
    });

    const endpoints = createEndpoints();
    (endpoints.getConsumption as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createAnalyticsResponse({
        channel: 'main',
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-07T00:00:00.000Z',
        results: [],
      }),
    );
    const syncStrategy = new SyncStrategy({
      cacheManager,
      endpoints,
      now: () => new Date('2026-04-07T00:00:00.000Z'),
      analyticsTtlMs: 0,
    });

    await syncStrategy.syncAnalytics('main');

    expect(cacheManager.get(getAnalyticsCacheKey('main', 'consumption'))?.data).toMatchObject({
      results: [{ sensor: 'freezer', total_kwh: 42, min_demand_kw: 1, max_demand_kw: 3 }],
    });
  });
});
