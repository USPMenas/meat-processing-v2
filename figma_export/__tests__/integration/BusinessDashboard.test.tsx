import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import BusinessDashboard from '@/app/pages/BusinessDashboard';
import * as businessHooks from '@/hooks/useBusinessData';
import * as cacheSyncHooks from '@/hooks/useCacheSync';

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

function buildHourlyAverages() {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    avgEnergy: hour >= 8 && hour < 18 ? 18 : 12,
    avgOccupancy: hour === 8 ? 82 : 58,
    tariff: hour >= 22 || hour < 6 ? 0.5 : hour >= 18 && hour < 21 ? 0.85 : 0.65,
  }));
}

describe('BusinessDashboard integration', () => {
  beforeEach(() => {
    vi.spyOn(cacheSyncHooks, 'useCacheSync').mockReturnValue(buildCacheSyncMock());
    vi.spyOn(businessHooks, 'useBusinessData').mockReturnValue({
      currentRevenue: 85000,
      projectedRevenue: 170000,
      energyCost: 6500,
      projectedEnergyCost: 13000,
      margin: 92.35,
      projectedMargin: 92.35,
      revenueChange: 5,
      costChange: 2,
      dailyData: [
        {
          date: '2026-03-30',
          label: '30/03',
          totalKwh: 500,
          averageTemperature: -18,
          averageOccupancy: 70,
          energyCost: 325,
          revenue: 4250,
        },
        {
          date: '2026-03-31',
          label: '31/03',
          totalKwh: 500,
          averageTemperature: -18,
          averageOccupancy: 72,
          energyCost: 325,
          revenue: 4250,
        },
      ],
      monthlyComparison: [
        {
          month: 'fev/26',
          totalKwh: 9000,
          energyCost: 5900,
          revenue: 76000,
        },
        {
          month: 'mar/26',
          totalKwh: 10000,
          energyCost: 6500,
          revenue: 85000,
        },
      ],
      hourlyAverages: buildHourlyAverages(),
      cumulativeData: [
        {
          day: 30,
          label: '30',
          energyAccum: 325,
          revenueAccum: 4250,
        },
        {
          day: 31,
          label: '31',
          energyAccum: 650,
          revenueAccum: 8500,
        },
      ],
      periodSeries: [
        {
          freezerEnergy: 4,
          equipmentEnergy: 6,
          temperature: -18,
          occupancy: 65,
          timestamp: new Date('2026-03-30T12:00:00.000Z'),
        },
        {
          freezerEnergy: 5,
          equipmentEnergy: 7,
          temperature: -17,
          occupancy: 72,
          timestamp: new Date('2026-03-31T12:00:00.000Z'),
        },
      ],
      referenceDate: new Date('2026-03-31T12:00:00'),
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the business KPIs, charts and insights with cached financial data', async () => {
    render(
      <MemoryRouter initialEntries={['/business']}>
        <BusinessDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Faturamento do Periodo/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 85k/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 170k/i)).toBeInTheDocument();
    expect(screen.getByText(/Margem Operacional/i)).toBeInTheDocument();
    expect(screen.getByText(/Custo e receita do periodo/i)).toBeInTheDocument();
    expect(screen.getByText(/Energia e ocupacao do periodo/i)).toBeInTheDocument();
    expect(screen.getByText(/Insights Executivos/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Expandir Custo e receita do periodo/i }),
    ).toBeInTheDocument();
  });

  it('shows loading placeholders while the business indicators are being prepared', () => {
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
    vi.spyOn(businessHooks, 'useBusinessData').mockReturnValue({
      currentRevenue: 0,
      projectedRevenue: 0,
      energyCost: 0,
      projectedEnergyCost: 0,
      margin: 0,
      projectedMargin: 0,
      revenueChange: 0,
      costChange: 0,
      dailyData: [],
      monthlyComparison: [],
      hourlyAverages: [],
      cumulativeData: [],
      periodSeries: [],
      referenceDate: null,
      isLoading: true,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/business']}>
        <BusinessDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Carregando indicadores financeiros/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /^Indicadores Financeiros$/i }),
    ).toBeInTheDocument();
  });

  it('shows the retry state when no cached business data is available', async () => {
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
    vi.spyOn(businessHooks, 'useBusinessData').mockReturnValue({
      currentRevenue: 0,
      projectedRevenue: 0,
      energyCost: 0,
      projectedEnergyCost: 0,
      margin: 0,
      projectedMargin: 0,
      revenueChange: 0,
      costChange: 0,
      dailyData: [],
      monthlyComparison: [],
      hourlyAverages: [],
      cumulativeData: [],
      periodSeries: [],
      referenceDate: null,
      isLoading: false,
      error: 'Os dados financeiros ainda nao estao disponiveis no cache.',
    });

    render(
      <MemoryRouter initialEntries={['/business']}>
        <BusinessDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: /Nao foi possivel montar a tela de negocios/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Atualizar/i })).toBeInTheDocument();
  });

  it('shows the explicit backup banner when business data is being served from the snapshot', async () => {
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
      <MemoryRouter initialEntries={['/business']}>
        <BusinessDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Usando backup SQLite/i)).toBeInTheDocument();
    expect(screen.getByText(/Financeiro pelo backup/i)).toBeInTheDocument();
  });
});
