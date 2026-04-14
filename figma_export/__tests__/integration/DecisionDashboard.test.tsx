import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import DecisionDashboard from '@/app/pages/DecisionDashboard';
import * as cacheSyncHooks from '@/hooks/useCacheSync';
import * as decisionHooks from '@/hooks/useDecisionMatrix';
import * as mobileHook from '@/app/components/ui/use-mobile';

function buildCacheSyncMock(
  overrides: Partial<ReturnType<typeof cacheSyncHooks.useCacheSync>> = {},
) {
  return {
    isLoading: false,
    isOnline: true,
    isRefreshing: false,
    lastSync: new Date('2026-04-08T10:00:00.000Z'),
    lastApiAttempt: new Date('2026-04-08T10:00:00.000Z'),
    lastSuccessfulApiSync: new Date('2026-04-08T10:00:00.000Z'),
    lastDataTimestamp: new Date('2026-04-08T10:00:00.000Z'),
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

function buildDecisionMock(): ReturnType<typeof decisionHooks.useDecisionMatrix> {
  const rows = [
    {
      action: 'delay_to_ideal_window' as const,
      label: 'Adiar para a próxima janela ideal',
      scores: [
        {
          criterion: 'Seguranca operacional',
          score: 74,
          weight: 40,
          weightedScore: 29.6,
          rationale: 'Risco atual permite aguardar a janela barata.',
        },
        {
          criterion: 'Eficiência energética',
          score: 96,
          weight: 25,
          weightedScore: 24,
          rationale: 'Tarifa de ponta torna o adiamento muito eficiente.',
        },
        {
          criterion: 'Impacto logístico',
          score: 66,
          weight: 20,
          weightedScore: 13.2,
          rationale: 'Ocupação ainda comporta pequena espera.',
        },
        {
          criterion: 'Impacto financeiro',
          score: 72,
          weight: 15,
          weightedScore: 10.8,
          rationale: 'A margem melhora ao deslocar carga para fora de ponta.',
        },
      ],
      totalScore: 77.6,
      recommendation: 'recommended' as const,
      rationale: 'Segurar a operação agora captura a melhor janela de tarifa.',
    },
    {
      action: 'redistribute_load' as const,
      label: 'Redistribuir carga entre equipamentos',
      scores: [
        {
          criterion: 'Seguranca operacional',
          score: 63,
          weight: 40,
          weightedScore: 25.2,
          rationale: 'Alivia pressão moderada sem parar a operação.',
        },
        {
          criterion: 'Eficiência energética',
          score: 80,
          weight: 25,
          weightedScore: 20,
          rationale: 'Reduz custo energético na janela atual.',
        },
        {
          criterion: 'Impacto logístico',
          score: 68,
          weight: 20,
          weightedScore: 13.6,
          rationale: 'Mantém fluxo com pouco atrito logístico.',
        },
        {
          criterion: 'Impacto financeiro',
          score: 65,
          weight: 15,
          weightedScore: 9.8,
          rationale: 'Ajuda a segurar custo sem cortar throughput.',
        },
      ],
      totalScore: 68.6,
      recommendation: 'watch' as const,
      rationale: 'Boa alternativa intermediária se a espera não for possível.',
    },
    {
      action: 'operate_now' as const,
      label: 'Operar agora',
      scores: [
        {
          criterion: 'Seguranca operacional',
          score: 55,
          weight: 40,
          weightedScore: 22,
          rationale: 'Viável, mas com menos folga operacional.',
        },
        {
          criterion: 'Eficiência energética',
          score: 34,
          weight: 25,
          weightedScore: 8.5,
          rationale: 'A tarifa atual tira eficiência da decisão.',
        },
        {
          criterion: 'Impacto logístico',
          score: 72,
          weight: 20,
          weightedScore: 14.4,
          rationale: 'Mantém o fluxo atual imediatamente.',
        },
        {
          criterion: 'Impacto financeiro',
          score: 40,
          weight: 15,
          weightedScore: 6,
          rationale: 'A margem absorve mal a tarifa de ponta.',
        },
      ],
      totalScore: 50.9,
      recommendation: 'avoid' as const,
      rationale: 'A operação agora custa caro demais para a janela atual.',
    },
    {
      action: 'schedule_maintenance' as const,
      label: 'Acionar manutenção preventiva',
      scores: [
        {
          criterion: 'Seguranca operacional',
          score: 44,
          weight: 40,
          weightedScore: 17.6,
          rationale: 'Não há risco alto o bastante para parar agora.',
        },
        {
          criterion: 'Eficiência energética',
          score: 48,
          weight: 25,
          weightedScore: 12,
          rationale: 'Pode melhorar eficiência, mas não é prioridade imediata.',
        },
        {
          criterion: 'Impacto logístico',
          score: 25,
          weight: 20,
          weightedScore: 5,
          rationale: 'Interrompe o fluxo sem necessidade urgente.',
        },
        {
          criterion: 'Impacto financeiro',
          score: 32,
          weight: 15,
          weightedScore: 4.8,
          rationale: 'A decisão traz custo de curto prazo sem urgência.',
        },
      ],
      totalScore: 39.4,
      recommendation: 'avoid' as const,
      rationale: 'A manutenção fica como cenário de contingência, não ação imediata.',
    },
  ];

  return {
    summary: {
      currentRiskLevel: 'medium',
      recommendedAction: 'delay_to_ideal_window',
      secondaryAction: 'redistribute_load',
      rows,
      executiveMessage:
        'A melhor decisão é segurar o processamento e capturar a próxima janela tarifária favorável.',
      reviewCondition: 'Revisar ao chegar 22h ou antes se o risco operacional subir.',
      priorityBadges: ['risco moderado', 'tarifa de ponta', 'janela ideal 22h'],
    },
    rows,
    signals: {
      temperature: -18,
      occupancy: 72,
      freezerEnergy: 9,
      peakOccupancy: 78,
      criticalAlerts: 0,
      warningAlerts: 1,
      infoAlerts: 0,
      isStale: false,
      currentTariff: 0.85,
      nextIdealHour: 22,
      lowEnergyHours: 8,
      energyCost: 12_000,
      projectedEnergyCost: 18_000,
      margin: 23,
      energyCostShare: 0.24,
      isOnline: true,
      isUsingBackup: false,
      dataSource: 'api',
      lastUpdatedAt: new Date('2026-04-08T10:00:00.000Z'),
    },
    isLoading: false,
    error: null,
    lastUpdatedAt: new Date('2026-04-08T10:00:00.000Z'),
    sourceStatus: {
      isOnline: true,
      isUsingBackup: false,
      dataSource: 'api' as const,
    },
  };
}

describe('DecisionDashboard integration', () => {
  beforeEach(() => {
    vi.spyOn(cacheSyncHooks, 'useCacheSync').mockReturnValue(buildCacheSyncMock());
    vi.spyOn(decisionHooks, 'useDecisionMatrix').mockReturnValue(buildDecisionMock());
    vi.spyOn(mobileHook, 'useIsMobile').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the executive recommendation and desktop comparison table', async () => {
    render(
      <MemoryRouter initialEntries={['/decision']}>
        <DecisionDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Sala de Decisão/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Adiar para a próxima janela ideal/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('heading', { name: /Matriz de alternativas/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Score da melhor ação/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Decisao/i })).toBeInTheDocument();
    expect(screen.getByText(/Dashboards de apoio/i)).toBeInTheDocument();
  });

  it('renders stacked mobile action cards without relying on a wide table', async () => {
    vi.spyOn(mobileHook, 'useIsMobile').mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={['/decision']}>
        <DecisionDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: /Matriz de alternativas/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Ver detalhes da ação/i })).toHaveLength(4);
    expect(screen.getByText(/No celular, cada ação aparece em um card expansível/i)).toBeInTheDocument();
  });
});
