import { act, renderHook, waitFor } from '@testing-library/react';
import { useCacheSync } from '@/hooks/useCacheSync';
import type { MeasurementSyncState } from '@/services/cache/types';

const syncDeltaMock = vi.fn();
const coldStartMock = vi.fn();
const needsColdStartMock = vi.fn();
const startMock = vi.fn();
const updateIntervalMock = vi.fn();
const stopMock = vi.fn();
const isActiveMock = vi.fn();

let pollingCallback: (() => Promise<void>) | null = null;
let pollingActive = false;
let syncState: MeasurementSyncState | null = null;
let cachedMeasurements: Array<{ timestamp: string }> = [];

function createSyncState(
  overrides: Partial<MeasurementSyncState> = {},
): MeasurementSyncState {
  return {
    channel: 'lab',
    status: 'fresh',
    dataSource: 'api',
    latestMeasurementAt: '2026-04-10T09:42:07',
    lastFallbackCheckAt: null,
    lastApiAttemptAt: '2026-04-10T09:42:30.000Z',
    lastSuccessfulApiSyncAt: '2026-04-10T09:42:30.000Z',
    backupSnapshotGeneratedAt: null,
    backupSnapshotStatus: null,
    backupRefreshAttemptedAt: null,
    backupRefreshFinishedAt: null,
    backupRefreshDurationMs: null,
    backupRefreshError: null,
    backupSnapshotAgeHours: null,
    isBackupSnapshotFreshEnough: null,
    recentAnchorAt: '2026-04-10T09:42:07',
    recentWindowFrom: '2026-04-10T09:12:07',
    recentWindowTo: '2026-04-10T09:42:07',
    message: null,
    ...overrides,
  };
}

vi.mock('@/services/cache/cacheSelectors', () => ({
  getCachedMeasurementSyncState: vi.fn(() => syncState),
  getCachedMeasurements: vi.fn(() => cachedMeasurements),
}));

vi.mock('@/services/cache/syncStrategy', () => ({
  SyncStrategy: vi.fn().mockImplementation(() => ({
    needsColdStart: needsColdStartMock,
    coldStart: coldStartMock,
    syncDelta: syncDeltaMock,
  })),
}));

vi.mock('@/services/polling/pollingManager', () => ({
  PollingManager: vi.fn().mockImplementation(() => ({
    start: startMock.mockImplementation((callback: () => Promise<void>) => {
      pollingCallback = callback;
      pollingActive = true;
    }),
    updateInterval: updateIntervalMock,
    stop: stopMock.mockImplementation(() => {
      pollingActive = false;
    }),
    isActive: isActiveMock.mockImplementation(() => pollingActive),
  })),
}));

describe('useCacheSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pollingCallback = null;
    pollingActive = false;
    cachedMeasurements = [{ timestamp: '2026-04-10T09:42:07' }];
    syncState = createSyncState();
    needsColdStartMock.mockReturnValue(false);
    coldStartMock.mockResolvedValue(undefined);
  });

  it('keeps normal polling when a failed delta still leaves a usable backup snapshot', async () => {
    syncDeltaMock.mockImplementation(async () => {
      syncState = createSyncState({
        status: 'backup',
        dataSource: 'backup',
        latestMeasurementAt: '2026-03-31T10:24:17',
        lastApiAttemptAt: '2026-04-10T09:43:30.000Z',
        lastSuccessfulApiSyncAt: '2026-04-10T09:42:30.000Z',
        backupSnapshotGeneratedAt: '2026-04-10T09:41:00.000Z',
        backupSnapshotStatus: 'last_good',
        backupRefreshAttemptedAt: '2026-04-10T09:43:00.000Z',
        backupRefreshFinishedAt: '2026-04-10T09:43:02.000Z',
        backupRefreshDurationMs: 2000,
        backupRefreshError: 'offline',
        backupSnapshotAgeHours: 240,
        isBackupSnapshotFreshEnough: false,
        recentAnchorAt: null,
        recentWindowFrom: null,
        recentWindowTo: null,
        message: 'Usando o ultimo snapshot bom enquanto a API procura dados novos.',
      });
      cachedMeasurements = [{ timestamp: '2026-03-31T10:24:17' }];
      throw new Error('Internal route returned 500');
    });

    const { result } = renderHook(() => useCacheSync('lab'));

    await waitFor(() => {
      expect(result.current.pollingMode).toBe('normal');
    });

    await act(async () => {
      await pollingCallback?.();
    });

    expect(result.current.pollingMode).toBe('normal');
    expect(result.current.isUsingBackup).toBe(true);
    expect(result.current.isOnline).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.sourceMessage).toContain('ultimo snapshot bom');
    expect(startMock).toHaveBeenCalledWith(expect.any(Function), 60_000);
    expect(updateIntervalMock).not.toHaveBeenCalledWith(300_000);
  });

  it('degrades and pauses only when sync failures leave no usable data in cache', async () => {
    cachedMeasurements = [];
    syncState = null;
    syncDeltaMock.mockRejectedValue(new Error('No data available'));

    const { result } = renderHook(() => useCacheSync('lab'));

    await waitFor(() => {
      expect(result.current.pollingMode).toBe('degraded');
    });

    await act(async () => {
      await pollingCallback?.();
    });

    expect(result.current.pollingMode).toBe('paused');
    expect(result.current.canRetry).toBe(true);
    expect(result.current.error).toContain('No data available');
    expect(stopMock).toHaveBeenCalled();
  });
});
