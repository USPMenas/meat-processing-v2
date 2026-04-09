import { DEFAULT_OCCUPANCY_CONFIG, DEFAULT_SENSOR_MAP, DEFAULT_TEMPERATURE_CONFIG } from '@/domain/constants/dashboard';
import {
  buildOperationalSeries,
  buildPredictionSeries,
  getLatestElectricalSnapshot,
} from '@/domain/transformers/operationalSeriesTransformer';
import type { ApiMeasurement } from '@/domain/types';
import labFixture from '../../analise-banco-de-dados/fixtures/channel-lab-1min.json';
import operationalExampleFixture from '../../analise-banco-de-dados/fixtures/useOperationalData-example.json';

const measurements: ApiMeasurement[] = [
  {
    channel: 'main',
    sensor: 'fase3',
    apparent_power: 10,
    active_power: 10,
    reactive_power: 1,
    power_factor: 0.93,
    current: 5,
    voltage: 219,
    timestamp: '2026-04-07T10:00:00',
  },
  {
    channel: 'main',
    sensor: 'fase1',
    apparent_power: 4,
    active_power: 4,
    reactive_power: 1,
    power_factor: 0.96,
    current: 2,
    voltage: 221,
    timestamp: '2026-04-07T10:00:00',
  },
  {
    channel: 'main',
    sensor: 'fase3',
    apparent_power: 12,
    active_power: 12,
    reactive_power: 1,
    power_factor: 0.94,
    current: 6,
    voltage: 220,
    timestamp: '2026-04-07T10:01:00',
  },
];

describe('operationalSeriesTransformer', () => {
  it('combines energy, temperature and occupancy into operational data', () => {
    const series = buildOperationalSeries(
      measurements,
      { ...DEFAULT_SENSOR_MAP },
      { ...DEFAULT_TEMPERATURE_CONFIG },
      { ...DEFAULT_OCCUPANCY_CONFIG },
    );

    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({
      freezerEnergy: 10,
      equipmentEnergy: 4,
    });
  });

  it('builds a forward-looking prediction series', () => {
    const series = buildOperationalSeries(
      measurements,
      { ...DEFAULT_SENSOR_MAP },
      { ...DEFAULT_TEMPERATURE_CONFIG },
      { ...DEFAULT_OCCUPANCY_CONFIG },
    );
    const prediction = buildPredictionSeries(series, 3);

    expect(prediction).toHaveLength(3);
    expect(prediction[0].timestamp.toISOString()).toBe('2026-04-07T13:02:00.000Z');
  });

  it('extracts the latest electrical snapshot from the newest timestamp', () => {
    expect(getLatestElectricalSnapshot(measurements)).toEqual({
      voltage: 220,
      powerFactor: 0.94,
    });
  });

  it('matches the studied operational shape with the real lab fixture', () => {
    const series = buildOperationalSeries(
      labFixture.measurements,
      { ...DEFAULT_SENSOR_MAP },
      { ...DEFAULT_TEMPERATURE_CONFIG },
      { ...DEFAULT_OCCUPANCY_CONFIG },
    );
    const latest = series[series.length - 1];

    expect(latest.freezerEnergy).toBeCloseTo(operationalExampleFixture.derived.freezerEnergyKw, 2);
    expect(latest.equipmentEnergy).toBeCloseTo(
      operationalExampleFixture.derived.equipmentEnergyKw,
      2,
    );
    expect(latest.temperature).toBeCloseTo(operationalExampleFixture.derived.temperatureC, 0);
    expect(latest.occupancy).toBeCloseTo(operationalExampleFixture.derived.occupancyPct, 0);
  });
});
