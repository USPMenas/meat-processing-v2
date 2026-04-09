import { useEffect, useRef, useState } from 'react';
import { SENSOR_MAP } from '../config/channels';
import { DEFAULT_OCCUPANCY_CONFIG, DEFAULT_TEMPERATURE_CONFIG } from '../domain/constants/dashboard';
import { buildOperationalSeries } from '../domain/transformers/operationalSeriesTransformer';
import type { OperationalChartPeriod, OperationalData } from '../domain/types';
import {
  getCachedMeasurementSyncState,
  getCachedMeasurements,
  getCachedOperationalHistory,
  getCachedOperationalHistoryPayload,
} from '../services/cache/cacheSelectors';
import { subscribeToCacheUpdates } from '../services/cache/cacheEvents';
import {
  getMeasurementCacheKey,
  getOperationalHistoryCacheKey,
} from '../services/cache/cacheKeys';
import { SyncStrategy } from '../services/cache/syncStrategy';
import { parseApiTimestamp } from '../services/api/timestamps';

function getFallbackSeries(channel: string): OperationalData[] {
  const measurements = getCachedMeasurements(channel);

  if (measurements.length === 0) {
    return [];
  }

  return buildOperationalSeries(
    measurements,
    { ...SENSOR_MAP },
    { ...DEFAULT_TEMPERATURE_CONFIG },
    { ...DEFAULT_OCCUPANCY_CONFIG },
  );
}

function getLatestMeasurementAt(channel: string): string | null {
  const measurements = getCachedMeasurements(channel);

  return (
    getCachedMeasurementSyncState(channel)?.latestMeasurementAt ??
    measurements[measurements.length - 1]?.timestamp ??
    null
  );
}

export function useOperationalHistory(
  channel: string,
  period: OperationalChartPeriod,
): {
  data: OperationalData[];
  error: string | null;
  isLoading: boolean;
  lastMeasurementAt: Date | null;
} {
  const syncStrategyRef = useRef<SyncStrategy | null>(null);
  const [state, setState] = useState({
    data: [] as OperationalData[],
    error: null as string | null,
    isLoading: true,
    lastMeasurementAt: null as Date | null,
  });

  if (!syncStrategyRef.current) {
    syncStrategyRef.current = new SyncStrategy();
  }

  useEffect(() => {
    let cancelled = false;
    const syncStrategy = syncStrategyRef.current as SyncStrategy;

    const loadFromCache = () => {
      const cachedSeries = getCachedOperationalHistory(channel, period);
      const cachedPayload = getCachedOperationalHistoryPayload(channel, period);
      const fallbackSeries = getFallbackSeries(channel);
      const latestMeasurementAt =
        cachedPayload?.anchorMeasurementAt ?? getLatestMeasurementAt(channel);

      if (cancelled) {
        return;
      }

      setState((previous) => ({
        ...previous,
        data: cachedSeries.length > 0 ? cachedSeries : fallbackSeries,
        isLoading: false,
        lastMeasurementAt: latestMeasurementAt
          ? parseApiTimestamp(latestMeasurementAt)
          : null,
      }));
    };

    const ensureHistory = async () => {
      const latestMeasurementAt = getLatestMeasurementAt(channel);
      const cachedPayload = getCachedOperationalHistoryPayload(channel, period);

      loadFromCache();

      if (
        !latestMeasurementAt ||
        (cachedPayload?.anchorMeasurementAt === latestMeasurementAt &&
          cachedPayload.points.length > 0)
      ) {
        return;
      }

      if (!cancelled) {
        setState((previous) => ({
          ...previous,
          isLoading: true,
          error: null,
        }));
      }

      try {
        await syncStrategy.syncOperationalHistory(channel, period);
      } catch (error) {
        if (!cancelled) {
          setState((previous) => ({
            ...previous,
            error:
              error instanceof Error
                ? error.message
                : 'Nao foi possivel montar o historico operacional.',
            isLoading: false,
          }));
        }
      } finally {
        loadFromCache();
      }
    };

    void ensureHistory();

    const unsubscribe = subscribeToCacheUpdates((detail) => {
      if (detail.key === getOperationalHistoryCacheKey(channel, period)) {
        loadFromCache();
        return;
      }

      if (detail.key === getMeasurementCacheKey(channel)) {
        void ensureHistory();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [channel, period]);

  return state;
}
