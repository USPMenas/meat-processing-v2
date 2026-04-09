import { DEFAULT_TEMPERATURE_CONFIG } from '@/domain/constants/dashboard';
import {
  deriveTemperature,
  getTemperatureTimeSeries,
} from '@/domain/transformers/temperatureTransformer';
import type { ApiMeasurement } from '@/domain/types';

const measurements: ApiMeasurement[] = [
  {
    channel: 'main',
    sensor: 'fase3',
    apparent_power: 15,
    active_power: 15,
    reactive_power: 1,
    power_factor: 0.95,
    current: 5,
    voltage: 220,
    timestamp: '2026-04-07T10:00:00',
  },
  {
    channel: 'main',
    sensor: 'fase1',
    apparent_power: 3,
    active_power: 3,
    reactive_power: 1,
    power_factor: 0.95,
    current: 2,
    voltage: 220,
    timestamp: '2026-04-07T10:00:00',
  },
];

describe('temperatureTransformer', () => {
  it('derives a deterministic freezer temperature from power', () => {
    expect(deriveTemperature(15, { ...DEFAULT_TEMPERATURE_CONFIG })).toBe(-14.2);
  });

  it('builds a deterministic temperature time series', () => {
    expect(getTemperatureTimeSeries(measurements, { ...DEFAULT_TEMPERATURE_CONFIG })).toEqual([
      {
        timestamp: new Date(2026, 3, 7, 10, 0, 0),
        temperature: -14.2,
      },
    ]);
  });
});
