import type { BackupChannelSnapshot } from '@/domain/types';
import type { OperationalHistoryCachePayload } from '@/domain/types';
import { CacheManager } from '@/services/cache/cacheManager';
import {
  getMeasurementCacheKey,
  getMeasurementSyncStateCacheKey,
  getOperationalHistoryCacheKey,
} from '@/services/cache/cacheKeys';
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

function createHistoryResponse(days: 7 | 30) {
  const samples = Array.from({ length: days }, (_, index) => {
    const date = new Date(2026, 3, 10 - (days - 1 - index), 18, 0, 0, 0);
    const dateKey = [
      String(date.getFullYear()).padStart(4, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    const measurementAt = `${dateKey}T18:57:07`;

    return {
      date: dateKey,
      measurementAt,
      measurements: [
        {
          channel: 'lab',
          sensor: 'fase1',
          apparent_power: 7,
          active_power: 7 + index,
          reactive_power: 1,
          power_factor: 0.95,
          current: 0.09,
          voltage: 127,
          timestamp: measurementAt,
        },
        {
          channel: 'lab',
          sensor: 'fase2',
          apparent_power: 4,
          active_power: 4 + index,
          reactive_power: 1,
          power_factor: 0.95,
          current: 0.05,
          voltage: 128,
          timestamp: measurementAt,
        },
        {
          channel: 'lab',
          sensor: 'fase3',
          apparent_power: 8,
          active_power: 8 + index,
          reactive_power: 1,
          power_factor: 0.95,
          current: 0.07,
          voltage: 129,
          timestamp: measurementAt,
        },
      ],
    };
  });

  return {
    channel: 'lab',
    days,
    resolution: 'day' as const,
    checkedAt: '2026-04-10T09:42:30.000Z',
    samples,
    message: `Historico diario atualizado com dados reais em ${days} de ${days} dias.`,
  };
}

describe('SyncStrategy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates the cold start from the renewable bootstrap snapshot', async () => {
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({ storage });
    const runtimeEndpoints = createRuntimeEndpoints();
    const bundledSnapshot = createBackupSnapshot();
    const renewedSnapshot = {
      ...createBackupSnapshot(),
      generatedAt: '2026-04-10T09:45:00.000Z',
      source: 'runtime-refresh',
    };

    vi.mocked(runtimeEndpoints.getBootstrapSnapshot).mockResolvedValue({
      channel: 'lab',
      snapshot: renewedSnapshot,
      snapshotStatus: 'renewed',
      snapshotGeneratedAt: renewedSnapshot.generatedAt,
      snapshotSource: renewedSnapshot.source,
      latestMeasurementAt: renewedSnapshot.latestMeasurementAt,
      refreshAttemptedAt: '2026-04-10T09:45:00.000Z',
      refreshFinishedAt: '2026-04-10T09:45:03.000Z',
      refreshDurationMs: 3000,
      refreshError: null,
      snapshotAgeHours: 240,
      isSnapshotFreshEnough: false,
      message: 'Backup renovado a partir da API.',
    });

    const progress: number[] = [];
    const syncStrategy = new SyncStrategy({
      cacheManager,
      runtimeEndpoints,
      backupSnapshotLoader: async () => bundledSnapshot,
      now: () => new Date('2026-04-10T09:46:00.000Z'),
    });

    await syncStrategy.coldStart('lab', (value) => {
      progress.push(value);
    });

    expect(runtimeEndpoints.getBootstrapSnapshot).toHaveBeenCalledWith('lab');
    expect(cacheManager.get(getMeasurementCacheKey('lab'))?.data).toHaveLength(3);
    expect(
      cacheManager.get<MeasurementSyncState>(getMeasurementSyncStateCacheKey('lab'))?.data,
    ).toMatchObject({
      status: 'backup',
      dataSource: 'backup',
      latestMeasurementAt: '2026-03-31T10:24:17',
      backupSnapshotGeneratedAt: '2026-04-10T09:45:00.000Z',
      backupSnapshotStatus: 'renewed',
      backupRefreshDurationMs: 3000,
      backupSnapshotAgeHours: 240,
      message: 'Backup renovado a partir da API.',
    });
    expect(progress).toEqual([0, 35, 100]);
  });

  it('merges the recent delta into the backup baseline and promotes the source to hybrid', async () => {
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
          sensor: 'fase1',
          apparent_power: 7,
          active_power: 7,
          reactive_power: 1,
          power_factor: 0.95,
          current: 0.09,
          voltage: 127,
          timestamp: '2026-04-10T09:42:07',
        },
        {
          channel: 'lab',
          sensor: 'fase2',
          apparent_power: 4,
          active_power: 4,
          reactive_power: 1,
          power_factor: 0.95,
          current: 0.05,
          voltage: 128,
          timestamp: '2026-04-10T09:42:07',
        },
        {
          channel: 'lab',
          sensor: 'fase3',
          apparent_power: 8,
          active_power: 8,
          reactive_power: 1,
          power_factor: 0.95,
          current: 0.07,
          voltage: 129,
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
    vi.mocked(runtimeEndpoints.getHistory)
      .mockResolvedValueOnce(createHistoryResponse(7))
      .mockResolvedValueOnce(createHistoryResponse(30));

    const syncStrategy = new SyncStrategy({
      cacheManager,
      runtimeEndpoints,
      backupSnapshotLoader: async () => snapshot,
      now: () => new Date('2026-04-10T09:42:30'),
    });

    await syncStrategy.coldStart('lab');
    await syncStrategy.syncDelta('lab');

    expect(runtimeEndpoints.getRecentMeasurements).toHaveBeenCalledWith('lab', {
      lastKnownAt: '2026-03-31T10:24:17',
      shouldProbe: true,
    });
    expect(runtimeEndpoints.getHistory).toHaveBeenNthCalledWith(1, 'lab', 7);
    expect(runtimeEndpoints.getHistory).toHaveBeenNthCalledWith(2, 'lab', 30);
    expect(cacheManager.get(getMeasurementCacheKey('lab'))?.data).toHaveLength(3);
    expect(
      cacheManager.get<MeasurementSyncState>(getMeasurementSyncStateCacheKey('lab'))?.data,
    ).toMatchObject({
      status: 'fresh',
      dataSource: 'hybrid',
      latestMeasurementAt: '2026-04-10T09:42:07',
      recentAnchorAt: '2026-04-10T09:42:07',
      recentWindowFrom: '2026-04-10T09:12:07',
      recentWindowTo: '2026-04-10T09:42:07',
      backupSnapshotGeneratedAt: '2026-04-10T09:41:00.000Z',
      backupSnapshotStatus: 'renewed',
    });
    expect(
      cacheManager.get(getOperationalHistoryCacheKey('lab', '24h'))?.data,
    ).toMatchObject({
      anchorMeasurementAt: '2026-04-10T09:42:07',
    });
    expect(
      cacheManager.get<OperationalHistoryCachePayload>(
        getOperationalHistoryCacheKey('lab', '7d'),
      )?.data.points,
    ).toHaveLength(7);
    expect(
      cacheManager.get<OperationalHistoryCachePayload>(
        getOperationalHistoryCacheKey('lab', '30d'),
      )?.data.points,
    ).toHaveLength(30);
  });

  it('keeps the backup baseline alive when no recent measurements are found', async () => {
    const storage = createMemoryStorage();
    const cacheManager = new CacheManager({ storage });
    const runtimeEndpoints = createRuntimeEndpoints();
    const snapshot = createBackupSnapshot();

    vi.mocked(runtimeEndpoints.getBootstrapSnapshot).mockResolvedValue({
      channel: 'lab',
      snapshot,
      snapshotStatus: 'bundled',
      snapshotGeneratedAt: snapshot.generatedAt,
      snapshotSource: snapshot.source,
      latestMeasurementAt: snapshot.latestMeasurementAt,
      refreshAttemptedAt: '2026-04-10T09:42:00.000Z',
      refreshFinishedAt: '2026-04-10T09:42:02.000Z',
      refreshDurationMs: 2000,
      refreshError: 'This operation was aborted',
      snapshotAgeHours: 240,
      isSnapshotFreshEnough: false,
      message: 'Snapshot empacotado carregado.',
    });
    vi.mocked(runtimeEndpoints.getRecentMeasurements).mockResolvedValue({
      channel: 'lab',
      measurements: [],
      anchorAt: '2026-03-31T10:24:17',
      checkedAt: '2026-04-10T09:42:30.000Z',
      probeWindow: null,
      source: 'empty',
      message: 'Sem dados novos nas ultimas 72 horas.',
    });
    vi.mocked(runtimeEndpoints.getHistory)
      .mockResolvedValueOnce(createHistoryResponse(7))
      .mockResolvedValueOnce(createHistoryResponse(30));

    const syncStrategy = new SyncStrategy({
      cacheManager,
      runtimeEndpoints,
      backupSnapshotLoader: async () => snapshot,
      now: () => new Date('2026-04-10T09:42:30'),
    });

    await syncStrategy.coldStart('lab');
    await syncStrategy.syncDelta('lab');

    expect(
      cacheManager.get<MeasurementSyncState>(getMeasurementSyncStateCacheKey('lab'))?.data,
    ).toMatchObject({
      status: 'fallback_stale',
      dataSource: 'backup',
      latestMeasurementAt: '2026-03-31T10:24:17',
      lastFallbackCheckAt: '2026-04-10T09:42:30.000Z',
      backupSnapshotStatus: 'bundled',
      backupRefreshError: 'This operation was aborted',
      message: 'Sem dados novos nas ultimas 72 horas.',
    });
    expect(
      cacheManager.get<OperationalHistoryCachePayload>(
        getOperationalHistoryCacheKey('lab', '7d'),
      )?.data.points,
    ).toHaveLength(7);
    expect(
      cacheManager.get<OperationalHistoryCachePayload>(
        getOperationalHistoryCacheKey('lab', '30d'),
      )?.data.points,
    ).toHaveLength(30);
  });
});
