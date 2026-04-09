import { useEffect, useMemo, useState } from 'react';
import { DASHBOARD_PERIOD_DAYS, DASHBOARD_PERIOD_HOURS } from '../config/periods';
import { SENSOR_MAP } from '../config/channels';
import { DEFAULT_OCCUPANCY_CONFIG } from '../domain/constants/dashboard';
import {
  buildBusinessSummary,
  buildDailyBusinessData,
  buildMonthlyComparison,
  estimateTotalConsumptionKwhFromSeries,
  getTotalConsumptionKwh,
} from '../domain/transformers/businessTransformer';
import { buildHourlyData } from '../domain/transformers/logisticsTransformer';
import type {
  BusinessData,
  OperationalChartPeriod,
  OperationalData,
} from '../domain/types';
import { getCachedAnalytics } from '../services/cache/cacheSelectors';
import { subscribeToCacheUpdates } from '../services/cache/cacheEvents';
import { getAnalyticsCacheKey } from '../services/cache/cacheKeys';
import { useOperationalHistory } from './useOperationalHistory';

export function useBusinessData(
  channel: string,
  period: OperationalChartPeriod,
): BusinessData & {
  isLoading: boolean;
  error: string | null;
  periodSeries: OperationalData[];
} {
  const history = useOperationalHistory(channel, period);
  const [analyticsRevision, setAnalyticsRevision] = useState(0);

  useEffect(() => {
    return subscribeToCacheUpdates((detail) => {
      if (
        detail.key === getAnalyticsCacheKey(channel, 'consumption') ||
        detail.key === getAnalyticsCacheKey(channel, 'hourly_profile') ||
        detail.key === getAnalyticsCacheKey(channel, 'current_by_sensor')
      ) {
        setAnalyticsRevision((current) => current + 1);
      }
    });
  }, [channel]);

  return useMemo(() => {
    const consumption = getCachedAnalytics(channel, 'consumption');
    const cachedHourlyProfile = getCachedAnalytics(channel, 'hourly_profile');
    const currentBySensor = getCachedAnalytics(channel, 'current_by_sensor');
    const operationalSeries = history.data;
    const referenceDate =
      history.lastMeasurementAt ??
      operationalSeries[operationalSeries.length - 1]?.timestamp ??
      null;
    const hourlyAverages = buildHourlyData({
      hourlyProfile: operationalSeries.length > 0 ? null : cachedHourlyProfile,
      currentBySensor,
      operationalSeries,
      sensorMap: { ...SENSOR_MAP },
      occupancyConfig: { ...DEFAULT_OCCUPANCY_CONFIG },
    });
    const analyticsTotalKwh = getTotalConsumptionKwh(consumption?.results);
    const selectedTotalKwh =
      analyticsTotalKwh > 0 && period === '30d'
        ? analyticsTotalKwh
        : operationalSeries.length > 0
        ? estimateTotalConsumptionKwhFromSeries(
            operationalSeries,
            Math.max(1, DASHBOARD_PERIOD_HOURS[period] / Math.max(operationalSeries.length, 1)),
          )
        : analyticsTotalKwh;
    const dailyData = buildDailyBusinessData({
      operationalSeries,
      totalKwh: selectedTotalKwh,
      hourlyAverages,
      referenceDate,
    });
    const monthlyComparison = buildMonthlyComparison(
      dailyData,
      period === '30d' ? 3 : 1,
    );
    const summary = buildBusinessSummary({
      dailyData,
      monthlyComparison,
      hourlyAverages,
      referenceDate,
      projectionDaysElapsed: Math.max(dailyData.length, 1),
      projectionTotalDays: DASHBOARD_PERIOD_DAYS[period],
    });
    const hasData =
      summary.dailyData.length > 0 ||
      summary.currentRevenue > 0 ||
      summary.energyCost > 0 ||
      summary.hourlyAverages.some((entry) => entry.avgEnergy > 0);

    return {
      ...summary,
      periodSeries: operationalSeries,
      isLoading: history.isLoading && !hasData,
      error: hasData
        ? history.error
        : history.error ??
          'Os dados financeiros ainda nao estao disponiveis no cache.',
    };
  }, [
    analyticsRevision,
    channel,
    history.data,
    history.error,
    history.isLoading,
    history.lastMeasurementAt,
    period,
  ]);
}
