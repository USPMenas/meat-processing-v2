import type { ApiMeasurement, OccupancyConfig } from '../types';
import { parseApiTimestamp } from '../../services/api/timestamps';
import { clamp, deterministicNoise, round } from './deterministic';

function isTrackedSensor(sensor: string, sourceSensorIds?: string[]): boolean {
  if (!sourceSensorIds || sourceSensorIds.length === 0) {
    return true;
  }

  return sourceSensorIds.some((sourceSensorId) => sourceSensorId.toLowerCase() === sensor.toLowerCase());
}

function deriveOccupancyWithSeed(
  current: number,
  config: OccupancyConfig,
  seed: string | number,
): number {
  const normalizedMax = config.maxCurrent === 0 ? 1 : config.maxCurrent;
  const scaleFactor = config.scaleFactor ?? 40;
  const minOccupancy = config.minOccupancy ?? 20;
  const maxOccupancy = config.maxOccupancy ?? 98;
  const noise = deterministicNoise(seed, config.noiseAmplitude);
  const occupancy =
    config.baseOccupancy +
    ((current - config.avgCurrent) / normalizedMax) * scaleFactor +
    noise;

  return round(clamp(occupancy, minOccupancy, maxOccupancy));
}

export function deriveOccupancy(current: number, config: OccupancyConfig): number {
  return deriveOccupancyWithSeed(
    current,
    config,
    `${current}:${config.baseOccupancy}:${config.avgCurrent}:${config.maxCurrent}`,
  );
}

export function getOccupancyTimeSeries(
  measurements: ApiMeasurement[],
  config: OccupancyConfig,
): Array<{ timestamp: Date; occupancy: number }> {
  const grouped = new Map<string, number>();

  measurements.forEach((measurement) => {
    if (!isTrackedSensor(measurement.sensor, config.sourceSensorIds)) {
      return;
    }

    grouped.set(measurement.timestamp, (grouped.get(measurement.timestamp) ?? 0) + measurement.current);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([timestamp, current]) => ({
      timestamp: parseApiTimestamp(timestamp),
      occupancy: deriveOccupancyWithSeed(current, config, timestamp),
    }));
}
