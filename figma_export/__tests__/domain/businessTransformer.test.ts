import { BUSINESS_MODEL_ASSUMPTIONS } from '@/domain/constants/financial';
import {
  buildBusinessSummary,
  buildBusinessTimeline,
  buildDailyBusinessData,
  buildMonthlyComparison,
  generateBusinessInsights,
  getBusinessPeriodShare,
} from '@/domain/transformers/businessTransformer';
import type { HourlyAvgEntry, OperationalData } from '@/domain/types';

function buildOperationalSeries(): OperationalData[] {
  return [
    {
      freezerEnergy: 100,
      equipmentEnergy: 140,
      temperature: -18,
      occupancy: 72,
      timestamp: new Date('2026-03-31T12:00:00'),
    },
  ];
}

function buildHourlyAverages(): HourlyAvgEntry[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    avgEnergy: hour === 12 ? 240 : 0,
    avgOccupancy: hour === 12 ? 72 : 0,
    tariff: hour >= 22 || hour < 6 ? 0.5 : hour >= 18 && hour < 21 ? 0.85 : 0.65,
  }));
}

describe('businessTransformer', () => {
  it('converts 240 kWh into 100 kg processed and calculates revenue and losses correctly', () => {
    const { timeline } = buildBusinessTimeline({
      operationalSeries: buildOperationalSeries(),
      period: '24h',
      referenceDate: new Date('2026-03-31T12:00:00'),
    });
    const activeBucket = timeline.find((entry) => entry.totalKwh > 0);

    expect(activeBucket).toBeDefined();
    expect(activeBucket?.totalKwh).toBeCloseTo(240, 2);
    expect(activeBucket?.processedKg).toBeCloseTo(100, 2);
    expect(activeBucket?.grossRevenue).toBeCloseTo(1600, 2);
    expect(activeBucket?.lostMerchandiseCost).toBeCloseTo(55, 2);
  });

  it('applies the correct period share for 24h, 7d and 30d windows', () => {
    expect(getBusinessPeriodShare('24h')).toBeCloseTo(1 / 30, 5);
    expect(getBusinessPeriodShare('7d')).toBeCloseTo(7 / 30, 5);
    expect(getBusinessPeriodShare('30d')).toBe(1);
  });

  it('builds business summaries with hourly granularity for 24h and daily granularity for 7d', () => {
    const hourlyTimeline = buildBusinessTimeline({
      operationalSeries: buildOperationalSeries(),
      period: '24h',
      referenceDate: new Date('2026-03-31T12:00:00'),
    });
    const hourlyDailyData = buildDailyBusinessData(hourlyTimeline.timeline, hourlyTimeline.granularity);
    const hourlySummary = buildBusinessSummary({
      timeline: hourlyTimeline.timeline,
      timelineGranularity: hourlyTimeline.granularity,
      dailyData: hourlyDailyData,
      monthlyComparison: buildMonthlyComparison(hourlyDailyData, 2),
      hourlyAverages: buildHourlyAverages(),
      referenceDate: new Date('2026-03-31T12:00:00'),
      period: '24h',
    });

    const dailyTimeline = buildBusinessTimeline({
      operationalSeries: buildOperationalSeries(),
      period: '7d',
      referenceDate: new Date('2026-03-31T12:00:00'),
    });

    expect(hourlySummary.timelineGranularity).toBe('hour');
    expect(hourlySummary.estimatedProcessedKg).toBeCloseTo(100, 2);
    expect(hourlySummary.assumptions.employeeCount).toBe(4);
    expect(dailyTimeline.granularity).toBe('day');
    expect(dailyTimeline.timeline).toHaveLength(7);
  });

  it('generates managerial insights from the new business model', () => {
    const { timeline, granularity } = buildBusinessTimeline({
      operationalSeries: buildOperationalSeries(),
      period: '24h',
      referenceDate: new Date('2026-03-31T12:00:00'),
      assumptions: BUSINESS_MODEL_ASSUMPTIONS,
    });
    const dailyData = buildDailyBusinessData(timeline, granularity);
    const summary = buildBusinessSummary({
      timeline,
      timelineGranularity: granularity,
      dailyData,
      monthlyComparison: buildMonthlyComparison(dailyData, 2),
      hourlyAverages: buildHourlyAverages(),
      referenceDate: new Date('2026-03-31T12:00:00'),
      period: '24h',
    });
    const insights = generateBusinessInsights(summary);

    expect(insights[0]?.title).toMatch(/Margem/i);
    expect(insights[1]?.title).toMatch(/Maior pressao de custo/i);
  });
});
