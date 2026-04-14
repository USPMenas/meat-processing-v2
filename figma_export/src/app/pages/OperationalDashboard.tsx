import { useMemo } from 'react';
import {
  Activity,
  Package,
  Snowflake,
  Thermometer,
  WifiOff,
  Zap,
} from 'lucide-react';
import { FRIGORIFICO_CHANNEL } from '../../config/channels';
import { getPeriodLabel } from '../../config/periods';
import { DEFAULT_TEMPERATURE_CONFIG } from '../../domain/constants/dashboard';
import { DEFAULT_THRESHOLD_CONFIG } from '../../domain/constants/thresholds';
import { useCacheSync } from '../../hooks/useCacheSync';
import { useDashboardPeriod } from '../../hooks/useDashboardPeriod';
import { useOperationalHistory } from '../../hooks/useOperationalHistory';
import { useRealtimeData } from '../../hooks/useRealtimeData';
import { AlertBanner } from '../components/dashboard/AlertBanner';
import { DashboardPeriodToolbar } from '../components/dashboard/DashboardPeriodToolbar';
import { DataSourceBanner } from '../components/dashboard/DataSourceBanner';
import { ExpandableChartPanel } from '../components/dashboard/ExpandableChartPanel';
import { MetricCardWithChart } from '../components/dashboard/MetricCardWithChart';
import { TimeSeriesChart } from '../components/dashboard/TimeSeriesChart';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';

function formatAge(date: Date | null): string {
  if (!date) {
    return 'sem historico';
  }

  const ageMs = Date.now() - date.getTime();
  const ageMinutes = Math.max(0, Math.round(ageMs / 60_000));

  if (ageMinutes < 60) {
    return `${ageMinutes} min atras`;
  }

  const ageHours = Math.floor(ageMinutes / 60);
  const remainingMinutes = ageMinutes % 60;

  if (ageHours < 24) {
    return remainingMinutes > 0
      ? `${ageHours}h ${remainingMinutes}min atras`
      : `${ageHours}h atras`;
  }

  const ageDays = Math.floor(ageHours / 24);
  const remainingHours = ageHours % 24;

  return remainingHours > 0
    ? `${ageDays}d ${remainingHours}h atras`
    : `${ageDays}d atras`;
}

function LoadingCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-28" />
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
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}

function MetricInfo({
  formula,
  details,
}: {
  formula: string;
  details: string[];
}) {
  return (
    <>
      <p>{formula}</p>
      {details.map((detail) => (
        <p key={detail}>{detail}</p>
      ))}
    </>
  );
}

const TEMPERATURE_CHART_DOMAIN: [number, number] = [
  DEFAULT_TEMPERATURE_CONFIG.minTemperature,
  DEFAULT_TEMPERATURE_CONFIG.maxTemperature,
];

export default function OperationalDashboard() {
  const channel = FRIGORIFICO_CHANNEL;
  const [selectedPeriod, setSelectedPeriod] = useDashboardPeriod();
  const sync = useCacheSync(channel);
  const realtime = useRealtimeData(channel);
  const history = useOperationalHistory(channel, selectedPeriod);
  const chartSeries = history.data.length > 0 ? history.data : realtime.historical;
  const currentData = realtime.data ?? chartSeries[chartSeries.length - 1] ?? null;
  const totalEnergySeries = chartSeries.map((entry) => ({
    ...entry,
    totalEnergy: entry.freezerEnergy + entry.equipmentEnergy,
  }));
  const currentPeriodLabel = getPeriodLabel(selectedPeriod);
  const lastMeasurementAt =
    history.lastMeasurementAt ?? currentData?.timestamp ?? sync.lastDataTimestamp ?? null;
  const isColdStarting = sync.isLoading && !currentData && chartSeries.length === 0;
  const hasData = Boolean(currentData) || chartSeries.length > 0;
  const freshnessLabel = sync.isUsingBackup
    ? `Dados do backup (${formatAge(lastMeasurementAt)})`
    : realtime.isStale
      ? `Dados desatualizados (${formatAge(lastMeasurementAt)})`
      : 'Dados ao vivo';
  const averages = useMemo(() => {
    if (chartSeries.length === 0) {
      return {
        freezerEnergy: 0,
        equipmentEnergy: 0,
        temperature: 0,
        occupancy: 0,
      };
    }

    const totals = chartSeries.reduce(
      (accumulator, entry) => ({
        freezerEnergy: accumulator.freezerEnergy + entry.freezerEnergy,
        equipmentEnergy: accumulator.equipmentEnergy + entry.equipmentEnergy,
        temperature: accumulator.temperature + entry.temperature,
        occupancy: accumulator.occupancy + entry.occupancy,
      }),
      {
        freezerEnergy: 0,
        equipmentEnergy: 0,
        temperature: 0,
        occupancy: 0,
      },
    );

    return {
      freezerEnergy: totals.freezerEnergy / chartSeries.length,
      equipmentEnergy: totals.equipmentEnergy / chartSeries.length,
      temperature: totals.temperature / chartSeries.length,
      occupancy: totals.occupancy / chartSeries.length,
    };
  }, [chartSeries]);

  if (isColdStarting) {
    return (
      <DashboardLayout variant="operational">
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Carregando dados historicos... {sync.progress}%
                </p>
                <p className="text-sm text-gray-500">
                  Sincronizando a janela recente de medicoes do canal lab e preparando os
                  graficos do periodo.
                </p>
              </div>
              <Badge className="w-fit bg-blue-600 text-white">{sync.progress}%</Badge>
            </div>
            <Progress className="mt-4" value={sync.progress} />
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold text-gray-900">
              Monitoramento em Tempo Real
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <LoadingCard key={index} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LoadingChart title="Consumo Total de Energia" />
            <LoadingChart title="Comparativo: Energia vs Temperatura" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!hasData || !currentData) {
    return (
      <DashboardLayout variant="operational">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-red-50 p-3 text-red-600">
                <WifiOff className="size-6" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Nao foi possivel montar a tela operacional
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {sync.error ??
                      history.error ??
                      'Nenhum dado foi encontrado para iniciar a operacao.'}
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
    <DashboardLayout variant="operational">
      <div className="space-y-4">
        <DataSourceBanner
          channel={channel}
          isOnline={sync.isOnline}
          dataSource={sync.dataSource}
          sourceMessage={sync.sourceMessage}
          lastApiAttempt={sync.lastApiAttempt}
          lastSuccessfulApiSync={sync.lastSuccessfulApiSync}
          lastDataTimestamp={sync.lastDataTimestamp ?? lastMeasurementAt}
          backupSnapshotTimestamp={sync.backupSnapshotTimestamp}
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={
                  realtime.isStale || sync.isUsingBackup
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }
              >
                <Activity
                  className={`size-3.5 ${
                    realtime.isStale || sync.isUsingBackup ? '' : 'animate-pulse'
                  }`}
                />
                {freshnessLabel}
              </Badge>
              <Badge variant="outline">Canal fixo: lab</Badge>
              <Badge variant="outline">{currentPeriodLabel}</Badge>
            </div>

            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Monitoramento Operacional
              </h2>
              <p className="text-sm text-gray-500">
                Todos os cards e graficos abaixo usam apenas a serie real do periodo
                selecionado, sem previsao artificial.
              </p>
            </div>

            {(sync.error || history.error) && (
              <p className="text-sm text-amber-700">{sync.error ?? history.error}</p>
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

        {realtime.alerts.length > 0 && <AlertBanner alerts={realtime.alerts} />}

        <div>
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            Monitoramento em Tempo Real
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <MetricCardWithChart
              title="Energia - Congelador"
              value={currentData.freezerEnergy}
              unit="kW"
              icon={Zap}
              status={
                currentData.freezerEnergy >= DEFAULT_THRESHOLD_CONFIG.freezerEnergyWarning
                  ? 'warning'
                  : 'normal'
              }
              subtitle={`Serie real do congelador em ${currentPeriodLabel.toLowerCase()}`}
              miniChartData={chartSeries}
              miniChartDataKey="freezerEnergy"
              miniChartColor="#3b82f6"
              miniChartType="area"
              infoTitle="Como calculamos a energia do congelador"
              infoContent={
                <MetricInfo
                  formula="Somamos o campo active_power dos sensores configurados como freezer no ultimo timestamp disponivel."
                  details={[
                    'No mapeamento atual, o congelador usa o sensor fase3.',
                    'O valor exibido e medido em kW e nao tem extrapolacao de previsao.',
                    'Se faltar algum sensor no timestamp, a soma usa apenas o que veio da API ou do backup.',
                  ]}
                />
              }
              footer={
                <div className="text-xs text-gray-600">
                  <strong>Media no periodo:</strong> {averages.freezerEnergy.toFixed(1)} kW
                </div>
              }
              detailTitle={`Energia do Congelador - ${currentPeriodLabel}`}
              detailContent={
                <TimeSeriesChart
                  data={chartSeries}
                  lines={[
                    {
                      dataKey: 'freezerEnergy',
                      name: 'Congelador',
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
              title="Energia - Equipamentos"
              value={currentData.equipmentEnergy}
              unit="kW"
              icon={Snowflake}
              status="normal"
              subtitle={`Serie real dos equipamentos em ${currentPeriodLabel.toLowerCase()}`}
              miniChartData={chartSeries}
              miniChartDataKey="equipmentEnergy"
              miniChartColor="#10b981"
              miniChartType="area"
              infoTitle="Como calculamos a energia dos equipamentos"
              infoContent={
                <MetricInfo
                  formula="Somamos o active_power dos sensores classificados como equipamentos no ultimo instante disponivel."
                  details={[
                    'No mapeamento atual, equipamentos usam fase1 e fase2.',
                    'O calculo segue o mesmo timestamp da leitura mais recente vinda da fonte ativa.',
                    'Se um sensor nao aparecer naquele instante, o card nao quebra nem gera NaN.',
                  ]}
                />
              }
              footer={
                <div className="text-xs text-gray-600">
                  <strong>Media no periodo:</strong> {averages.equipmentEnergy.toFixed(1)} kW
                </div>
              }
              detailTitle={`Energia dos Equipamentos - ${currentPeriodLabel}`}
              detailContent={
                <TimeSeriesChart
                  data={chartSeries}
                  lines={[
                    {
                      dataKey: 'equipmentEnergy',
                      name: 'Equipamentos',
                      color: '#10b981',
                    },
                  ]}
                  yAxisLabel="kW"
                  height={350}
                  period={selectedPeriod}
                />
              }
            />

            <MetricCardWithChart
              title="Temperatura"
              value={currentData.temperature}
              unit="°C"
              icon={Thermometer}
              status={
                currentData.temperature >= DEFAULT_THRESHOLD_CONFIG.temperatureCritical
                  ? 'critical'
                  : currentData.temperature >=
                        DEFAULT_THRESHOLD_CONFIG.temperatureWarningHigh ||
                      currentData.temperature <=
                        DEFAULT_THRESHOLD_CONFIG.temperatureWarningLow
                    ? 'warning'
                    : 'normal'
              }
              subtitle={`Temperatura derivada em ${currentPeriodLabel.toLowerCase()}`}
              miniChartData={chartSeries}
              miniChartDataKey="temperature"
              miniChartColor="#8b5cf6"
              miniChartType="line"
              miniChartDomain={TEMPERATURE_CHART_DOMAIN}
              infoTitle="Como calculamos a temperatura"
              infoContent={
                <MetricInfo
                  formula="Temperatura estimada = baseTemperature + (activePower - avgPower) x sensitivityFactor."
                  details={[
                    'A calibracao atual usa o sensor fase3 como referencia energetica do congelador.',
                    'O resultado e limitado a uma faixa operacional realista para nao gerar valores irreais.',
                    'Este numero e derivado, nao e uma medicao direta de temperatura vinda da API.',
                  ]}
                />
              }
              footer={
                <div className="text-xs text-gray-600">
                  <strong>Media no periodo:</strong> {averages.temperature.toFixed(1)} °C
                </div>
              }
              detailTitle={`Temperatura - ${currentPeriodLabel}`}
              detailContent={
                <TimeSeriesChart
                  data={chartSeries}
                  yAxisDomain={TEMPERATURE_CHART_DOMAIN}
                  lines={[
                    {
                      dataKey: 'temperature',
                      name: 'Temperatura',
                      color: '#8b5cf6',
                    },
                  ]}
                  yAxisLabel="°C"
                  height={350}
                  period={selectedPeriod}
                />
              }
            />

            <MetricCardWithChart
              title="Ocupacao"
              value={currentData.occupancy}
              unit="%"
              icon={Package}
              status={
                currentData.occupancy >= DEFAULT_THRESHOLD_CONFIG.occupancyCritical
                  ? 'critical'
                  : currentData.occupancy >= DEFAULT_THRESHOLD_CONFIG.occupancyWarning
                    ? 'warning'
                    : 'normal'
              }
              subtitle={`Ocupacao derivada em ${currentPeriodLabel.toLowerCase()}`}
              miniChartData={chartSeries}
              miniChartDataKey="occupancy"
              miniChartColor="#f59e0b"
              miniChartType="area"
              infoTitle="Como calculamos a ocupacao"
              infoContent={
                <MetricInfo
                  formula="Ocupacao estimada = baseOccupancy + ((corrente - avgCurrent) / maxCurrent) x scaleFactor."
                  details={[
                    'A corrente usada nessa conta vem da soma dos sensores fase1 e fase2.',
                    'O resultado e limitado a uma faixa operacional valida para evitar distorcoes.',
                    'Este numero representa atividade operacional estimada, nao uma contagem fisica.',
                  ]}
                />
              }
              footer={
                <div className="text-xs text-gray-600">
                  <strong>Media no periodo:</strong> {averages.occupancy.toFixed(1)}%
                </div>
              }
              detailTitle={`Ocupacao - ${currentPeriodLabel}`}
              detailContent={
                <TimeSeriesChart
                  data={chartSeries}
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
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ExpandableChartPanel
            title="Consumo Total de Energia"
            subtitle={currentPeriodLabel}
            detailTitle={`Consumo Total de Energia - ${currentPeriodLabel}`}
            detailContent={
              <TimeSeriesChart
                data={totalEnergySeries}
                lines={[
                  { dataKey: 'totalEnergy', name: 'Total', color: '#06b6d4' },
                ]}
                yAxisLabel="kW"
                height={360}
                period={selectedPeriod}
              />
            }
          >
            <TimeSeriesChart
              data={totalEnergySeries}
              lines={[
                { dataKey: 'totalEnergy', name: 'Total', color: '#06b6d4' },
              ]}
              yAxisLabel="kW"
              height={200}
              period={selectedPeriod}
            />
          </ExpandableChartPanel>

          <ExpandableChartPanel
            title="Comparativo: Energia vs Temperatura"
            subtitle={currentPeriodLabel}
            detailTitle={`Comparativo: Energia vs Temperatura - ${currentPeriodLabel}`}
            detailContent={
              <TimeSeriesChart
                data={chartSeries}
                lines={[
                  {
                    dataKey: 'freezerEnergy',
                    name: 'Energia',
                    color: '#3b82f6',
                  },
                  {
                    dataKey: 'temperature',
                    name: 'Temperatura',
                    color: '#8b5cf6',
                  },
                ]}
                height={360}
                period={selectedPeriod}
              />
            }
          >
            <TimeSeriesChart
              data={chartSeries}
              lines={[
                {
                  dataKey: 'freezerEnergy',
                  name: 'Energia',
                  color: '#3b82f6',
                },
                {
                  dataKey: 'temperature',
                  name: 'Temperatura',
                  color: '#8b5cf6',
                },
              ]}
              height={200}
              period={selectedPeriod}
            />
          </ExpandableChartPanel>
        </div>
      </div>
    </DashboardLayout>
  );
}
