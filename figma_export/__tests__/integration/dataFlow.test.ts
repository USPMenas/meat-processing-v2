import { transformToFreezerEnergy } from '@/domain/transformers/energyTransformer';
import { ApiClient } from '@/services/api/client';
import type { ApiEndpoints } from '@/services/api/endpoints';
import type { ChannelMeasurementsResponse } from '@/services/api/types';
import { CacheManager } from '@/services/cache/cacheManager';
import {
  getMeasurementCacheKey,
  getMeasurementSyncStateCacheKey,
} from '@/services/cache/cacheKeys';
import { SyncStrategy } from '@/services/cache/syncStrategy';
import type { MeasurementSyncState } from '@/services/cache/types';
import emptyWindowFixture from '../../analise-banco-de-dados/fixtures/channel-lab-default-empty-24h.json';

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

function responseFor(measurements: ChannelMeasurementsResponse['measurements']): ChannelMeasurementsResponse {
  return {
    channel: 'main',
    from: measurements[0]?.timestamp ?? '2026-04-07T00:00:00.000Z',
    to: measurements[measurements.length - 1]?.timestamp ?? '2026-04-07T00:00:00.000Z',
    count: measurements.length,
    measurements,
  };
}

function createEndpoints(channelMeasurements: ReturnType<typeof vi.fn>): ApiEndpoints {
  return {
    getChannelMeasurements: channelMeasurements,
    getSensorMeasurements: vi.fn(),
    getConsumption: vi.fn().mockResolvedValue({
      channel: 'main',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-07T00:00:00.000Z',
      results: [],
    }),
    getDemandPeaks: vi.fn().mockResolvedValue({
      channel: 'main',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-07T00:00:00.000Z',
      results: [],
    }),
    getElectricalHealth: vi.fn().mockResolvedValue({
      channel: 'main',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-07T00:00:00.000Z',
      results: [],
    }),
    getHourlyProfile: vi.fn().mockResolvedValue({
      channel: 'main',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-07T00:00:00.000Z',
      results: [],
    }),
    getCurrentBySensor: vi.fn().mockResolvedValue({
      channel: 'main',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-07T00:00:00.000Z',
      results: [],
    }),
  };
}

describe('integration: data flow', () => {
  it('flows from ApiClient to CacheManager to transformer output', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          responseFor([
            {
              channel: 'main',
              sensor: 'freezer',
              apparent_power: 12,
              active_power: 12,
              reactive_power: 1,
              power_factor: 0.95,
              current: 5,
              voltage: 220,
              timestamp: '2026-04-07T00:00:00.000Z',
            },
          ]),
        ),
        { status: 200 },
      ),
    );
    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      fetchFn,
      retryDelaysMs: [],
    });
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({ storage });
    const response = await client.get<ChannelMeasurementsResponse>('/main');

    cacheManager.set(getMeasurementCacheKey('main'), response.measurements);

    expect(
      transformToFreezerEnergy(
        cacheManager.get<ChannelMeasurementsResponse['measurements']>(getMeasurementCacheKey('main'))
          ?.data ?? [],
        {
        freezerSensors: ['freezer'],
        equipmentSensors: [],
        },
      ),
    ).toBe(12);
  });

  it('populates the cache on a cold start with only a recent raw slice', async () => {
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({ storage });
    const endpoints = createEndpoints(
      vi
        .fn()
        .mockResolvedValueOnce(
          responseFor([
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
        ),
    );
    const syncStrategy = new SyncStrategy({
      cacheManager,
      endpoints,
      now: () => new Date('2026-04-07T00:00:00.000Z'),
      measurementCacheWindowHours: 1,
    });

    await syncStrategy.coldStart('main');

    expect(cacheManager.get(getMeasurementCacheKey('main'))?.data).toHaveLength(1);
  });

  it('merges new data during delta sync without losing cached measurements', async () => {
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
    const endpoints = createEndpoints(
      vi.fn().mockResolvedValue(
        responseFor([
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
            apparent_power: 7,
            active_power: 7,
            reactive_power: 1,
            power_factor: 0.95,
            current: 3,
            voltage: 219,
            timestamp: '2026-04-07T00:01:00.000Z',
          },
        ]),
      ),
    );
    const syncStrategy = new SyncStrategy({
      cacheManager,
      endpoints,
      now: () => new Date('2026-04-07T00:02:00.000Z'),
    });

    await syncStrategy.syncDelta('main');

    expect(cacheManager.get(getMeasurementCacheKey('main'))?.data).toHaveLength(2);
  });

  it('keeps operating with the latest available API measurement when recent data is missing', async () => {
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
    const channelMeasurements = vi
      .fn()
      .mockResolvedValueOnce(emptyWindowFixture)
      .mockResolvedValueOnce(emptyWindowFixture)
      .mockResolvedValueOnce(
        responseFor([
          {
            channel: 'main',
            sensor: 'freezer',
            apparent_power: 11,
            active_power: 11,
            reactive_power: 1,
            power_factor: 0.95,
            current: 5,
            voltage: 220,
            timestamp: '2026-03-15T12:00:00.000Z',
          },
        ]),
      );
    const endpoints = createEndpoints(channelMeasurements);
    const syncStrategy = new SyncStrategy({
      cacheManager,
      endpoints,
      now: () => new Date('2026-04-07T12:00:00.000Z'),
      staleFallbackProbeOffsetsDays: [1, 30],
    });

    await syncStrategy.syncDelta('main');

    expect(
      transformToFreezerEnergy(
        cacheManager.get<ChannelMeasurementsResponse['measurements']>(getMeasurementCacheKey('main'))
          ?.data ?? [],
        {
          freezerSensors: ['freezer'],
          equipmentSensors: [],
        },
      ),
    ).toBe(11);
    expect(
      cacheManager.get<MeasurementSyncState>(getMeasurementSyncStateCacheKey('main'))?.data,
    ).toMatchObject({
      status: 'fallback_stale',
      dataSource: 'api',
      latestMeasurementAt: '2026-03-15T12:00:00.000Z',
    });
  });
});
