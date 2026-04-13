import { API_CONFIG } from '../../config/api';
import { SENSOR_MAP } from '../../config/channels';
import {
  DEFAULT_OCCUPANCY_CONFIG,
  DEFAULT_TEMPERATURE_CONFIG,
} from '../../domain/constants/dashboard';
import { buildOperationalSeries } from '../../domain/transformers/operationalSeriesTransformer';
import type {
  BackupChannelSnapshot,
  OperationalChartPeriod,
  OperationalHistoryCachePayload,
  OperationalHistoryPoint,
} from '../../domain/types';
import { parseApiTimestamp } from '../api/timestamps';
import type { ApiMeasurement, AnalyticsType } from '../api/types';
import { loadBackupSnapshot } from '../backup/snapshot';
import { runtimeEndpoints, type RuntimeEndpoints } from '../runtime/endpoints';
import type {
  BootstrapResponse,
  DailyHistorySample,
  HistoryResponse,
  RecentResponse,
} from '../runtime/types';
import { cacheManager, type CacheEntry, type CacheManager } from './cacheManager';
import {
  getAnalyticsCacheKey,
  getMeasurementCacheKey,
  getMeasurementSyncStateCacheKey,
  getOperationalHistoryCacheKey,
} from './cacheKeys';
import type {
  MeasurementDataSource,
  MeasurementSyncState,
} from './types';

type BackupSnapshotLoader = (channel: string) => Promise<BackupChannelSnapshot | null>;

interface SyncStrategyOptions {
  cacheManager?: CacheManager;
  runtimeEndpoints?: RuntimeEndpoints;
  backupSnapshotLoader?: BackupSnapshotLoader;
  now?: () => Date;
  analyticsTtlMs?: number;
  measurementCacheWindowHours?: number;
  analyticsWindowDays?: number;
  staleFallbackRecheckMs?: number;
  staleFallbackProbeOffsetsMinutes?: readonly number[];
  staleFallbackProbeWindowMinutes?: number;
}

const OPERATIONAL_HISTORY_CONFIG: Record<
  OperationalChartPeriod,
  {
    rangeHours: number;
    stepHours: number;
    ttlMs: number;
    windowMinutes: number;
  }
> = {
  '24h': {
    rangeHours: 24,
    stepHours: 1,
    ttlMs: 6 * 60 * 60 * 1000,
    windowMinutes: 20,
  },
  '7d': {
    rangeHours: 7 * 24,
    stepHours: 24,
    ttlMs: 6 * 60 * 60 * 1000,
    windowMinutes: 30,
  },
  '30d': {
    rangeHours: 30 * 24,
    stepHours: 24,
    ttlMs: 12 * 60 * 60 * 1000,
    windowMinutes: 90,
  },
};

function addHours(date: Date, hours: number): Date {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function subtractHours(date: Date, hours: number): Date {
  return addHours(date, -hours);
}

function subtractMinutes(date: Date, minutes: number): Date {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() - minutes);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatLocalDateKey(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function createLocalDayEndTimestamp(dayKey: string): string {
  return `${dayKey}T23:59:59`;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getMeasurementAgeHours(
  latestMeasurementAt: string | null,
  now: Date,
): number | null {
  if (!latestMeasurementAt) {
    return null;
  }

  return round(
    Math.max(
      0,
      (now.getTime() - parseApiTimestamp(latestMeasurementAt).getTime()) / 3_600_000,
    ),
  );
}

function latestMeasurementTimestamp(measurements: ApiMeasurement[]): string | null {
  if (measurements.length === 0) {
    return null;
  }

  return measurements.reduce((latest, measurement) => {
    return measurement.timestamp > latest ? measurement.timestamp : latest;
  }, measurements[0].timestamp);
}

function mergeMeasurements(
  current: ApiMeasurement[],
  incoming: ApiMeasurement[],
): ApiMeasurement[] {
  const map = new Map<string, ApiMeasurement>();

  [...current, ...incoming].forEach((measurement) => {
    map.set(
      `${measurement.channel}::${measurement.sensor}::${measurement.timestamp}`,
      measurement,
    );
  });

  return Array.from(map.values()).sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

function toOperationalHistoryPoint(
  measurements: ApiMeasurement[],
): OperationalHistoryPoint | null {
  const latestAt = latestMeasurementTimestamp(measurements);

  if (!latestAt) {
    return null;
  }

  const series = buildOperationalSeries(
    measurements,
    { ...SENSOR_MAP },
    { ...DEFAULT_TEMPERATURE_CONFIG },
    { ...DEFAULT_OCCUPANCY_CONFIG },
  );
  const latest = series[series.length - 1];

  if (!latest) {
    return null;
  }

  return {
    freezerEnergy: latest.freezerEnergy,
    equipmentEnergy: latest.equipmentEnergy,
    temperature: latest.temperature,
    occupancy: latest.occupancy,
    timestamp: latestAt,
  };
}

function mapPointsByDay(
  points: OperationalHistoryPoint[],
): Map<string, OperationalHistoryPoint> {
  const map = new Map<string, OperationalHistoryPoint>();

  points.forEach((point) => {
    map.set(formatLocalDateKey(parseApiTimestamp(point.timestamp)), point);
  });

  return map;
}

function buildDailyHistoryPoints(
  samples: DailyHistorySample[],
): OperationalHistoryPoint[] {
  return samples.flatMap((sample) => {
    if (!sample.measurements.length || !sample.measurementAt) {
      return [];
    }

    const point = toOperationalHistoryPoint(sample.measurements);
    if (!point) {
      return [];
    }

    return [
      {
        ...point,
        timestamp: sample.measurementAt,
      },
    ];
  });
}

function getHistoryAnchorAt(
  historyResponse: HistoryResponse | null,
  fallbackAnchorAt: string,
): string {
  if (!historyResponse || historyResponse.samples.length === 0) {
    return fallbackAnchorAt;
  }

  const sampleWithMeasurement = [...historyResponse.samples]
    .reverse()
    .find((sample) => sample.measurementAt);

  if (sampleWithMeasurement?.measurementAt) {
    return sampleWithMeasurement.measurementAt;
  }

  return createLocalDayEndTimestamp(
    historyResponse.samples[historyResponse.samples.length - 1].date,
  );
}

function averageHistoryPoints(
  previous: OperationalHistoryPoint,
  penultimate: OperationalHistoryPoint,
  dayKey: string,
): OperationalHistoryPoint {
  return {
    freezerEnergy: round(
      (previous.freezerEnergy + penultimate.freezerEnergy) / 2,
    ),
    equipmentEnergy: round(
      (previous.equipmentEnergy + penultimate.equipmentEnergy) / 2,
    ),
    temperature: round((previous.temperature + penultimate.temperature) / 2),
    occupancy: round((previous.occupancy + penultimate.occupancy) / 2),
    timestamp: createLocalDayEndTimestamp(dayKey),
  };
}

function mergeDailyHistoryPoints(
  basePoints: OperationalHistoryPoint[],
  overlayPoints: OperationalHistoryPoint[],
  period: Extract<OperationalChartPeriod, '7d' | '30d'>,
  anchor: Date,
): OperationalHistoryPoint[] {
  const dayCount = period === '7d' ? 7 : 30;
  const anchorDay = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate(),
    0,
    0,
    0,
    0,
  );
  const baseMap = mapPointsByDay(basePoints);
  const overlayMap = mapPointsByDay(overlayPoints);
  const merged: OperationalHistoryPoint[] = [];

  for (let index = dayCount - 1; index >= 0; index -= 1) {
    const dayKey = formatLocalDateKey(addDays(anchorDay, -index));
    const overlayPoint = overlayMap.get(dayKey);

    if (overlayPoint) {
      merged.push(overlayPoint);
      continue;
    }

    if (merged.length >= 2) {
      merged.push(
        averageHistoryPoints(
          merged[merged.length - 1],
          merged[merged.length - 2],
          dayKey,
        ),
      );
      continue;
    }

    const basePoint = baseMap.get(dayKey);
    if (basePoint) {
      merged.push(basePoint);
    }
  }

  return merged;
}

function getBucketKey(
  timestamp: string,
  anchor: Date,
  config: (typeof OPERATIONAL_HISTORY_CONFIG)[OperationalChartPeriod],
): number | null {
  const diffMs = anchor.getTime() - parseApiTimestamp(timestamp).getTime();
  const rangeMs = config.rangeHours * 60 * 60 * 1000;
  const stepMs = config.stepHours * 60 * 60 * 1000;

  if (diffMs < 0 || diffMs > rangeMs) {
    return null;
  }

  return Math.floor(diffMs / stepMs);
}

function buildOverlayHistoryPoints(
  measurements: ApiMeasurement[],
  period: OperationalChartPeriod,
  anchor: Date,
): OperationalHistoryPoint[] {
  const config = OPERATIONAL_HISTORY_CONFIG[period];
  const pointCount = Math.max(1, Math.ceil(config.rangeHours / config.stepHours));
  const points: OperationalHistoryPoint[] = [];
  const seen = new Set<string>();

  for (let index = pointCount - 1; index >= 0; index -= 1) {
    const bucketEnd = subtractHours(anchor, index * config.stepHours);
    const bucketStart = subtractMinutes(bucketEnd, config.windowMinutes);
    const bucketMeasurements = measurements.filter((measurement) => {
      const timestamp = parseApiTimestamp(measurement.timestamp).getTime();
      return (
        timestamp >= bucketStart.getTime() && timestamp <= bucketEnd.getTime()
      );
    });
    const point = toOperationalHistoryPoint(bucketMeasurements);

    if (!point || seen.has(point.timestamp)) {
      continue;
    }

    seen.add(point.timestamp);
    points.push(point);
  }

  return points;
}

function mergeHistoryPoints(
  basePoints: OperationalHistoryPoint[],
  overlayPoints: OperationalHistoryPoint[],
  period: OperationalChartPeriod,
  anchor: Date,
): OperationalHistoryPoint[] {
  const config = OPERATIONAL_HISTORY_CONFIG[period];
  const pointMap = new Map<number, OperationalHistoryPoint>();

  [...basePoints, ...overlayPoints].forEach((point) => {
    const bucketKey = getBucketKey(point.timestamp, anchor, config);
    if (bucketKey === null) {
      return;
    }

    pointMap.set(bucketKey, point);
  });

  return Array.from(pointMap.values()).sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

function buildSyncMessageFromBootstrap(
  response: BootstrapResponse,
): string {
  return response.message ?? `Snapshot ${response.snapshotStatus} carregado.`;
}

function buildSyncMessageFromRecent(
  response: RecentResponse,
  latestMeasurementAt: string | null,
): string {
  if (response.message) {
    return response.message;
  }

  if (latestMeasurementAt) {
    return `Sem dados novos nas ultimas 72 horas; exibindo ${latestMeasurementAt}.`;
  }

  return 'Nenhum dado recente foi encontrado.';
}

export class SyncStrategy {
  private cacheManager: CacheManager;

  private runtimeEndpoints: RuntimeEndpoints;

  private backupSnapshotLoader: BackupSnapshotLoader;

  private now: () => Date;

  private analyticsTtlMs: number;

  private measurementCacheWindowHours: number;

  private analyticsWindowDays: number;

  private staleFallbackRecheckMs: number;

  private staleFallbackProbeOffsetsMinutes: readonly number[];

  private staleFallbackProbeWindowMinutes: number;

  constructor(options: SyncStrategyOptions = {}) {
    this.cacheManager = options.cacheManager ?? cacheManager;
    this.runtimeEndpoints = options.runtimeEndpoints ?? runtimeEndpoints;
    this.backupSnapshotLoader = options.backupSnapshotLoader ?? loadBackupSnapshot;
    this.now = options.now ?? (() => new Date());
    this.analyticsTtlMs = options.analyticsTtlMs ?? API_CONFIG.analyticsTtlMs;
    this.measurementCacheWindowHours =
      options.measurementCacheWindowHours ??
      API_CONFIG.measurementCacheWindowHours;
    this.analyticsWindowDays =
      options.analyticsWindowDays ?? API_CONFIG.analyticsWindowDays;
    this.staleFallbackRecheckMs =
      options.staleFallbackRecheckMs ?? API_CONFIG.staleFallbackRecheckMs;
    this.staleFallbackProbeOffsetsMinutes =
      options.staleFallbackProbeOffsetsMinutes ??
      API_CONFIG.staleFallbackProbeOffsetsMinutes;
    this.staleFallbackProbeWindowMinutes =
      options.staleFallbackProbeWindowMinutes ??
      API_CONFIG.staleFallbackProbeWindowMinutes;
  }

  needsColdStart(channel: string): boolean {
    return (
      this.cacheManager.get<ApiMeasurement[]>(getMeasurementCacheKey(channel)) === null
    );
  }

  async coldStart(channel: string, onProgress?: (progress: number) => void): Promise<void> {
    onProgress?.(0);
    const nowIso = this.now().toISOString();
    const bundledSnapshot = await this.backupSnapshotLoader(channel);

    if (bundledSnapshot) {
      const bundledSnapshotAgeHours = getMeasurementAgeHours(
        bundledSnapshot.latestMeasurementAt,
        this.now(),
      );
      this.hydrateSnapshot(channel, bundledSnapshot, {
        dataSource: 'backup',
        status: 'backup',
        lastApiAttemptAt: null,
        lastSuccessfulApiSyncAt: null,
        backupSnapshotStatus: 'bundled',
        backupRefreshAttemptedAt: null,
        backupRefreshFinishedAt: null,
        backupRefreshDurationMs: null,
        backupRefreshError: null,
        backupSnapshotAgeHours: bundledSnapshotAgeHours,
        isBackupSnapshotFreshEnough:
          bundledSnapshotAgeHours !== null && bundledSnapshotAgeHours <= 72,
        message:
          'Snapshot local carregado enquanto o backup renovavel e consultado.',
      });
      onProgress?.(35);
    }

    try {
      const response = await this.runtimeEndpoints.getBootstrapSnapshot(channel);
      this.hydrateSnapshot(channel, response.snapshot, {
        dataSource: 'backup',
        status: 'backup',
        lastApiAttemptAt: nowIso,
        lastSuccessfulApiSyncAt: null,
        backupSnapshotStatus: response.snapshotStatus,
        backupRefreshAttemptedAt: response.refreshAttemptedAt,
        backupRefreshFinishedAt: response.refreshFinishedAt,
        backupRefreshDurationMs: response.refreshDurationMs,
        backupRefreshError: response.refreshError,
        backupSnapshotAgeHours: response.snapshotAgeHours,
        isBackupSnapshotFreshEnough: response.isSnapshotFreshEnough,
        message: buildSyncMessageFromBootstrap(response),
      });
      onProgress?.(100);
    } catch (error) {
      onProgress?.(100);

      if (this.getMeasurementSyncState(channel)?.latestMeasurementAt) {
        return;
      }

      throw error;
    }
  }

  async syncDelta(channel: string): Promise<void> {
    if (this.needsColdStart(channel)) {
      await this.coldStart(channel);
      return;
    }

    const now = this.now();
    const existingMeasurements =
      this.cacheManager.get<ApiMeasurement[]>(getMeasurementCacheKey(channel))?.data ?? [];
    const previousState = this.getMeasurementSyncState(channel);
    const latestKnownMeasurementAt =
      previousState?.recentAnchorAt ??
      previousState?.latestMeasurementAt ??
      latestMeasurementTimestamp(existingMeasurements);
    const allowProbe = this.shouldProbeForRecent(
      latestKnownMeasurementAt,
      previousState?.lastFallbackCheckAt ?? null,
      now,
    );
    const recentResponse = await this.runtimeEndpoints.getRecentMeasurements(channel, {
      lastKnownAt: latestKnownMeasurementAt,
      shouldProbe: allowProbe,
    });

    if (recentResponse.measurements.length === 0) {
      const latestMeasurementAt =
        latestKnownMeasurementAt ?? latestMeasurementTimestamp(existingMeasurements);
      const hasBackupBaseline =
        previousState?.backupSnapshotGeneratedAt !== null ||
        previousState?.dataSource === 'backup' ||
        previousState?.dataSource === 'hybrid';
      const dataSource: MeasurementDataSource =
        previousState?.dataSource === 'hybrid'
          ? 'hybrid'
          : hasBackupBaseline
            ? 'backup'
            : 'api';
      const state: MeasurementSyncState = {
        channel,
        status: latestMeasurementAt ? 'fallback_stale' : 'empty',
        dataSource,
        latestMeasurementAt,
        lastFallbackCheckAt: allowProbe
          ? recentResponse.checkedAt
          : previousState?.lastFallbackCheckAt ?? null,
        lastApiAttemptAt: now.toISOString(),
        lastSuccessfulApiSyncAt: previousState?.lastSuccessfulApiSyncAt ?? null,
        backupSnapshotGeneratedAt: previousState?.backupSnapshotGeneratedAt ?? null,
        backupSnapshotStatus: previousState?.backupSnapshotStatus ?? null,
        backupRefreshAttemptedAt:
          previousState?.backupRefreshAttemptedAt ?? null,
        backupRefreshFinishedAt:
          previousState?.backupRefreshFinishedAt ?? null,
        backupRefreshDurationMs:
          previousState?.backupRefreshDurationMs ?? null,
        backupRefreshError: previousState?.backupRefreshError ?? null,
        backupSnapshotAgeHours:
          previousState?.backupSnapshotAgeHours ??
          getMeasurementAgeHours(latestMeasurementAt, now),
        isBackupSnapshotFreshEnough:
          previousState?.isBackupSnapshotFreshEnough ??
          (getMeasurementAgeHours(latestMeasurementAt, now) ?? Number.POSITIVE_INFINITY) <=
            72,
        recentAnchorAt: previousState?.recentAnchorAt ?? latestMeasurementAt,
        recentWindowFrom:
          recentResponse.probeWindow?.from ?? previousState?.recentWindowFrom ?? null,
        recentWindowTo:
          recentResponse.probeWindow?.to ?? previousState?.recentWindowTo ?? null,
        message: buildSyncMessageFromRecent(recentResponse, latestMeasurementAt),
      };

      this.setMeasurementSyncState(channel, state);
      await this.syncOperationalHistory(channel, '24h');
      await this.syncOperationalHistory(channel, '7d');
      await this.syncOperationalHistory(channel, '30d');
      return;
    }

    const mergedMeasurements = this.trimMeasurements(
      mergeMeasurements(existingMeasurements, recentResponse.measurements),
    );
    const latestMeasurementAt =
      latestMeasurementTimestamp(mergedMeasurements) ??
      recentResponse.anchorAt ??
      latestKnownMeasurementAt;

    this.cacheManager.set(getMeasurementCacheKey(channel), mergedMeasurements);

    const isFresh =
      latestMeasurementAt !== null &&
      now.getTime() - parseApiTimestamp(latestMeasurementAt).getTime() <=
        API_CONFIG.staleAfterMs;
    const dataSource: MeasurementDataSource =
      previousState?.dataSource === 'backup' || previousState?.dataSource === 'hybrid'
        ? 'hybrid'
        : 'api';
    const state: MeasurementSyncState = {
      channel,
      status: isFresh ? 'fresh' : 'fallback_stale',
      dataSource,
      latestMeasurementAt,
      lastFallbackCheckAt:
        recentResponse.source === 'probed_window' ? recentResponse.checkedAt : null,
      lastApiAttemptAt: now.toISOString(),
      lastSuccessfulApiSyncAt: now.toISOString(),
      backupSnapshotGeneratedAt: previousState?.backupSnapshotGeneratedAt ?? null,
      backupSnapshotStatus: previousState?.backupSnapshotStatus ?? null,
      backupRefreshAttemptedAt: previousState?.backupRefreshAttemptedAt ?? null,
      backupRefreshFinishedAt: previousState?.backupRefreshFinishedAt ?? null,
      backupRefreshDurationMs: previousState?.backupRefreshDurationMs ?? null,
      backupRefreshError: previousState?.backupRefreshError ?? null,
      backupSnapshotAgeHours:
        previousState?.backupSnapshotAgeHours ??
        getMeasurementAgeHours(previousState?.latestMeasurementAt ?? null, now),
      isBackupSnapshotFreshEnough:
        previousState?.isBackupSnapshotFreshEnough ??
        (getMeasurementAgeHours(previousState?.latestMeasurementAt ?? null, now) ??
          Number.POSITIVE_INFINITY) <= 72,
      recentAnchorAt: recentResponse.anchorAt ?? latestMeasurementAt,
      recentWindowFrom: recentResponse.probeWindow?.from ?? null,
      recentWindowTo: recentResponse.probeWindow?.to ?? null,
      message: buildSyncMessageFromRecent(recentResponse, latestMeasurementAt),
    };

    this.setMeasurementSyncState(channel, state);
    await this.syncOperationalHistory(channel, '24h');
    await this.syncOperationalHistory(channel, '7d');
    await this.syncOperationalHistory(channel, '30d');
  }

  async syncAnalytics(_channel: string): Promise<void> {
    return Promise.resolve();
  }

  async syncOperationalHistory(
    channel: string,
    period: OperationalChartPeriod,
  ): Promise<void> {
    const cacheKey = getOperationalHistoryCacheKey(channel, period);
    const cachedEntry =
      this.cacheManager.get<OperationalHistoryCachePayload>(cacheKey);
    const cachedPayload = cachedEntry?.data ?? null;
    const measurements =
      this.cacheManager.get<ApiMeasurement[]>(getMeasurementCacheKey(channel))?.data ?? [];
    const syncState = this.getMeasurementSyncState(channel);
    const latestMeasurementAt =
      syncState?.recentAnchorAt ??
      syncState?.latestMeasurementAt ??
      latestMeasurementTimestamp(measurements) ??
      cachedPayload?.anchorMeasurementAt ??
      null;

    if (!latestMeasurementAt) {
      return;
    }

    const anchor = parseApiTimestamp(latestMeasurementAt);

    if (period === '7d' || period === '30d') {
      const historyResponse = await this.fetchRuntimeHistoryIfNeeded(
        channel,
        period,
        latestMeasurementAt,
        syncState,
        cachedEntry,
      );
      const historyAnchorAt = getHistoryAnchorAt(
        historyResponse,
        latestMeasurementAt,
      );
      const overlayPoints = historyResponse
        ? buildDailyHistoryPoints(historyResponse.samples)
        : [];
      const mergedDailyPoints = mergeDailyHistoryPoints(
        cachedPayload?.points ?? [],
        overlayPoints,
        period,
        parseApiTimestamp(historyAnchorAt),
      );

      this.cacheManager.set(cacheKey, {
        anchorMeasurementAt: historyAnchorAt,
        period,
        points: mergedDailyPoints,
      });
      return;
    }

    const overlayPoints = buildOverlayHistoryPoints(measurements, period, anchor);

    if (!cachedPayload) {
      this.cacheManager.set(cacheKey, {
        anchorMeasurementAt: latestMeasurementAt,
        period,
        points: overlayPoints,
      });
      return;
    }

    this.cacheManager.set(cacheKey, {
      anchorMeasurementAt: latestMeasurementAt,
      period,
      points: mergeHistoryPoints(cachedPayload.points, overlayPoints, period, anchor),
    });
  }

  private async fetchRuntimeHistoryIfNeeded(
    channel: string,
    period: Extract<OperationalChartPeriod, '7d' | '30d'>,
    latestMeasurementAt: string,
    syncState: MeasurementSyncState | null,
    cachedEntry: CacheEntry<OperationalHistoryCachePayload> | null,
  ): Promise<HistoryResponse | null> {
    const cacheKey = getOperationalHistoryCacheKey(channel, period);
    const config = OPERATIONAL_HISTORY_CONFIG[period];
    const expectedPointCount = period === '7d' ? 7 : 30;
    const isBundledFallback =
      syncState?.backupSnapshotStatus === 'bundled' ||
      (syncState?.backupSnapshotStatus === 'last_good' &&
        syncState.isBackupSnapshotFreshEnough === false);
    const shouldRefresh =
      !cachedEntry ||
      cachedEntry.data.points.length === 0 ||
      cachedEntry.data.anchorMeasurementAt !== latestMeasurementAt ||
      this.cacheManager.isExpired(cacheKey, config.ttlMs) ||
      (isBundledFallback && cachedEntry.data.points.length < expectedPointCount);

    if (!shouldRefresh) {
      return null;
    }

    return this.runtimeEndpoints.getHistory(channel, period === '7d' ? 7 : 30);
  }

  private shouldProbeForRecent(
    latestKnownMeasurementAt: string | null,
    lastFallbackCheckAt: string | null,
    now: Date,
  ): boolean {
    if (lastFallbackCheckAt) {
      const elapsedSinceFallback =
        now.getTime() - new Date(lastFallbackCheckAt).getTime();
      if (elapsedSinceFallback < this.staleFallbackRecheckMs) {
        return false;
      }
    }

    if (!latestKnownMeasurementAt) {
      return true;
    }

    const ageMs =
      now.getTime() - parseApiTimestamp(latestKnownMeasurementAt).getTime();
    return ageMs > API_CONFIG.recentDeltaWindowMinutes * 60 * 1000;
  }

  private getMeasurementSyncState(channel: string): MeasurementSyncState | null {
    return (
      this.cacheManager.get<MeasurementSyncState>(
        getMeasurementSyncStateCacheKey(channel),
      )?.data ?? null
    );
  }

  private setMeasurementSyncState(channel: string, state: MeasurementSyncState): void {
    this.cacheManager.set(getMeasurementSyncStateCacheKey(channel), state);
  }

  private hydrateSnapshot(
    channel: string,
    snapshot: BackupChannelSnapshot,
    options: {
      dataSource: MeasurementDataSource;
      status: MeasurementSyncState['status'];
      lastApiAttemptAt: string | null;
      lastSuccessfulApiSyncAt: string | null;
      backupSnapshotStatus: MeasurementSyncState['backupSnapshotStatus'];
      backupRefreshAttemptedAt: string | null;
      backupRefreshFinishedAt: string | null;
      backupRefreshDurationMs: number | null;
      backupRefreshError: string | null;
      backupSnapshotAgeHours: number | null;
      isBackupSnapshotFreshEnough: boolean | null;
      message: string;
    },
  ): void {
    this.cacheManager.set(
      getMeasurementCacheKey(channel),
      this.trimMeasurements(snapshot.operational.recentMeasurements),
    );
    (
      Object.entries(snapshot.operational.histories) as Array<
        [OperationalChartPeriod, OperationalHistoryCachePayload]
      >
    ).forEach(([period, payload]) => {
      this.cacheManager.set(getOperationalHistoryCacheKey(channel, period), payload);
    });
    this.cacheManager.set(
      getAnalyticsCacheKey(channel, 'consumption' as AnalyticsType),
      snapshot.business.consumption,
    );
    this.cacheManager.set(
      getAnalyticsCacheKey(channel, 'demand_peaks' as AnalyticsType),
      snapshot.business.demandPeaks,
    );
    this.cacheManager.set(
      getAnalyticsCacheKey(channel, 'electrical_health' as AnalyticsType),
      snapshot.business.electricalHealth,
    );
    this.cacheManager.set(
      getAnalyticsCacheKey(channel, 'hourly_profile' as AnalyticsType),
      snapshot.logistics.hourlyProfile,
    );
    this.cacheManager.set(
      getAnalyticsCacheKey(channel, 'current_by_sensor' as AnalyticsType),
      snapshot.logistics.currentBySensor,
    );

    this.setMeasurementSyncState(channel, {
      channel,
      status: options.status,
      dataSource: options.dataSource,
      latestMeasurementAt: snapshot.latestMeasurementAt,
      lastFallbackCheckAt: null,
      lastApiAttemptAt: options.lastApiAttemptAt,
      lastSuccessfulApiSyncAt: options.lastSuccessfulApiSyncAt,
      backupSnapshotGeneratedAt: snapshot.generatedAt,
      backupSnapshotStatus: options.backupSnapshotStatus,
      backupRefreshAttemptedAt: options.backupRefreshAttemptedAt,
      backupRefreshFinishedAt: options.backupRefreshFinishedAt,
      backupRefreshDurationMs: options.backupRefreshDurationMs,
      backupRefreshError: options.backupRefreshError,
      backupSnapshotAgeHours: options.backupSnapshotAgeHours,
      isBackupSnapshotFreshEnough: options.isBackupSnapshotFreshEnough,
      recentAnchorAt: null,
      recentWindowFrom: null,
      recentWindowTo: null,
      message: options.message,
    });
  }

  private trimMeasurements(measurements: ApiMeasurement[]): ApiMeasurement[] {
    const latestTimestamp = latestMeasurementTimestamp(measurements);

    if (!latestTimestamp) {
      return [];
    }

    const cutoff =
      parseApiTimestamp(latestTimestamp).getTime() -
      this.measurementCacheWindowHours * 60 * 60 * 1000;

    return measurements
      .filter(
        (measurement) =>
          parseApiTimestamp(measurement.timestamp).getTime() >= cutoff,
      )
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }
}
