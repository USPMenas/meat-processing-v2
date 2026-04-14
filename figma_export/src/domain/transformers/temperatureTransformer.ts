import type { ApiMeasurement, TemperatureConfig } from '../types';
import { parseApiTimestamp } from '../../services/api/timestamps';
import { clamp, deterministicNoise, round } from './deterministic';

function isTrackedSensor(sensor: string, sourceSensorIds?: string[]): boolean {
  if (!sourceSensorIds || sourceSensorIds.length === 0) {
    return true;
  }

  return sourceSensorIds.some((sourceSensorId) => sourceSensorId.toLowerCase() === sensor.toLowerCase());
}

function deriveTemperatureWithSeed(
  activePower: number,
  config: TemperatureConfig,
  seed: string | number,
): number {
  const noise = deterministicNoise(seed, config.noiseAmplitude);
  const minTemperature = config.minTemperature ?? -2;
  const maxTemperature = config.maxTemperature ?? 2;
  const derivedTemperature =
    config.baseTemperature +
    (activePower - config.avgPower) * config.sensitivityFactor +
    noise;

  return round(clamp(derivedTemperature, minTemperature, maxTemperature));
}

export function deriveTemperature(activePower: number, config: TemperatureConfig): number {
  return deriveTemperatureWithSeed(
    activePower,
    config,
    `${activePower}:${config.baseTemperature}:${config.avgPower}:${config.sensitivityFactor}`,
  );
}

export function getTemperatureTimeSeries(
  measurements: ApiMeasurement[],
  config: TemperatureConfig,
): Array<{ timestamp: Date; temperature: number }> {
  const grouped = new Map<string, number>();

  measurements.forEach((measurement) => {
    if (!isTrackedSensor(measurement.sensor, config.sourceSensorIds)) {
      return;
    }

    grouped.set(measurement.timestamp, (grouped.get(measurement.timestamp) ?? 0) + measurement.active_power);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([timestamp, activePower]) => ({
      timestamp: parseApiTimestamp(timestamp),
      temperature: deriveTemperatureWithSeed(activePower, config, timestamp),
    }));
}
