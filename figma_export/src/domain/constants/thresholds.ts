import type { ThresholdConfig } from '../types';

export const DEFAULT_THRESHOLD_CONFIG: Readonly<ThresholdConfig> = Object.freeze({
  temperatureCritical: -15,
  temperatureWarningHigh: -16,
  temperatureWarningLow: -21,
  freezerEnergyWarning: 18,
  occupancyWarning: 85,
  occupancyCritical: 95,
  voltageMin: 122,
  voltageMax: 131.5,
});
