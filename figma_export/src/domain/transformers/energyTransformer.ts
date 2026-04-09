import type { ApiMeasurement, SensorMap } from '../types';
import { parseApiTimestamp } from '../../services/api/timestamps';
import { round } from './deterministic';

function normalizeSensorId(sensor: string): string {
  return sensor.trim().toLowerCase();
}

function getLatestTimestamp(measurements: ApiMeasurement[]): string | null {
  if (measurements.length === 0) {
    return null;
  }

  return measurements.reduce(
    (latest, measurement) =>
      measurement.timestamp > latest ? measurement.timestamp : latest,
    measurements[0].timestamp,
  );
}

function getLatestMeasurements(measurements: ApiMeasurement[]): ApiMeasurement[] {
  const latestTimestamp = getLatestTimestamp(measurements);

  if (!latestTimestamp) {
    return [];
  }

  return measurements.filter((measurement) => measurement.timestamp === latestTimestamp);
}

function resolveFreezerSensors(measurements: ApiMeasurement[], sensorMap: SensorMap): Set<string> {
  const freezerSensors = new Set(sensorMap.freezerSensors.map(normalizeSensorId));

  const matchedFreezers = measurements.filter((measurement) =>
    freezerSensors.has(normalizeSensorId(measurement.sensor)),
  );

  if (matchedFreezers.length > 0) {
    return freezerSensors;
  }

  const latestMeasurements = getLatestMeasurements(measurements);
  const highestLoadSensor = [...latestMeasurements].sort(
    (left, right) => right.active_power - left.active_power,
  )[0];

  return new Set(highestLoadSensor ? [normalizeSensorId(highestLoadSensor.sensor)] : []);
}

function resolveEquipmentSensors(
  measurements: ApiMeasurement[],
  sensorMap: SensorMap,
  freezerSensors: Set<string>,
): Set<string> {
  const explicitSensors = sensorMap.equipmentSensors.map(normalizeSensorId);

  if (explicitSensors.length > 0) {
    return new Set(explicitSensors);
  }

  return new Set(
    measurements
      .map((measurement) => normalizeSensorId(measurement.sensor))
      .filter((sensor) => !freezerSensors.has(sensor)),
  );
}

export function transformToFreezerEnergy(measurements: ApiMeasurement[], sensorMap: SensorMap): number {
  const latestMeasurements = getLatestMeasurements(measurements);
  const freezerSensors = resolveFreezerSensors(measurements, sensorMap);

  const total = latestMeasurements.reduce((sum, measurement) => {
    return freezerSensors.has(normalizeSensorId(measurement.sensor))
      ? sum + measurement.active_power
      : sum;
  }, 0);

  return round(total);
}

export function transformToEquipmentEnergy(measurements: ApiMeasurement[], sensorMap: SensorMap): number {
  const latestMeasurements = getLatestMeasurements(measurements);
  const freezerSensors = resolveFreezerSensors(measurements, sensorMap);
  const equipmentSensors = resolveEquipmentSensors(measurements, sensorMap, freezerSensors);

  const total = latestMeasurements.reduce((sum, measurement) => {
    return equipmentSensors.has(normalizeSensorId(measurement.sensor))
      ? sum + measurement.active_power
      : sum;
  }, 0);

  return round(total);
}

export function getEnergyTimeSeries(
  measurements: ApiMeasurement[],
  sensorMap: SensorMap,
): Array<{ timestamp: Date; freezerEnergy: number; equipmentEnergy: number }> {
  const freezerSensors = resolveFreezerSensors(measurements, sensorMap);
  const equipmentSensors = resolveEquipmentSensors(measurements, sensorMap, freezerSensors);
  const grouped = new Map<string, { freezerEnergy: number; equipmentEnergy: number }>();

  measurements.forEach((measurement) => {
    const key = measurement.timestamp;
    const currentEntry = grouped.get(key) ?? {
      freezerEnergy: 0,
      equipmentEnergy: 0,
    };
    const normalizedSensor = normalizeSensorId(measurement.sensor);

    if (freezerSensors.has(normalizedSensor)) {
      currentEntry.freezerEnergy += measurement.active_power;
    } else if (equipmentSensors.has(normalizedSensor)) {
      currentEntry.equipmentEnergy += measurement.active_power;
    }

    grouped.set(key, currentEntry);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([timestamp, entry]) => ({
      timestamp: parseApiTimestamp(timestamp),
      freezerEnergy: round(entry.freezerEnergy),
      equipmentEnergy: round(entry.equipmentEnergy),
    }));
}
