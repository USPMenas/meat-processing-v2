import { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { MetricCardWithChart } from '../components/dashboard/MetricCardWithChart';
import { AlertBanner } from '../components/dashboard/AlertBanner';
import { TimeSeriesChart } from '../components/dashboard/TimeSeriesChart';
import { Zap, Snowflake, Thermometer, Package } from 'lucide-react';
import {
  RealtimeData,
  generateRealtimeData,
  getCurrentData,
  generatePrediction,
  checkAlerts,
  Alert,
} from '../utils/mockData';

export default function OperationalDashboard() {
  const [currentData, setCurrentData] = useState<RealtimeData>(getCurrentData());
  const [historicalData, setHistoricalData] = useState<RealtimeData[]>(generateRealtimeData());
  const [predictionData, setPredictionData] = useState<RealtimeData[]>(generatePrediction());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  
  useEffect(() => {
    // Atualiza dados a cada 5 segundos
    const interval = setInterval(() => {
      const newData = getCurrentData();
      setCurrentData(newData);
      setHistoricalData(generateRealtimeData());
      setPredictionData(generatePrediction());
      setAlerts(checkAlerts(newData));
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    setAlerts(checkAlerts(currentData));
  }, [currentData]);
  
  // Combina dados históricos e previsão para o gráfico
  const combinedData = [
    ...historicalData.map(d => ({ ...d, type: 'histórico' })),
    ...predictionData.map(d => ({ ...d, type: 'previsão' })),
  ];
  
  // Últimos 12 pontos para mini gráfico
  const recentData = historicalData.slice(-12);
  
  return (
    <DashboardLayout variant="operational">
      <div className="space-y-4">
        {/* Alertas */}
        {alerts.length > 0 && <AlertBanner alerts={alerts} />}
        
        {/* Métricas em Tempo Real com Mini Gráficos */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Monitoramento em Tempo Real</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCardWithChart
              title="Energia - Congelador"
              value={currentData.freezerEnergy}
              unit="kW"
              icon={Zap}
              status={currentData.freezerEnergy > 18 ? 'warning' : 'normal'}
              subtitle="Consumo em tempo real"
              miniChartData={recentData}
              miniChartDataKey="freezerEnergy"
              miniChartColor="#3b82f6"
              miniChartType="area"
              footer={
                <div className="text-xs text-gray-600">
                  <strong>Média (1h):</strong> {(historicalData.reduce((acc, d) => acc + d.freezerEnergy, 0) / historicalData.length).toFixed(1)} kW
                </div>
              }
              detailTitle="Energia do Congelador - Detalhes"
              detailContent={
                <div>
                  <TimeSeriesChart
                    data={combinedData}
                    lines={[
                      { dataKey: 'freezerEnergy', name: 'Congelador', color: '#3b82f6' },
                    ]}
                    yAxisLabel="kW"
                    height={350}
                  />
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Consumo médio (última hora):</strong> {(historicalData.reduce((acc, d) => acc + d.freezerEnergy, 0) / historicalData.length).toFixed(2)} kW
                    </p>
                  </div>
                </div>
              }
            />
            
            <MetricCardWithChart
              title="Energia - Equipamentos"
              value={currentData.equipmentEnergy}
              unit="kW"
              icon={Snowflake}
              status="normal"
              subtitle="Demais equipamentos"
              miniChartData={recentData}
              miniChartDataKey="equipmentEnergy"
              miniChartColor="#10b981"
              miniChartType="area"
              footer={
                <div className="text-xs text-gray-600">
                  <strong>Média (1h):</strong> {(historicalData.reduce((acc, d) => acc + d.equipmentEnergy, 0) / historicalData.length).toFixed(1)} kW
                </div>
              }
              detailTitle="Energia dos Equipamentos - Detalhes"
              detailContent={
                <div>
                  <TimeSeriesChart
                    data={combinedData}
                    lines={[
                      { dataKey: 'equipmentEnergy', name: 'Equipamentos', color: '#10b981' },
                    ]}
                    yAxisLabel="kW"
                    height={350}
                  />
                  <div className="mt-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>Consumo médio (última hora):</strong> {(historicalData.reduce((acc, d) => acc + d.equipmentEnergy, 0) / historicalData.length).toFixed(2)} kW
                    </p>
                  </div>
                </div>
              }
            />
            
            <MetricCardWithChart
              title="Temperatura"
              value={currentData.temperature}
              unit="°C"
              icon={Thermometer}
              status={currentData.temperature > -16 ? 'critical' : currentData.temperature < -20 ? 'warning' : 'normal'}
              subtitle="Temperatura interna"
              miniChartData={recentData}
              miniChartDataKey="temperature"
              miniChartColor="#8b5cf6"
              miniChartType="line"
              footer={
                <div className="text-xs text-gray-600">
                  <strong>Ideal:</strong> -18°C a -20°C
                </div>
              }
              detailTitle="Temperatura - Detalhes"
              detailContent={
                <div>
                  <TimeSeriesChart
                    data={combinedData}
                    lines={[
                      { dataKey: 'temperature', name: 'Temperatura', color: '#8b5cf6' },
                    ]}
                    yAxisLabel="°C"
                    height={350}
                  />
                  <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-800">
                      <strong>Faixa ideal:</strong> -18°C a -20°C | <strong>Média:</strong> {(historicalData.reduce((acc, d) => acc + d.temperature, 0) / historicalData.length).toFixed(2)}°C
                    </p>
                  </div>
                </div>
              }
            />
            
            <MetricCardWithChart
              title="Ocupação"
              value={currentData.occupancy}
              unit="%"
              icon={Package}
              status={currentData.occupancy > 85 ? 'warning' : 'normal'}
              subtitle="Capacidade utilizada"
              miniChartData={recentData}
              miniChartDataKey="occupancy"
              miniChartColor="#f59e0b"
              miniChartType="area"
              footer={
                <div className="text-xs text-gray-600">
                  <strong>Capacidade ideal:</strong> 60-80%
                </div>
              }
              detailTitle="Ocupação - Detalhes"
              detailContent={
                <div>
                  <TimeSeriesChart
                    data={combinedData}
                    lines={[
                      { dataKey: 'occupancy', name: 'Ocupação', color: '#f59e0b' },
                    ]}
                    yAxisLabel="%"
                    height={350}
                  />
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="p-3 bg-amber-50 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>Capacidade ideal:</strong> 60-80%
                      </p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>Média:</strong> {(historicalData.reduce((acc, d) => acc + d.occupancy, 0) / historicalData.length).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              }
            />
          </div>
        </div>
        
        {/* Resumo Consolidado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Consumo Total de Energia
            </h3>
            <TimeSeriesChart
              data={combinedData.map(d => ({
                ...d,
                totalEnergy: d.freezerEnergy + d.equipmentEnergy,
              }))}
              lines={[
                { dataKey: 'totalEnergy', name: 'Total', color: '#06b6d4' },
              ]}
              yAxisLabel="kW"
              height={200}
            />
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Comparativo: Energia vs Temperatura
            </h3>
            <TimeSeriesChart
              data={combinedData}
              lines={[
                { dataKey: 'freezerEnergy', name: 'Energia', color: '#3b82f6' },
                { dataKey: 'temperature', name: 'Temperatura', color: '#8b5cf6' },
              ]}
              height={200}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}