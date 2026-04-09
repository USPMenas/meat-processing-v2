export type MeasurementSyncStatus = 'fresh' | 'fallback_stale' | 'backup' | 'empty';

export type MeasurementDataSource = 'api' | 'backup';

export type PollingMode = 'normal' | 'degraded' | 'paused';

export interface MeasurementSyncState {
  channel: string;
  status: MeasurementSyncStatus;
  dataSource: MeasurementDataSource;
  latestMeasurementAt: string | null;
  lastFallbackCheckAt: string | null;
  lastApiAttemptAt: string | null;
  lastSuccessfulApiSyncAt: string | null;
  backupSnapshotGeneratedAt: string | null;
  message: string | null;
}
