// Default to a same-origin path so browser requests flow through local/prod proxies.
export const BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api';
export const TIMEOUT_MS = 10_000;
export const RETRY_DELAYS_MS = Object.freeze([1_000, 2_000, 4_000]);
export const RETRY_ATTEMPTS = RETRY_DELAYS_MS.length;
export const POLLING_INTERVAL_MS = 60_000;
export const DEGRADED_POLLING_INTERVAL_MS = 5 * 60_000;
export const CACHE_VERSION = '1.1';
export const COLD_START_MONTHS = 3;
export const STALE_FALLBACK_RECHECK_MS = 15 * 60 * 1_000;
// Discovery still probes day-based windows so we do not multiply startup traffic.
export const STALE_FALLBACK_PROBE_OFFSETS_DAYS = Object.freeze([
  1, 2, 3, 5, 7, 10, 14, 21, 30, 60, 90,
]);
export const STALE_FALLBACK_PROBE_WINDOW_HOURS = 1;
// Measurement sync probes the most recent history in 6h blocks before giving up.
export const STALE_FALLBACK_LOOKBACK_HOURS = 48;
export const STALE_FALLBACK_BLOCK_HOURS = 6;
export const ANALYTICS_TTL_MS = 60 * 60 * 1_000;
export const STALE_AFTER_MS = 2 * 60 * 1_000;
export const MEASUREMENT_CACHE_WINDOW_HOURS = 1;
export const ANALYTICS_WINDOW_DAYS = 30;
export const DEFAULT_CHANNEL =
  import.meta.env.VITE_DEFAULT_CHANNEL?.trim() || 'lab';

export const API_CONFIG = Object.freeze({
  baseUrl: BASE_URL,
  timeoutMs: TIMEOUT_MS,
  retryDelaysMs: RETRY_DELAYS_MS,
  pollingIntervalMs: POLLING_INTERVAL_MS,
  degradedPollingIntervalMs: DEGRADED_POLLING_INTERVAL_MS,
  cacheVersion: CACHE_VERSION,
  coldStartMonths: COLD_START_MONTHS,
  staleFallbackRecheckMs: STALE_FALLBACK_RECHECK_MS,
  staleFallbackProbeOffsetsDays: STALE_FALLBACK_PROBE_OFFSETS_DAYS,
  staleFallbackProbeWindowHours: STALE_FALLBACK_PROBE_WINDOW_HOURS,
  staleFallbackLookbackHours: STALE_FALLBACK_LOOKBACK_HOURS,
  staleFallbackBlockHours: STALE_FALLBACK_BLOCK_HOURS,
  analyticsTtlMs: ANALYTICS_TTL_MS,
  staleAfterMs: STALE_AFTER_MS,
  measurementCacheWindowHours: MEASUREMENT_CACHE_WINDOW_HOURS,
  analyticsWindowDays: ANALYTICS_WINDOW_DAYS,
  defaultChannel: DEFAULT_CHANNEL,
});
