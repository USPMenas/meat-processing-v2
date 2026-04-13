import { useEffect, useRef, useState } from 'react';
import { API_CONFIG } from '../config/api';
import { parseApiTimestamp } from '../services/api/timestamps';
import {
  getCachedMeasurementSyncState,
  getCachedMeasurements,
} from '../services/cache/cacheSelectors';
import { SyncStrategy } from '../services/cache/syncStrategy';
import { PollingManager } from '../services/polling/pollingManager';
import type {
  BackupSnapshotStatus,
  MeasurementDataSource,
  PollingMode,
} from '../services/cache/types';

type SyncOutcome = 'success' | 'failure';

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Erro desconhecido durante a sincronizacao.';
}

function getIntervalForMode(mode: PollingMode): number {
  return mode === 'degraded'
    ? API_CONFIG.degradedPollingIntervalMs
    : API_CONFIG.pollingIntervalMs;
}

function hasUsableSyncData(
  syncState: ReturnType<typeof getCachedMeasurementSyncState>,
  cachedMeasurements: ReturnType<typeof getCachedMeasurements>,
): boolean {
  if (syncState?.status === 'empty') {
    return false;
  }

  return Boolean(
    syncState?.latestMeasurementAt ?? cachedMeasurements[cachedMeasurements.length - 1]?.timestamp,
  );
}

function isApiFresh(
  syncState: ReturnType<typeof getCachedMeasurementSyncState>,
): boolean {
  if (!syncState) {
    return false;
  }

  return (
    syncState.status === 'fresh' &&
    (syncState.dataSource === 'api' || syncState.dataSource === 'hybrid')
  );
}

function getSyncOutcome(channel: string): SyncOutcome {
  const syncState = getCachedMeasurementSyncState(channel);
  const cachedMeasurements = getCachedMeasurements(channel);

  if (hasUsableSyncData(syncState, cachedMeasurements)) {
    return 'success';
  }

  return 'failure';
}

export function useCacheSync(channel: string): {
  isLoading: boolean;
  isOnline: boolean;
  isRefreshing: boolean;
  lastSync: Date | null;
  lastApiAttempt: Date | null;
  lastSuccessfulApiSync: Date | null;
  lastDataTimestamp: Date | null;
  backupSnapshotTimestamp: Date | null;
  backupSnapshotStatus: BackupSnapshotStatus | null;
  backupRefreshAttemptedAt: Date | null;
  backupRefreshFinishedAt: Date | null;
  backupRefreshDurationMs: number | null;
  backupRefreshError: string | null;
  backupSnapshotAgeHours: number | null;
  isBackupSnapshotFreshEnough: boolean | null;
  dataSource: MeasurementDataSource;
  isUsingBackup: boolean;
  sourceMessage: string | null;
  progress: number;
  error: string | null;
  pollingMode: PollingMode;
  canRetry: boolean;
  refreshNow: () => Promise<void>;
} {
  const syncStrategyRef = useRef<SyncStrategy | null>(null);
  const pollingManagerRef = useRef<PollingManager | null>(null);
  const pollingModeRef = useRef<PollingMode>('normal');
  const refreshNowRef = useRef<(() => Promise<void>) | null>(null);

  const [state, setState] = useState({
    isLoading: false,
    isOnline: true,
    isRefreshing: false,
    lastSync: null as Date | null,
    lastApiAttempt: null as Date | null,
    lastSuccessfulApiSync: null as Date | null,
    lastDataTimestamp: null as Date | null,
    backupSnapshotTimestamp: null as Date | null,
    backupSnapshotStatus: null as BackupSnapshotStatus | null,
    backupRefreshAttemptedAt: null as Date | null,
    backupRefreshFinishedAt: null as Date | null,
    backupRefreshDurationMs: null as number | null,
    backupRefreshError: null as string | null,
    backupSnapshotAgeHours: null as number | null,
    isBackupSnapshotFreshEnough: null as boolean | null,
    dataSource: 'api' as MeasurementDataSource,
    isUsingBackup: false,
    sourceMessage: null as string | null,
    progress: 0,
    error: null as string | null,
    pollingMode: 'normal' as PollingMode,
    canRetry: false,
  });

  if (!syncStrategyRef.current) {
    syncStrategyRef.current = new SyncStrategy();
  }

  if (!pollingManagerRef.current) {
    pollingManagerRef.current = new PollingManager();
  }

  useEffect(() => {
    let cancelled = false;
    const syncStrategy = syncStrategyRef.current as SyncStrategy;
    const pollingManager = pollingManagerRef.current as PollingManager;

    const setPollingMode = (mode: PollingMode) => {
      pollingModeRef.current = mode;

      if (mode === 'paused') {
        pollingManager.stop();
      } else if (pollingManager.isActive()) {
        pollingManager.updateInterval(getIntervalForMode(mode));
      }

      if (!cancelled) {
        setState((previous) => ({
          ...previous,
          pollingMode: mode,
          canRetry:
            mode === 'paused' ||
            previous.isUsingBackup ||
            Boolean(previous.error),
        }));
      }
    };

    const syncStateToViewState = (fallbackError: string | null): SyncOutcome => {
      const syncState = getCachedMeasurementSyncState(channel);
      const cachedMeasurements = getCachedMeasurements(channel);
      const hasUsableData = hasUsableSyncData(syncState, cachedMeasurements);
      const lastMeasurementAt =
        syncState?.latestMeasurementAt ??
        cachedMeasurements[cachedMeasurements.length - 1]?.timestamp ??
        null;
      const outcome = getSyncOutcome(channel);
      const isUsingBackup = syncState?.dataSource === 'backup';
      const isOnline = isApiFresh(syncState);
      const errorMessage = hasUsableData
        ? null
        : fallbackError ?? syncState?.message ?? null;

      if (!cancelled) {
        setState((previous) => ({
          ...previous,
          isLoading: false,
          isRefreshing: false,
          isOnline,
          lastSync: syncState?.lastApiAttemptAt
            ? new Date(syncState.lastApiAttemptAt)
            : previous.lastSync,
          lastApiAttempt: syncState?.lastApiAttemptAt
            ? new Date(syncState.lastApiAttemptAt)
            : previous.lastApiAttempt,
          lastSuccessfulApiSync: syncState?.lastSuccessfulApiSyncAt
            ? new Date(syncState.lastSuccessfulApiSyncAt)
            : previous.lastSuccessfulApiSync,
          lastDataTimestamp: lastMeasurementAt
            ? parseApiTimestamp(lastMeasurementAt)
            : previous.lastDataTimestamp,
          backupSnapshotTimestamp: syncState?.backupSnapshotGeneratedAt
            ? new Date(syncState.backupSnapshotGeneratedAt)
            : previous.backupSnapshotTimestamp,
          backupSnapshotStatus:
            syncState?.backupSnapshotStatus ?? previous.backupSnapshotStatus,
          backupRefreshAttemptedAt: syncState?.backupRefreshAttemptedAt
            ? new Date(syncState.backupRefreshAttemptedAt)
            : previous.backupRefreshAttemptedAt,
          backupRefreshFinishedAt: syncState?.backupRefreshFinishedAt
            ? new Date(syncState.backupRefreshFinishedAt)
            : previous.backupRefreshFinishedAt,
          backupRefreshDurationMs:
            syncState?.backupRefreshDurationMs ?? previous.backupRefreshDurationMs,
          backupRefreshError:
            syncState?.backupRefreshError ?? previous.backupRefreshError,
          backupSnapshotAgeHours:
            syncState?.backupSnapshotAgeHours ?? previous.backupSnapshotAgeHours,
          isBackupSnapshotFreshEnough:
            syncState?.isBackupSnapshotFreshEnough ??
            previous.isBackupSnapshotFreshEnough,
          dataSource: syncState?.dataSource ?? previous.dataSource,
          isUsingBackup,
          sourceMessage:
            syncState?.message ??
            (hasUsableData ? previous.sourceMessage : fallbackError) ??
            previous.sourceMessage,
          progress: previous.progress === 0 ? 100 : previous.progress,
          error: errorMessage,
          canRetry:
            pollingModeRef.current === 'paused' ||
            !hasUsableData ||
            Boolean(errorMessage),
        }));
      }

      return outcome;
    };

    const syncStateFromErrorOnly = (errorMessage: string): SyncOutcome => {
      const hasCachedMeasurements = getCachedMeasurements(channel).length > 0;

      if (!cancelled) {
        setState((previous) => ({
          ...previous,
          isLoading: false,
          isRefreshing: false,
          isOnline: false,
          progress: hasCachedMeasurements
            ? Math.max(previous.progress, 100)
            : previous.progress,
          error: errorMessage,
          canRetry: true,
        }));
      }

      return 'failure';
    };

    const attemptSync = async (options: {
      allowColdStart: boolean;
      manual: boolean;
    }): Promise<SyncOutcome> => {
      const needsColdStart =
        options.allowColdStart && syncStrategy.needsColdStart(channel);

      if (!cancelled) {
        setState((previous) => ({
          ...previous,
          isLoading: needsColdStart,
          isRefreshing: options.manual || (!needsColdStart && previous.progress > 0),
          progress: needsColdStart ? 0 : previous.progress,
          error: null,
        }));
      }

      try {
        if (needsColdStart) {
          await syncStrategy.coldStart(channel, (progress) => {
            if (!cancelled) {
              setState((previous) => ({
                ...previous,
                progress,
                isLoading: progress < 100,
              }));
            }
          });
        } else {
          await syncStrategy.syncDelta(channel);
        }

        return syncStateToViewState(null);
      } catch (error) {
        const fallbackError = getErrorMessage(error);
        const syncOutcome = syncStateToViewState(fallbackError);
        const hasSyncState = getCachedMeasurementSyncState(channel) !== null;

        if (!hasSyncState && getCachedMeasurements(channel).length === 0) {
          return syncStateFromErrorOnly(fallbackError);
        }

        return syncOutcome;
      }
    };

    const applyOutcome = (attemptMode: PollingMode, outcome: SyncOutcome) => {
      if (outcome === 'success') {
        setPollingMode('normal');
        return;
      }

      if (attemptMode === 'normal') {
        if (!pollingManager.isActive()) {
          pollingManager.start(runPollingAttempt, getIntervalForMode('degraded'));
        }
        setPollingMode('degraded');
        return;
      }

      setPollingMode('paused');
    };

    const runPollingAttempt = async () => {
      const attemptMode = pollingModeRef.current;
      const outcome = await attemptSync({
        allowColdStart: false,
        manual: false,
      });

      if (!cancelled) {
        applyOutcome(attemptMode, outcome);
      }
    };

    const startPolling = (mode: PollingMode) => {
      if (mode === 'paused') {
        setPollingMode('paused');
        return;
      }

      if (pollingManager.isActive()) {
        pollingManager.updateInterval(getIntervalForMode(mode));
      } else {
        pollingManager.start(runPollingAttempt, getIntervalForMode(mode));
      }

      setPollingMode(mode);
    };

    refreshNowRef.current = async () => {
      pollingManager.stop();
      pollingModeRef.current = 'normal';

      if (!cancelled) {
        setState((previous) => ({
          ...previous,
          pollingMode: 'normal',
          canRetry: false,
        }));
      }

      const outcome = await attemptSync({
        allowColdStart: true,
        manual: true,
      });

      if (!cancelled) {
        if (outcome === 'success') {
          startPolling('normal');
          return;
        }

        startPolling('degraded');
      }
    };

    const runInitialSync = async () => {
      const outcome = await attemptSync({
        allowColdStart: true,
        manual: false,
      });

      if (cancelled) {
        return;
      }

      startPolling(outcome === 'success' ? 'normal' : 'degraded');
    };

    void runInitialSync();

    return () => {
      cancelled = true;
      refreshNowRef.current = null;
      pollingManager.stop();
    };
  }, [channel]);

  return {
    ...state,
    refreshNow: async () => {
      if (refreshNowRef.current) {
        await refreshNowRef.current();
      }
    },
  };
}
