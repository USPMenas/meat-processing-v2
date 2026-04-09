import { render, screen } from '@testing-library/react';
import App from '@/app/App';
import * as cacheSyncHooks from '@/hooks/useCacheSync';
import * as operationalHistoryHooks from '@/hooks/useOperationalHistory';
import * as realtimeHooks from '@/hooks/useRealtimeData';

function buildCacheSyncMock(overrides: Partial<ReturnType<typeof cacheSyncHooks.useCacheSync>> = {}) {
  return {
    isLoading: false,
    isOnline: true,
    isRefreshing: false,
    lastSync: new Date('2026-04-07T12:00:30.000Z'),
    lastApiAttempt: new Date('2026-04-07T12:00:30.000Z'),
    lastSuccessfulApiSync: new Date('2026-04-07T12:00:30.000Z'),
    lastDataTimestamp: new Date('2026-04-07T12:00:00.000Z'),
    backupSnapshotTimestamp: null,
    dataSource: 'api' as const,
    isUsingBackup: false,
    sourceMessage: null,
    progress: 100,
    error: null,
    pollingMode: 'normal' as const,
    canRetry: false,
    refreshNow: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('App integration', () => {
  beforeEach(() => {
    vi.spyOn(cacheSyncHooks, 'useCacheSync').mockReturnValue(buildCacheSyncMock());
    vi.spyOn(realtimeHooks, 'useRealtimeData').mockReturnValue({
      data: {
        freezerEnergy: 5.8,
        equipmentEnergy: 5.7,
        temperature: -19.1,
        occupancy: 10.6,
        timestamp: new Date('2026-04-07T12:00:00.000Z'),
      },
      historical: [
        {
          freezerEnergy: 5.8,
          equipmentEnergy: 5.7,
          temperature: -19.1,
          occupancy: 10.6,
          timestamp: new Date('2026-04-07T12:00:00.000Z'),
        },
      ],
      prediction: [],
      alerts: [],
      isLoading: false,
      isStale: false,
    });
    vi.spyOn(operationalHistoryHooks, 'useOperationalHistory').mockReturnValue({
      data: [
        {
          freezerEnergy: 5.8,
          equipmentEnergy: 5.7,
          temperature: -19.1,
          occupancy: 10.6,
          timestamp: new Date('2026-04-07T12:00:00.000Z'),
        },
      ],
      error: null,
      isLoading: false,
      lastMeasurementAt: new Date('2026-04-07T12:00:00.000Z'),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the dashboard shell', async () => {
    render(<App />);

    expect(await screen.findByText(/Monitoramento em Tempo Real/i)).toBeInTheDocument();
  });
});
