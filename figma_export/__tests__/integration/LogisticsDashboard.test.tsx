import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import LogisticsDashboard from '@/app/pages/LogisticsDashboard';
import * as cacheSyncHooks from '@/hooks/useCacheSync';
import * as logisticsHooks from '@/hooks/useLogisticsData';

function buildCacheSyncMock(overrides: Partial<ReturnType<typeof cacheSyncHooks.useCacheSync>> = {}) {
  return {
    isLoading: false,
    isOnline: true,
    isRefreshing: false,
    lastSync: new Date('2026-04-08T12:00:30.000Z'),
    lastApiAttempt: new Date('2026-04-08T12:00:30.000Z'),
    lastSuccessfulApiSync: new Date('2026-04-08T12:00:30.000Z'),
    lastDataTimestamp: new Date('2026-03-31T10:24:17.000Z'),
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

function buildHourlyData() {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    avgEnergy: hour >= 8 && hour < 18 ? 20 : hour >= 22 || hour < 6 ? 12 : 14,
    avgOccupancy: hour === 8 ? 92 : hour >= 8 && hour < 18 ? 76 : 35,
    tariff: hour >= 22 || hour < 6 ? 0.5 : hour >= 18 && hour < 21 ? 0.85 : 0.65,
  }));
}

describe('LogisticsDashboard integration', () => {
  beforeEach(() => {
    const hourlyData = buildHourlyData();

    vi.spyOn(cacheSyncHooks, 'useCacheSync').mockReturnValue(buildCacheSyncMock());
    vi.spyOn(logisticsHooks, 'useLogisticsData').mockReturnValue({
      avgEnergy24h: 15.8,
      peakOccupancy: 92,
      lowEnergyHours: 8,
      nextIdealHour: 22,
      hourlyData,
      hourlyProfile: hourlyData,
      occupancyForecast: hourlyData.map((entry) => ({
        hour: entry.hour,
        occupancy: entry.avgOccupancy,
        energyPrice: entry.tariff,
      })),
      energyPrices: hourlyData.map((entry) => ({
        hour: entry.hour,
        price: entry.tariff,
      })),
      periodSeries: [
        {
          freezerEnergy: 8,
          equipmentEnergy: 12,
          temperature: -18,
          occupancy: 70,
          timestamp: new Date('2026-03-31T08:00:00.000Z'),
        },
        {
          freezerEnergy: 7,
          equipmentEnergy: 11,
          temperature: -17,
          occupancy: 92,
          timestamp: new Date('2026-03-31T14:00:00.000Z'),
        },
      ],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the logistics cards, charts and insights with cached data', async () => {
    render(
      <MemoryRouter initialEntries={['/logistics']}>
        <LogisticsDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Consumo Medio \(Ultimas 24 horas\)/i)).toBeInTheDocument();
    expect(screen.getByText('15.8')).toBeInTheDocument();
    expect(screen.getByText('92.0')).toBeInTheDocument();
    expect(screen.getByText(/Horas Tarifa Baixa/i)).toBeInTheDocument();
    expect(screen.getByText(/Energia vs Ocupacao/i)).toBeInTheDocument();
    expect(screen.getByText(/Perfil horario consolidado/i)).toBeInTheDocument();
    expect(screen.getByText(/Insight - Consumo/i)).toBeInTheDocument();
    expect(screen.getByText(/Dados vindos da API/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Expandir Energia vs Ocupacao/i }),
    ).toBeInTheDocument();
  });

  it('shows loading placeholders while logistics data is being prepared', () => {
    vi.spyOn(cacheSyncHooks, 'useCacheSync').mockReturnValue(
      buildCacheSyncMock({
        isLoading: true,
        lastSync: null,
        lastApiAttempt: null,
        lastSuccessfulApiSync: null,
        lastDataTimestamp: null,
        progress: 40,
      }),
    );
    vi.spyOn(logisticsHooks, 'useLogisticsData').mockReturnValue({
      avgEnergy24h: 0,
      peakOccupancy: 0,
      lowEnergyHours: 8,
      nextIdealHour: 22,
      hourlyData: [],
      hourlyProfile: [],
      occupancyForecast: [],
      energyPrices: [],
      periodSeries: [],
      isLoading: true,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/logistics']}>
        <LogisticsDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Carregando planejamento logistico/i)).toBeInTheDocument();
    expect(screen.getByText(/Indicadores de Planejamento/i)).toBeInTheDocument();
  });

  it('shows the retry state when no cached logistics data is available', async () => {
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
    vi.spyOn(logisticsHooks, 'useLogisticsData').mockReturnValue({
      avgEnergy24h: 0,
      peakOccupancy: 0,
      lowEnergyHours: 8,
      nextIdealHour: null,
      hourlyData: [],
      hourlyProfile: [],
      occupancyForecast: [],
      energyPrices: [],
      periodSeries: [],
      isLoading: false,
      error: 'Os dados de logistica ainda nao estao disponiveis no cache.',
    });

    render(
      <MemoryRouter initialEntries={['/logistics']}>
        <LogisticsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: /Nao foi possivel montar a tela de logistica/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Atualizar/i })).toBeInTheDocument();
  });

  it('shows the explicit backup banner when logistics is using the local snapshot', async () => {
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
      <MemoryRouter initialEntries={['/logistics']}>
        <LogisticsDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Usando backup SQLite/i)).toBeInTheDocument();
    expect(screen.getByText(/Planejamento pelo backup/i)).toBeInTheDocument();
  });
});
