import type { SensorMap } from '../domain/types';

export const FRIGORIFICO_CHANNEL = 'lab';

export const SENSOR_MAP: Readonly<SensorMap> = Object.freeze({
  freezerSensors: ['fase3'],
  equipmentSensors: ['fase1', 'fase2'],
});

export const DISCOVERY_CHANNEL_CANDIDATES = Object.freeze(['lab']);
