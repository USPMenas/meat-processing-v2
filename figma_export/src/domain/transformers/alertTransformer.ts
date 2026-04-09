import type { Alert, ThresholdConfig } from '../types';
import { round } from './deterministic';

export function checkAlerts(
  data: {
    temperature: number;
    freezerEnergy: number;
    occupancy: number;
    voltage?: number;
    powerFactor?: number;
  },
  thresholds: ThresholdConfig,
): Alert[] {
  const alerts: Alert[] = [];

  if (data.temperature >= thresholds.temperatureCritical) {
    alerts.push({
      type: 'critical',
      variable: 'Temperatura',
      message: 'Temperatura acima do limite critico',
      value: round(data.temperature),
      expected: thresholds.temperatureCritical,
    });
  } else if (data.temperature >= thresholds.temperatureWarningHigh) {
    alerts.push({
      type: 'warning',
      variable: 'Temperatura',
      message: 'Temperatura acima da faixa ideal',
      value: round(data.temperature),
      expected: thresholds.temperatureWarningHigh,
    });
  } else if (data.temperature <= thresholds.temperatureWarningLow) {
    alerts.push({
      type: 'warning',
      variable: 'Temperatura',
      message: 'Temperatura abaixo da faixa ideal',
      value: round(data.temperature),
      expected: thresholds.temperatureWarningLow,
    });
  }

  if (data.freezerEnergy >= thresholds.freezerEnergyWarning) {
    alerts.push({
      type: 'warning',
      variable: 'Energia do Congelador',
      message: 'Consumo acima do esperado',
      value: round(data.freezerEnergy),
      expected: thresholds.freezerEnergyWarning,
    });
  }

  if (data.occupancy >= thresholds.occupancyCritical) {
    alerts.push({
      type: 'critical',
      variable: 'Ocupacao',
      message: 'Capacidade critica do frigorifico',
      value: round(data.occupancy),
      expected: thresholds.occupancyCritical,
    });
  } else if (data.occupancy >= thresholds.occupancyWarning) {
    alerts.push({
      type: 'info',
      variable: 'Ocupacao',
      message: 'Capacidade acima do ideal',
      value: round(data.occupancy),
      expected: thresholds.occupancyWarning,
    });
  }

  if (
    typeof data.voltage === 'number' &&
    (data.voltage < thresholds.voltageMin || data.voltage > thresholds.voltageMax)
  ) {
    alerts.push({
      type: 'warning',
      variable: 'Tensao',
      message: 'Tensao fora da faixa segura',
      value: round(data.voltage),
      expected:
        data.voltage < thresholds.voltageMin
          ? thresholds.voltageMin
          : thresholds.voltageMax,
    });
  }

  if (
    typeof data.powerFactor === 'number' &&
    typeof thresholds.powerFactorMin === 'number' &&
    data.powerFactor < thresholds.powerFactorMin
  ) {
    alerts.push({
      type: 'warning',
      variable: 'Fator de Potencia',
      message: 'Fator de potencia abaixo do recomendado',
      value: round(data.powerFactor),
      expected: thresholds.powerFactorMin,
    });
  }

  return alerts;
}
