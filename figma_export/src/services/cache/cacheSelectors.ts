import { parseApiTimestamp } from '../api/timestamps';
import type { AnalyticsResponseMap, AnalyticsType, ApiMeasurement } from '../api/types';
import type {
  OperationalData,
  OperationalChartPeriod,
  OperationalHistoryCachePayload,
} from '../../domain/types';
import { cacheManager, type CacheEntry, type CacheManager } from './cacheManager';
import type { MeasurementSyncState } from './types';
import {
  getAnalyticsCacheKey,
  getMeasurementCacheKey,
  getMeasurementSyncStateCacheKey,
  getOperationalHistoryCacheKey,
} from './cacheKeys';

export function getCachedMeasurementEntry(
  channel: string,
  manager: CacheManager = cacheManager,
): CacheEntry<ApiMeasurement[]> | null {
  return manager.get<ApiMeasurement[]>(getMeasurementCacheKey(channel));
}

export function getCachedMeasurements(
  channel: string,
  manager: CacheManager = cacheManager,
): ApiMeasurement[] {
  return getCachedMeasurementEntry(channel, manager)?.data ?? [];
}

export function getCachedMeasurementSyncState(
  channel: string,
  manager: CacheManager = cacheManager,
): MeasurementSyncState | null {
  return manager.get<MeasurementSyncState>(getMeasurementSyncStateCacheKey(channel))?.data ?? null;
}

export function getCachedAnalytics<T extends AnalyticsType>(
  channel: string,
  type: T,
  manager: CacheManager = cacheManager,
): AnalyticsResponseMap[T] | null {
  return manager.get<AnalyticsResponseMap[T]>(getAnalyticsCacheKey(channel, type))?.data ?? null;
}

export function getCachedOperationalHistoryEntry(
  channel: string,
  period: OperationalChartPeriod,
  manager: CacheManager = cacheManager,
): CacheEntry<OperationalHistoryCachePayload> | null {
  return manager.get<OperationalHistoryCachePayload>(
    getOperationalHistoryCacheKey(channel, period),
  );
}

export function getCachedOperationalHistoryPayload(
  channel: string,
  period: OperationalChartPeriod,
  manager: CacheManager = cacheManager,
): OperationalHistoryCachePayload | null {
  return getCachedOperationalHistoryEntry(channel, period, manager)?.data ?? null;
}

export function getCachedOperationalHistory(
  channel: string,
  period: OperationalChartPeriod,
  manager: CacheManager = cacheManager,
): OperationalData[] {
  const payload = getCachedOperationalHistoryPayload(channel, period, manager);

  if (!payload) {
    return [];
  }

  return payload.points.map((point) => ({
    freezerEnergy: point.freezerEnergy,
    equipmentEnergy: point.equipmentEnergy,
    temperature: point.temperature,
    occupancy: point.occupancy,
    timestamp: parseApiTimestamp(point.timestamp),
  }));
}
