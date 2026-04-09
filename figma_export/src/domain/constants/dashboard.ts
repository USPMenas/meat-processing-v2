import type { OccupancyConfig, SensorMap, TemperatureConfig } from '../types';

export const DEFAULT_SENSOR_MAP: Readonly<SensorMap> = Object.freeze({
  freezerSensors: ['fase3'],
  equipmentSensors: ['fase1', 'fase2'],
});

export const DEFAULT_TEMPERATURE_CONFIG: Readonly<TemperatureConfig> = Object.freeze({
  baseTemperature: -18,
  avgPower: 7.95,
  sensitivityFactor: 2.5 / (10 - 5.36),
  noiseAmplitude: 0,
  minTemperature: -22,
  maxTemperature: -14,
  sourceSensorIds: ['fase3'],
});

export const DEFAULT_OCCUPANCY_CONFIG: Readonly<OccupancyConfig> = Object.freeze({
  baseOccupancy: 10,
  avgCurrent: 0.0822,
  maxCurrent: 0.2673 - 0.0822,
  noiseAmplitude: 0,
  scaleFactor: 90,
  minOccupancy: 0,
  maxOccupancy: 100,
  sourceSensorIds: ['fase1', 'fase2'],
});
