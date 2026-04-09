import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import OperationalDashboard from '@/app/pages/OperationalDashboard';
import * as cacheSyncHooks from '@/hooks/useCacheSync';
import * as operationalHistoryHooks from '@/hooks/useOperationalHistory';
import * as realtimeHooks from '@/hooks/useRealtimeData';

function buildCacheSyncMock(overrides: Partial<ReturnType<typeof cacheSyncHooks.useCacheSync>> = {}) {
  return {
    isLoading: false,
    isOnline: true,
    isRefreshing: false,
    lastSync: new Date('2026-04-08T12:00:30.000Z'),
    lastApiAttempt: new Date('2026-04-08T12:00:30.000Z'),
    lastSuccessfulApiSync: new Date('2026-04-08T12:00:30.000Z'),
    lastDataTimestamp: new Date('2026-03-31T11:40:56.000Z'),
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

describe('OperationalDashboard integration', () => {
  beforeEach(() => {
    vi.spyOn(cacheSyncHooks, 'useCacheSync').mockReturnValue(buildCacheSyncMock());
    vi.spyOn(realtimeHooks, 'useRealtimeData').mockReturnValue({
      data: {
        freezerEnergy: 15,
        equipmentEnergy: 5,
        temperature: -14,
        occupancy: 86.7,
        timestamp: new Date('2026-03-31T11:40:56.000Z'),
      },
      historical: [
        {
          freezerEnergy: 15,
          equipmentEnergy: 5,
          temperature: -14,
          occupancy: 86.7,
          timestamp: new Date('2026-03-31T11:40:56.000Z'),
        },
      ],
      prediction: [],
      alerts: [
        {
          type: 'critical',
          variable: 'Temperatura',
          message: 'Temperatura acima do limite critico',
          value: -14,
          expected: -15,
        },
      ],
      isLoading: false,
      isStale: true,
    });
    vi.spyOn(operationalHistoryHooks, 'useOperationalHistory').mockReturnValue({
      data: [
        {
          freezerEnergy: 12,
          equipmentEnergy: 4,
          temperature: -18,
          occupancy: 70,
          timestamp: new Date('2026-03-30T11:40:56.000Z'),
        },
        {
          freezerEnergy: 15,
          equipmentEnergy: 5,
          temperature: -14,
          occupancy: 86.7,
          timestamp: new Date('2026-03-31T11:40:56.000Z'),
        },
      ],
      error: null,
      isLoading: false,
      lastMeasurementAt: new Date('2026-03-31T11:40:56.000Z'),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the operational cards with explicit API timestamps and alerts', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <OperationalDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Energia - Congelador')).toBeInTheDocument();
    expect(screen.getByText('15.0')).toBeInTheDocument();
    expect(screen.getByText('5.0')).toBeInTheDocument();
    expect(screen.getByText('86.7')).toBeInTheDocument();
    expect(screen.getByText(/Temperatura acima do limite critico/i)).toBeInTheDocument();
    expect(screen.getByText(/Ultima tentativa na API/i)).toBeInTheDocument();
    expect(screen.getByText(/Ultimo dado exibido/i)).toBeInTheDocument();
    const lastMeasurementCard = screen.getByText(/Ultimo dado exibido/i).closest('div');

    expect(lastMeasurementCard).not.toBeNull();
    expect(
      within(lastMeasurementCard as HTMLDivElement).getByText(/31\/03\/2026/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Como calculamos Energia - Congelador/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Ultimas 24 horas/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Canal monitorado/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Expandir Consumo Total de Energia/i }),
    ).toBeInTheDocument();
  });

  it('shows skeleton loading while the cold start is running', () => {
    vi.spyOn(cacheSyncHooks, 'useCacheSync').mockReturnValue(
      buildCacheSyncMock({
        isLoading: true,
        lastSync: null,
        lastApiAttempt: null,
        lastSuccessfulApiSync: null,
        lastDataTimestamp: null,
        progress: 42,
      }),
    );
    vi.spyOn(realtimeHooks, 'useRealtimeData').mockReturnValue({
      data: null,
      historical: [],
      prediction: [],
      alerts: [],
      isLoading: true,
      isStale: true,
    });
    vi.spyOn(operationalHistoryHooks, 'useOperationalHistory').mockReturnValue({
      data: [],
      error: null,
      isLoading: true,
      lastMeasurementAt: null,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <OperationalDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Carregando dados historicos\.\.\. 42%/i)).toBeInTheDocument();
    expect(screen.getByText(/Consumo Total de Energia/i)).toBeInTheDocument();
  });

  it('shows the retry state when the API is offline and no cache is available', async () => {
    vi.spyOn(cacheSyncHooks, 'useCacheSync').mockReturnValue(
      buildCacheSyncMock({
        isOnline: false,
        lastSync: null,
        lastApiAttempt: null,
        lastSuccessfulApiSync: null,
        lastDataTimestamp: null,
        progress: 0,
        error: 'Nao foi possivel conectar ao servidor',
        pollingMode: 'paused',
        canRetry: true,
      }),
    );
    vi.spyOn(realtimeHooks, 'useRealtimeData').mockReturnValue({
      data: null,
      historical: [],
      prediction: [],
      alerts: [],
      isLoading: false,
      isStale: true,
    });
    vi.spyOn(operationalHistoryHooks, 'useOperationalHistory').mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
      lastMeasurementAt: null,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <OperationalDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: /Nao foi possivel montar a tela operacional/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Atualizar/i })).toBeInTheDocument();
    expect(screen.getByText(/Nao foi possivel conectar ao servidor/i)).toBeInTheDocument();
  });

  it('highlights when the operational screen is rendering from the bundled backup', async () => {
    vi.spyOn(cacheSyncHooks, 'useCacheSync').mockReturnValue(
      buildCacheSyncMock({
        isOnline: false,
        dataSource: 'backup',
        isUsingBackup: true,
        sourceMessage: 'API indisponivel; usando dados do backup local.',
        backupSnapshotTimestamp: new Date('2026-04-09T14:06:48.000Z'),
      }),
    );

    render(
      <MemoryRouter initialEntries={['/']}>
        <OperationalDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Usando backup SQLite/i)).toBeInTheDocument();
    expect(screen.getByText(/Snapshot do backup/i)).toBeInTheDocument();
    expect(screen.getAllByText(/31\/03\/2026/i).length).toBeGreaterThan(0);
  });
});
