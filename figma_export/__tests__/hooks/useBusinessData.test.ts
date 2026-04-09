import { renderHook, waitFor } from '@testing-library/react';
import { useBusinessData } from '@/hooks/useBusinessData';
import { cacheManager } from '@/services/cache/cacheManager';
import {
  getMeasurementCacheKey,
  getMeasurementSyncStateCacheKey,
  getOperationalHistoryCacheKey,
} from '@/services/cache/cacheKeys';

function buildHistoryPoints(period: '24h' | '7d' | '30d') {
  if (period === '24h') {
    return Array.from({ length: 24 }, (_, index) => ({
      freezerEnergy: 3,
      equipmentEnergy: 5,
      temperature: -18 + (index % 2) * 0.2,
      occupancy: 60 + index,
      timestamp: `2026-03-31T${String(index).padStart(2, '0')}:00:00`,
    }));
  }

  const days = period === '7d' ? 7 : 30;

  return Array.from({ length: days }, (_, index) => ({
    freezerEnergy: 4,
    equipmentEnergy: 6,
    temperature: -18 + (index % 3) * 0.1,
    occupancy: 64 + (index % 5),
    timestamp: `2026-03-${String(index + 1).padStart(2, '0')}T12:00:00`,
  }));
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
        timestamp: '2026-03-31T23:00:00',
      },
    ]);
    cacheManager.set(getMeasurementSyncStateCacheKey('lab'), {
      channel: 'lab',
      status: 'synced',
      dataSource: 'backup',
      latestMeasurementAt: '2026-03-31T23:00:00',
      lastFallbackCheckAt: '2026-04-08T12:00:00.000Z',
      lastApiAttemptAt: '2026-04-08T12:00:00.000Z',
      lastSuccessfulApiSyncAt: '2026-04-08T12:00:00.000Z',
      backupSnapshotGeneratedAt: '2026-04-08T12:00:00.000Z',
      message: 'backup',
    });

    (['24h', '7d', '30d'] as const).forEach((period) => {
      cacheManager.set(getOperationalHistoryCacheKey('lab', period), {
        anchorMeasurementAt: '2026-03-31T23:00:00',
        period,
        points: buildHistoryPoints(period),
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cacheManager.clearAll();
  });

  it('returns hourly business timelines for 24h using the same business model as the UI', async () => {
    const { result } = renderHook(() => useBusinessData('lab', '24h'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.timelineGranularity).toBe('hour');
    expect(result.current.timeline).toHaveLength(24);
    expect(result.current.assumptions.employeeCount).toBe(4);
    expect(result.current.estimatedProcessedKg).toBeGreaterThan(0);
    expect(result.current.currentRevenue).toBeGreaterThan(0);
    expect(result.current.totalCosts).toBeGreaterThan(result.current.energyCost);
    expect(result.current.hourlyAverages).toHaveLength(24);
  });

  it('returns daily business timelines for 7d and keeps bucket sums aligned with the aggregated KPIs', async () => {
    const { result } = renderHook(() => useBusinessData('lab', '7d'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const timelineRevenue = result.current.timeline.reduce(
      (total, entry) => total + entry.grossRevenue,
      0,
    );
    const timelineCosts = result.current.timeline.reduce(
      (total, entry) => total + entry.totalCosts,
      0,
    );

    expect(result.current.timelineGranularity).toBe('day');
    expect(result.current.timeline).toHaveLength(7);
    expect(result.current.dailyData).toHaveLength(7);
    expect(timelineRevenue).toBeCloseTo(result.current.currentRevenue, 2);
    expect(timelineCosts).toBeCloseTo(result.current.totalCosts, 2);
  });

  it('keeps the same model working for 30d snapshots without depending on live API analytics', async () => {
    const { result } = renderHook(() => useBusinessData('lab', '30d'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.timelineGranularity).toBe('day');
    expect(result.current.timeline).toHaveLength(30);
    expect(result.current.monthlyComparison.length).toBeGreaterThanOrEqual(1);
    expect(result.current.costBreakdown.payroll).toBeGreaterThan(0);
    expect(result.current.costBreakdown.total).toBeCloseTo(result.current.totalCosts, 2);
  });
});
