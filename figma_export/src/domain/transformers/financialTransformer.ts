import { FINANCIAL_CONFIG } from '../constants/financial';
import { TARIFFS, getTariffForHour } from '../constants/tariffs';
import { parseApiTimestamp } from '../../services/api/timestamps';
import type { ApiMeasurement, MonthlyEntry, TariffConfig } from '../types';
import { round } from './deterministic';

export function calculateEnergyCost(
  totalKwh: number,
  hourlyBreakdown: { hour: number; kwh: number }[],
  tariffTable: TariffConfig[],
): number {
  if (totalKwh <= 0) {
    return 0;
  }

  if (hourlyBreakdown.length === 0) {
    const averageTariff =
      tariffTable.reduce((sum, tariff) => sum + tariff.rate, 0) / Math.max(tariffTable.length, 1);

    return round(totalKwh * averageTariff);
  }

  const breakdownTotal = hourlyBreakdown.reduce((sum, entry) => sum + entry.kwh, 0);
  const normalizationFactor = breakdownTotal > 0 ? totalKwh / breakdownTotal : 0;

  const cost = hourlyBreakdown.reduce((sum, entry) => {
    return sum + entry.kwh * normalizationFactor * getTariffForHour(entry.hour, tariffTable);
  }, 0);

  return round(cost);
}

export function calculateRevenue(totalKwh: number, revenuePerKwh: number): number {
  return round(totalKwh * revenuePerKwh);
}

export function calculateMargin(revenue: number, cost: number): number {
  if (revenue <= 0) {
    return 0;
  }

  return round(((revenue - cost) / revenue) * 100);
}

export function projectMonthly(
  accumulatedValue: number,
  daysElapsed: number,
  totalDaysInMonth: number,
): number {
  if (daysElapsed <= 0) {
    return round(accumulatedValue);
  }

  return round((accumulatedValue / daysElapsed) * totalDaysInMonth);
}

export function estimateMeasurementIntervalHours(measurements: ApiMeasurement[]): number {
  if (measurements.length < 2) {
    return 1 / 60;
  }

  const timestamps = Array.from(
    new Set(measurements.map((measurement) => parseApiTimestamp(measurement.timestamp).getTime())),
  ).sort((left, right) => left - right);
  const deltas = timestamps
    .slice(1)
    .map((timestamp, index) => timestamp - timestamps[index])
    .filter((delta) => delta > 0)
    .sort((left, right) => left - right);

  if (deltas.length === 0) {
    return 1 / 60;
  }

  const median = deltas[Math.floor(deltas.length / 2)];
  return median / (1000 * 60 * 60);
}

function formatMonth(date: Date): string {
  const value = date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });

  return value.replace('.', '').replace(' de ', '/');
}

export function getMonthlyAggregation(measurements: ApiMeasurement[], months: number): MonthlyEntry[] {
  const intervalHours = estimateMeasurementIntervalHours(measurements);
  const grouped = new Map<string, { totalKwh: number; hourlyBreakdown: Map<number, number> }>();

  measurements.forEach((measurement) => {
    const timestamp = parseApiTimestamp(measurement.timestamp);
    const key = `${timestamp.getFullYear()}-${timestamp.getMonth()}`;
    const currentEntry = grouped.get(key) ?? {
      totalKwh: 0,
      hourlyBreakdown: new Map<number, number>(),
    };
    const energy = measurement.active_power * intervalHours;
    const hour = timestamp.getHours();

    currentEntry.totalKwh += energy;
    currentEntry.hourlyBreakdown.set(hour, (currentEntry.hourlyBreakdown.get(hour) ?? 0) + energy);
    grouped.set(key, currentEntry);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-months)
    .map(([key, entry]) => {
      const [year, month] = key.split('-').map(Number);
      const date = new Date(year, month, 1);
      const hourlyBreakdown = Array.from(entry.hourlyBreakdown.entries()).map(([hour, kwh]) => ({
        hour,
        kwh,
      }));
      const totalKwh = round(entry.totalKwh);

      return {
        month: formatMonth(date),
        totalKwh,
        energyCost: calculateEnergyCost(totalKwh, hourlyBreakdown, [...TARIFFS]),
        revenue: calculateRevenue(totalKwh, FINANCIAL_CONFIG.REVENUE_PER_KWH),
      };
    });
}
