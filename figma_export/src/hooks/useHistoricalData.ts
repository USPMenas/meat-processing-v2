import { useEffect, useState } from 'react';
import { SENSOR_MAP } from '../config/channels';
import { parseApiTimestamp } from '../services/api/timestamps';
import { DEFAULT_OCCUPANCY_CONFIG, DEFAULT_TEMPERATURE_CONFIG } from '../domain/constants/dashboard';
import { FINANCIAL_CONFIG } from '../domain/constants/financial';
import { TARIFFS, getTariffForHour } from '../domain/constants/tariffs';
import { calculateEnergyCost, calculateRevenue, estimateMeasurementIntervalHours, getMonthlyAggregation } from '../domain/transformers/financialTransformer';
import { buildOperationalSeries } from '../domain/transformers/operationalSeriesTransformer';
import type { DailyEntry, HourlyProfileEntry, OperationalData } from '../domain/types';
import { getCachedAnalytics, getCachedMeasurements } from '../services/cache/cacheSelectors';
import { getAnalyticsCacheKey, getMeasurementCacheKey } from '../services/cache/cacheKeys';
import { subscribeToCacheUpdates } from '../services/cache/cacheEvents';

function formatLocalDateKey(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function buildDailyAggregation(series: OperationalData[], intervalHours: number): DailyEntry[] {
  const grouped = new Map<
    string,
    {
      totalKwh: number;
      averageTemperature: number;
      averageOccupancy: number;
      sampleCount: number;
      hourlyBreakdown: Map<number, number>;
    }
  >();

  series.forEach((entry) => {
    const date = formatLocalDateKey(entry.timestamp);
    const currentEntry = grouped.get(date) ?? {
      totalKwh: 0,
      averageTemperature: 0,
      averageOccupancy: 0,
      sampleCount: 0,
      hourlyBreakdown: new Map<number, number>(),
    };
    const totalEnergy = (entry.freezerEnergy + entry.equipmentEnergy) * intervalHours;

    currentEntry.totalKwh += totalEnergy;
    currentEntry.averageTemperature += entry.temperature;
    currentEntry.averageOccupancy += entry.occupancy;
    currentEntry.sampleCount += 1;
    currentEntry.hourlyBreakdown.set(
      entry.timestamp.getHours(),
      (currentEntry.hourlyBreakdown.get(entry.timestamp.getHours()) ?? 0) + totalEnergy,
    );
    grouped.set(date, currentEntry);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entry]) => {
      const totalKwh = entry.totalKwh;
      const hourlyBreakdown = Array.from(entry.hourlyBreakdown.entries()).map(([hour, kwh]) => ({
        hour,
        kwh,
      }));

      return {
        date,
        label: date,
        totalKwh,
        averageTemperature: entry.averageTemperature / Math.max(entry.sampleCount, 1),
        averageOccupancy: entry.averageOccupancy / Math.max(entry.sampleCount, 1),
        energyCost: calculateEnergyCost(totalKwh, hourlyBreakdown, [...TARIFFS]),
        revenue: calculateRevenue(totalKwh, FINANCIAL_CONFIG.REVENUE_PER_KWH),
      };
    });
}

function buildHourlyProfile(channel: string, series: OperationalData[]): HourlyProfileEntry[] {
  const analytics = getCachedAnalytics(channel, 'hourly_profile');
  const occupancyByHour = new Map<number, { total: number; count: number }>();

  series.forEach((entry) => {
    const hour = entry.timestamp.getHours();
    const current = occupancyByHour.get(hour) ?? { total: 0, count: 0 };
    current.total += entry.occupancy;
    current.count += 1;
    occupancyByHour.set(hour, current);
  });

  if (analytics) {
    const grouped = new Map<number, { energy: number; samples: number }>();

    analytics.results.forEach((entry) => {
      const hour = Number.parseInt(entry.hour, 10);
      const current = grouped.get(hour) ?? { energy: 0, samples: 0 };
      current.energy += entry.avg_power_kw;
      current.samples += 1;
      grouped.set(hour, current);
    });

    return Array.from(grouped.entries())
      .sort(([left], [right]) => left - right)
      .map(([hour, entry]) => ({
        hour,
        avgEnergy: entry.energy / Math.max(entry.samples, 1),
        avgOccupancy:
          (occupancyByHour.get(hour)?.total ?? 0) / Math.max(occupancyByHour.get(hour)?.count ?? 1, 1),
        tariff: getTariffForHour(hour, [...TARIFFS]),
      }));
  }

  const grouped = new Map<number, { energy: number; occupancy: number; samples: number }>();

  series.forEach((entry) => {
    const hour = entry.timestamp.getHours();
    const current = grouped.get(hour) ?? { energy: 0, occupancy: 0, samples: 0 };

    current.energy += entry.freezerEnergy + entry.equipmentEnergy;
    current.occupancy += entry.occupancy;
    current.samples += 1;
    grouped.set(hour, current);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left - right)
    .map(([hour, entry]) => ({
      hour,
      avgEnergy: entry.energy / Math.max(entry.samples, 1),
      avgOccupancy: entry.occupancy / Math.max(entry.samples, 1),
      tariff: getTariffForHour(hour, [...TARIFFS]),
    }));
}

export function useHistoricalData(
  channel: string,
  periodDays: number,
): {
  data: OperationalData[];
  dailyAggregation: DailyEntry[];
  monthlyAggregation: ReturnType<typeof getMonthlyAggregation>;
  hourlyProfile: HourlyProfileEntry[];
  isLoading: boolean;
} {
  const [state, setState] = useState({
    data: [] as OperationalData[],
    dailyAggregation: [] as DailyEntry[],
    monthlyAggregation: [] as ReturnType<typeof getMonthlyAggregation>,
    hourlyProfile: [] as HourlyProfileEntry[],
    isLoading: true,
  });

  useEffect(() => {
    const load = () => {
      const measurements = getCachedMeasurements(channel);
      const latestMeasurementAt = measurements[measurements.length - 1]?.timestamp ?? null;
      const referenceTime = latestMeasurementAt
        ? parseApiTimestamp(latestMeasurementAt).getTime()
        : Date.now();
      const cutoff = referenceTime - periodDays * 24 * 60 * 60 * 1000;
      const filteredMeasurements = measurements.filter(
        (measurement) => parseApiTimestamp(measurement.timestamp).getTime() >= cutoff,
      );
      const series = buildOperationalSeries(
        filteredMeasurements,
        { ...SENSOR_MAP },
        { ...DEFAULT_TEMPERATURE_CONFIG },
        { ...DEFAULT_OCCUPANCY_CONFIG },
      );
      const intervalHours = estimateMeasurementIntervalHours(filteredMeasurements);
      const dailyAggregation = buildDailyAggregation(series, intervalHours);
      const monthlyAggregation = getMonthlyAggregation(
        filteredMeasurements,
        Math.max(1, Math.ceil(periodDays / 30)),
      );
      const hourlyProfile = buildHourlyProfile(channel, series);

      setState({
        data: series,
        dailyAggregation,
        monthlyAggregation,
        hourlyProfile,
        isLoading: false,
      });
    };

    load();

    return subscribeToCacheUpdates((detail) => {
      if (
        detail.key === getMeasurementCacheKey(channel) ||
        detail.key === getAnalyticsCacheKey(channel, 'hourly_profile')
      ) {
        load();
      }
    });
  }, [channel, periodDays]);

  return state;
}
