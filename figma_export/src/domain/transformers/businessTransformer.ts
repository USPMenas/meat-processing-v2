import { FINANCIAL_CONFIG } from '../constants/financial';
import { TARIFFS } from '../constants/tariffs';
import {
  calculateEnergyCost,
  calculateMargin,
  calculateRevenue,
  projectMonthly,
} from './financialTransformer';
import type {
  BusinessData,
  CumulativeEntry,
  DailyEntry,
  HourlyAvgEntry,
  InsightCard,
  MonthlyEntry,
  OperationalData,
} from '../types';

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function formatLocalDateKey(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatMonthLabel(date: Date): string {
  return date
    .toLocaleString('pt-BR', {
      month: 'short',
      year: '2-digit',
    })
    .replace('.', '')
    .replace(' de ', '/');
}

function buildHourlyBreakdown(totalKwh: number, hourlyAverages: HourlyAvgEntry[]): { hour: number; kwh: number }[] {
  if (hourlyAverages.length === 0) {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      kwh: totalKwh / 24,
    }));
  }

  const weightTotal = sum(hourlyAverages.map((entry) => Math.max(entry.avgEnergy, 0)));

  if (weightTotal <= 0) {
    return hourlyAverages.map((entry) => ({
      hour: entry.hour,
      kwh: totalKwh / Math.max(hourlyAverages.length, 1),
    }));
  }

  return hourlyAverages.map((entry) => ({
    hour: entry.hour,
    kwh: (totalKwh * Math.max(entry.avgEnergy, 0)) / weightTotal,
  }));
}

export function getTotalConsumptionKwh(
  results: Array<{ total_kwh: number }> | undefined,
): number {
  if (!results || results.length === 0) {
    return 0;
  }

  return sum(results.map((entry) => entry.total_kwh));
}

export function estimateTotalConsumptionKwhFromSeries(
  operationalSeries: OperationalData[],
  defaultStepHours: number,
): number {
  if (operationalSeries.length === 0) {
    return 0;
  }

  if (operationalSeries.length === 1) {
    const entry = operationalSeries[0];
    return (entry.freezerEnergy + entry.equipmentEnergy) * defaultStepHours;
  }

  return operationalSeries.reduce((total, entry, index) => {
    const nextEntry = operationalSeries[index + 1];
    const intervalHours = nextEntry
      ? (nextEntry.timestamp.getTime() - entry.timestamp.getTime()) / 3_600_000
      : defaultStepHours;

    return (
      total +
      (entry.freezerEnergy + entry.equipmentEnergy) *
        (intervalHours > 0 ? intervalHours : defaultStepHours)
    );
  }, 0);
}

export function buildDailyBusinessData(params: {
  operationalSeries: OperationalData[];
  totalKwh: number;
  hourlyAverages: HourlyAvgEntry[];
  referenceDate: Date | null;
}): DailyEntry[] {
  const { operationalSeries, totalKwh, hourlyAverages, referenceDate } = params;
  const grouped = new Map<
    string,
    {
      date: Date;
      energySamples: number[];
      temperatures: number[];
      occupancies: number[];
    }
  >();

  operationalSeries.forEach((entry) => {
    const key = formatLocalDateKey(entry.timestamp);
    const current = grouped.get(key) ?? {
      date: new Date(entry.timestamp.getFullYear(), entry.timestamp.getMonth(), entry.timestamp.getDate()),
      energySamples: [],
      temperatures: [],
      occupancies: [],
    };

    current.energySamples.push(entry.freezerEnergy + entry.equipmentEnergy);
    current.temperatures.push(entry.temperature);
    current.occupancies.push(entry.occupancy);
    grouped.set(key, current);
  });

  if (grouped.size === 0 && referenceDate) {
    grouped.set(formatLocalDateKey(referenceDate), {
      date: new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()),
      energySamples: [0],
      temperatures: [],
      occupancies: [],
    });
  }

  const entries = Array.from(grouped.values()).sort((left, right) => left.date.getTime() - right.date.getTime());
  const weightTotal = sum(entries.map((entry) => Math.max(average(entry.energySamples), 0)));
  const fallbackDailyKwh = entries.length > 0 ? totalKwh / entries.length : 0;

  return entries.map((entry) => {
    const avgEnergy = average(entry.energySamples);
    const dayWeight = Math.max(avgEnergy, 0);
    const estimatedKwh =
      totalKwh > 0
        ? weightTotal > 0
          ? (totalKwh * dayWeight) / weightTotal
          : fallbackDailyKwh
        : avgEnergy * FINANCIAL_CONFIG.WORKING_HOURS_PER_DAY;
    const hourlyBreakdown = buildHourlyBreakdown(estimatedKwh, hourlyAverages);
    const energyCost = calculateEnergyCost(estimatedKwh, hourlyBreakdown, [...TARIFFS]);
    const revenue = calculateRevenue(estimatedKwh, FINANCIAL_CONFIG.REVENUE_PER_KWH);

    return {
      date: formatLocalDateKey(entry.date),
      label: formatDayLabel(entry.date),
      totalKwh: estimatedKwh,
      averageTemperature: average(entry.temperatures),
      averageOccupancy: average(entry.occupancies),
      energyCost,
      revenue,
    };
  });
}

export function buildMonthlyComparison(dailyData: DailyEntry[], maxMonths = 3): MonthlyEntry[] {
  const grouped = new Map<
    string,
    {
      date: Date;
      totalKwh: number;
      energyCost: number;
      revenue: number;
    }
  >();

  dailyData.forEach((entry) => {
    const [year, month] = entry.date.split('-').map(Number);
    const key = `${year}-${month}`;
    const current = grouped.get(key) ?? {
      date: new Date(year, month - 1, 1),
      totalKwh: 0,
      energyCost: 0,
      revenue: 0,
    };

    current.totalKwh += entry.totalKwh;
    current.energyCost += entry.energyCost;
    current.revenue += entry.revenue;
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .slice(-maxMonths)
    .map((entry) => ({
      month: formatMonthLabel(entry.date),
      totalKwh: entry.totalKwh,
      energyCost: entry.energyCost,
      revenue: entry.revenue,
    }));
}

export function buildCumulativeData(
  dailyData: DailyEntry[],
  referenceDate: Date | null,
): CumulativeEntry[] {
  if (!referenceDate) {
    return [];
  }

  let energyAccum = 0;
  let revenueAccum = 0;

  return dailyData
    .filter((entry) => {
      const [year, month] = entry.date.split('-').map(Number);
      return year === referenceDate.getFullYear() && month - 1 === referenceDate.getMonth();
    })
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((entry) => {
      const day = Number.parseInt(entry.date.slice(-2), 10);
      energyAccum += entry.energyCost;
      revenueAccum += entry.revenue;

      return {
        day,
        label: String(day).padStart(2, '0'),
        energyAccum,
        revenueAccum,
      };
    });
}

export function calculateChange(currentValue: number, previousValue: number): number {
  if (previousValue <= 0) {
    return 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

function getPeakTariffCostShare(hourlyAverages: HourlyAvgEntry[]): number {
  if (hourlyAverages.length === 0) {
    return 0;
  }

  const weightedCosts = hourlyAverages.map((entry) => entry.avgEnergy * entry.tariff);
  const totalCostWeight = sum(weightedCosts);

  if (totalCostWeight <= 0) {
    return 0;
  }

  const peakCostWeight = sum(
    hourlyAverages
      .filter((entry) => entry.hour >= 18 && entry.hour < 21)
      .map((entry) => entry.avgEnergy * entry.tariff),
  );

  return (peakCostWeight / totalCostWeight) * 100;
}

export function generateBusinessInsights(data: BusinessData): InsightCard[] {
  const insights: InsightCard[] = [];
  const peakTariffCostShare = getPeakTariffCostShare(data.hourlyAverages);

  if (data.revenueChange > data.costChange) {
    insights.push({
      title: 'Crescimento Sustentavel',
      text: `Faturamento cresceu ${data.revenueChange.toFixed(1)}% enquanto o custo energetico variou ${data.costChange.toFixed(1)}%.`,
      variant: 'blue',
    });
  } else {
    insights.push({
      title: 'Pressao de Custos',
      text: `Custo energetico variou ${data.costChange.toFixed(1)}%, acima do faturamento (${data.revenueChange.toFixed(1)}%).`,
      variant: 'amber',
    });
  }

  if (data.margin > 85) {
    insights.push({
      title: 'Margem Saudavel',
      text: `A operacao sustenta margem atual de ${data.margin.toFixed(1)}%, mesmo com os custos de energia monitorados.`,
      variant: 'blue',
    });
  } else if (peakTariffCostShare > 40) {
    insights.push({
      title: 'Oportunidade',
      text: `Horarios de ponta concentram ${peakTariffCostShare.toFixed(0)}% do custo horario estimado. Ajustes nessa faixa podem reduzir o gasto mensal.`,
      variant: 'amber',
    });
  } else {
    insights.push({
      title: 'Operacao Estavel',
      text: `A projeção de margem no fechamento do periodo aponta ${data.projectedMargin.toFixed(1)}%, com custo energetico projetado de R$ ${data.projectedEnergyCost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}.`,
      variant: 'blue',
    });
  }

  return insights.slice(0, 2);
}

export function buildBusinessSummary(params: {
  dailyData: DailyEntry[];
  monthlyComparison: MonthlyEntry[];
  hourlyAverages: HourlyAvgEntry[];
  referenceDate: Date | null;
  projectionDaysElapsed?: number;
  projectionTotalDays?: number;
}): BusinessData {
  const {
    dailyData,
    monthlyComparison,
    hourlyAverages,
    referenceDate,
    projectionDaysElapsed,
    projectionTotalDays,
  } = params;
  const currentMonth =
    monthlyComparison[monthlyComparison.length - 1] ?? {
      month: '--',
      totalKwh: 0,
      energyCost: 0,
      revenue: 0,
    };
  const previousMonth =
    monthlyComparison[monthlyComparison.length - 2] ?? {
      month: '--',
      totalKwh: 0,
      energyCost: 0,
      revenue: 0,
    };
  const daysElapsed = projectionDaysElapsed ?? referenceDate?.getDate() ?? 0;
  const totalDaysInMonth =
    projectionTotalDays ??
    (referenceDate
      ? new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate()
      : FINANCIAL_CONFIG.DAYS_PER_MONTH);
  const currentRevenue = currentMonth.revenue;
  const energyCost = currentMonth.energyCost;
  const projectedRevenue = projectMonthly(currentRevenue, daysElapsed, totalDaysInMonth);
  const projectedEnergyCost = projectMonthly(energyCost, daysElapsed, totalDaysInMonth);
  const margin = calculateMargin(currentRevenue, energyCost);
  const projectedMargin = calculateMargin(projectedRevenue, projectedEnergyCost);
  const revenueChange = calculateChange(currentRevenue, previousMonth.revenue);
  const costChange = calculateChange(energyCost, previousMonth.energyCost);
  const cumulativeData = buildCumulativeData(dailyData, referenceDate);

  return {
    currentRevenue,
    projectedRevenue,
    energyCost,
    projectedEnergyCost,
    margin,
    projectedMargin,
    revenueChange,
    costChange,
    monthlyComparison,
    dailyData,
    hourlyAverages,
    cumulativeData,
    referenceDate,
  };
}
