import { TARIFFS } from '@/domain/constants/tariffs';
import {
  calculateEnergyCost,
  calculateMargin,
  calculateRevenue,
  getMonthlyAggregation,
  projectMonthly,
} from '@/domain/transformers/financialTransformer';
import type { ApiMeasurement } from '@/domain/types';

describe('financialTransformer', () => {
  it('calculates energy cost for the provided hourly breakdown', () => {
    expect(
      calculateEnergyCost(
        100,
        [{ hour: 18, kwh: 100 }],
        [...TARIFFS],
      ),
    ).toBe(85);
  });

  it('calculates revenue from energy processed', () => {
    expect(calculateRevenue(1000, 8.5)).toBe(8500);
  });

  it('calculates operational margin', () => {
    expect(calculateMargin(8500, 650)).toBe(92.35);
  });

  it('projects the monthly total linearly', () => {
    expect(projectMonthly(5000, 15, 30)).toBe(10000);
  });

  it('aggregates measurements by month', () => {
    const measurements: ApiMeasurement[] = [
      {
        channel: 'main',
        sensor: 'freezer',
        apparent_power: 10,
        active_power: 10,
        reactive_power: 1,
        power_factor: 0.95,
        current: 5,
        voltage: 220,
        timestamp: '2026-03-01T00:00:00',
      },
      {
        channel: 'main',
        sensor: 'freezer',
        apparent_power: 10,
        active_power: 10,
        reactive_power: 1,
        power_factor: 0.95,
        current: 5,
        voltage: 220,
        timestamp: '2026-03-01T01:00:00',
      },
    ];

    expect(getMonthlyAggregation(measurements, 1)[0]).toMatchObject({
      month: 'mar/26',
      totalKwh: 20,
    });
  });
});
