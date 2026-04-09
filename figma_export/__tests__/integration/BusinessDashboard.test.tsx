import { fireEvent, render, screen } from '@testing-library/react';
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

function buildTimeline() {
  return [
    {
      key: '2026-03-30',
      label: '30/03',
      timestamp: new Date('2026-03-30T12:00:00.000Z'),
      totalKwh: 240,
      processedKg: 100,
      grossRevenue: 1600,
      energyCost: 156,
      payrollCost: 513.33,
      rentCost: 280,
      maintenanceCost: 105,
      lostMerchandiseCost: 55,
      totalCosts: 1109.33,
      operatingProfit: 490.67,
      margin: 30.67,
      averageTemperature: -18,
      averageOccupancy: 65,
    },
    {
      key: '2026-03-31',
      label: '31/03',
      timestamp: new Date('2026-03-31T12:00:00.000Z'),
      totalKwh: 240,
      processedKg: 100,
      grossRevenue: 1600,
      energyCost: 156,
      payrollCost: 513.33,
      rentCost: 280,
      maintenanceCost: 105,
      lostMerchandiseCost: 55,
      totalCosts: 1109.33,
      operatingProfit: 490.67,
      margin: 30.67,
      averageTemperature: -17.8,
      averageOccupancy: 67,
    },
  ];
}

describe('BusinessDashboard integration', () => {
  beforeEach(() => {
    vi.spyOn(cacheSyncHooks, 'useCacheSync').mockReturnValue(buildCacheSyncMock());
    vi.spyOn(businessHooks, 'useBusinessData').mockReturnValue({
      currentRevenue: 3200,
      projectedRevenue: 48000,
      energyCost: 312,
      projectedEnergyCost: 4680,
      margin: 30.67,
      projectedMargin: 30.67,
      revenueChange: 0,
      costChange: 0,
      estimatedProcessedKg: 200,
      totalCosts: 2218.66,
      operatingProfit: 981.34,
      costBreakdown: {
        energy: 312,
        payroll: 1026.66,
        rent: 560,
        maintenance: 210,
        lostMerchandise: 110,
        total: 2218.66,
      },
      timeline: buildTimeline(),
      timelineGranularity: 'day',
      assumptions: {
        employeeCount: 4,
        monthlyPayrollCost: 22000,
        monthlyRentCost: 12000,
        monthlyMaintenanceCost: 4500,
        lossRate: 0.05,
        merchandiseCostPerKg: 11,
        kwhPerKgProcessed: 2.4,
        averageSalePricePerKg: 16,
      },
      dailyData: [
        {
          date: '2026-03-30',
          label: '30/03',
          totalKwh: 240,
          averageTemperature: -18,
          averageOccupancy: 65,
          energyCost: 156,
          revenue: 1600,
        },
        {
          date: '2026-03-31',
          label: '31/03',
          totalKwh: 240,
          averageTemperature: -17.8,
          averageOccupancy: 67,
          energyCost: 156,
          revenue: 1600,
        },
      ],
      monthlyComparison: [
        {
          month: 'mar/26',
          totalKwh: 480,
          energyCost: 312,
          revenue: 3200,
        },
      ],
      hourlyAverages: [],
      cumulativeData: [
        {
          day: 30,
          label: '30',
          energyAccum: 156,
          revenueAccum: 1600,
        },
        {
          day: 31,
          label: '31',
          energyAccum: 312,
          revenueAccum: 3200,
        },
      ],
      periodSeries: [],
      referenceDate: new Date('2026-03-31T12:00:00'),
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the new business model KPIs, charts and assumptions panel', async () => {
    render(
      <MemoryRouter initialEntries={['/business']}>
        <BusinessDashboard />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText(/Faturamento estimado/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Custos totais/i)).toBeInTheDocument();
    expect(screen.getByText(/Lucro operacional/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Volume processado/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Premissas do modelo/i)).toBeInTheDocument();
    expect(screen.getByText(/Faturamento x custos x lucro/i)).toBeInTheDocument();
    expect(screen.getByText(/Composicao dos custos/i)).toBeInTheDocument();
  });

  it('opens the methodology modal with the fixed assumptions of the model', async () => {
    render(
      <MemoryRouter initialEntries={['/business']}>
        <BusinessDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Ver metodologia/i }));

    expect(await screen.findByText(/Metodologia do modelo de negocios/i)).toBeInTheDocument();
    expect(screen.getAllByText(/4 funcionarios/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/2.4 kWh para 1 kg processado/i)).toBeInTheDocument();
  });

  it('shows loading placeholders while the business model is being prepared', () => {
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
      estimatedProcessedKg: 0,
      totalCosts: 0,
      operatingProfit: 0,
      costBreakdown: {
        energy: 0,
        payroll: 0,
        rent: 0,
        maintenance: 0,
        lostMerchandise: 0,
        total: 0,
      },
      timeline: [],
      timelineGranularity: 'day',
      assumptions: {
        employeeCount: 4,
        monthlyPayrollCost: 22000,
        monthlyRentCost: 12000,
        monthlyMaintenanceCost: 4500,
        lossRate: 0.05,
        merchandiseCostPerKg: 11,
        kwhPerKgProcessed: 2.4,
        averageSalePricePerKg: 16,
      },
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

    expect(screen.getByText(/Carregando modelo de negocios/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Indicadores do Negocio$/i })).toBeInTheDocument();
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
      estimatedProcessedKg: 0,
      totalCosts: 0,
      operatingProfit: 0,
      costBreakdown: {
        energy: 0,
        payroll: 0,
        rent: 0,
        maintenance: 0,
        lostMerchandise: 0,
        total: 0,
      },
      timeline: [],
      timelineGranularity: 'day',
      assumptions: {
        employeeCount: 4,
        monthlyPayrollCost: 22000,
        monthlyRentCost: 12000,
        monthlyMaintenanceCost: 4500,
        lossRate: 0.05,
        merchandiseCostPerKg: 11,
        kwhPerKgProcessed: 2.4,
        averageSalePricePerKg: 16,
      },
      dailyData: [],
      monthlyComparison: [],
      hourlyAverages: [],
      cumulativeData: [],
      periodSeries: [],
      referenceDate: null,
      isLoading: false,
      error: 'Os dados do modelo de negocios ainda nao estao disponiveis no cache.',
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
});
