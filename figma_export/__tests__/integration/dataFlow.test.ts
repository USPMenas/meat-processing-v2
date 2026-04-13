import { transformToFreezerEnergy } from '@/domain/transformers/energyTransformer';
import type { BackupChannelSnapshot } from '@/domain/types';
import { ApiClient } from '@/services/api/client';
import type { ChannelMeasurementsResponse } from '@/services/api/types';
import { CacheManager } from '@/services/cache/cacheManager';
import { getMeasurementCacheKey, getMeasurementSyncStateCacheKey } from '@/services/cache/cacheKeys';
import { SyncStrategy } from '@/services/cache/syncStrategy';
import type { MeasurementSyncState } from '@/services/cache/types';
import type { RuntimeEndpoints } from '@/services/runtime/endpoints';

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

function responseFor(
  measurements: ChannelMeasurementsResponse['measurements'],
): ChannelMeasurementsResponse {
  return {
    channel: 'lab',
    from: measurements[0]?.timestamp ?? '2026-04-10T09:00:00',
    to: measurements[measurements.length - 1]?.timestamp ?? '2026-04-10T09:00:00',
    count: measurements.length,
    measurements,
  };
}

function createBackupSnapshot(channel = 'lab'): BackupChannelSnapshot {
  return {
    channel,
    generatedAt: '2026-04-10T09:41:00.000Z',
    source: 'backup_2026-04-10.db',
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

function createRuntimeEndpoints(): RuntimeEndpoints {
  return {
    getBootstrapSnapshot: vi.fn(),
    getRecentMeasurements: vi.fn(),
    getHistory: vi.fn(),
  };
}

describe('integration: data flow', () => {
  it('builds internal URLs correctly and returns parsed JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          responseFor([
            {
              channel: 'lab',
              sensor: 'fase3',
              apparent_power: 12,
              active_power: 12,
              reactive_power: 1,
              power_factor: 0.95,
              current: 5,
              voltage: 220,
              timestamp: '2026-04-10T09:42:07',
            },
          ]),
        ),
        { status: 200 },
      ),
    );
    const client = new ApiClient({
      baseUrl: '/internal/',
      fetchFn,
      retryDelaysMs: [],
    });

    const response = await client.get<ChannelMeasurementsResponse>('/recent/lab');

    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('/internal/recent/lab'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(response.measurements).toHaveLength(1);
  });

  it('flows from the hybrid sync layer into cache-backed transformers', async () => {
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({ storage });
    const runtimeEndpoints = createRuntimeEndpoints();
    const snapshot = createBackupSnapshot();

    vi.mocked(runtimeEndpoints.getBootstrapSnapshot).mockResolvedValue({
      channel: 'lab',
      snapshot,
      snapshotStatus: 'renewed',
      snapshotGeneratedAt: snapshot.generatedAt,
      snapshotSource: snapshot.source,
      latestMeasurementAt: snapshot.latestMeasurementAt,
      refreshAttemptedAt: '2026-04-10T09:41:00.000Z',
      refreshFinishedAt: '2026-04-10T09:41:04.000Z',
      refreshDurationMs: 4000,
      refreshError: null,
      snapshotAgeHours: 240,
      isSnapshotFreshEnough: false,
      message: 'Backup renovado a partir da API.',
    });
    vi.mocked(runtimeEndpoints.getRecentMeasurements).mockResolvedValue({
      channel: 'lab',
      measurements: [
        {
          channel: 'lab',
          sensor: 'fase3',
          apparent_power: 15,
          active_power: 15,
          reactive_power: 1,
          power_factor: 0.95,
          current: 5,
          voltage: 220,
          timestamp: '2026-04-10T09:42:07',
        },
      ],
      anchorAt: '2026-04-10T09:42:07',
      checkedAt: '2026-04-10T09:42:30.000Z',
      probeWindow: {
        from: '2026-04-10T09:12:07',
        to: '2026-04-10T09:42:07',
      },
      source: 'recent_window',
      message: 'Dados recentes encontrados em 2026-04-10T09:42:07.',
    });
    vi.mocked(runtimeEndpoints.getHistory).mockImplementation(async (_channel, days) => ({
      channel: 'lab',
      days,
      resolution: 'day',
      checkedAt: '2026-04-10T09:42:30.000Z',
      samples: [],
      message: `Nenhuma amostra diaria foi encontrada nos ultimos ${days} dias.`,
    }));

    const syncStrategy = new SyncStrategy({
      cacheManager,
      runtimeEndpoints,
      backupSnapshotLoader: async () => snapshot,
      now: () => new Date('2026-04-10T09:42:30'),
    });

    await syncStrategy.coldStart('lab');
    await syncStrategy.syncDelta('lab');

    expect(
      transformToFreezerEnergy(
        cacheManager.get<ChannelMeasurementsResponse['measurements']>(
          getMeasurementCacheKey('lab'),
        )?.data ?? [],
        {
          freezerSensors: ['fase3'],
          equipmentSensors: ['fase1', 'fase2'],
        },
      ),
    ).toBe(15);
    expect(
      cacheManager.get<MeasurementSyncState>(getMeasurementSyncStateCacheKey('lab'))?.data,
    ).toMatchObject({
      dataSource: 'hybrid',
      status: 'fresh',
      latestMeasurementAt: '2026-04-10T09:42:07',
    });
  });
});
