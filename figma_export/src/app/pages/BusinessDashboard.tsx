import { DashboardLayout } from "../components/layout/DashboardLayout";
import { MetricCardWithChart } from "../components/dashboard/MetricCardWithChart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Area,
  AreaChart,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Zap,
  Target,
} from "lucide-react";
import {
  getMonthlyComparison,
  getCurrentMonthData,
  generateHistoricalData,
} from "../utils/mockData";

export default function BusinessDashboard() {
  const monthlyComparison = getMonthlyComparison();
  const currentMonthData = getCurrentMonthData();
  const historicalData = generateHistoricalData();

  // Cálculos financeiros
  const currentMonth =
    monthlyComparison[monthlyComparison.length - 1];
  const previousMonth =
    monthlyComparison[monthlyComparison.length - 2];

  const energyCostChange =
    ((currentMonth.energyCost - previousMonth.energyCost) /
      previousMonth.energyCost) *
    100;
  const revenueChange =
    ((currentMonth.revenue - previousMonth.revenue) /
      previousMonth.revenue) *
    100;

  const projectedRevenue =
    (currentMonth.revenue / currentMonthData.length) * 31;
  const projectedEnergyCost =
    (currentMonth.energyCost / currentMonthData.length) * 31;

  const currentMargin =
    ((currentMonth.revenue - currentMonth.energyCost) /
      currentMonth.revenue) *
    100;
  const projectedMargin =
    ((projectedRevenue - projectedEnergyCost) /
      projectedRevenue) *
    100;

  // Dados acumulados do mês
  const cumulativeData = currentMonthData.map((d, index) => ({
    day: d.day,
    energyAccum: currentMonthData
      .slice(0, index + 1)
      .reduce((acc, item) => acc + item.energy, 0),
    revenueAccum: currentMonthData
      .slice(0, index + 1)
      .reduce((acc, item) => acc + item.revenue, 0),
  }));

  // Dados dos últimos 30 dias para histograma
  const last30DaysData = currentMonthData.map((d) => ({
    day: d.day,
    energy: d.energy,
    revenue: d.revenue / 100, // Divide por 100 para escala similar
  }));

  // Média diária por hora (últimas 24h)
  const hourlyAverages = Array.from(
    { length: 24 },
    (_, hour) => {
      const hourData = historicalData.filter(
        (d) => d.timestamp.getHours() === hour,
      );
      if (hourData.length === 0) return null;

      return {
        hour,
        avgEnergy:
          hourData.reduce(
            (acc, d) =>
              acc + d.freezerEnergy + d.equipmentEnergy,
            0,
          ) / hourData.length,
        avgOccupancy:
          hourData.reduce((acc, d) => acc + d.occupancy, 0) /
          hourData.length,
      };
    },
  ).filter(Boolean);

  // Mini gráficos
  const recentMonthData = currentMonthData.slice(-12);

  return (
    <DashboardLayout variant="business">
      <div className="space-y-4">
        {/* KPIs Executivos */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Indicadores Financeiros - Março 2026
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <MetricCardWithChart
              title="Faturamento Atual"
              value={`R$ ${(currentMonth.revenue / 1000).toFixed(0)}k`}
              icon={DollarSign}
              variant="business"
              subtitle="Mês atual"
              footer={
                <div className="text-xs text-blue-700">
                  <strong>vs. mês anterior:</strong>{" "}
                  {revenueChange >= 0 ? "+" : ""}
                  {revenueChange.toFixed(1)}%
                </div>
              }
            />

            <MetricCardWithChart
              title="Projeção Mensal"
              value={`R$ ${(projectedRevenue / 1000).toFixed(0)}k`}
              icon={TrendingUp}
              variant="business"
              subtitle="Estimativa fim do mês"
              footer={
                <div className="text-xs text-blue-700">
                  Baseado em {currentMonthData.length} dias de
                  dados
                </div>
              }
            />

            <MetricCardWithChart
              title="Custo Energético"
              value={`R$ ${(currentMonth.energyCost / 1000).toFixed(0)}k`}
              icon={Zap}
              variant="business"
              subtitle="Mês atual"
              footer={
                <div className="text-xs text-blue-700">
                  <strong>Projeção mês:</strong> R${" "}
                  {(projectedEnergyCost / 1000).toFixed(0)}k
                </div>
              }
            />

            <MetricCardWithChart
              title="Projeção de Custo Mensal"
              value={`R$ ${(projectedRevenue / 1000).toFixed(0)}k`}
              icon={TrendingUp}
              variant="business"
              subtitle="Estimativa fim do mês"
              footer={
                <div className="text-xs text-blue-700">
                  Baseado em {currentMonthData.length} dias de
                  dados
                </div>
              }
              detailTitle="Comparação Mensal - Últimos 5 Meses"
              detailContent={
                <div>
                  <ResponsiveContainer
                    width="100%"
                    height={350}
                  >
                    <ComposedChart data={monthlyComparison}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e0e7ff"
                      />
                      <XAxis
                        dataKey="month"
                        fontSize={12}
                        stroke="#64748b"
                      />
                      <YAxis
                        yAxisId="left"
                        fontSize={12}
                        stroke="#64748b"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        fontSize={12}
                        stroke="#64748b"
                      />
                      <Tooltip
                        formatter={(value: number) =>
                          `R$ ${value.toLocaleString("pt-BR")}`
                        }
                      />
                      <Legend />
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
                        name="Faturamento"
                        stroke="#10b981"
                        strokeWidth={3}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              }
            />

            <MetricCardWithChart
              title="Margem Operacional"
              value={currentMargin.toFixed(1)}
              unit="%"
              icon={Target}
              variant="business"
              subtitle="Margem atual"
              footer={
                <div className="text-xs text-blue-700">
                  <strong>Projeção:</strong>{" "}
                  {projectedMargin.toFixed(1)}% no fim do mês
                </div>
              }
            />
          </div>
        </div>

        {/* Gráficos Principais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gráfico de Linha - Últimos 30 Dias */}
          <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Custo Energético Diário - Últimos 30 Dias
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={last30DaysData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e0e7ff"
                />
                <XAxis
                  dataKey="day"
                  label={{
                    value: "Dia do Mês",
                    position: "insideBottomLeft",
                    offset: -5,
                  }}
                  fontSize={11}
                  stroke="#64748b"
                />
                <YAxis
                  label={{
                    value: "Consumo (R$)",
                    position: "insideBottomLeft",
                    offset: 20,
                    angle: -90,
                  }}
                  fontSize={11}
                  stroke="#64748b"
                />
                <Tooltip
                  formatter={(value: number) =>
                    `R$ ${value.toFixed(0)}`
                  }
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="energy"
                  name="Custo de Energia"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>Total do mês:</strong> R${" "}
                {currentMonth.energyCost.toLocaleString(
                  "pt-BR",
                )}{" "}
                |<strong> Média diária:</strong> R${" "}
                {(
                  currentMonth.energyCost /
                  currentMonthData.length
                ).toFixed(0)}
              </p>
            </div>
          </div>

          {/* Gráfico de Linha - Média Diária por Hora */}
          <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Padrão Diário: Consumo vs Ocupação
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={hourlyAverages}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e0e7ff"
                />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h) => `${h}h`}
                  label={{
                    value: "Hora do Dia",
                    position: "insideBottomLeft",
                    offset: -5,
                  }}
                  fontSize={11}
                  stroke="#64748b"
                />
                <YAxis
                  yAxisId="left"
                  label={{
                    value: "Energia (kW)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  fontSize={11}
                  stroke="#64748b"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  label={{
                    value: "Ocupação (%)",
                    angle: 90,
                    position: "insideRight",
                  }}
                  fontSize={11}
                  stroke="#64748b"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgEnergy"
                  name="Consumo Médio (kW)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 3 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgOccupancy"
                  name="Ocupação Média (%)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: "#f59e0b", r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-800">
                <strong>Insight:</strong> Pico de consumo entre
                8h-18h correlaciona com maior ocupação do
                frigorífico.
              </p>
            </div>
          </div>
        </div>

        {/* Insights Executivos */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Insights Executivos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg">
                  <TrendingUp className="size-4 text-green-700" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900">
                    Crescimento Sustentável
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Faturamento cresceu{" "}
                    {revenueChange.toFixed(1)}% enquanto custo
                    aumentou {energyCostChange.toFixed(1)}%.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-purple-100 rounded-lg">
                  <DollarSign className="size-4 text-purple-700" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900">
                    Oportunidade
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Otimização em horários de pico pode reduzir
                    custos em até 15%.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}