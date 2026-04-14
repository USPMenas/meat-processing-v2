import { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  BadgeAlert,
  Clock3,
  Scale,
  ShieldAlert,
  Snowflake,
  Wallet,
  Wrench,
} from 'lucide-react';
import { FRIGORIFICO_CHANNEL } from '../../config/channels';
import { getPeriodLabel } from '../../config/periods';
import { getDecisionActionLabel } from '../../domain/transformers/decisionTransformer';
import type {
  DecisionActionId,
  DecisionCriterionScore,
  DecisionMatrixRow,
} from '../../domain/types';
import { useCacheSync } from '../../hooks/useCacheSync';
import { useDashboardPeriod } from '../../hooks/useDashboardPeriod';
import { useDecisionMatrix } from '../../hooks/useDecisionMatrix';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { DataSourceBanner } from '../components/dashboard/DataSourceBanner';
import { DashboardPeriodToolbar } from '../components/dashboard/DashboardPeriodToolbar';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
import { Skeleton } from '../components/ui/skeleton';
import { useIsMobile } from '../components/ui/use-mobile';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function formatTariff(value: number): string {
  return `R$ ${value.toFixed(2)}/kWh`;
}

function formatDateTime(value: Date | null): string {
  if (!value) {
    return '--';
  }

  return value.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActionIcon(action: DecisionActionId) {
  switch (action) {
    case 'operate_now':
      return Snowflake;
    case 'delay_to_ideal_window':
      return Clock3;
    case 'redistribute_load':
      return ArrowRightLeft;
    case 'schedule_maintenance':
      return Wrench;
  }
}

function getRecommendationTone(recommendation: DecisionMatrixRow['recommendation']) {
  if (recommendation === 'recommended') {
    return {
      badge: 'bg-emerald-100 text-emerald-800',
      surface: 'border-emerald-200 bg-emerald-50/80',
      label: 'Recomendada',
    };
  }

  if (recommendation === 'watch') {
    return {
      badge: 'bg-amber-100 text-amber-900',
      surface: 'border-amber-200 bg-amber-50/80',
      label: 'Monitorar',
    };
  }

  return {
    badge: 'bg-slate-100 text-slate-700',
    surface: 'border-slate-200 bg-white',
    label: 'Evitar',
  };
}

function getRiskTone(riskLevel: 'low' | 'medium' | 'high') {
  if (riskLevel === 'high') {
    return 'bg-red-100 text-red-800';
  }

  if (riskLevel === 'medium') {
    return 'bg-amber-100 text-amber-900';
  }

  return 'bg-emerald-100 text-emerald-800';
}

function getCriterionBarTone(score: number) {
  if (score >= 75) {
    return 'bg-emerald-500';
  }

  if (score >= 50) {
    return 'bg-amber-500';
  }

  return 'bg-rose-500';
}

function SignalCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof ShieldAlert;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{helper}</p>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}

function DecisionDetailPanel({
  row,
  isMobile,
}: {
  row: DecisionMatrixRow;
  isMobile: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tone = getRecommendationTone(row.recommendation);
  const Icon = getActionIcon(row.action);

  const content = (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="rounded-2xl bg-white p-3 text-slate-700 shadow-sm">
          <Icon className="size-5" />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={tone.badge}>{tone.label}</Badge>
            <Badge variant="outline">Score {row.totalScore.toFixed(1)}</Badge>
          </div>
          <p className="text-sm leading-6 text-slate-600">{row.rationale}</p>
        </div>
      </div>

      <div className="space-y-3">
        {row.scores.map((score) => (
          <CriterionScoreCard key={score.criterion} score={score} />
        ))}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full justify-center rounded-xl"
          onClick={() => setOpen(true)}
        >
          Ver detalhes da ação
        </Button>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[28px] px-0 pb-6">
          <SheetHeader className="px-4 pb-2">
            <SheetTitle>{row.label}</SheetTitle>
            <SheetDescription>
              Critérios e score detalhado para a decisão operacional.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 rounded-xl"
        onClick={() => setOpen(true)}
      >
        Ver detalhes
      </Button>
      <DialogContent className="max-w-2xl rounded-3xl border-slate-200 p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>{row.label}</DialogTitle>
          <DialogDescription>
            Critérios e score detalhado para a decisão operacional.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{content}</div>
      </DialogContent>
    </Dialog>
  );
}

function CriterionScoreCard({ score }: { score: DecisionCriterionScore }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{score.criterion}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Peso {score.weight}%
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-950">{score.score.toFixed(0)}</p>
          <p className="text-xs text-slate-500">{score.weightedScore.toFixed(1)} pts</p>
        </div>
      </div>
      <div
        className={`mt-3 h-2 rounded-full ${getCriterionBarTone(score.score)}`}
        style={{ width: `${score.score}%` }}
      />
      <p className="mt-3 text-sm leading-6 text-slate-600">{score.rationale}</p>
    </div>
  );
}

function MobileDecisionCard({
  row,
  isMobile,
}: {
  row: DecisionMatrixRow;
  isMobile: boolean;
}) {
  const tone = getRecommendationTone(row.recommendation);
  const Icon = getActionIcon(row.action);

  return (
    <AccordionItem
      value={row.action}
      className={`overflow-hidden rounded-2xl border ${tone.surface}`}
    >
      <AccordionTrigger className="min-h-11 px-4 py-4 hover:no-underline">
        <div className="flex w-full items-start gap-3 text-left">
          <div className="rounded-2xl bg-white/90 p-3 text-slate-700 shadow-sm">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-950">{row.label}</span>
              <Badge className={tone.badge}>{tone.label}</Badge>
            </div>
            <p className="text-sm leading-6 text-slate-600">{row.rationale}</p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-3 py-2 text-right text-white">
            <p className="text-xs uppercase tracking-[0.16em] text-white/70">Score</p>
            <p className="text-lg font-semibold">{row.totalScore.toFixed(1)}</p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-3">
          {row.scores.map((score) => (
            <div key={score.criterion} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{score.criterion}</p>
                  <p className="text-xs text-slate-500">Peso {score.weight}%</p>
                </div>
                <span className="text-sm font-semibold text-slate-950">
                  {score.score.toFixed(0)}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${getCriterionBarTone(score.score)}`}
                  style={{ width: `${score.score}%` }}
                />
              </div>
            </div>
          ))}
          <DecisionDetailPanel row={row} isMobile={isMobile} />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function DesktopDecisionTable({
  rows,
  isMobile,
}: {
  rows: DecisionMatrixRow[];
  isMobile: boolean;
}) {
  return (
    <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:block">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
            <th className="px-5 py-4">Ação</th>
            <th className="px-4 py-4">Status</th>
            <th className="px-4 py-4">Segurança</th>
            <th className="px-4 py-4">Eficiência</th>
            <th className="px-4 py-4">Logística</th>
            <th className="px-4 py-4">Financeiro</th>
            <th className="px-4 py-4">Score total</th>
            <th className="px-5 py-4">Detalhes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => {
            const tone = getRecommendationTone(row.recommendation);
            const Icon = getActionIcon(row.action);

            return (
              <tr key={row.action} className="align-top">
                <td className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                      <Icon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-950">{row.label}</p>
                      <p className="max-w-xs text-sm leading-6 text-slate-600">
                        {row.rationale}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <Badge className={tone.badge}>{tone.label}</Badge>
                </td>
                {row.scores.map((score) => (
                  <td key={score.criterion} className="px-4 py-4">
                    <div className="min-w-[90px]">
                      <p className="text-sm font-semibold text-slate-950">
                        {score.score.toFixed(0)}
                      </p>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <div
                          className={`h-2 rounded-full ${getCriterionBarTone(score.score)}`}
                          style={{ width: `${score.score}%` }}
                        />
                      </div>
                    </div>
                  </td>
                ))}
                <td className="px-4 py-4">
                  <span className="text-lg font-semibold text-slate-950">
                    {row.totalScore.toFixed(1)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <DecisionDetailPanel row={row} isMobile={isMobile} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DecisionDashboard() {
  const channel = FRIGORIFICO_CHANNEL;
  const [selectedPeriod, setSelectedPeriod] = useDashboardPeriod();
  const sync = useCacheSync(channel);
  const decision = useDecisionMatrix(channel, selectedPeriod, {
    isLoading: sync.isLoading,
    isOnline: sync.isOnline,
    isUsingBackup: sync.isUsingBackup,
    dataSource: sync.dataSource,
    lastDataTimestamp: sync.lastDataTimestamp,
    error: sync.error,
  });
  const isMobile = useIsMobile();
  const currentPeriodLabel = getPeriodLabel(selectedPeriod);
  const recommendedRow = decision.rows[0] ?? null;
  const secondaryRow = decision.rows[1] ?? null;
  const hasData =
    Boolean(decision.signals.temperature !== null) ||
    decision.rows.some((row) => row.totalScore > 0);

  const signalCards = useMemo(
    () => [
      {
        icon: ShieldAlert,
        label: 'Risco operacional',
        value:
          decision.summary.currentRiskLevel === 'high'
            ? 'Alto'
            : decision.summary.currentRiskLevel === 'medium'
              ? 'Moderado'
              : 'Controlado',
        helper:
          decision.summary.currentRiskLevel === 'high'
            ? 'Alertas, temperatura ou staleness já pressionam a continuidade da operação.'
            : decision.summary.currentRiskLevel === 'medium'
              ? 'A operação ainda roda, mas já exige decisão ativa do gerente operacional.'
              : 'Os sinais do twin estão estáveis para sustentar a rotina atual.',
      },
      {
        icon: Clock3,
        label: 'Janela tarifária',
        value:
          decision.signals.nextIdealHour === null
            ? formatTariff(decision.signals.currentTariff)
            : `${formatTariff(decision.signals.currentTariff)} • ${String(decision.signals.nextIdealHour).padStart(2, '0')}h`,
        helper:
          decision.signals.nextIdealHour === null
            ? 'Sem janela barata clara nas próximas horas; a tarifa atual domina a decisão.'
            : `Próxima janela ideal prevista para ${String(decision.signals.nextIdealHour).padStart(2, '0')}h com ${decision.signals.lowEnergyHours} horas baratas no ciclo.`,
      },
      {
        icon: Wallet,
        label: 'Custo energético',
        value: formatCurrency(decision.signals.energyCost),
        helper: `Projeção da janela: ${formatCurrency(decision.signals.projectedEnergyCost)}. Energia representa ${(decision.signals.energyCostShare * 100).toFixed(0)}% do custo modelado.`,
      },
      {
        icon: Scale,
        label: 'Margem operacional',
        value: `${decision.signals.margin.toFixed(1)}%`,
        helper:
          decision.signals.margin < 25
            ? 'A margem está pressionada; decisões de custo ganham peso imediato.'
            : 'A margem ainda absorve ajustes sem exigir corte brusco da operação.',
      },
    ],
    [
      decision.signals.currentTariff,
      decision.signals.energyCost,
      decision.signals.energyCostShare,
      decision.signals.lowEnergyHours,
      decision.signals.margin,
      decision.signals.nextIdealHour,
      decision.signals.projectedEnergyCost,
      decision.summary.currentRiskLevel,
    ],
  );

  if (sync.isLoading && decision.isLoading && !hasData) {
    return (
      <DashboardLayout variant="decision">
        <div className="space-y-4">
          <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-950">
              Consolidando a matriz de decisão...
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Cruzando dados operacionais, logísticos e financeiros para sugerir a
              melhor ação desta janela.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <LoadingCard key={index} />
            ))}
          </div>

          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <LoadingCard key={index} />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!hasData) {
    return (
      <DashboardLayout variant="decision">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-red-50 p-3 text-red-600">
                <BadgeAlert className="size-6" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Não foi possível montar a sala de decisão
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {decision.error ??
                      'Ainda não há dados suficientes para consolidar a matriz desta janela.'}
                  </p>
                </div>

                <DashboardPeriodToolbar
                  period={selectedPeriod}
                  onPeriodChange={setSelectedPeriod}
                  onRefresh={sync.refreshNow}
                  isRefreshing={sync.isRefreshing}
                  pollingMode={sync.pollingMode}
                  align="left"
                />
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout variant="decision">
      <div className="space-y-4">
        <DataSourceBanner
          channel={channel}
          isOnline={sync.isOnline}
          dataSource={sync.dataSource}
          sourceMessage={sync.sourceMessage}
          lastApiAttempt={sync.lastApiAttempt}
          lastSuccessfulApiSync={sync.lastSuccessfulApiSync}
          lastDataTimestamp={sync.lastDataTimestamp}
          backupSnapshotTimestamp={sync.backupSnapshotTimestamp}
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={getRiskTone(decision.summary.currentRiskLevel)}>
                {decision.summary.currentRiskLevel === 'high'
                  ? 'Risco alto'
                  : decision.summary.currentRiskLevel === 'medium'
                    ? 'Risco moderado'
                    : 'Risco controlado'}
              </Badge>
              <Badge variant="outline">{currentPeriodLabel}</Badge>
              <Badge variant="outline">Atualizado em {formatDateTime(decision.lastUpdatedAt)}</Badge>
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-950">Sala de Decisão</h2>
              <p className="text-sm leading-6 text-slate-600">
                Matriz de alternativas para o gerente operacional, consolidando risco,
                tarifa, logística e margem em uma recomendação única.
              </p>
            </div>

            {decision.error && (
              <p className="text-sm text-amber-700">{decision.error}</p>
            )}
          </div>

          <DashboardPeriodToolbar
            period={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            onRefresh={sync.refreshNow}
            isRefreshing={sync.isRefreshing}
            pollingMode={sync.pollingMode}
          />
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-sm sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              {decision.summary.priorityBadges.map((badge) => (
                <Badge
                  key={badge}
                  className="border border-white/10 bg-white/10 text-white backdrop-blur-sm"
                >
                  {badge}
                </Badge>
              ))}
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/60">
                  Recomendação principal
                </p>
                <h3 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
                  {getDecisionActionLabel(decision.summary.recommendedAction)}
                </h3>
                <p className="max-w-2xl text-sm leading-6 text-white/75">
                  {decision.summary.executiveMessage}
                </p>
              </div>

              <div className="w-full rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm lg:max-w-xs">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                  Score da melhor ação
                </p>
                <p className="mt-2 text-4xl font-semibold">
                  {recommendedRow?.totalScore.toFixed(1) ?? '--'}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  Alternativa reserva: {secondaryRow?.label ?? 'Sem segunda ação definida.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {signalCards.map((card) => (
            <SignalCard
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={card.value}
              helper={card.helper}
            />
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Matriz de alternativas</h3>
              <p className="text-sm leading-6 text-slate-600">
                No celular, cada ação aparece em um card expansível; em telas maiores,
                a comparação fica lado a lado.
              </p>
            </div>
          </div>

          <Accordion type="single" collapsible className="space-y-3 md:hidden">
            {decision.rows.map((row) => (
              <MobileDecisionCard key={row.action} row={row} isMobile={isMobile} />
            ))}
          </Accordion>

          <DesktopDecisionTable rows={decision.rows} isMobile={isMobile} />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Decisão do stakeholder
            </p>
            <div className="mt-3 space-y-4">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {recommendedRow?.label}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {recommendedRow?.rationale}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Plano alternativo
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {secondaryRow?.label ?? 'Sem alternativa reserva'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Condição de revisão
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {decision.summary.reviewCondition}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Dashboards de apoio
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">Operacional</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Temperatura, ocupação, energia do freezer, alertas e staleness.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">Logística</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Janela ideal, horas de tarifa baixa e pico de ocupação da operação.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">Negócios</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Custo energético, projeção de custo e pressão sobre a margem.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
