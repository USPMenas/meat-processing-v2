import { DEFAULT_OCCUPANCY_CONFIG } from '@/domain/constants/dashboard';
import {
  deriveOccupancy,
  getOccupancyTimeSeries,
} from '@/domain/transformers/occupancyTransformer';
import type { ApiMeasurement } from '@/domain/types';

const measurements: ApiMeasurement[] = [
  {
    channel: 'main',
    sensor: 'fase3',
    apparent_power: 10,
    active_power: 10,
    reactive_power: 1,
    power_factor: 0.95,
    current: 5,
    voltage: 220,
    timestamp: '2026-04-07T10:00:00',
  },
  {
    channel: 'main',
    sensor: 'fase1',
    apparent_power: 8,
    active_power: 8,
    reactive_power: 1,
    power_factor: 0.95,
    current: 2,
    voltage: 220,
    timestamp: '2026-04-07T10:00:00',
  },
];

describe('occupancyTransformer', () => {
  it('derives deterministic occupancy from current', () => {
    expect(deriveOccupancy(5, { ...DEFAULT_OCCUPANCY_CONFIG })).toBe(100);
  });

  it('builds a deterministic occupancy time series', () => {
    expect(getOccupancyTimeSeries(measurements, { ...DEFAULT_OCCUPANCY_CONFIG })).toEqual([
      {
        timestamp: new Date(2026, 3, 7, 10, 0, 0),
        occupancy: 100,
      },
    ]);
  });
});
