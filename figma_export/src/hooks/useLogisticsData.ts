import { useEffect, useMemo, useState } from 'react';
import { SENSOR_MAP } from '../config/channels';
import { DEFAULT_OCCUPANCY_CONFIG } from '../domain/constants/dashboard';
import { LOW_TARIFF_THRESHOLD } from '../domain/constants/tariffs';
import {
  buildEnergyPrices,
  buildHourlyData,
  buildOccupancyForecast,
} from '../domain/transformers/logisticsTransformer';
import type {
  LogisticsData,
  OperationalChartPeriod,
  OperationalData,
} from '../domain/types';
import { getCachedAnalytics } from '../services/cache/cacheSelectors';
import { subscribeToCacheUpdates } from '../services/cache/cacheEvents';
import { getAnalyticsCacheKey } from '../services/cache/cacheKeys';
import { useOperationalHistory } from './useOperationalHistory';

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values);
}

function getNextIdealHour(
  referenceDate: Date,
  prices: LogisticsData['energyPrices'],
): number | null {
  const currentHour = referenceDate.getHours();

  for (let offset = 1; offset <= 24; offset += 1) {
    const hour = (currentHour + offset) % 24;
    const price = prices.find((entry) => entry.hour === hour);

    if (price && price.price < LOW_TARIFF_THRESHOLD) {
      return hour;
    }
  }

  return null;
}

export function useLogisticsData(
  channel: string,
  period: OperationalChartPeriod,
): LogisticsData & {
  isLoading: boolean;
  error: string | null;
  periodSeries: OperationalData[];
} {
  const history = useOperationalHistory(channel, period);
  const [analyticsRevision, setAnalyticsRevision] = useState(0);

  useEffect(() => {
    return subscribeToCacheUpdates((detail) => {
      if (
        detail.key === getAnalyticsCacheKey(channel, 'hourly_profile') ||
        detail.key === getAnalyticsCacheKey(channel, 'current_by_sensor')
      ) {
        setAnalyticsRevision((current) => current + 1);
      }
    });
  }, [channel]);

  return useMemo(() => {
    const energyPrices = buildEnergyPrices();
    const cachedHourlyProfile = getCachedAnalytics(channel, 'hourly_profile');
    const currentBySensor = getCachedAnalytics(channel, 'current_by_sensor');
    const operationalSeries = history.data;
    const hourlyData = buildHourlyData({
      hourlyProfile:
        operationalSeries.length > 0 ? null : cachedHourlyProfile,
      currentBySensor,
      operationalSeries,
      sensorMap: { ...SENSOR_MAP },
      occupancyConfig: { ...DEFAULT_OCCUPANCY_CONFIG },
    });
    const referenceDate = new Date(Date.now());
    const occupancyForecast = buildOccupancyForecast(
      hourlyData,
      referenceDate.getHours(),
    );
    const avgEnergyPeriod =
      operationalSeries.length > 0
        ? average(
            operationalSeries.map(
              (entry) => entry.freezerEnergy + entry.equipmentEnergy,
            ),
          )
        : average(hourlyData.map((entry) => entry.avgEnergy));
    const peakOccupancy =
      operationalSeries.length > 0
        ? max(operationalSeries.map((entry) => entry.occupancy))
        : max(hourlyData.map((entry) => entry.avgOccupancy));
    const lowEnergyHours = energyPrices.filter(
      (entry) => entry.price < LOW_TARIFF_THRESHOLD,
    ).length;
    const nextIdealHour = getNextIdealHour(referenceDate, energyPrices);
    const hasOperationalHistory = operationalSeries.length > 0;
    const hasHourlyProfile = hourlyData.some((entry) => entry.avgEnergy > 0);
    const hasData = hasOperationalHistory || hasHourlyProfile;

    return {
      avgEnergy24h: avgEnergyPeriod,
      peakOccupancy,
      lowEnergyHours,
      nextIdealHour,
      hourlyData,
      hourlyProfile: hourlyData,
      occupancyForecast,
      energyPrices,
      periodSeries: operationalSeries,
      isLoading: history.isLoading && !hasData,
      error: hasData
        ? history.error
        : history.error ??
          'Os dados de logistica ainda nao estao disponiveis no cache.',
    };
  }, [
    analyticsRevision,
    channel,
    history.data,
    history.error,
    history.isLoading,
    history.lastMeasurementAt,
  ]);
}
