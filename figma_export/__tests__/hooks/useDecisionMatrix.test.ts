import { renderHook } from '@testing-library/react';
import { useDecisionMatrix } from '@/hooks/useDecisionMatrix';
import * as businessHooks from '@/hooks/useBusinessData';
import * as logisticsHooks from '@/hooks/useLogisticsData';
import * as realtimeHooks from '@/hooks/useRealtimeData';

describe('useDecisionMatrix', () => {
  beforeEach(() => {
    vi.spyOn(realtimeHooks, 'useRealtimeData').mockReturnValue({
      data: {
        freezerEnergy: 8.1,
        equipmentEnergy: 10.4,
        temperature: -18,
        occupancy: 61,
        timestamp: new Date('2026-04-08T10:00:00.000Z'),
      },
      historical: [],
      prediction: [],
      alerts: [],
      isLoading: false,
      isStale: false,
    });
    vi.spyOn(logisticsHooks, 'useLogisticsData').mockReturnValue({
      avgEnergy24h: 14.2,
      peakOccupancy: 60,
      lowEnergyHours: 8,
      nextIdealHour: 22,
      hourlyData: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        avgEnergy: hour >= 18 && hour < 21 ? 20 : 12,
        avgOccupancy: hour >= 8 && hour < 18 ? 72 : 38,
        tariff: hour >= 18 && hour < 21 ? 0.85 : hour >= 22 || hour < 6 ? 0.5 : 0.65,
      })),
      hourlyProfile: [],
      occupancyForecast: [],
      energyPrices: [],
      periodSeries: [],
      isLoading: false,
      error: null,
    });
    vi.spyOn(businessHooks, 'useBusinessData').mockReturnValue({
      currentRevenue: 92_000,
      projectedRevenue: 110_000,
      energyCost: 6_500,
      projectedEnergyCost: 9_000,
      margin: 31,
      projectedMargin: 29,
      revenueChange: 4,
      costChange: 3,
      estimatedProcessedKg: 5_600,
      totalCosts: 44_000,
      operatingProfit: 48_000,
      costBreakdown: {
        energy: 6_500,
        payroll: 18_000,
        rent: 8_500,
        maintenance: 3_000,
        lostMerchandise: 2_000,
        total: 44_000,
      },
      timeline: [
        {
          key: '1',
          label: '08/04',
          timestamp: new Date('2026-04-08T00:00:00.000Z'),
          totalKwh: 1_000,
          processedKg: 400,
          grossRevenue: 50_000,
          energyCost: 6_500,
          payrollCost: 8_000,
          rentCost: 4_000,
          maintenanceCost: 1_500,
          lostMerchandiseCost: 900,
          totalCosts: 20_900,
          operatingProfit: 29_100,
          margin: 31,
          averageTemperature: -18,
          averageOccupancy: 61,
        },
      ],
      timelineGranularity: 'day',
      assumptions: {
        employeeCount: 4,
        monthlyPayrollCost: 22_000,
        monthlyRentCost: 12_000,
        monthlyMaintenanceCost: 4_500,
        lossRate: 0.05,
        merchandiseCostPerKg: 11,
        kwhPerKgProcessed: 2.4,
        averageSalePricePerKg: 16,
      },
      monthlyComparison: [],
      dailyData: [],
      hourlyAverages: [],
      cumulativeData: [],
      referenceDate: new Date('2026-04-08T10:00:00.000Z'),
      periodSeries: [],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('consolidates the three dashboards into a decision matrix', () => {
    const { result } = renderHook(() =>
      useDecisionMatrix('lab', '24h', {
        isLoading: false,
        isOnline: true,
        isUsingBackup: false,
        dataSource: 'api',
        lastDataTimestamp: new Date('2026-04-08T10:00:00.000Z'),
        error: null,
      }),
    );

    expect(result.current.summary.recommendedAction).toBe('operate_now');
    expect(result.current.rows).toHaveLength(4);
    expect(result.current.sourceStatus.dataSource).toBe('api');
    expect(result.current.signals.energyCostShare).toBeCloseTo(6_500 / 44_000, 3);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns an empty summary when no dashboard has usable data', () => {
    vi.spyOn(realtimeHooks, 'useRealtimeData').mockReturnValue({
      data: null,
      historical: [],
      prediction: [],
      alerts: [],
      isLoading: false,
      isStale: true,
    });
    vi.spyOn(logisticsHooks, 'useLogisticsData').mockReturnValue({
      avgEnergy24h: 0,
      peakOccupancy: 0,
      lowEnergyHours: 8,
      nextIdealHour: null,
      hourlyData: [],
      hourlyProfile: [],
      occupancyForecast: [],
      energyPrices: [],
      periodSeries: [],
      isLoading: false,
      error: 'Sem dados de logística.',
    });
    vi.spyOn(businessHooks, 'useBusinessData').mockReturnValue({
      currentRevenue: 0,
      projectedRevenue: 0,
      energyCost: 0,
      projectedEnergyCost: 0,
      margin: 0,
      projectedMargin: 0,
      revenueChange: 0,
      costChange: 0,
      estimatedProcessedKg: 0,
      totalCosts: 0,
      operatingProfit: 0,
      costBreakdown: {
        energy: 0,
        payroll: 0,
        rent: 0,
        maintenance: 0,
        lostMerchandise: 0,
        total: 0,
      },
      timeline: [],
      timelineGranularity: 'day',
      assumptions: {
        employeeCount: 4,
        monthlyPayrollCost: 22_000,
        monthlyRentCost: 12_000,
        monthlyMaintenanceCost: 4_500,
        lossRate: 0.05,
        merchandiseCostPerKg: 11,
        kwhPerKgProcessed: 2.4,
        averageSalePricePerKg: 16,
      },
      monthlyComparison: [],
      dailyData: [],
      hourlyAverages: [],
      cumulativeData: [],
      referenceDate: null,
      periodSeries: [],
      isLoading: false,
      error: 'Sem dados de negócio.',
    });

    const { result } = renderHook(() =>
      useDecisionMatrix('lab', '24h', {
        isLoading: false,
        isOnline: false,
        isUsingBackup: true,
        dataSource: 'backup',
        lastDataTimestamp: null,
        error: 'Sem dados do twin.',
      }),
    );

    expect(result.current.summary.recommendedAction).toBeNull();
    expect(result.current.error).toBe('Sem dados do twin.');
    expect(result.current.rows).toHaveLength(4);
  });
});
