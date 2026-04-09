import { useEffect, useMemo, useState } from 'react';
import { SENSOR_MAP } from '../config/channels';
import { DEFAULT_OCCUPANCY_CONFIG } from '../domain/constants/dashboard';
import {
  buildBusinessSummary,
  buildBusinessTimeline,
  buildDailyBusinessData,
  buildMonthlyComparison,
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
        detail.key === getAnalyticsCacheKey(channel, 'hourly_profile') ||
        detail.key === getAnalyticsCacheKey(channel, 'current_by_sensor')
      ) {
        setAnalyticsRevision((current) => current + 1);
      }
    });
  }, [channel]);

  return useMemo(() => {
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
    const { timeline, granularity } = buildBusinessTimeline({
      operationalSeries,
      period,
      referenceDate,
    });
    const dailyData = buildDailyBusinessData(timeline, granularity);
    const monthlyComparison = buildMonthlyComparison(
      dailyData,
      period === '30d' ? 3 : 2,
    );
    const summary = buildBusinessSummary({
      timeline,
      timelineGranularity: granularity,
      dailyData,
      monthlyComparison,
      hourlyAverages,
      referenceDate,
      period,
    });
    const hasData =
      summary.timeline.length > 0 ||
      summary.currentRevenue > 0 ||
      summary.totalCosts > 0 ||
      operationalSeries.length > 0;

    return {
      ...summary,
      periodSeries: operationalSeries,
      isLoading: history.isLoading && !hasData,
      error: hasData
        ? history.error
        : history.error ??
          'Os dados do modelo de negocios ainda nao estao disponiveis no cache.',
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
