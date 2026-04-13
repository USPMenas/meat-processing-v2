export type MeasurementSyncStatus = 'fresh' | 'fallback_stale' | 'backup' | 'empty';

export type MeasurementDataSource = 'api' | 'backup' | 'hybrid';

export type BackupSnapshotStatus = 'renewed' | 'last_good' | 'bundled';

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
  backupSnapshotStatus: BackupSnapshotStatus | null;
  backupRefreshAttemptedAt: string | null;
  backupRefreshFinishedAt: string | null;
  backupRefreshDurationMs: number | null;
  backupRefreshError: string | null;
  backupSnapshotAgeHours: number | null;
  isBackupSnapshotFreshEnough: boolean | null;
  recentAnchorAt: string | null;
  recentWindowFrom: string | null;
  recentWindowTo: string | null;
  message: string | null;
}
