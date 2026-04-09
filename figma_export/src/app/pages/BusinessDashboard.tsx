import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DollarSign,
  Package,
  Receipt,
  Target,
  TrendingUp,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { FRIGORIFICO_CHANNEL } from '../../config/channels';
import { getPeriodLabel } from '../../config/periods';
import { generateBusinessInsights } from '../../domain/transformers/businessTransformer';
import { useBusinessData } from '../../hooks/useBusinessData';
import { useCacheSync } from '../../hooks/useCacheSync';
import { useDashboardPeriod } from '../../hooks/useDashboardPeriod';
import { DashboardPeriodToolbar } from '../components/dashboard/DashboardPeriodToolbar';
import { DataSourceBanner } from '../components/dashboard/DataSourceBanner';
import { ExpandableChartPanel } from '../components/dashboard/ExpandableChartPanel';
import { MetricCardWithChart } from '../components/dashboard/MetricCardWithChart';
import { TimeSeriesChart } from '../components/dashboard/TimeSeriesChart';
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
import { Skeleton } from '../components/ui/skeleton';

function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(0)}k`;
  }

  return `R$ ${value.toFixed(0)}`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function formatKilograms(value: number): string {
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)} t`;
  }

  return `${value.toFixed(0)} kg`;
}

function LoadingMetricCard() {
  return (
    <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}

function LoadingChart({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">{title}</h3>
      <Skeleton className="h-[240px] w-full" />
    </div>
  );
}

export default function BusinessDashboard() {
  const channel = FRIGORIFICO_CHANNEL;
  const [selectedPeriod, setSelectedPeriod] = useDashboardPeriod();
  const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
  const sync = useCacheSync(channel);
  const business = useBusinessData(channel, selectedPeriod);
  const currentPeriodLabel = getPeriodLabel(selectedPeriod);
  const insights = useMemo(() => generateBusinessInsights(business), [business]);
  const hasData =
    business.timeline.length > 0 ||
    business.currentRevenue > 0 ||
    business.totalCosts > 0;
  const financialTimelineSeries = business.timeline.map((entry) => ({
    label: entry.label,
    timestamp: entry.timestamp,
    faturamento: entry.grossRevenue,
    custos: entry.totalCosts,
    lucro: entry.operatingProfit,
  }));
  const costCompositionSeries = business.timeline.map((entry) => ({
    label: entry.label,
    timestamp: entry.timestamp,
    energia: entry.energyCost,
    folha: entry.payrollCost,
    aluguel: entry.rentCost,
    manutencao: entry.maintenanceCost,
    perdas: entry.lostMerchandiseCost,
  }));
  const volumeSeries = business.timeline.map((entry) => ({
    timestamp: entry.timestamp,
    processedKg: entry.processedKg,
  }));
  const revenueSeries = business.timeline.map((entry) => ({
    timestamp: entry.timestamp,
    grossRevenue: entry.grossRevenue,
  }));
  const totalCostSeries = business.timeline.map((entry) => ({
    timestamp: entry.timestamp,
    totalCosts: entry.totalCosts,
  }));
  const profitSeries = business.timeline.map((entry) => ({
    timestamp: entry.timestamp,
    operatingProfit: entry.operatingProfit,
  }));
  const marginSeries = business.timeline.map((entry) => ({
    timestamp: entry.timestamp,
    margin: entry.margin,
  }));

  if (sync.isLoading && business.isLoading && !hasData) {
    return (
      <DashboardLayout variant="business">
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">
              Carregando modelo de negocios...
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Montando faturamento, custos e lucro para {currentPeriodLabel.toLowerCase()}.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-gray-900">
              Indicadores do Negocio
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <LoadingMetricCard key={index} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LoadingChart title="Faturamento x custos x lucro" />
            <LoadingChart title="Composicao dos custos" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!hasData) {
    return (
      <DashboardLayout variant="business">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-red-50 p-3 text-red-600">
                <WifiOff className="size-6" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Nao foi possivel montar a tela de negocios
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {sync.error ?? business.error ?? 'Sem indicadores financeiros no cache local.'}
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
    <DashboardLayout variant="business">
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
              <Badge className="bg-slate-100 text-slate-800">
                {sync.isUsingBackup ? 'Modelo via backup' : 'Modelo via API/cache'}
              </Badge>
              <Badge variant="outline">Canal fixo: lab</Badge>
              <Badge variant="outline">{currentPeriodLabel}</Badge>
              <Badge variant="outline">
                Serie {business.timelineGranularity === 'hour' ? 'horaria' : 'diaria'}
              </Badge>
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Modelo Gerencial do Negocio
              </h2>
              <p className="text-sm text-gray-500">
                Energia convertida em volume processado, faturamento estimado e custos operacionais.
              </p>
            </div>

            {(sync.error || business.error) && (
              <p className="text-sm text-amber-700">{sync.error ?? business.error}</p>
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

        <div>
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            Indicadores do Negocio - {currentPeriodLabel}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <MetricCardWithChart
              title="Faturamento estimado"
              value={formatCurrencyCompact(business.currentRevenue)}
              icon={DollarSign}
              variant="business"
              subtitle={`Receita bruta estimada em ${currentPeriodLabel.toLowerCase()}`}
              miniChartData={revenueSeries}
              miniChartDataKey="grossRevenue"
              miniChartColor="#10b981"
              miniChartType="area"
              detailTitle={`Faturamento estimado - ${currentPeriodLabel}`}
              detailContent={
                <TimeSeriesChart
                  data={revenueSeries}
                  lines={[
                    {
                      dataKey: 'grossRevenue',
                      name: 'Faturamento',
                      color: '#10b981',
                    },
                  ]}
                  height={320}
                  variant="business"
                  period={selectedPeriod}
                />
              }
              infoTitle="Como calculamos o faturamento"
              infoContent={
                <>
                  <p>
                    Primeiro convertemos o consumo energetico em volume processado usando a
                    premissa de {business.assumptions.kwhPerKgProcessed.toFixed(1)} kWh por kg.
                  </p>
                  <p>
                    Depois multiplicamos o volume processado pelo preco medio de venda de R${' '}
                    {business.assumptions.averageSalePricePerKg.toFixed(2)} por kg.
                  </p>
                </>
              }
              footer={
                <div className="text-xs text-blue-700">
                  Projecao mensal: {formatCurrency(business.projectedRevenue)}
                </div>
              }
            />

            <MetricCardWithChart
              title="Custos totais"
              value={formatCurrencyCompact(business.totalCosts)}
              icon={Receipt}
              variant="business"
              subtitle={`Energia, folha, aluguel, manutencao e perdas em ${currentPeriodLabel.toLowerCase()}`}
              miniChartData={totalCostSeries}
              miniChartDataKey="totalCosts"
              miniChartColor="#3b82f6"
              miniChartType="area"
              detailTitle={`Custos totais - ${currentPeriodLabel}`}
              detailContent={
                <TimeSeriesChart
                  data={totalCostSeries}
                  lines={[
                    {
                      dataKey: 'totalCosts',
                      name: 'Custos totais',
                      color: '#3b82f6',
                    },
                  ]}
                  height={320}
                  variant="business"
                  period={selectedPeriod}
                />
              }
              infoTitle="Como calculamos os custos"
              infoContent={
                <>
                  <p>
                    Somamos custo de energia por tarifa horaria com rateio linear de folha,
                    aluguel e manutencao na janela escolhida.
                  </p>
                  <p>
                    Tambem aplicamos perda fixa de {Math.round(business.assumptions.lossRate * 100)}%
                    do volume processado, precificada a R$ {business.assumptions.merchandiseCostPerKg.toFixed(2)} por kg.
                  </p>
                </>
              }
              footer={
                <div className="text-xs text-blue-700">
                  Energia representa {((business.costBreakdown.energy / Math.max(business.totalCosts, 1)) * 100).toFixed(1)}% do custo total
                </div>
              }
            />

            <MetricCardWithChart
              title="Lucro operacional"
              value={formatCurrencyCompact(business.operatingProfit)}
              icon={TrendingUp}
              variant="business"
              subtitle={`Resultado operacional em ${currentPeriodLabel.toLowerCase()}`}
              miniChartData={profitSeries}
              miniChartDataKey="operatingProfit"
              miniChartColor="#0f766e"
              miniChartType="area"
              detailTitle={`Lucro operacional - ${currentPeriodLabel}`}
              detailContent={
                <TimeSeriesChart
                  data={profitSeries}
                  lines={[
                    {
                      dataKey: 'operatingProfit',
                      name: 'Lucro operacional',
                      color: '#0f766e',
                    },
                  ]}
                  height={320}
                  variant="business"
                  period={selectedPeriod}
                />
              }
              infoTitle="Como calculamos o lucro operacional"
              infoContent={
                <>
                  <p>
                    O lucro operacional e a diferenca entre faturamento bruto estimado e custo
                    total modelado do mesmo periodo.
                  </p>
                  <p>
                    O modelo e gerencial e simplificado, pensado para justificar os indicadores da tela.
                  </p>
                </>
              }
              footer={
                <div className="text-xs text-blue-700">
                  Receita atual: {formatCurrency(business.currentRevenue)}
                </div>
              }
            />

            <MetricCardWithChart
              title="Margem operacional"
              value={business.margin}
              unit="%"
              icon={Target}
              variant="business"
              subtitle={`Margem estimada em ${currentPeriodLabel.toLowerCase()}`}
              miniChartData={marginSeries}
              miniChartDataKey="margin"
              miniChartColor="#8b5cf6"
              miniChartType="line"
              detailTitle={`Margem operacional - ${currentPeriodLabel}`}
              detailContent={
                <TimeSeriesChart
                  data={marginSeries}
                  lines={[
                    {
                      dataKey: 'margin',
                      name: 'Margem',
                      color: '#8b5cf6',
                    },
                  ]}
                  height={320}
                  variant="business"
                  period={selectedPeriod}
                />
              }
              infoTitle="Como calculamos a margem"
              infoContent={
                <>
                  <p>
                    Margem operacional = (faturamento bruto - custos totais) / faturamento bruto.
                  </p>
                  <p>
                    A projecao mensal reaplica a media da janela atual para 30 dias, mantendo a
                    mesma estrutura de custos.
                  </p>
                </>
              }
              footer={
                <div className="text-xs text-blue-700">
                  Projecao mensal: {business.projectedMargin.toFixed(1)}%
                </div>
              }
            />

            <MetricCardWithChart
              title="Volume processado"
              value={formatKilograms(business.estimatedProcessedKg)}
              icon={Package}
              variant="business"
              subtitle={`Volume estimado em ${currentPeriodLabel.toLowerCase()}`}
              miniChartData={volumeSeries}
              miniChartDataKey="processedKg"
              miniChartColor="#f59e0b"
              miniChartType="area"
              detailTitle={`Volume processado - ${currentPeriodLabel}`}
              detailContent={
                <TimeSeriesChart
                  data={volumeSeries}
                  lines={[
                    {
                      dataKey: 'processedKg',
                      name: 'Kg processados',
                      color: '#f59e0b',
                    },
                  ]}
                  height={320}
                  variant="business"
                  period={selectedPeriod}
                />
              }
              infoTitle="Como estimamos o volume processado"
              infoContent={
                <>
                  <p>
                    Cada {business.assumptions.kwhPerKgProcessed.toFixed(1)} kWh consumidos sao
                    convertidos em 1 kg processado.
                  </p>
                  <p>
                    Essa relacao simples cria um elo consistente entre dados energeticos e
                    indicadores de negocio.
                  </p>
                </>
              }
              footer={
                <div className="text-xs text-blue-700">
                  Premissa: {business.assumptions.kwhPerKgProcessed.toFixed(1)} kWh por kg
                </div>
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/60 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                  <Wallet className="size-4" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Premissas do modelo</h3>
              </div>
              <p className="text-sm text-gray-600">
                Operacao pequena com {business.assumptions.employeeCount} funcionarios, faturamento
                estimado a partir de energia convertida em kg processados.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                <p>Folha mensal: {formatCurrency(business.assumptions.monthlyPayrollCost)}</p>
                <p>Aluguel mensal: {formatCurrency(business.assumptions.monthlyRentCost)}</p>
                <p>Manutencao mensal: {formatCurrency(business.assumptions.monthlyMaintenanceCost)}</p>
                <p>Perda fixa: {(business.assumptions.lossRate * 100).toFixed(0)}%</p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsMethodologyOpen(true);
              }}
            >
              Ver metodologia
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ExpandableChartPanel
            title="Faturamento x custos x lucro"
            subtitle={currentPeriodLabel}
            detailTitle={`Faturamento x custos x lucro - ${currentPeriodLabel}`}
            detailContent={
              <TimeSeriesChart
                data={financialTimelineSeries}
                lines={[
                  { dataKey: 'faturamento', name: 'Faturamento', color: '#10b981' },
                  { dataKey: 'custos', name: 'Custos totais', color: '#3b82f6' },
                  { dataKey: 'lucro', name: 'Lucro operacional', color: '#0f766e' },
                ]}
                height={360}
                variant="business"
                period={selectedPeriod}
              />
            }
          >
            <TimeSeriesChart
              data={financialTimelineSeries}
              lines={[
                { dataKey: 'faturamento', name: 'Faturamento', color: '#10b981' },
                { dataKey: 'custos', name: 'Custos totais', color: '#3b82f6' },
                { dataKey: 'lucro', name: 'Lucro operacional', color: '#0f766e' },
              ]}
              height={240}
              variant="business"
              period={selectedPeriod}
            />
          </ExpandableChartPanel>

          <ExpandableChartPanel
            title="Composicao dos custos"
            subtitle={currentPeriodLabel}
            detailTitle={`Composicao dos custos - ${currentPeriodLabel}`}
            detailContent={
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={costCompositionSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                  <XAxis dataKey="label" fontSize={11} stroke="#64748b" />
                  <YAxis fontSize={11} stroke="#64748b" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="energia" name="Energia" stackId="cost" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="folha" name="Folha" stackId="cost" fill="#0f766e" />
                  <Bar dataKey="aluguel" name="Aluguel" stackId="cost" fill="#8b5cf6" />
                  <Bar dataKey="manutencao" name="Manutencao" stackId="cost" fill="#f59e0b" />
                  <Bar dataKey="perdas" name="Perdas" stackId="cost" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={costCompositionSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                <XAxis dataKey="label" fontSize={11} stroke="#64748b" />
                <YAxis fontSize={11} stroke="#64748b" />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="energia" name="Energia" stackId="cost" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="folha" name="Folha" stackId="cost" fill="#0f766e" />
                <Bar dataKey="aluguel" name="Aluguel" stackId="cost" fill="#8b5cf6" />
                <Bar dataKey="manutencao" name="Manutencao" stackId="cost" fill="#f59e0b" />
                <Bar dataKey="perdas" name="Perdas" stackId="cost" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </ExpandableChartPanel>
        </div>

        <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Insights Executivos</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {insights.map((insight) => (
              <div key={insight.title} className="rounded-lg border border-blue-100 bg-white p-3">
                <div className="flex items-start gap-2">
                  <div
                    className={`rounded-lg p-1.5 ${
                      insight.variant === 'blue' ? 'bg-green-100' : 'bg-amber-100'
                    }`}
                  >
                    {insight.variant === 'blue' ? (
                      <TrendingUp className="size-4 text-green-700" />
                    ) : (
                      <DollarSign className="size-4 text-amber-700" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-900">{insight.title}</p>
                    <p className="mt-1 text-xs text-gray-600">{insight.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={isMethodologyOpen} onOpenChange={setIsMethodologyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Metodologia do modelo de negocios</DialogTitle>
            <DialogDescription>
              Modelo gerencial simples, pensado para justificar os valores da tela a partir da energia consumida.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm text-gray-600">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="font-medium text-gray-900">Premissas fixas</p>
                <ul className="mt-2 space-y-1 text-xs">
                  <li>{business.assumptions.employeeCount} funcionarios</li>
                  <li>Folha mensal: {formatCurrency(business.assumptions.monthlyPayrollCost)}</li>
                  <li>Aluguel mensal: {formatCurrency(business.assumptions.monthlyRentCost)}</li>
                  <li>Manutencao mensal: {formatCurrency(business.assumptions.monthlyMaintenanceCost)}</li>
                </ul>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="font-medium text-gray-900">Conversoes</p>
                <ul className="mt-2 space-y-1 text-xs">
                  <li>{business.assumptions.kwhPerKgProcessed.toFixed(1)} kWh para 1 kg processado</li>
                  <li>Preco medio: R$ {business.assumptions.averageSalePricePerKg.toFixed(2)} por kg</li>
                  <li>Perda fixa: {(business.assumptions.lossRate * 100).toFixed(0)}%</li>
                  <li>Custo da perda: R$ {business.assumptions.merchandiseCostPerKg.toFixed(2)} por kg</li>
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900">
              <p>
                1. Somamos o consumo eletrico por bucket do periodo e calculamos o custo de energia pelas tarifas horarias.
              </p>
              <p className="mt-2">
                2. Convertimos kWh em kg processados e multiplicamos pelo preco medio de venda para obter o faturamento bruto.
              </p>
              <p className="mt-2">
                3. Rateamos folha, aluguel e manutencao de forma linear na janela selecionada e aplicamos perda de mercadoria como custo operacional adicional.
              </p>
              <p className="mt-2">
                4. Lucro operacional = faturamento bruto - custos totais. Margem = lucro operacional / faturamento bruto.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
