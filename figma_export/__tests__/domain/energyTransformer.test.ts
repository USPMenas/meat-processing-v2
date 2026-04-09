import {
  getEnergyTimeSeries,
  transformToEquipmentEnergy,
  transformToFreezerEnergy,
} from '@/domain/transformers/energyTransformer';
import type { ApiMeasurement, SensorMap } from '@/domain/types';

const sensorMap: SensorMap = {
  freezerSensors: ['freezer'],
  equipmentSensors: ['equipment_a', 'equipment_b'],
};

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
    timestamp: '2026-04-07T10:00:00.000Z',
  },
  {
    channel: 'main',
    sensor: 'equipment_a',
    apparent_power: 4,
    active_power: 4,
    reactive_power: 1,
    power_factor: 0.95,
    current: 2,
    voltage: 220,
    timestamp: '2026-04-07T10:00:00.000Z',
  },
  {
    channel: 'main',
    sensor: 'equipment_b',
    apparent_power: 3,
    active_power: 3,
    reactive_power: 1,
    power_factor: 0.95,
    current: 1,
    voltage: 220,
    timestamp: '2026-04-07T10:01:00.000Z',
  },
  {
    channel: 'main',
    sensor: 'freezer',
    apparent_power: 12,
    active_power: 12,
    reactive_power: 1,
    power_factor: 0.95,
    current: 6,
    voltage: 221,
    timestamp: '2026-04-07T10:01:00.000Z',
  },
];

describe('energyTransformer', () => {
  it('returns the latest freezer energy value', () => {
    expect(transformToFreezerEnergy(measurements, sensorMap)).toBe(12);
  });

  it('returns the latest equipment energy value', () => {
    expect(transformToEquipmentEnergy(measurements, sensorMap)).toBe(3);
  });

  it('builds a grouped time series by timestamp', () => {
    expect(getEnergyTimeSeries(measurements, sensorMap)).toEqual([
      {
        timestamp: new Date('2026-04-07T10:00:00.000Z'),
        freezerEnergy: 10,
        equipmentEnergy: 4,
      },
      {
        timestamp: new Date('2026-04-07T10:01:00.000Z'),
        freezerEnergy: 12,
        equipmentEnergy: 3,
      },
    ]);
  });
});
