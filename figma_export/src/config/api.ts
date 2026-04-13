export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || '/internal/';
export const TIMEOUT_MS = 10_000;
export const RETRY_DELAYS_MS = Object.freeze([1_000, 2_000, 4_000]);
export const RETRY_ATTEMPTS = RETRY_DELAYS_MS.length;
export const POLLING_INTERVAL_MS = 60_000;
export const DEGRADED_POLLING_INTERVAL_MS = 5 * 60_000;
export const CACHE_VERSION = '1.0';
export const COLD_START_MONTHS = 3;
export const STALE_FALLBACK_RECHECK_MS = 15 * 60 * 1_000;
export const STALE_FALLBACK_PROBE_OFFSETS_MINUTES = Object.freeze([
  30, 60, 120, 180, 240, 360, 480, 720, 1080, 1440, 2160, 2880, 3600, 4320,
]);
export const STALE_FALLBACK_PROBE_WINDOW_MINUTES = 10;
export const ANALYTICS_TTL_MS = 60 * 60 * 1_000;
export const STALE_AFTER_MS = 2 * 60 * 1_000;
export const MEASUREMENT_CACHE_WINDOW_HOURS = 2;
export const ANALYTICS_WINDOW_DAYS = 30;
export const RECENT_DELTA_WINDOW_MINUTES = 30;
export const INITIAL_RECENT_POLL_DELAY_MS = 60_000;
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
  staleFallbackProbeOffsetsMinutes: STALE_FALLBACK_PROBE_OFFSETS_MINUTES,
  staleFallbackProbeWindowMinutes: STALE_FALLBACK_PROBE_WINDOW_MINUTES,
  analyticsTtlMs: ANALYTICS_TTL_MS,
  staleAfterMs: STALE_AFTER_MS,
  measurementCacheWindowHours: MEASUREMENT_CACHE_WINDOW_HOURS,
  analyticsWindowDays: ANALYTICS_WINDOW_DAYS,
  recentDeltaWindowMinutes: RECENT_DELTA_WINDOW_MINUTES,
  initialRecentPollDelayMs: INITIAL_RECENT_POLL_DELAY_MS,
  defaultChannel: DEFAULT_CHANNEL,
});
