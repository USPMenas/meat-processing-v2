import { generateBusinessInsights } from '@/domain/transformers/businessTransformer';
import type { BusinessData, DailyEntry, HourlyAvgEntry, MonthlyEntry } from '@/domain/types';

function buildDailyData(): DailyEntry[] {
  return [
    {
      date: '2026-03-29',
      label: '29/03',
      totalKwh: 200,
      averageTemperature: -18,
      averageOccupancy: 70,
      energyCost: 130,
      revenue: 1700,
    },
  ];
}

function buildMonthlyComparison(): MonthlyEntry[] {
  return [
    {
      month: 'fev/26',
      totalKwh: 500,
      energyCost: 300,
      revenue: 4000,
    },
    {
      month: 'mar/26',
      totalKwh: 650,
      energyCost: 420,
      revenue: 4200,
    },
  ];
}

function buildHourlyAverages(): HourlyAvgEntry[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    avgEnergy: hour >= 18 && hour < 21 ? 20 : 10,
    avgOccupancy: hour === 8 ? 82 : 55,
    tariff: hour >= 22 || hour < 6 ? 0.5 : hour >= 18 && hour < 21 ? 0.85 : 0.65,
  }));
}

function buildBusinessData(overrides: Partial<BusinessData> = {}): BusinessData {
  return {
    currentRevenue: 4200,
    projectedRevenue: 8400,
    energyCost: 420,
    projectedEnergyCost: 840,
    margin: 90,
    projectedMargin: 90,
    revenueChange: 5,
    costChange: 2,
    dailyData: buildDailyData(),
    monthlyComparison: buildMonthlyComparison(),
    hourlyAverages: buildHourlyAverages(),
    cumulativeData: [
      {
        day: 29,
        label: '29',
        energyAccum: 130,
        revenueAccum: 1700,
      },
    ],
    referenceDate: new Date('2026-03-29T12:00:00'),
    ...overrides,
  };
}

describe('businessTransformer', () => {
  it('returns the sustainable growth insight when revenue grows faster than cost', () => {
    const insights = generateBusinessInsights(buildBusinessData());

    expect(insights[0]?.title).toMatch(/Crescimento Sustentavel/i);
    expect(insights[0]?.text).toMatch(/5.0%/i);
    expect(insights[0]?.text).toMatch(/2.0%/i);
  });

  it('returns the healthy margin insight when the operation stays above 85%', () => {
    const insights = generateBusinessInsights(buildBusinessData({ margin: 92 }));

    expect(insights[1]?.title).toMatch(/Margem Saudavel/i);
    expect(insights[1]?.text).toMatch(/92.0%/i);
  });
});
