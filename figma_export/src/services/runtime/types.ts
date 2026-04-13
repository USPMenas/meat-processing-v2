import type { BackupChannelSnapshot } from '../../domain/types';
import type { ApiMeasurement } from '../api/types';

export type BootstrapSnapshotStatus = 'renewed' | 'last_good' | 'bundled';

export interface BootstrapResponse {
  channel: string;
  snapshot: BackupChannelSnapshot;
  snapshotStatus: BootstrapSnapshotStatus;
  snapshotGeneratedAt: string;
  snapshotSource: string;
  latestMeasurementAt: string;
  refreshAttemptedAt: string | null;
  refreshFinishedAt: string | null;
  refreshDurationMs: number | null;
  refreshError: string | null;
  snapshotAgeHours: number | null;
  isSnapshotFreshEnough: boolean;
  message: string | null;
}

export type RecentDataSource = 'recent_window' | 'probed_window' | 'empty';

export interface RecentResponse {
  channel: string;
  measurements: ApiMeasurement[];
  anchorAt: string | null;
  checkedAt: string;
  probeWindow: {
    from: string;
    to: string;
  } | null;
  source: RecentDataSource;
  message: string | null;
}

export interface DailyHistorySample {
  date: string;
  measurementAt: string | null;
  measurements: ApiMeasurement[];
}

export interface HistoryResponse {
  channel: string;
  days: 7 | 30;
  resolution: 'day';
  checkedAt: string;
  samples: DailyHistorySample[];
  message: string | null;
}
