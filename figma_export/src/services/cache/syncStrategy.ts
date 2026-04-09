import { API_CONFIG } from '../../config/api';
import { SENSOR_MAP } from '../../config/channels';
import { DEFAULT_OCCUPANCY_CONFIG, DEFAULT_TEMPERATURE_CONFIG } from '../../domain/constants/dashboard';
import { buildOperationalSeries } from '../../domain/transformers/operationalSeriesTransformer';
import type {
  BackupChannelSnapshot,
  OperationalChartPeriod,
  OperationalHistoryCachePayload,
  OperationalHistoryPoint,
} from '../../domain/types';
import { parseApiTimestamp } from '../api/timestamps';
import { apiEndpoints, type ApiEndpoints } from '../api/endpoints';
import type { AnalyticsResponseMap, AnalyticsType, ApiMeasurement } from '../api/types';
import { loadBackupSnapshot } from '../backup/snapshot';
import { cacheManager, type CacheManager } from './cacheManager';
import {
  getAnalyticsCacheKey,
  getMeasurementCacheKey,
  getMeasurementSyncStateCacheKey,
  getOperationalHistoryCacheKey,
} from './cacheKeys';
import type { MeasurementSyncState } from './types';

type BackupSnapshotLoader = (channel: string) => Promise<BackupChannelSnapshot | null>;

interface SyncStrategyOptions {
  cacheManager?: CacheManager;
  endpoints?: ApiEndpoints;
  backupSnapshotLoader?: BackupSnapshotLoader;
  now?: () => Date;
  analyticsTtlMs?: number;
  measurementCacheWindowHours?: number;
  analyticsWindowDays?: number;
  staleFallbackRecheckMs?: number;
  staleFallbackProbeOffsetsDays?: readonly number[];
  staleFallbackProbeWindowHours?: number;
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
    stepHours: 6,
    ttlMs: 12 * 60 * 60 * 1000,
    windowMinutes: 30,
  },
  '30d': {
    rangeHours: 30 * 24,
    stepHours: 24,
    ttlMs: 24 * 60 * 60 * 1000,
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

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function subtractMinutes(date: Date, minutes: number): Date {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() - minutes);
  return next;
}

function latestMeasurementTimestamp(measurements: ApiMeasurement[]): string | null {
  if (measurements.length === 0) {
    return null;
  }

  return measurements.reduce((latest, measurement) => {
    return measurement.timestamp > latest ? measurement.timestamp : latest;
  }, measurements[0].timestamp);
}

function hasAnalyticsResults(
  response: AnalyticsResponseMap[AnalyticsType] | null,
): response is AnalyticsResponseMap[AnalyticsType] & { results: unknown[] } {
  return Array.isArray(response?.results) && response.results.length > 0;
}

function mergeMeasurements(current: ApiMeasurement[], incoming: ApiMeasurement[]): ApiMeasurement[] {
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

class BackupFallbackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupFallbackError';
  }
}

export class SyncStrategy {
  private cacheManager: CacheManager;

  private endpoints: ApiEndpoints;

  private backupSnapshotLoader: BackupSnapshotLoader;

  private now: () => Date;

  private analyticsTtlMs: number;

  private measurementCacheWindowHours: number;

  private analyticsWindowDays: number;

  private staleFallbackRecheckMs: number;

  private staleFallbackProbeOffsetsDays: readonly number[];

  private staleFallbackProbeWindowHours: number;

  constructor(options: SyncStrategyOptions = {}) {
    this.cacheManager = options.cacheManager ?? cacheManager;
    this.endpoints = options.endpoints ?? apiEndpoints;
    this.backupSnapshotLoader = options.backupSnapshotLoader ?? loadBackupSnapshot;
    this.now = options.now ?? (() => new Date());
    this.analyticsTtlMs = options.analyticsTtlMs ?? API_CONFIG.analyticsTtlMs;
    this.measurementCacheWindowHours =
      options.measurementCacheWindowHours ?? API_CONFIG.measurementCacheWindowHours;
    this.analyticsWindowDays = options.analyticsWindowDays ?? API_CONFIG.analyticsWindowDays;
    this.staleFallbackRecheckMs =
      options.staleFallbackRecheckMs ?? API_CONFIG.staleFallbackRecheckMs;
    this.staleFallbackProbeOffsetsDays =
      options.staleFallbackProbeOffsetsDays ?? API_CONFIG.staleFallbackProbeOffsetsDays;
    this.staleFallbackProbeWindowHours =
      options.staleFallbackProbeWindowHours ?? API_CONFIG.staleFallbackProbeWindowHours;
  }

  needsColdStart(channel: string): boolean {
    return this.cacheManager.get<ApiMeasurement[]>(getMeasurementCacheKey(channel)) === null;
  }

  async coldStart(channel: string, onProgress?: (progress: number) => void): Promise<void> {
    const now = this.now();
    const start = subtractHours(now, this.measurementCacheWindowHours);

    onProgress?.(0);

    try {
      const response = await this.endpoints.getChannelMeasurements(
        channel,
        start.toISOString(),
        now.toISOString(),
      );
      const trimmedMeasurements = this.trimMeasurements(response.measurements);
      const syncState = await this.persistMeasurementState(channel, trimmedMeasurements, now, {
        responseMeasurements: trimmedMeasurements,
        forceFallbackSearch: trimmedMeasurements.length === 0,
      });

      if (syncState.status === 'backup') {
        onProgress?.(100);
        throw new BackupFallbackError(
          syncState.message ?? 'API indisponivel; usando o snapshot local do backup.',
        );
      }

      if (trimmedMeasurements.length > 0) {
        this.cacheManager.set(getMeasurementCacheKey(channel), trimmedMeasurements);
      }
      onProgress?.(100);
      await this.syncAnalytics(channel);
    } catch (error) {
      const fallbackState = await this.applyBackupFallback(channel, now, {
        lastApiAttemptAt: now.toISOString(),
        message:
          error instanceof Error
            ? `API indisponivel; usando dados do backup local. ${error.message}`
            : 'API indisponivel; usando dados do backup local.',
      });

      onProgress?.(100);

      if (fallbackState) {
        throw new BackupFallbackError(fallbackState.message ?? 'Usando dados do backup local.');
      }

      throw error;
    }
  }

  async syncDelta(channel: string): Promise<void> {
    if (this.needsColdStart(channel)) {
      await this.coldStart(channel);
      return;
    }

    if (this.getMeasurementSyncState(channel)?.dataSource === 'backup') {
      await this.coldStart(channel);
      return;
    }

    const key = getMeasurementCacheKey(channel);
    const lastSync = this.cacheManager.getLastSync(key);
    const nowDate = this.now();
    const now = nowDate.toISOString();

    if (!lastSync || lastSync >= now) {
      await this.syncAnalytics(channel);
      return;
    }

    try {
      const response = await this.endpoints.getChannelMeasurements(channel, lastSync, now);
      const existing = this.cacheManager.get<ApiMeasurement[]>(key)?.data ?? [];
      const mergedMeasurements =
        response.measurements.length > 0
          ? this.trimMeasurements(mergeMeasurements(existing, response.measurements))
          : existing;

      const syncState = await this.persistMeasurementState(channel, mergedMeasurements, nowDate, {
        responseMeasurements: response.measurements,
      });

      if (syncState.status === 'backup') {
        throw new BackupFallbackError(
          syncState.message ?? 'API sem dados atuais; usando o snapshot local do backup.',
        );
      }

      await this.syncAnalytics(channel);
    } catch (error) {
      const fallbackState = await this.applyBackupFallback(channel, nowDate, {
        lastApiAttemptAt: now,
        message:
          error instanceof Error
            ? `API indisponivel; usando dados do backup local. ${error.message}`
            : 'API indisponivel; usando dados do backup local.',
      });

      if (fallbackState) {
        throw new BackupFallbackError(fallbackState.message ?? 'Usando dados do backup local.');
      }

      throw error;
    }
  }

  async syncAnalytics(channel: string): Promise<void> {
    const now = this.now();
    const fromTime = subtractDays(now, this.analyticsWindowDays).toISOString();
    const toTime = now.toISOString();

    const tasks: Array<{
      type: AnalyticsType;
      run: () => Promise<unknown>;
    }> = [
      {
        type: 'consumption',
        run: () => this.endpoints.getConsumption(channel, fromTime, toTime),
      },
      {
        type: 'demand_peaks',
        run: () => this.endpoints.getDemandPeaks(channel, fromTime, toTime),
      },
      {
        type: 'electrical_health',
        run: () => this.endpoints.getElectricalHealth(channel, fromTime, toTime),
      },
      {
        type: 'hourly_profile',
        run: () => this.endpoints.getHourlyProfile(channel, fromTime, toTime),
      },
      {
        type: 'current_by_sensor',
        run: () => this.endpoints.getCurrentBySensor(channel, fromTime, toTime),
      },
    ];

    for (const task of tasks) {
      const cacheKey = getAnalyticsCacheKey(channel, task.type);
      const shouldForceRefresh = this.getMeasurementSyncState(channel)?.dataSource === 'backup';
      if (!shouldForceRefresh && !this.cacheManager.isExpired(cacheKey, this.analyticsTtlMs)) {
        continue;
      }

      const response = (await task.run()) as AnalyticsResponseMap[typeof task.type];
      const cachedResponse =
        this.cacheManager.get<AnalyticsResponseMap[typeof task.type]>(cacheKey)?.data ?? null;

      if (!hasAnalyticsResults(response) && hasAnalyticsResults(cachedResponse)) {
        this.cacheManager.set(cacheKey, cachedResponse);
        continue;
      }

      this.cacheManager.set(cacheKey, response);
    }
  }

  async syncOperationalHistory(
    channel: string,
    period: OperationalChartPeriod,
  ): Promise<void> {
    if (this.getMeasurementSyncState(channel)?.dataSource === 'backup') {
      await this.hydrateBackupOperationalHistory(channel);
      return;
    }

    const cacheKey = getOperationalHistoryCacheKey(channel, period);
    const latestMeasurementAt =
      this.getMeasurementSyncState(channel)?.latestMeasurementAt ??
      latestMeasurementTimestamp(
        this.cacheManager.get<ApiMeasurement[]>(getMeasurementCacheKey(channel))?.data ?? [],
      );
    const cachedPayload =
      this.cacheManager.get<OperationalHistoryCachePayload>(cacheKey)?.data ?? null;
    const config = OPERATIONAL_HISTORY_CONFIG[period];

    if (
      latestMeasurementAt &&
      cachedPayload?.anchorMeasurementAt === latestMeasurementAt &&
      !this.cacheManager.isExpired(cacheKey, config.ttlMs)
    ) {
      return;
    }

    if (!latestMeasurementAt) {
      return;
    }

    const anchor = parseApiTimestamp(latestMeasurementAt);
    const pointCount = Math.max(1, Math.ceil(config.rangeHours / config.stepHours));
    const points: OperationalHistoryPoint[] = [];
    const seenTimestamps = new Set<string>();

    try {
      for (let index = pointCount - 1; index >= 0; index -= 1) {
        const bucketEnd = subtractHours(anchor, index * config.stepHours);
        const bucketStart = subtractMinutes(bucketEnd, config.windowMinutes);
        const response = await this.endpoints.getChannelMeasurements(
          channel,
          bucketStart.toISOString(),
          bucketEnd.toISOString(),
        );
        const point = toOperationalHistoryPoint(response.measurements);

        if (!point || seenTimestamps.has(point.timestamp)) {
          continue;
        }

        seenTimestamps.add(point.timestamp);
        points.push(point);
      }

      if (points.length === 0) {
        const fallbackPoint = toOperationalHistoryPoint(
          this.cacheManager.get<ApiMeasurement[]>(getMeasurementCacheKey(channel))?.data ?? [],
        );

        if (fallbackPoint) {
          points.push(fallbackPoint);
        }
      }

      this.cacheManager.set(cacheKey, {
        anchorMeasurementAt: latestMeasurementAt,
        period,
        points,
      });
    } catch (error) {
      const hydrated = await this.hydrateBackupOperationalHistory(channel);
      if (hydrated) {
        return;
      }

      throw error;
    }
  }

  private async persistMeasurementState(
    channel: string,
    measurements: ApiMeasurement[],
    now: Date,
    options: {
      responseMeasurements?: ApiMeasurement[];
      forceFallbackSearch?: boolean;
    } = {},
  ): Promise<MeasurementSyncState> {
    const key = getMeasurementCacheKey(channel);
    const responseMeasurements = options.responseMeasurements ?? [];
    const fallbackResult =
      responseMeasurements.length > 0
        ? { measurements: [] as ApiMeasurement[], checkedAt: now.toISOString() }
        : await this.resolveLatestAvailableMeasurements(
            channel,
            now,
            latestMeasurementTimestamp(measurements),
            options.forceFallbackSearch ?? false,
          );
    const mergedMeasurements = mergeMeasurements(measurements, fallbackResult.measurements);
    const latestMeasurementAt = latestMeasurementTimestamp(mergedMeasurements);
    const previousState = this.getMeasurementSyncState(channel);

    if (latestMeasurementAt) {
      const isFresh =
        now.getTime() - parseApiTimestamp(latestMeasurementAt).getTime() <= API_CONFIG.staleAfterMs;

      this.cacheManager.set(key, mergedMeasurements);
      const state: MeasurementSyncState = {
        channel,
        status: isFresh ? 'fresh' : 'fallback_stale',
        dataSource: 'api',
        latestMeasurementAt,
        lastFallbackCheckAt: isFresh ? null : fallbackResult.checkedAt,
        lastApiAttemptAt: now.toISOString(),
        lastSuccessfulApiSyncAt: now.toISOString(),
        backupSnapshotGeneratedAt: null,
        message: isFresh
          ? null
          : `API sem dados recentes; usando a ultima medicao disponivel em ${latestMeasurementAt}.`,
      };

      this.setMeasurementSyncState(channel, state);
      return state;
    }

    const fallbackState = await this.applyBackupFallback(channel, now, {
      lastApiAttemptAt: now.toISOString(),
      message:
        'API sem dados recentes e sem historico util; exibindo o snapshot local do backup.',
    });

    if (fallbackState) {
      return fallbackState;
    }

    const state: MeasurementSyncState = {
      channel,
      status: 'empty',
      dataSource: previousState?.dataSource ?? 'api',
      latestMeasurementAt: null,
      lastFallbackCheckAt: fallbackResult.checkedAt,
      lastApiAttemptAt: now.toISOString(),
      lastSuccessfulApiSyncAt: previousState?.lastSuccessfulApiSyncAt ?? null,
      backupSnapshotGeneratedAt: previousState?.backupSnapshotGeneratedAt ?? null,
      message: 'API sem dados recentes e sem historico disponivel para fallback.',
    };

    this.setMeasurementSyncState(channel, state);
    return state;
  }

  private async resolveLatestAvailableMeasurements(
    channel: string,
    now: Date,
    latestKnownMeasurementAt: string | null,
    forceSearch: boolean,
  ): Promise<{ measurements: ApiMeasurement[]; checkedAt: string }> {
    const checkedAt = now.toISOString();
    const syncState = this.getMeasurementSyncState(channel);

    if (!forceSearch && this.shouldReuseFallback(channel, now)) {
      return {
        measurements: [],
        checkedAt: syncState?.lastFallbackCheckAt ?? checkedAt,
      };
    }

    for (const offsetDays of this.staleFallbackProbeOffsetsDays) {
      const probeStart = subtractDays(now, offsetDays);
      const probeEnd = addHours(probeStart, this.staleFallbackProbeWindowHours);
      const response = await this.endpoints.getChannelMeasurements(
        channel,
        probeStart.toISOString(),
        probeEnd.toISOString(),
      );

      if (response.measurements.length === 0) {
        continue;
      }

      const latestResponseTimestamp = latestMeasurementTimestamp(response.measurements);
      if (
        latestResponseTimestamp &&
        latestKnownMeasurementAt &&
        latestResponseTimestamp <= latestKnownMeasurementAt
      ) {
        return {
          measurements: [],
          checkedAt,
        };
      }

      return {
        measurements: this.trimMeasurements(response.measurements),
        checkedAt,
      };
    }

    return {
      measurements: [],
      checkedAt,
    };
  }

  private shouldReuseFallback(channel: string, now: Date): boolean {
    const syncState = this.getMeasurementSyncState(channel);

    if (syncState?.status !== 'fallback_stale' || !syncState.lastFallbackCheckAt) {
      return false;
    }

    return (
      now.getTime() - new Date(syncState.lastFallbackCheckAt).getTime() <
      this.staleFallbackRecheckMs
    );
  }

  private getMeasurementSyncState(channel: string): MeasurementSyncState | null {
    return (
      this.cacheManager.get<MeasurementSyncState>(getMeasurementSyncStateCacheKey(channel))?.data ??
      null
    );
  }

  private setMeasurementSyncState(channel: string, state: MeasurementSyncState): void {
    this.cacheManager.set(getMeasurementSyncStateCacheKey(channel), state);
  }

  private async applyBackupFallback(
    channel: string,
    now: Date,
    options: {
      lastApiAttemptAt?: string | null;
      message: string;
    },
  ): Promise<MeasurementSyncState | null> {
    const snapshot = await this.backupSnapshotLoader(channel);

    if (!snapshot) {
      return null;
    }

    this.cacheManager.set(
      getMeasurementCacheKey(channel),
      snapshot.operational.recentMeasurements,
    );
    (
      Object.entries(snapshot.operational.histories) as Array<
        [OperationalChartPeriod, OperationalHistoryCachePayload]
      >
    ).forEach(([period, payload]) => {
      this.cacheManager.set(getOperationalHistoryCacheKey(channel, period), payload);
    });
    this.cacheManager.set(
      getAnalyticsCacheKey(channel, 'consumption'),
      snapshot.business.consumption,
    );
    this.cacheManager.set(
      getAnalyticsCacheKey(channel, 'demand_peaks'),
      snapshot.business.demandPeaks,
    );
    this.cacheManager.set(
      getAnalyticsCacheKey(channel, 'electrical_health'),
      snapshot.business.electricalHealth,
    );
    this.cacheManager.set(
      getAnalyticsCacheKey(channel, 'hourly_profile'),
      snapshot.logistics.hourlyProfile,
    );
    this.cacheManager.set(
      getAnalyticsCacheKey(channel, 'current_by_sensor'),
      snapshot.logistics.currentBySensor,
    );

    const previousState = this.getMeasurementSyncState(channel);
    const state: MeasurementSyncState = {
      channel,
      status: 'backup',
      dataSource: 'backup',
      latestMeasurementAt: snapshot.latestMeasurementAt,
      lastFallbackCheckAt: null,
      lastApiAttemptAt: options.lastApiAttemptAt ?? previousState?.lastApiAttemptAt ?? null,
      lastSuccessfulApiSyncAt: previousState?.lastSuccessfulApiSyncAt ?? null,
      backupSnapshotGeneratedAt: snapshot.generatedAt,
      message: `${options.message} Ultimo dado do backup: ${snapshot.latestMeasurementAt}.`,
    };

    this.setMeasurementSyncState(channel, state);
    return state;
  }

  private async hydrateBackupOperationalHistory(channel: string): Promise<boolean> {
    const snapshot = await this.backupSnapshotLoader(channel);

    if (!snapshot) {
      return false;
    }

    (
      Object.entries(snapshot.operational.histories) as Array<
        [OperationalChartPeriod, OperationalHistoryCachePayload]
      >
    ).forEach(([period, payload]) => {
      this.cacheManager.set(getOperationalHistoryCacheKey(channel, period), payload);
    });

    return true;
  }

  private trimMeasurements(measurements: ApiMeasurement[]): ApiMeasurement[] {
    const latestTimestamp = latestMeasurementTimestamp(measurements);

    if (!latestTimestamp) {
      return [];
    }

    const cutoff =
      parseApiTimestamp(latestTimestamp).getTime() -
      this.measurementCacheWindowHours * 60 * 60 * 1000;

    return measurements.filter(
      (measurement) => parseApiTimestamp(measurement.timestamp).getTime() >= cutoff,
    ).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }
}
