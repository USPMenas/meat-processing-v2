import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clock, Package, TrendingDown, WifiOff, Zap } from 'lucide-react';
import { FRIGORIFICO_CHANNEL } from '../../config/channels';
import { getPeriodLabel } from '../../config/periods';
import { generateLogisticsInsights } from '../../domain/transformers/logisticsTransformer';
import { useCacheSync } from '../../hooks/useCacheSync';
import { useDashboardPeriod } from '../../hooks/useDashboardPeriod';
import { useLogisticsData } from '../../hooks/useLogisticsData';
import { DashboardPeriodToolbar } from '../components/dashboard/DashboardPeriodToolbar';
import { DataSourceBanner } from '../components/dashboard/DataSourceBanner';
import { ExpandableChartPanel } from '../components/dashboard/ExpandableChartPanel';
import { MetricCardWithChart } from '../components/dashboard/MetricCardWithChart';
import { TimeSeriesChart } from '../components/dashboard/TimeSeriesChart';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';

function LoadingMetricCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-3 w-36" />
      </div>
    </div>
  );
}

function LoadingChart({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>
      <Skeleton className="h-[240px] w-full" />
    </div>
  );
}

export default function LogisticsDashboard() {
  const channel = FRIGORIFICO_CHANNEL;
  const [selectedPeriod, setSelectedPeriod] = useDashboardPeriod();
  const sync = useCacheSync(channel);
  const logistics = useLogisticsData(channel, selectedPeriod);
  const currentPeriodLabel = getPeriodLabel(selectedPeriod);
  const insights = useMemo(() => generateLogisticsInsights(logistics), [logistics]);
  const periodSeries = logistics.periodSeries.map((entry) => ({
    ...entry,
    totalEnergy: entry.freezerEnergy + entry.equipmentEnergy,
  }));
  const hasData =
    logistics.avgEnergy24h > 0 ||
    logistics.peakOccupancy > 0 ||
    logistics.hourlyData.some((entry) => entry.avgEnergy > 0) ||
    periodSeries.length > 0;
  const peakHour = logistics.hourlyData.reduce<{ hour: number; occupancy: number } | null>(
    (highest, entry) => {
      if (!highest || entry.avgOccupancy > highest.occupancy) {
        return {
          hour: entry.hour,
          occupancy: entry.avgOccupancy,
        };
      }

      return highest;
    },
    null,
  );
  const highestEnergyHour = logistics.hourlyData.reduce<{ hour: number; value: number } | null>(
    (highest, entry) => {
      if (!highest || entry.avgEnergy > highest.value) {
        return {
          hour: entry.hour,
          value: entry.avgEnergy,
        };
      }

      return highest;
    },
    null,
  );
  const nextIdealValue =
    logistics.nextIdealHour === null
      ? '--'
      : String(logistics.nextIdealHour).padStart(2, '0');
  const nextIdealTariff =
    logistics.nextIdealHour === null
      ? null
      : logistics.energyPrices.find((entry) => entry.hour === logistics.nextIdealHour)?.price ??
        null;

  if (sync.isLoading && logistics.isLoading && !hasData) {
    return (
      <DashboardLayout variant="logistics">
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">
              Carregando planejamento logistico...
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Sincronizando historico operacional e consolidando o perfil de {currentPeriodLabel.toLowerCase()}.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-gray-900">
              Indicadores de Planejamento
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <LoadingMetricCard key={index} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LoadingChart title="Energia vs Ocupacao" />
            <LoadingChart title="Perfil horario consolidado" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!hasData) {
    return (
      <DashboardLayout variant="logistics">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-red-50 p-3 text-red-600">
                <WifiOff className="size-6" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Nao foi possivel montar a tela de logistica
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {sync.error ?? logistics.error ?? 'Sem dados de planejamento no cache local.'}
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
    <DashboardLayout variant="logistics">
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
                {sync.isUsingBackup ? 'Planejamento pelo backup' : 'Planejamento em cache local'}
              </Badge>
              <Badge variant="outline">Canal fixo: lab</Badge>
              <Badge variant="outline">{currentPeriodLabel}</Badge>
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Indicadores de Planejamento
              </h2>
              <p className="text-sm text-gray-500">
                KPIs e graficos consolidados a partir da serie real do periodo selecionado.
              </p>
            </div>

            {(sync.error || logistics.error) && (
              <p className="text-sm text-amber-700">{sync.error ?? logistics.error}</p>
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <MetricCardWithChart
            title={`Consumo Medio (${currentPeriodLabel})`}
            value={logistics.avgEnergy24h}
            unit="kW"
            icon={Zap}
            subtitle="Media do consumo total no periodo selecionado"
            miniChartData={periodSeries}
            miniChartDataKey="totalEnergy"
            miniChartColor="#3b82f6"
            miniChartType="area"
            footer={
              <div className="text-xs text-gray-600">
                Pico por hora consolidada: {highestEnergyHour?.hour ?? '--'}h ({highestEnergyHour?.value.toFixed(1) ?? '--'} kW)
              </div>
            }
            detailTitle={`Consumo de Energia - ${currentPeriodLabel}`}
            detailContent={
              <TimeSeriesChart
                data={periodSeries}
                lines={[
                  {
                    dataKey: 'totalEnergy',
                    name: 'Energia',
                    color: '#3b82f6',
                  },
                ]}
                yAxisLabel="kW"
                height={350}
                period={selectedPeriod}
              />
            }
          />

          <MetricCardWithChart
            title={`Pico de Ocupacao (${currentPeriodLabel})`}
            value={logistics.peakOccupancy}
            unit="%"
            icon={Package}
            subtitle="Maior ocupacao derivada no periodo selecionado"
            miniChartData={periodSeries}
            miniChartDataKey="occupancy"
            miniChartColor="#f59e0b"
            miniChartType="line"
            footer={
              <div className="text-xs text-gray-600">
                Pico consolidado: {peakHour?.hour ?? '--'}h
              </div>
            }
            detailTitle={`Ocupacao - ${currentPeriodLabel}`}
            detailContent={
              <TimeSeriesChart
                data={periodSeries}
                lines={[
                  {
                    dataKey: 'occupancy',
                    name: 'Ocupacao',
                    color: '#f59e0b',
                  },
                ]}
                yAxisLabel="%"
                height={350}
                period={selectedPeriod}
              />
            }
          />

          <MetricCardWithChart
            title="Horas Tarifa Baixa"
            value={String(logistics.lowEnergyHours)}
            unit="h/dia"
            icon={TrendingDown}
            subtitle={`Tabela tarifaria aplicada ao planejamento de ${currentPeriodLabel.toLowerCase()}`}
            miniChartData={logistics.energyPrices}
            miniChartDataKey="price"
            miniChartColor="#10b981"
            miniChartType="area"
            footer={
              <div className="text-xs text-gray-600">Tarifa minima: R$ 0,50/kWh</div>
            }
            detailTitle="Tarifas de Energia por Horario"
            detailContent={
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={logistics.energyPrices}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}h`} fontSize={12} />
                  <YAxis
                    label={{ value: 'R$/kWh', angle: -90, position: 'insideLeft' }}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Tarifa']}
                    labelFormatter={(hour) => `${hour}:00`}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            }
          />

          <MetricCardWithChart
            title="Proximo Horario Ideal"
            value={nextIdealValue}
            unit={logistics.nextIdealHour === null ? undefined : 'h'}
            icon={Clock}
            subtitle="Janela futura com tarifa baixa com base no perfil observado"
            miniChartData={logistics.occupancyForecast}
            miniChartDataKey="occupancy"
            miniChartColor="#8b5cf6"
            miniChartType="line"
            footer={
              <div className="text-xs text-gray-600">
                {nextIdealTariff === null
                  ? 'Sem janela barata disponivel.'
                  : `Tarifa prevista: R$ ${nextIdealTariff.toFixed(2)}/kWh`}
              </div>
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ExpandableChartPanel
            title="Energia vs Ocupacao"
            subtitle={currentPeriodLabel}
            detailTitle={`Energia vs Ocupacao - ${currentPeriodLabel}`}
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
              period={selectedPeriod}
            />
          </ExpandableChartPanel>

          <ExpandableChartPanel
            title="Perfil horario consolidado"
            subtitle={currentPeriodLabel}
            detailTitle={`Perfil horario consolidado - ${currentPeriodLabel}`}
            detailContent={
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={logistics.hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}h`} fontSize={11} />
                  <YAxis yAxisId="left" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" fontSize={11} />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === 'Tarifa'
                        ? [`R$ ${value.toFixed(2)}`, name]
                        : name === 'Energia'
                          ? [`${value.toFixed(1)} kW`, name]
                          : [`${value.toFixed(1)}%`, name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="tariff"
                    name="Tarifa"
                    fill="#fef3c7"
                    stroke="#f59e0b"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="avgEnergy"
                    name="Energia"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="avgOccupancy"
                    name="Ocupacao"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={logistics.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}h`} fontSize={11} />
                <YAxis yAxisId="left" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'Tarifa'
                      ? [`R$ ${value.toFixed(2)}`, name]
                      : name === 'Energia'
                        ? [`${value.toFixed(1)} kW`, name]
                        : [`${value.toFixed(1)}%`, name]
                  }
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="tariff"
                  name="Tarifa"
                  fill="#fef3c7"
                  stroke="#f59e0b"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgEnergy"
                  name="Energia"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgOccupancy"
                  name="Ocupacao"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ExpandableChartPanel>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {insights.map((insight) => (
            <div
              key={insight.title}
              className={`rounded-lg border p-3 ${
                insight.variant === 'blue'
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <p
                className={`mb-1 text-xs font-medium ${
                  insight.variant === 'blue' ? 'text-blue-600' : 'text-amber-600'
                }`}
              >
                {insight.title}
              </p>
              <p
                className={`text-xs ${
                  insight.variant === 'blue' ? 'text-blue-900' : 'text-amber-900'
                }`}
              >
                {insight.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
