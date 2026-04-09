import type { AnalyticsType } from '../api/types';
import type { OperationalChartPeriod } from '../../domain/types';
import { CACHE_VERSION as API_CACHE_VERSION } from '../../config/api';

export const STORAGE_PREFIX = 'frigorifico_';
export const CACHE_VERSION = API_CACHE_VERSION;

export function getVersionStorageKey(): string {
  return 'cache_version';
}

export function getMeasurementCacheKey(channel: string): string {
  return `cache_measurements_${channel}`;
}

export function getMeasurementSyncStateCacheKey(channel: string): string {
  return `cache_measurement_sync_state_${channel}`;
}

export function getAnalyticsCacheKey(channel: string, type: AnalyticsType): string {
  return `cache_analytics_${type}_${channel}`;
}

export function getOperationalHistoryCacheKey(
  channel: string,
  period: OperationalChartPeriod,
): string {
  return `cache_operational_history_${channel}_${period}`;
}
