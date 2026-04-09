import { renderHook, waitFor } from '@testing-library/react';
import { useBusinessData } from '@/hooks/useBusinessData';
import { cacheManager } from '@/services/cache/cacheManager';
import {
  getAnalyticsCacheKey,
  getMeasurementCacheKey,
  getMeasurementSyncStateCacheKey,
  getOperationalHistoryCacheKey,
} from '@/services/cache/cacheKeys';

function buildHourlyProfileResults() {
  return Array.from({ length: 24 }, (_, hour) => [
    {
      hour: String(hour).padStart(2, '0'),
      sensor: 'fase1',
      avg_power_kw: 4,
    },
    {
      hour: String(hour).padStart(2, '0'),
      sensor: 'fase2',
      avg_power_kw: 2,
    },
    {
      hour: String(hour).padStart(2, '0'),
      sensor: 'fase3',
      avg_power_kw: 4,
    },
  ]).flat();
}

describe('useBusinessData', () => {
  beforeEach(() => {
    cacheManager.clearAll();
    cacheManager.set(getMeasurementCacheKey('lab'), [
      {
        channel: 'lab',
        sensor: 'fase3',
        apparent_power: 4,
        active_power: 4,
        reactive_power: 1,
        power_factor: 0.95,
        current: 0.07,
        voltage: 127,
        timestamp: '2026-03-31T12:00:00',
      },
    ]);
    cacheManager.set(getMeasurementSyncStateCacheKey('lab'), {
      channel: 'lab',
      status: 'fallback_stale',
      dataSource: 'api',
      latestMeasurementAt: '2026-03-31T12:00:00',
      lastFallbackCheckAt: '2026-04-08T12:00:00.000Z',
      lastApiAttemptAt: '2026-04-08T12:00:00.000Z',
      lastSuccessfulApiSyncAt: '2026-04-08T12:00:00.000Z',
      backupSnapshotGeneratedAt: null,
      message: 'stale',
    });
    cacheManager.set(getOperationalHistoryCacheKey('lab', '30d'), {
      anchorMeasurementAt: '2026-03-31T12:00:00',
      period: '30d',
      points: [
        {
          freezerEnergy: 4,
          equipmentEnergy: 6,
          temperature: -18,
          occupancy: 65,
          timestamp: '2026-02-27T12:00:00',
        },
        {
          freezerEnergy: 4,
          equipmentEnergy: 6,
          temperature: -18,
          occupancy: 65,
          timestamp: '2026-02-28T12:00:00',
        },
        {
          freezerEnergy: 4,
          equipmentEnergy: 6,
          temperature: -18,
          occupancy: 65,
          timestamp: '2026-03-29T12:00:00',
        },
        {
          freezerEnergy: 4,
          equipmentEnergy: 6,
          temperature: -18,
          occupancy: 65,
          timestamp: '2026-03-30T12:00:00',
        },
        {
          freezerEnergy: 4,
          equipmentEnergy: 6,
          temperature: -18,
          occupancy: 65,
          timestamp: '2026-03-31T12:00:00',
        },
      ],
    });
    cacheManager.set(getAnalyticsCacheKey('lab', 'consumption'), {
      channel: 'lab',
      from: '2026-02-27T00:00:00',
      to: '2026-03-31T23:59:59',
      results: [
        { sensor: 'fase1', total_kwh: 400, min_demand_kw: 2, max_demand_kw: 10 },
        { sensor: 'fase2', total_kwh: 200, min_demand_kw: 1, max_demand_kw: 6 },
        { sensor: 'fase3', total_kwh: 400, min_demand_kw: 2, max_demand_kw: 8 },
      ],
    });
    cacheManager.set(getAnalyticsCacheKey('lab', 'hourly_profile'), {
      channel: 'lab',
      from: '2026-02-27T00:00:00',
      to: '2026-03-31T23:59:59',
      results: buildHourlyProfileResults(),
    });
    cacheManager.set(getAnalyticsCacheKey('lab', 'current_by_sensor'), {
      channel: 'lab',
      from: '2026-02-27T00:00:00',
      to: '2026-03-31T23:59:59',
      results: [
        { sensor: 'fase1', avg_current: 0.07 },
        { sensor: 'fase2', avg_current: 0.04 },
        { sensor: 'fase3', avg_current: 0.07 },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cacheManager.clearAll();
  });

  it('builds monthly comparison and calculates the revenue change from cached history', async () => {
    const { result } = renderHook(() => useBusinessData('lab', '30d'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.monthlyComparison).toHaveLength(2);
    expect(result.current.monthlyComparison[0]?.month).toMatch(/fev/i);
    expect(result.current.monthlyComparison[1]?.month).toMatch(/mar/i);
    expect(result.current.currentRevenue).toBeCloseTo(5100, 0);
    expect(result.current.revenueChange).toBeCloseTo(50, 1);
    expect(result.current.dailyData).toHaveLength(5);
    expect(result.current.hourlyAverages).toHaveLength(24);
    expect(result.current.periodSeries).toHaveLength(5);
  });
});
