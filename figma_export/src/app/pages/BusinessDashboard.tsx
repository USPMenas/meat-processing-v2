import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DollarSign, Target, TrendingUp, WifiOff, Zap } from 'lucide-react';
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
import { Skeleton } from '../components/ui/skeleton';

function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
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
  const sync = useCacheSync(channel);
  const business = useBusinessData(channel, selectedPeriod);
  const currentPeriodLabel = getPeriodLabel(selectedPeriod);
  const insights = useMemo(() => generateBusinessInsights(business), [business]);
  const hasData =
    business.currentRevenue > 0 ||
    business.energyCost > 0 ||
    business.dailyData.length > 0 ||
    business.periodSeries.length > 0;
  const costSeries = business.dailyData.map((entry) => ({
    label: entry.label,
    energyCost: entry.energyCost,
    revenue: entry.revenue,
  }));
  const recentDailyData = business.dailyData.map((entry) => ({
    value: entry.energyCost,
  }));
  const periodSeries = business.periodSeries.map((entry) => ({
    ...entry,
    totalEnergy: entry.freezerEnergy + entry.equipmentEnergy,
  }));

  if (sync.isLoading && business.isLoading && !hasData) {
    return (
      <DashboardLayout variant="business">
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">
              Carregando indicadores financeiros...
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Montando receita, custo e margem para {currentPeriodLabel.toLowerCase()}.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-gray-900">
              Indicadores Financeiros
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 5 }, (_, index) => (
                <LoadingMetricCard key={index} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LoadingChart title="Custo e receita do periodo" />
            <LoadingChart title="Energia e ocupacao do periodo" />
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
                {sync.isUsingBackup ? 'Financeiro pelo backup' : 'Financeiro a partir da API/cache'}
              </Badge>
              <Badge variant="outline">Canal fixo: lab</Badge>
              <Badge variant="outline">{currentPeriodLabel}</Badge>
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Indicadores Financeiros
              </h2>
              <p className="text-sm text-gray-500">
                Receita, custo e margem recalculados para o periodo selecionado.
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
            Indicadores Financeiros - {currentPeriodLabel}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <MetricCardWithChart
              title="Faturamento do Periodo"
              value={formatCurrencyCompact(business.currentRevenue)}
              icon={DollarSign}
              variant="business"
              subtitle={`Receita estimada em ${currentPeriodLabel.toLowerCase()}`}
              miniChartData={recentDailyData}
              miniChartDataKey="value"
              miniChartColor="#10b981"
              miniChartType="area"
              footer={
                <div className="text-xs text-blue-700">
                  <strong>Variacao:</strong> {business.revenueChange >= 0 ? '+' : ''}
                  {business.revenueChange.toFixed(1)}%
                </div>
              }
            />

            <MetricCardWithChart
              title="Projecao do Periodo"
              value={formatCurrencyCompact(business.projectedRevenue)}
              icon={TrendingUp}
              variant="business"
              subtitle="Extrapolacao linear da janela selecionada"
              footer={
                <div className="text-xs text-blue-700">
                  Receita atual: {formatCurrency(business.currentRevenue)}
                </div>
              }
            />

            <MetricCardWithChart
              title="Custo Energetico"
              value={formatCurrencyCompact(business.energyCost)}
              icon={Zap}
              variant="business"
              subtitle={`Custo estimado em ${currentPeriodLabel.toLowerCase()}`}
              miniChartData={recentDailyData}
              miniChartDataKey="value"
              miniChartColor="#3b82f6"
              miniChartType="area"
              footer={
                <div className="text-xs text-blue-700">
                  <strong>Variacao:</strong> {business.costChange >= 0 ? '+' : ''}
                  {business.costChange.toFixed(1)}%
                </div>
              }
            />

            <MetricCardWithChart
              title="Projecao de Custo"
              value={formatCurrencyCompact(business.projectedEnergyCost)}
              icon={TrendingUp}
              variant="business"
              subtitle="Projecao linear da despesa energetica"
              footer={
                <div className="text-xs text-blue-700">
                  Custo atual: {formatCurrency(business.energyCost)}
                </div>
              }
            />

            <MetricCardWithChart
              title="Margem Operacional"
              value={business.margin}
              unit="%"
              icon={Target}
              variant="business"
              subtitle={`Margem estimada em ${currentPeriodLabel.toLowerCase()}`}
              footer={
                <div className="text-xs text-blue-700">
                  <strong>Projecao:</strong> {business.projectedMargin.toFixed(1)}%
                </div>
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ExpandableChartPanel
            title="Custo e receita do periodo"
            subtitle={currentPeriodLabel}
            detailTitle={`Custo e receita - ${currentPeriodLabel}`}
            detailContent={
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={costSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                  <XAxis dataKey="label" fontSize={11} stroke="#64748b" />
                  <YAxis yAxisId="left" fontSize={11} stroke="#64748b" />
                  <YAxis yAxisId="right" orientation="right" fontSize={11} stroke="#64748b" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    yAxisId="left"
                    dataKey="energyCost"
                    name="Custo"
                    fill="#3b82f6"
                    radius={[8, 8, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    name="Receita"
                    stroke="#10b981"
                    strokeWidth={3}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={costSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                <XAxis dataKey="label" fontSize={11} stroke="#64748b" />
                <YAxis yAxisId="left" fontSize={11} stroke="#64748b" />
                <YAxis yAxisId="right" orientation="right" fontSize={11} stroke="#64748b" />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="energyCost"
                  name="Custo"
                  fill="#3b82f6"
                  radius={[8, 8, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  name="Receita"
                  stroke="#10b981"
                  strokeWidth={3}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ExpandableChartPanel>

          <ExpandableChartPanel
            title="Energia e ocupacao do periodo"
            subtitle={currentPeriodLabel}
            detailTitle={`Energia e ocupacao - ${currentPeriodLabel}`}
            detailContent={
              <TimeSeriesChart
                data={periodSeries}
                lines={[
                  {
                    dataKey: 'totalEnergy',
                    name: 'Energia',
                    color: '#3b82f6',
                  },
                  {
                    dataKey: 'occupancy',
                    name: 'Ocupacao',
                    color: '#f59e0b',
                  },
                ]}
                height={360}
                variant="business"
                period={selectedPeriod}
              />
            }
          >
            <TimeSeriesChart
              data={periodSeries}
              lines={[
                {
                  dataKey: 'totalEnergy',
                  name: 'Energia',
                  color: '#3b82f6',
                },
                {
                  dataKey: 'occupancy',
                  name: 'Ocupacao',
                  color: '#f59e0b',
                },
              ]}
              height={240}
              variant="business"
              period={selectedPeriod}
            />
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
                      insight.variant === 'blue' ? 'bg-green-100' : 'bg-purple-100'
                    }`}
                  >
                    {insight.variant === 'blue' ? (
                      <TrendingUp className="size-4 text-green-700" />
                    ) : (
                      <DollarSign className="size-4 text-purple-700" />
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
    </DashboardLayout>
  );
}
