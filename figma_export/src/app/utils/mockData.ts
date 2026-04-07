// Dados mockados para os dashboards do frigorífico

export interface RealtimeData {
  timestamp: Date;
  freezerEnergy: number; // kW
  equipmentEnergy: number; // kW
  temperature: number; // °C
  occupancy: number; // %
}

export interface EnergyPrice {
  hour: number;
  price: number; // R$ por kWh
}

export interface MonthlyData {
  month: string;
  energyCost: number;
  revenue: number;
}

interface EnergyData {
  freezerEnergy: number; // kW
  equipmentEnergy: number; // kW
}

// Gera dados de tempo real (última hora)
export function generateRealtimeData(): RealtimeData[] {
  const data: RealtimeData[] = [];
  const now = new Date();

  for (let i = 60; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60000); // 1 minuto de intervalo
    data.push({
      timestamp,
      freezerEnergy:
        15 + Math.random() * 3 + Math.sin(i / 10) * 2,
      equipmentEnergy:
        8 + Math.random() * 2 + Math.cos(i / 15) * 1,
      temperature: -18 + Math.random() * 2 - 1,
      occupancy: 65 + Math.random() * 10 + Math.sin(i / 20) * 5,
    });
  }

  return data;
}

// Dados atuais (último ponto)
export function getCurrentData(): RealtimeData {
  const data = generateRealtimeData();
  return data[data.length - 1];
}

// Previsão para próxima hora
export function generatePrediction(): RealtimeData[] {
  const data: RealtimeData[] = [];
  const now = new Date();

  for (let i = 1; i <= 60; i++) {
    const timestamp = new Date(now.getTime() + i * 60000);
    data.push({
      timestamp,
      freezerEnergy:
        16 + Math.random() * 2 + Math.sin(i / 12) * 1.5,
      equipmentEnergy:
        9 + Math.random() * 1.5 + Math.cos(i / 18) * 0.8,
      temperature: -18.5 + Math.random() * 1.5 - 0.75,
      occupancy: 70 + Math.random() * 8 + Math.sin(i / 25) * 4,
    });
  }

  return data;
}

// Dados históricos (últimas 24 horas)
export function generateHistoricalData(): RealtimeData[] {
  const data: RealtimeData[] = [];
  const now = new Date();

  for (let i = 24 * 60; i >= 0; i -= 15) {
    // 15 min de intervalo
    const timestamp = new Date(now.getTime() - i * 60000);
    const hour = timestamp.getHours();

    // Simula variação ao longo do dia
    const isBusinessHours = hour >= 8 && hour <= 18;

    data.push({
      timestamp,
      freezerEnergy:
        (isBusinessHours ? 18 : 14) + Math.random() * 3,
      equipmentEnergy:
        (isBusinessHours ? 10 : 6) + Math.random() * 2,
      temperature: -18 + Math.random() * 2 - 1,
      occupancy:
        (isBusinessHours ? 75 : 60) + Math.random() * 10,
    });
  }

  return data;
}

// Preços de energia por hora
export function getEnergyPrices(): EnergyPrice[] {
  const prices: EnergyPrice[] = [];

  for (let hour = 0; hour < 24; hour++) {
    let price = 0.5; // preço base

    // Horário de pico (18h-21h)
    if (hour >= 18 && hour <= 21) {
      price = 0.85;
    }
    // Horário intermediário (6h-18h e 21h-22h)
    else if ((hour >= 6 && hour < 18) || hour === 22) {
      price = 0.65;
    }
    // Horário fora de pico (22h-6h)

    prices.push({ hour, price });
  }

  return prices;
}

// Previsão de ocupação nas próximas 24h
export function getOccupancyForecast(): {
  hour: number;
  occupancy: number;
  energyPrice: number;
}[] {
  const forecast = [];
  const prices = getEnergyPrices();

  for (let i = 0; i < 24; i++) {
    const hour = (new Date().getHours() + i) % 24;

    // Simula padrão de ocupação
    let occupancy = 50;
    if (hour >= 6 && hour <= 9)
      occupancy = 85; // Recebimento de mercadorias
    else if (hour >= 10 && hour <= 17) occupancy = 70;
    else if (hour >= 18 && hour <= 20) occupancy = 55;
    else occupancy = 45; // Madrugada

    forecast.push({
      hour,
      occupancy: occupancy + Math.random() * 10 - 5,
      energyPrice: prices[hour].price,
    });
  }

  return forecast;
}

// Dados mensais para comparação
export function getMonthlyComparison(): MonthlyData[] {
  const months = [
    "Nov/25",
    "Dez/25",
    "Jan/26",
    "Fev/26",
    "Mar/26",
  ];
  const data: MonthlyData[] = [];

  months.forEach((month, index) => {
    data.push({
      month,
      energyCost: 18000 + index * 1200 + Math.random() * 2000,
      revenue: 150000 + index * 8000 + Math.random() * 10000,
    });
  });

  return data;
}

// Dados diários do mês atual
export function getCurrentMonthData(): {
  day: number;
  energy: number;
  revenue: number;
}[] {
  const data = [];
  const currentDay = new Date().getDate();

  for (let day = 1; day <= currentDay; day++) {
    data.push({
      day,
      energy:
        800 + Math.random() * 200 + Math.sin(day / 5) * 100,
      revenue:
        6000 + Math.random() * 1500 + Math.cos(day / 7) * 800,
    });
  }

  return data;
}

// Verifica se há alertas
export interface Alert {
  type: "warning" | "critical" | "info";
  variable: string;
  message: string;
  value: number;
  expected: number;
}

export function checkAlerts(current: RealtimeData): Alert[] {
  const alerts: Alert[] = [];

  // Temperatura fora do esperado
  if (current.temperature > -16) {
    alerts.push({
      type: "critical",
      variable: "Temperatura",
      message: "Temperatura acima do ideal",
      value: current.temperature,
      expected: -18,
    });
  } else if (current.temperature < -20) {
    alerts.push({
      type: "warning",
      variable: "Temperatura",
      message: "Temperatura abaixo do ideal",
      value: current.temperature,
      expected: -18,
    });
  }

  // Energia do congelador alta
  if (current.freezerEnergy > 18) {
    alerts.push({
      type: "warning",
      variable: "Energia do Congelador",
      message: "Consumo acima do esperado",
      value: current.freezerEnergy,
      expected: 16,
    });
  }

  // Ocupação muito alta
  if (current.occupancy > 85) {
    alerts.push({
      type: "info",
      variable: "Ocupação",
      message: "Frigorífico próximo da capacidade máxima",
      value: current.occupancy,
      expected: 75,
    });
  }

  return alerts;
}