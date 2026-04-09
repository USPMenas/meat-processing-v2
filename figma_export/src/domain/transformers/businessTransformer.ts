import { BUSINESS_MODEL_ASSUMPTIONS, FINANCIAL_CONFIG } from '../constants/financial';
import { TARIFFS } from '../constants/tariffs';
import { calculateEnergyCost, calculateMargin, projectMonthly } from './financialTransformer';
import { round } from './deterministic';
import type {
  BusinessCostBreakdown,
  BusinessData,
  BusinessModelAssumptions,
  BusinessTimelineEntry,
  BusinessTimelineGranularity,
  CumulativeEntry,
  DailyEntry,
  HourlyAvgEntry,
  InsightCard,
  MonthlyEntry,
  OperationalChartPeriod,
  OperationalData,
} from '../types';

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return sum(values) / values.length;
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

function formatHourLabel(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
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

function alignToBucket(date: Date, granularity: BusinessTimelineGranularity): Date {
  if (granularity === 'hour') {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      0,
      0,
      0,
    );
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function shiftBucket(
  date: Date,
  granularity: BusinessTimelineGranularity,
  amount: number,
): Date {
  const shifted = new Date(date);

  if (granularity === 'hour') {
    shifted.setHours(shifted.getHours() + amount);
    return shifted;
  }

  shifted.setDate(shifted.getDate() + amount);
  return shifted;
}

function getTimelineGranularity(period: OperationalChartPeriod): BusinessTimelineGranularity {
  return period === '24h' ? 'hour' : 'day';
}

function getBucketCount(period: OperationalChartPeriod): number {
  return period === '24h' ? 24 : Number.parseInt(period, 10);
}

function getFallbackStepHours(
  operationalSeries: OperationalData[],
  period: OperationalChartPeriod,
): number {
  if (operationalSeries.length < 2) {
    return period === '24h' ? 1 : 24;
  }

  const timestamps = operationalSeries
    .map((entry) => entry.timestamp.getTime())
    .sort((left, right) => left - right);
  const deltas = timestamps
    .slice(1)
    .map((timestamp, index) => timestamp - timestamps[index])
    .filter((delta) => delta > 0)
    .sort((left, right) => left - right);

  if (deltas.length === 0) {
    return period === '24h' ? 1 : 24;
  }

  const median = deltas[Math.floor(deltas.length / 2)];
  return median / 3_600_000;
}

function createTimelineSkeleton(
  referenceDate: Date,
  period: OperationalChartPeriod,
  granularity: BusinessTimelineGranularity,
): Array<{
  key: string;
  label: string;
  timestamp: Date;
  totalKwh: number;
  averageTemperature: number[];
  averageOccupancy: number[];
  hourlyBreakdown: Map<number, number>;
}> {
  const bucketCount = getBucketCount(period);
  const endBucket = alignToBucket(referenceDate, granularity);
  const startBucket = shiftBucket(endBucket, granularity, -(bucketCount - 1));

  return Array.from({ length: bucketCount }, (_, index) => {
    const timestamp = shiftBucket(startBucket, granularity, index);

    return {
      key: timestamp.toISOString(),
      label: granularity === 'hour' ? formatHourLabel(timestamp) : formatDayLabel(timestamp),
      timestamp,
      totalKwh: 0,
      averageTemperature: [],
      averageOccupancy: [],
      hourlyBreakdown: new Map<number, number>(),
    };
  });
}

function getBusinessPeriodShare(period: OperationalChartPeriod): number {
  switch (period) {
    case '24h':
      return 1 / FINANCIAL_CONFIG.DAYS_PER_MONTH;
    case '7d':
      return 7 / FINANCIAL_CONFIG.DAYS_PER_MONTH;
    default:
      return 1;
  }
}

export function getTotalConsumptionKwh(
  results: Array<{ total_kwh: number }> | undefined,
): number {
  if (!results || results.length === 0) {
    return 0;
  }

  return round(sum(results.map((entry) => entry.total_kwh)));
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
    return round((entry.freezerEnergy + entry.equipmentEnergy) * defaultStepHours);
  }

  return round(
    operationalSeries.reduce((total, entry, index) => {
      const nextEntry = operationalSeries[index + 1];
      const intervalHours = nextEntry
        ? (nextEntry.timestamp.getTime() - entry.timestamp.getTime()) / 3_600_000
        : defaultStepHours;

      return (
        total +
        (entry.freezerEnergy + entry.equipmentEnergy) *
          (intervalHours > 0 ? intervalHours : defaultStepHours)
      );
    }, 0),
  );
}

export function buildBusinessTimeline(params: {
  operationalSeries: OperationalData[];
  period: OperationalChartPeriod;
  referenceDate: Date | null;
  assumptions?: BusinessModelAssumptions;
}): {
  timeline: BusinessTimelineEntry[];
  granularity: BusinessTimelineGranularity;
} {
  const {
    operationalSeries,
    period,
    referenceDate,
    assumptions = BUSINESS_MODEL_ASSUMPTIONS,
  } = params;

  if (operationalSeries.length === 0 || !referenceDate) {
    return {
      timeline: [],
      granularity: getTimelineGranularity(period),
    };
  }

  const granularity = getTimelineGranularity(period);
  const sortedSeries = [...operationalSeries].sort(
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
  );
  const bucketSkeleton = createTimelineSkeleton(referenceDate, period, granularity);
  const bucketMap = new Map(bucketSkeleton.map((bucket) => [bucket.key, bucket]));
  const defaultStepHours = getFallbackStepHours(sortedSeries, period);
  const periodShare = getBusinessPeriodShare(period);
  const fixedPayroll = assumptions.monthlyPayrollCost * periodShare;
  const fixedRent = assumptions.monthlyRentCost * periodShare;
  const fixedMaintenance = assumptions.monthlyMaintenanceCost * periodShare;
  const perBucketPayroll = fixedPayroll / Math.max(bucketSkeleton.length, 1);
  const perBucketRent = fixedRent / Math.max(bucketSkeleton.length, 1);
  const perBucketMaintenance = fixedMaintenance / Math.max(bucketSkeleton.length, 1);

  sortedSeries.forEach((entry, index) => {
    const nextEntry = sortedSeries[index + 1];
    const intervalHours = nextEntry
      ? (nextEntry.timestamp.getTime() - entry.timestamp.getTime()) / 3_600_000
      : defaultStepHours;
    const effectiveIntervalHours = intervalHours > 0 ? intervalHours : defaultStepHours;
    const bucketDate = alignToBucket(entry.timestamp, granularity);
    const bucket = bucketMap.get(bucketDate.toISOString());

    if (!bucket) {
      return;
    }

    const totalPowerKw = entry.freezerEnergy + entry.equipmentEnergy;
    const totalKwh = totalPowerKw * effectiveIntervalHours;

    bucket.totalKwh += totalKwh;
    bucket.averageTemperature.push(entry.temperature);
    bucket.averageOccupancy.push(entry.occupancy);
    bucket.hourlyBreakdown.set(
      entry.timestamp.getHours(),
      (bucket.hourlyBreakdown.get(entry.timestamp.getHours()) ?? 0) + totalKwh,
    );
  });

  const timeline = bucketSkeleton.map((bucket) => {
    const totalKwh = round(bucket.totalKwh);
    const processedKg = round(totalKwh / assumptions.kwhPerKgProcessed);
    const grossRevenue = round(processedKg * assumptions.averageSalePricePerKg);
    const energyCost = calculateEnergyCost(
      totalKwh,
      Array.from(bucket.hourlyBreakdown.entries()).map(([hour, kwh]) => ({ hour, kwh })),
      [...TARIFFS],
    );
    const lostMerchandiseCost = round(
      processedKg * assumptions.lossRate * assumptions.merchandiseCostPerKg,
    );
    const payrollCost = round(perBucketPayroll);
    const rentCost = round(perBucketRent);
    const maintenanceCost = round(perBucketMaintenance);
    const totalCosts = round(
      energyCost + payrollCost + rentCost + maintenanceCost + lostMerchandiseCost,
    );
    const operatingProfit = round(grossRevenue - totalCosts);

    return {
      key: bucket.key,
      label: bucket.label,
      timestamp: bucket.timestamp,
      totalKwh,
      processedKg,
      grossRevenue,
      energyCost,
      payrollCost,
      rentCost,
      maintenanceCost,
      lostMerchandiseCost,
      totalCosts,
      operatingProfit,
      margin: calculateMargin(grossRevenue, totalCosts),
      averageTemperature: round(average(bucket.averageTemperature)),
      averageOccupancy: round(average(bucket.averageOccupancy)),
    };
  });

  return { timeline, granularity };
}

export function buildDailyBusinessData(
  timeline: BusinessTimelineEntry[],
  granularity: BusinessTimelineGranularity,
): DailyEntry[] {
  if (timeline.length === 0) {
    return [];
  }

  if (granularity === 'day') {
    return timeline.map((entry) => ({
      date: formatLocalDateKey(entry.timestamp),
      label: entry.label,
      totalKwh: entry.totalKwh,
      averageTemperature: entry.averageTemperature,
      averageOccupancy: entry.averageOccupancy,
      energyCost: entry.energyCost,
      revenue: entry.grossRevenue,
    }));
  }

  const grouped = new Map<
    string,
    {
      timestamp: Date;
      totalKwh: number;
      averageTemperature: number[];
      averageOccupancy: number[];
      energyCost: number;
      revenue: number;
    }
  >();

  timeline.forEach((entry) => {
    const key = formatLocalDateKey(entry.timestamp);
    const current = grouped.get(key) ?? {
      timestamp: new Date(entry.timestamp.getFullYear(), entry.timestamp.getMonth(), entry.timestamp.getDate()),
      totalKwh: 0,
      averageTemperature: [],
      averageOccupancy: [],
      energyCost: 0,
      revenue: 0,
    };

    current.totalKwh += entry.totalKwh;
    current.averageTemperature.push(entry.averageTemperature);
    current.averageOccupancy.push(entry.averageOccupancy);
    current.energyCost += entry.energyCost;
    current.revenue += entry.grossRevenue;
    grouped.set(key, current);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entry]) => ({
      date,
      label: formatDayLabel(entry.timestamp),
      totalKwh: round(entry.totalKwh),
      averageTemperature: round(average(entry.averageTemperature)),
      averageOccupancy: round(average(entry.averageOccupancy)),
      energyCost: round(entry.energyCost),
      revenue: round(entry.revenue),
    }));
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
      totalKwh: round(entry.totalKwh),
      energyCost: round(entry.energyCost),
      revenue: round(entry.revenue),
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
        energyAccum: round(energyAccum),
        revenueAccum: round(revenueAccum),
      };
    });
}

export function calculateChange(currentValue: number, previousValue: number): number {
  if (previousValue <= 0) {
    return 0;
  }

  return round(((currentValue - previousValue) / previousValue) * 100);
}

export function buildBusinessCostBreakdown(
  timeline: BusinessTimelineEntry[],
): BusinessCostBreakdown {
  const breakdown = timeline.reduce(
    (accumulator, entry) => ({
      energy: accumulator.energy + entry.energyCost,
      payroll: accumulator.payroll + entry.payrollCost,
      rent: accumulator.rent + entry.rentCost,
      maintenance: accumulator.maintenance + entry.maintenanceCost,
      lostMerchandise: accumulator.lostMerchandise + entry.lostMerchandiseCost,
      total: accumulator.total + entry.totalCosts,
    }),
    {
      energy: 0,
      payroll: 0,
      rent: 0,
      maintenance: 0,
      lostMerchandise: 0,
      total: 0,
    },
  );

  return {
    energy: round(breakdown.energy),
    payroll: round(breakdown.payroll),
    rent: round(breakdown.rent),
    maintenance: round(breakdown.maintenance),
    lostMerchandise: round(breakdown.lostMerchandise),
    total: round(breakdown.total),
  };
}

export function generateBusinessInsights(data: BusinessData): InsightCard[] {
  if (data.timeline.length === 0) {
    return [
      {
        title: 'Sem serie financeira',
        text: 'Ainda nao ha buckets suficientes para montar os indicadores do negocio.',
        variant: 'amber',
      },
    ];
  }

  const costEntries: Array<{ label: string; value: number }> = [
    { label: 'energia', value: data.costBreakdown.energy },
    { label: 'folha', value: data.costBreakdown.payroll },
    { label: 'aluguel', value: data.costBreakdown.rent },
    { label: 'manutencao', value: data.costBreakdown.maintenance },
    { label: 'perdas', value: data.costBreakdown.lostMerchandise },
  ];
  const largestCost = [...costEntries].sort((left, right) => right.value - left.value)[0] ?? {
    label: 'energia',
    value: 0,
  };
  const largestCostShare =
    data.costBreakdown.total > 0
      ? round((largestCost.value / data.costBreakdown.total) * 100)
      : 0;
  const insights: InsightCard[] = [];

  if (data.margin >= 20) {
    insights.push({
      title: 'Margem operacional saudavel',
      text: `A janela atual sustenta margem de ${data.margin.toFixed(1)}%, com lucro estimado de R$ ${data.operatingProfit.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}.`,
      variant: 'blue',
    });
  } else {
    insights.push({
      title: 'Margem pressionada',
      text: `A margem caiu para ${data.margin.toFixed(1)}%. Vale revisar o peso de custos fixos e perdas sobre o volume processado.`,
      variant: 'amber',
    });
  }

  insights.push({
    title: 'Maior pressao de custo',
    text: `${largestCost.label.charAt(0).toUpperCase()}${largestCost.label.slice(1)} responde por ${largestCostShare.toFixed(1)}% do custo total modelado nesta janela.`,
    variant: largestCost.label === 'energia' || largestCost.label === 'perdas' ? 'amber' : 'blue',
  });

  return insights;
}

export function buildBusinessSummary(params: {
  timeline: BusinessTimelineEntry[];
  timelineGranularity: BusinessTimelineGranularity;
  dailyData: DailyEntry[];
  monthlyComparison: MonthlyEntry[];
  hourlyAverages: HourlyAvgEntry[];
  referenceDate: Date | null;
  period: OperationalChartPeriod;
  assumptions?: BusinessModelAssumptions;
}): BusinessData {
  const {
    timeline,
    timelineGranularity,
    dailyData,
    monthlyComparison,
    hourlyAverages,
    referenceDate,
    period,
    assumptions = BUSINESS_MODEL_ASSUMPTIONS,
  } = params;
  const currentRevenue = round(sum(timeline.map((entry) => entry.grossRevenue)));
  const energyCost = round(sum(timeline.map((entry) => entry.energyCost)));
  const totalCosts = round(sum(timeline.map((entry) => entry.totalCosts)));
  const operatingProfit = round(sum(timeline.map((entry) => entry.operatingProfit)));
  const estimatedProcessedKg = round(sum(timeline.map((entry) => entry.processedKg)));
  const periodDays = period === '24h' ? 1 : Number.parseInt(period, 10);
  const projectedRevenue = projectMonthly(
    currentRevenue,
    Math.max(periodDays, 1),
    FINANCIAL_CONFIG.DAYS_PER_MONTH,
  );
  const projectedEnergyCost = projectMonthly(
    energyCost,
    Math.max(periodDays, 1),
    FINANCIAL_CONFIG.DAYS_PER_MONTH,
  );
  const projectedTotalCosts = projectMonthly(
    totalCosts,
    Math.max(periodDays, 1),
    FINANCIAL_CONFIG.DAYS_PER_MONTH,
  );
  const margin = calculateMargin(currentRevenue, totalCosts);
  const projectedMargin = calculateMargin(projectedRevenue, projectedTotalCosts);
  const previousMonth =
    monthlyComparison.length > 1
      ? monthlyComparison[monthlyComparison.length - 2]
      : null;
  const currentMonth =
    monthlyComparison.length > 0
      ? monthlyComparison[monthlyComparison.length - 1]
      : null;
  const revenueChange = currentMonth && previousMonth
    ? calculateChange(currentMonth.revenue, previousMonth.revenue)
    : 0;
  const costChange = currentMonth && previousMonth
    ? calculateChange(currentMonth.energyCost, previousMonth.energyCost)
    : 0;

  return {
    currentRevenue,
    projectedRevenue,
    energyCost,
    projectedEnergyCost,
    margin,
    projectedMargin,
    revenueChange,
    costChange,
    estimatedProcessedKg,
    totalCosts,
    operatingProfit,
    costBreakdown: buildBusinessCostBreakdown(timeline),
    timeline,
    timelineGranularity,
    assumptions,
    monthlyComparison,
    dailyData,
    hourlyAverages,
    cumulativeData: buildCumulativeData(dailyData, referenceDate),
    referenceDate,
  };
}

export { getBusinessPeriodShare };
