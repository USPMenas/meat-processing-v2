import type { ApiMeasurement, OccupancyConfig, OperationalData, SensorMap, TemperatureConfig } from '../types';
import { getEnergyTimeSeries } from './energyTransformer';
import { getOccupancyTimeSeries } from './occupancyTransformer';
import { getTemperatureTimeSeries } from './temperatureTransformer';

export function buildOperationalSeries(
  measurements: ApiMeasurement[],
  sensorMap: SensorMap,
  temperatureConfig: TemperatureConfig,
  occupancyConfig: OccupancyConfig,
): OperationalData[] {
  const energySeries = getEnergyTimeSeries(measurements, sensorMap);
  const temperatureSeries = getTemperatureTimeSeries(measurements, temperatureConfig);
  const occupancySeries = getOccupancyTimeSeries(measurements, occupancyConfig);

  const temperatureByTimestamp = new Map(
    temperatureSeries.map((entry) => [entry.timestamp.toISOString(), entry.temperature]),
  );
  const occupancyByTimestamp = new Map(
    occupancySeries.map((entry) => [entry.timestamp.toISOString(), entry.occupancy]),
  );

  return energySeries.map((entry) => ({
    timestamp: entry.timestamp,
    freezerEnergy: entry.freezerEnergy,
    equipmentEnergy: entry.equipmentEnergy,
    temperature: temperatureByTimestamp.get(entry.timestamp.toISOString()) ?? temperatureConfig.baseTemperature,
    occupancy: occupancyByTimestamp.get(entry.timestamp.toISOString()) ?? occupancyConfig.baseOccupancy,
  }));
}

function averageDelta(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const deltas = values.slice(1).map((value, index) => value - values[index]);
  return deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
}

function clampOccupancy(value: number): number {
  return Math.min(Math.max(value, 20), 98);
}

function clampTemperature(value: number): number {
  return Math.min(Math.max(value, -25), -10);
}

export function buildPredictionSeries(series: OperationalData[], points = 60): OperationalData[] {
  if (series.length === 0) {
    return [];
  }

  const recent = series.slice(-5);
  const last = recent[recent.length - 1];
  const freezerDelta = averageDelta(recent.map((entry) => entry.freezerEnergy));
  const equipmentDelta = averageDelta(recent.map((entry) => entry.equipmentEnergy));
  const temperatureDelta = averageDelta(recent.map((entry) => entry.temperature));
  const occupancyDelta = averageDelta(recent.map((entry) => entry.occupancy));

  return Array.from({ length: points }, (_, index) => {
    const step = index + 1;
    return {
      timestamp: new Date(last.timestamp.getTime() + step * 60_000),
      freezerEnergy: Math.max(0, last.freezerEnergy + freezerDelta * step),
      equipmentEnergy: Math.max(0, last.equipmentEnergy + equipmentDelta * step),
      temperature: clampTemperature(last.temperature + temperatureDelta * step),
      occupancy: clampOccupancy(last.occupancy + occupancyDelta * step),
    };
  });
}

export function getLatestElectricalSnapshot(
  measurements: ApiMeasurement[],
): { voltage?: number; powerFactor?: number } {
  if (measurements.length === 0) {
    return {};
  }

  const latestTimestamp = measurements.reduce(
    (latest, measurement) =>
      measurement.timestamp > latest ? measurement.timestamp : latest,
    measurements[0].timestamp,
  );
  const latestMeasurements = measurements.filter((measurement) => measurement.timestamp === latestTimestamp);

  return {
    voltage:
      latestMeasurements.reduce((sum, measurement) => sum + measurement.voltage, 0) /
      Math.max(latestMeasurements.length, 1),
    powerFactor:
      latestMeasurements.reduce((sum, measurement) => sum + measurement.power_factor, 0) /
      Math.max(latestMeasurements.length, 1),
  };
}
