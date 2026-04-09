import { renderHook, waitFor } from '@testing-library/react';
import { useLogisticsData } from '@/hooks/useLogisticsData';
import { cacheManager } from '@/services/cache/cacheManager';
import {
  getAnalyticsCacheKey,
  getMeasurementCacheKey,
  getMeasurementSyncStateCacheKey,
  getOperationalHistoryCacheKey,
} from '@/services/cache/cacheKeys';

function getTotalEnergyForHour(hour: number): number {
  if (hour >= 8 && hour < 18) {
    return 20;
  }

  if (hour >= 22 || hour < 6) {
    return 12;
  }

  return 14;
}

function getOccupancyForHour(hour: number): number {
  if (hour === 8) {
    return 92;
  }

  if (hour >= 8 && hour < 18) {
    return 76;
  }

  return 35;
}

function buildOperationalHistoryPoints() {
  return Array.from({ length: 24 }, (_, hour) => {
    const timestamp = `2026-03-31T${String(hour).padStart(2, '0')}:00:00`;
    const totalEnergy = getTotalEnergyForHour(hour);
    const freezerEnergy = hour >= 8 && hour < 18 ? 7 : 6;

    return {
      freezerEnergy,
      equipmentEnergy: totalEnergy - freezerEnergy,
      temperature: -18 + (hour >= 8 && hour < 18 ? 1 : 0),
      occupancy: getOccupancyForHour(hour),
      timestamp,
    };
  });
}

function buildHourlyProfileResults() {
  return Array.from({ length: 24 }, (_, hour) => {
    const totalEnergy = getTotalEnergyForHour(hour);
    const phase1 = hour >= 8 && hour < 18 ? 8 : hour >= 22 || hour < 6 ? 5 : 6;
    const phase2 = hour >= 8 && hour < 18 ? 5 : hour >= 22 || hour < 6 ? 1 : 2;
    const phase3 = totalEnergy - phase1 - phase2;

    return [
      {
        hour: String(hour).padStart(2, '0'),
        sensor: 'fase1',
        avg_power_kw: phase1,
      },
      {
        hour: String(hour).padStart(2, '0'),
        sensor: 'fase2',
        avg_power_kw: phase2,
      },
      {
        hour: String(hour).padStart(2, '0'),
        sensor: 'fase3',
        avg_power_kw: phase3,
      },
    ];
  }).flat();
}

describe('useLogisticsData', () => {
  beforeEach(() => {
    cacheManager.clearAll();
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 3, 8, 9, 0, 0).getTime());

    cacheManager.set(getMeasurementCacheKey('lab'), [
      {
        channel: 'lab',
        sensor: 'fase3',
        apparent_power: 6,
        active_power: 6,
        reactive_power: 1,
        power_factor: 0.95,
        current: 0.07,
        voltage: 127,
        timestamp: '2026-03-31T23:00:00',
      },
    ]);
    cacheManager.set(getMeasurementSyncStateCacheKey('lab'), {
      channel: 'lab',
      status: 'fallback_stale',
      dataSource: 'api',
      latestMeasurementAt: '2026-03-31T23:00:00',
      lastFallbackCheckAt: '2026-04-08T09:00:00.000Z',
      lastApiAttemptAt: '2026-04-08T09:00:00.000Z',
      lastSuccessfulApiSyncAt: '2026-04-08T09:00:00.000Z',
      backupSnapshotGeneratedAt: null,
      message: 'stale',
    });
    cacheManager.set(getOperationalHistoryCacheKey('lab', '24h'), {
      anchorMeasurementAt: '2026-03-31T23:00:00',
      period: '24h',
      points: buildOperationalHistoryPoints(),
    });
    cacheManager.set(getAnalyticsCacheKey('lab', 'hourly_profile'), {
      channel: 'lab',
      from: '2026-03-30T00:00:00',
      to: '2026-03-31T23:00:00',
      results: buildHourlyProfileResults(),
    });
    cacheManager.set(getAnalyticsCacheKey('lab', 'current_by_sensor'), {
      channel: 'lab',
      from: '2026-03-30T00:00:00',
      to: '2026-03-31T23:00:00',
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

  it('calculates the logistics KPIs from cached data', async () => {
    const { result } = renderHook(() => useLogisticsData('lab', '24h'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.avgEnergy24h).toBeCloseTo(15.8, 1);
    expect(result.current.peakOccupancy).toBe(92);
    expect(result.current.lowEnergyHours).toBe(8);
    expect(result.current.nextIdealHour).toBe(22);
    expect(result.current.hourlyData).toHaveLength(24);
    expect(result.current.hourlyData[8]?.avgEnergy).toBeCloseTo(20, 1);
    expect(result.current.occupancyForecast).toHaveLength(24);
    expect(result.current.periodSeries).toHaveLength(24);
  });
});
