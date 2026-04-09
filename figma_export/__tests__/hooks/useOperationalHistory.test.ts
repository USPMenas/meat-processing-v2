import { renderHook, waitFor } from '@testing-library/react';
import { useOperationalHistory } from '@/hooks/useOperationalHistory';
import { cacheManager } from '@/services/cache/cacheManager';
import {
  getMeasurementCacheKey,
  getMeasurementSyncStateCacheKey,
  getOperationalHistoryCacheKey,
} from '@/services/cache/cacheKeys';
import { SyncStrategy } from '@/services/cache/syncStrategy';

describe('useOperationalHistory', () => {
  beforeEach(() => {
    cacheManager.clearAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cacheManager.clearAll();
  });

  it('reads an already cached operational series without triggering a new sync', async () => {
    const syncSpy = vi
      .spyOn(SyncStrategy.prototype, 'syncOperationalHistory')
      .mockResolvedValue(undefined);
    cacheManager.set(getMeasurementCacheKey('lab'), [
      {
        channel: 'lab',
        sensor: 'fase3',
        apparent_power: 10,
        active_power: 10,
        reactive_power: 1,
        power_factor: 0.95,
        current: 0.05,
        voltage: 128,
        timestamp: '2026-03-31T11:40:56',
      },
    ]);
    cacheManager.set(getMeasurementSyncStateCacheKey('lab'), {
      channel: 'lab',
      status: 'fallback_stale',
      dataSource: 'api',
      latestMeasurementAt: '2026-03-31T11:40:56',
      lastFallbackCheckAt: '2026-04-08T12:00:00.000Z',
      lastApiAttemptAt: '2026-04-08T12:00:00.000Z',
      lastSuccessfulApiSyncAt: '2026-04-08T12:00:00.000Z',
      backupSnapshotGeneratedAt: null,
      message: 'stale',
    });
    cacheManager.set(getOperationalHistoryCacheKey('lab', '24h'), {
      anchorMeasurementAt: '2026-03-31T11:40:56',
      period: '24h',
      points: [
        {
          freezerEnergy: 5.8,
          equipmentEnergy: 5.7,
          temperature: -19.2,
          occupancy: 11,
          timestamp: '2026-03-31T11:40:56',
        },
      ],
    });

    const { result } = renderHook(() => useOperationalHistory('lab', '24h'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]?.freezerEnergy).toBe(5.8);
    expect(result.current.lastMeasurementAt?.toISOString()).toContain('2026-03-31');
    expect(syncSpy).not.toHaveBeenCalled();
  });

  it('requests a period sync when the cached timeline is missing', async () => {
    const syncSpy = vi
      .spyOn(SyncStrategy.prototype, 'syncOperationalHistory')
      .mockImplementation(async (channel, period) => {
        cacheManager.set(getOperationalHistoryCacheKey(channel, period), {
          anchorMeasurementAt: '2026-03-31T11:40:56',
          period,
          points: [
            {
              freezerEnergy: 6,
              equipmentEnergy: 4.5,
              temperature: -18.5,
              occupancy: 30,
              timestamp: '2026-03-31T11:40:56',
            },
          ],
        });
      });
    cacheManager.set(getMeasurementCacheKey('lab'), [
      {
        channel: 'lab',
        sensor: 'fase3',
        apparent_power: 10,
        active_power: 10,
        reactive_power: 1,
        power_factor: 0.95,
        current: 0.05,
        voltage: 128,
        timestamp: '2026-03-31T11:40:56',
      },
    ]);
    cacheManager.set(getMeasurementSyncStateCacheKey('lab'), {
      channel: 'lab',
      status: 'fallback_stale',
      dataSource: 'api',
      latestMeasurementAt: '2026-03-31T11:40:56',
      lastFallbackCheckAt: '2026-04-08T12:00:00.000Z',
      lastApiAttemptAt: '2026-04-08T12:00:00.000Z',
      lastSuccessfulApiSyncAt: '2026-04-08T12:00:00.000Z',
      backupSnapshotGeneratedAt: null,
      message: 'stale',
    });

    const { result } = renderHook(() => useOperationalHistory('lab', '7d'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(syncSpy).toHaveBeenCalledWith('lab', '7d');
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]?.temperature).toBe(-18.5);
  });
});
