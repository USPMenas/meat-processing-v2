import type { ThresholdConfig } from '../types';

export const DEFAULT_THRESHOLD_CONFIG: Readonly<ThresholdConfig> = Object.freeze({
  temperatureTarget: 0,
  temperatureIdealMin: -2,
  temperatureIdealMax: 2,
  freezerEnergyWarning: 18,
  occupancyWarning: 85,
  occupancyCritical: 95,
  voltageMin: 122,
  voltageMax: 131.5,
});
