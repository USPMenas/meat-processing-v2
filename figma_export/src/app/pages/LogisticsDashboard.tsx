import { DashboardLayout } from '../components/layout/DashboardLayout';
import { MetricCardWithChart } from '../components/dashboard/MetricCardWithChart';
import { TimeSeriesChart } from '../components/dashboard/TimeSeriesChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, Area } from 'recharts';
import { Clock, TrendingDown, Package, Zap } from 'lucide-react';
import {
  generateHistoricalData,
  getEnergyPrices,
  getOccupancyForecast,
} from '../utils/mockData';

export default function LogisticsDashboard() {
  const historicalData = generateHistoricalData();
  const energyPrices = getEnergyPrices();
  const occupancyForecast = getOccupancyForecast();
  
  // Calcula estatísticas
  const avgEnergy = historicalData.reduce((acc, d) => acc + d.freezerEnergy + d.equipmentEnergy, 0) / historicalData.length;
  const peakOccupancy = Math.max(...historicalData.map(d => d.occupancy));
  const lowEnergyHours = energyPrices.filter(p => p.price < 0.60).length;
  
  // Últimos 12 pontos para mini gráficos
  const recentData = historicalData.slice(-12);
  
  // Agrupa dados por hora para o gráfico de 24h
  const hourlyData = Array.from({ length: 24 }, (_, hour) => {
    const hourData = historicalData.filter(d => d.timestamp.getHours() === hour);
    if (hourData.length === 0) return null;
    
    return {
      hour,
      energy: hourData.reduce((acc, d) => acc + d.freezerEnergy + d.equipmentEnergy, 0) / hourData.length,
      occupancy: hourData.reduce((acc, d) => acc + d.occupancy, 0) / hourData.length,
      price: energyPrices[hour].price,
    };
  }).filter(Boolean);
  
  return (
    <DashboardLayout variant="logistics">
      <div className="space-y-4">
        {/* KPIs */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Indicadores de Planejamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCardWithChart
              title="Consumo Médio (24h)"
              value={avgEnergy}
              unit="kW"
              icon={Zap}
              subtitle="Últimas 24 horas"
              miniChartData={recentData.map(d => ({ value: d.freezerEnergy + d.equipmentEnergy }))}
              miniChartDataKey="value"
              miniChartColor="#3b82f6"
              miniChartType="area"
              footer={
                <div className="text-xs text-gray-600">
                  Pico em horário comercial: +25%
                </div>
              }
              detailTitle="Consumo de Energia - Últimas 24 Horas"
              detailContent={
                <TimeSeriesChart
                  data={historicalData}
                  lines={[
                    { dataKey: 'freezerEnergy', name: 'Congelador', color: '#3b82f6' },
                    { dataKey: 'equipmentEnergy', name: 'Equipamentos', color: '#10b981' },
                  ]}
                  yAxisLabel="kW"
                  height={350}
                />
              }
            />
            
            <MetricCardWithChart
              title="Pico de Ocupação"
              value={peakOccupancy}
              unit="%"
              icon={Package}
              subtitle="Máximo nas últimas 24h"
              miniChartData={recentData}
              miniChartDataKey="occupancy"
              miniChartColor="#f59e0b"
              miniChartType="line"
              footer={
                <div className="text-xs text-gray-600">
                  Janela ideal: 6h-9h
                </div>
              }
              detailTitle="Ocupação - Últimas 24 Horas"
              detailContent={
                <TimeSeriesChart
                  data={historicalData}
                  lines={[
                    { dataKey: 'occupancy', name: 'Ocupação', color: '#f59e0b' },
                  ]}
                  yAxisLabel="%"
                  height={350}
                />
              }
            />
            
            <MetricCardWithChart
              title="Horas Tarifa Baixa"
              value={lowEnergyHours}
              unit="h/dia"
              icon={TrendingDown}
              subtitle="Horário fora de pico"
              miniChartData={energyPrices.slice(0, 12)}
              miniChartDataKey="price"
              miniChartColor="#10b981"
              miniChartType="area"
              footer={
                <div className="text-xs text-gray-600">
                  R$ 0,50/kWh (22h-6h)
                </div>
              }
              detailTitle="Tarifas de Energia por Horário"
              detailContent={
                <div>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={energyPrices}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} fontSize={12} />
                      <YAxis label={{ value: 'R$/kWh', angle: -90, position: 'insideLeft' }} fontSize={12} />
                      <Tooltip
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Tarifa']}
                        labelFormatter={(h) => `${h}:00`}
                      />
                      <Bar dataKey="price" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-green-50 rounded text-center">
                      <p className="text-green-600 font-medium">Fora de Pico</p>
                      <p className="text-green-800 mt-1">R$ 0,50/kWh</p>
                      <p className="text-gray-600">22h-6h</p>
                    </div>
                    <div className="p-2 bg-amber-50 rounded text-center">
                      <p className="text-amber-600 font-medium">Intermediário</p>
                      <p className="text-amber-800 mt-1">R$ 0,65/kWh</p>
                      <p className="text-gray-600">6h-18h</p>
                    </div>
                    <div className="p-2 bg-red-50 rounded text-center">
                      <p className="text-red-600 font-medium">Pico</p>
                      <p className="text-red-800 mt-1">R$ 0,85/kWh</p>
                      <p className="text-gray-600">18h-21h</p>
                    </div>
                  </div>
                </div>
              }
            />
            
            <MetricCardWithChart
              title="Próximo Horário Ideal"
              value={energyPrices.find((p, i) => i > new Date().getHours() && p.price < 0.60)?.hour || '--'}
              unit="h"
              icon={Clock}
              subtitle="Para operações de alta carga"
              footer={
                <div className="text-xs text-gray-600">
                  Economia de até 40%
                </div>
              }
            />
          </div>
        </div>
        
        {/* Gráficos Principais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Previsão de Ocupação e Energia */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Previsão: Ocupação vs. Tarifa de Energia
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={occupancyForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} fontSize={11} />
                <YAxis yAxisId="left" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="energyPrice"
                  name="Tarifa"
                  fill="#fef3c7"
                  stroke="#f59e0b"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="occupancy"
                  name="Ocupação"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          {/* Consumo vs Ocupação por Hora */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Consumo vs Ocupação (24h)
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} fontSize={11} />
                <YAxis yAxisId="left" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line yAxisId="left" dataKey="energy" name="Energia" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="occupancy" name="Ocupação" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Insights */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-600 mb-1 font-medium">Insight - Consumo</p>
            <p className="text-xs text-blue-900">
              Consumo aumenta 25-30% durante horário comercial. Planeje manutenções preventivas durante madrugada.
            </p>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-600 mb-1 font-medium">Insight - Estoque</p>
            <p className="text-xs text-amber-900">
              Ocupação ideal entre 6h-9h. Janela recomendada para recebimento coincide com tarifa intermediária.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}