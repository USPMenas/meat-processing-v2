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
    cachedMeasurements = [{ timestamp: '2026-03-31T11:40:56' }];
    syncState = {
      channel: 'lab',
      status: 'fresh',
      dataSource: 'api',
      latestMeasurementAt: '2026-03-31T11:40:56',
      lastFallbackCheckAt: null,
      lastApiAttemptAt: '2026-04-09T12:00:00.000Z',
      lastSuccessfulApiSyncAt: '2026-04-09T12:00:00.000Z',
      backupSnapshotGeneratedAt: null,
      message: null,
    };
    needsColdStartMock.mockReturnValue(false);
    coldStartMock.mockResolvedValue(undefined);
  });

  it('keeps the normal cadence on success, degrades after a failure, pauses after a second failure and restarts on manual refresh', async () => {
    let mode: 'success' | 'failure' = 'success';

    syncDeltaMock.mockImplementation(async () => {
      if (mode === 'success') {
        syncState = {
          channel: 'lab',
          status: 'fresh',
          dataSource: 'api',
          latestMeasurementAt: '2026-03-31T11:40:56',
          lastFallbackCheckAt: null,
          lastApiAttemptAt: '2026-04-09T12:00:00.000Z',
          lastSuccessfulApiSyncAt: '2026-04-09T12:00:00.000Z',
          backupSnapshotGeneratedAt: null,
          message: null,
        };
        return;
      }

      syncState = {
        channel: 'lab',
        status: 'backup',
        dataSource: 'backup',
        latestMeasurementAt: '2026-03-31T11:40:56',
        lastFallbackCheckAt: null,
        lastApiAttemptAt: '2026-04-09T12:05:00.000Z',
        lastSuccessfulApiSyncAt: '2026-04-09T12:00:00.000Z',
        backupSnapshotGeneratedAt: '2026-04-09T11:55:00.000Z',
        message: 'API indisponivel; usando backup.',
      };
      throw new Error('API indisponivel');
    });

    const { result } = renderHook(() => useCacheSync('lab'));

    await waitFor(() => {
      expect(result.current.pollingMode).toBe('normal');
    });

    expect(startMock).toHaveBeenCalledWith(expect.any(Function), 60_000);
    expect(result.current.canRetry).toBe(false);

    mode = 'failure';
    await act(async () => {
      await pollingCallback?.();
    });

    expect(result.current.pollingMode).toBe('degraded');
    expect(updateIntervalMock).toHaveBeenLastCalledWith(300_000);

    await act(async () => {
      await pollingCallback?.();
    });

    expect(result.current.pollingMode).toBe('paused');
    expect(result.current.canRetry).toBe(true);
    expect(stopMock).toHaveBeenCalled();

    mode = 'success';
    await act(async () => {
      await result.current.refreshNow();
    });

    expect(result.current.pollingMode).toBe('normal');
    expect(startMock).toHaveBeenLastCalledWith(expect.any(Function), 60_000);
  });
});
