import { LOW_TARIFF_THRESHOLD, TARIFFS, getHourlyTariffs, getTariffForHour } from '../constants/tariffs';
import type {
  HourlyProfileEntry,
  InsightCard,
  LogisticsData,
  OccupancyConfig,
  OccupancyForecastEntry,
  OperationalData,
  SensorMap,
  TariffConfig,
} from '../types';
import type { CurrentBySensorResponse, HourlyProfileResponse } from '../../services/api/types';
import { deriveOccupancy } from './occupancyTransformer';

interface FallbackHourEntry {
  avgEnergy: number;
  avgEquipmentEnergy: number;
  avgOccupancy: number;
}

function normalizeHour(hour: number | string): number {
  const parsedHour = typeof hour === 'number' ? hour : Number.parseInt(hour, 10);

  if (Number.isNaN(parsedHour)) {
    return 0;
  }

  return ((parsedHour % 24) + 24) % 24;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildFallbackByHour(series: OperationalData[]): Map<number, FallbackHourEntry> {
  const grouped = new Map<
    number,
    {
      totalEnergy: number;
      equipmentEnergy: number;
      occupancy: number;
      samples: number;
    }
  >();

  series.forEach((entry) => {
    const hour = entry.timestamp.getHours();
    const current = grouped.get(hour) ?? {
      totalEnergy: 0,
      equipmentEnergy: 0,
      occupancy: 0,
      samples: 0,
    };

    current.totalEnergy += entry.freezerEnergy + entry.equipmentEnergy;
    current.equipmentEnergy += entry.equipmentEnergy;
    current.occupancy += entry.occupancy;
    current.samples += 1;
    grouped.set(hour, current);
  });

  return new Map(
    Array.from(grouped.entries()).map(([hour, entry]) => [
      hour,
      {
        avgEnergy: entry.totalEnergy / Math.max(entry.samples, 1),
        avgEquipmentEnergy: entry.equipmentEnergy / Math.max(entry.samples, 1),
        avgOccupancy: entry.occupancy / Math.max(entry.samples, 1),
      },
    ]),
  );
}

function getAverageEquipmentCurrent(
  currentBySensor: CurrentBySensorResponse | null,
  sensorMap: SensorMap,
  occupancyConfig: OccupancyConfig,
): number {
  if (!currentBySensor) {
    return occupancyConfig.avgCurrent;
  }

  const total = currentBySensor.results
    .filter((entry) => sensorMap.equipmentSensors.includes(entry.sensor))
    .reduce((sum, entry) => sum + entry.avg_current, 0);

  return total > 0 ? total : occupancyConfig.avgCurrent;
}

function getTariffLabel(rate: number): string {
  if (rate < LOW_TARIFF_THRESHOLD) {
    return 'tarifa baixa';
  }

  if (rate >= 0.85) {
    return 'tarifa de ponta';
  }

  return 'tarifa intermediaria';
}

export function buildHourlyData(params: {
  hourlyProfile: HourlyProfileResponse | null;
  currentBySensor: CurrentBySensorResponse | null;
  operationalSeries: OperationalData[];
  sensorMap: SensorMap;
  occupancyConfig: OccupancyConfig;
  tariffTable?: readonly TariffConfig[];
}): HourlyProfileEntry[] {
  const {
    hourlyProfile,
    currentBySensor,
    operationalSeries,
    sensorMap,
    occupancyConfig,
    tariffTable = TARIFFS,
  } = params;
  const fallbackByHour = buildFallbackByHour(operationalSeries);
  const groupedByHour = new Map<
    number,
    {
      totalEnergy: number;
      equipmentEnergy: number;
      samples: number;
    }
  >();

  hourlyProfile?.results.forEach((entry) => {
    const hour = normalizeHour(entry.hour);
    const current = groupedByHour.get(hour) ?? {
      totalEnergy: 0,
      equipmentEnergy: 0,
      samples: 0,
    };

    current.totalEnergy += entry.avg_power_kw;
    if (sensorMap.equipmentSensors.includes(entry.sensor)) {
      current.equipmentEnergy += entry.avg_power_kw;
    }
    current.samples += 1;
    groupedByHour.set(hour, current);
  });

  const averageEquipmentCurrent = getAverageEquipmentCurrent(
    currentBySensor,
    sensorMap,
    occupancyConfig,
  );
  const equipmentBaselines = Array.from(groupedByHour.values())
    .map((entry) => entry.equipmentEnergy)
    .filter((value) => value > 0);
  const fallbackEquipmentBaselines = Array.from(fallbackByHour.values())
    .map((entry) => entry.avgEquipmentEnergy)
    .filter((value) => value > 0);
  const baselineEquipmentEnergy =
    average(equipmentBaselines) || average(fallbackEquipmentBaselines) || 1;

  return Array.from({ length: 24 }, (_, rawHour) => {
    const hour = normalizeHour(rawHour);
    const analyticsEntry = groupedByHour.get(hour);
    const fallbackEntry = fallbackByHour.get(hour);
    const avgEnergy =
      analyticsEntry && analyticsEntry.samples > 0
        ? analyticsEntry.totalEnergy
        : fallbackEntry?.avgEnergy ?? 0;
    const equipmentEnergy =
      analyticsEntry && analyticsEntry.samples > 0
        ? analyticsEntry.equipmentEnergy
        : fallbackEntry?.avgEquipmentEnergy ?? 0;
    const normalizedRatio = Math.max(equipmentEnergy, 0) / baselineEquipmentEnergy;
    const estimatedCurrent = averageEquipmentCurrent * normalizedRatio;
    const avgOccupancy =
      analyticsEntry && analyticsEntry.samples > 0
        ? deriveOccupancy(estimatedCurrent, occupancyConfig)
        : fallbackEntry?.avgOccupancy ?? occupancyConfig.baseOccupancy;

    return {
      hour,
      avgEnergy,
      avgOccupancy,
      tariff: getTariffForHour(hour, tariffTable),
    };
  });
}

export function buildOccupancyForecast(
  hourlyData: HourlyProfileEntry[],
  referenceHour: number,
): OccupancyForecastEntry[] {
  const byHour = new Map(hourlyData.map((entry) => [normalizeHour(entry.hour), entry]));
  const startHour = normalizeHour(referenceHour);

  return Array.from({ length: 24 }, (_, offset) => {
    const hour = (startHour + offset) % 24;
    const entry = byHour.get(hour);

    return {
      hour,
      occupancy: entry?.avgOccupancy ?? 0,
      energyPrice: entry?.tariff ?? getTariffForHour(hour),
    };
  });
}

export function generateLogisticsInsights(data: LogisticsData): InsightCard[] {
  const businessHours = data.hourlyData.filter((entry) => entry.hour >= 8 && entry.hour < 18);
  const overnightHours = data.hourlyData.filter(
    (entry) => entry.hour >= 22 || entry.hour < 6,
  );
  const businessAverage = average(businessHours.map((entry) => entry.avgEnergy));
  const overnightAverage = average(overnightHours.map((entry) => entry.avgEnergy));
  const percentIncrease =
    overnightAverage > 0
      ? ((businessAverage - overnightAverage) / overnightAverage) * 100
      : 0;
  const occupancyPeak = data.hourlyData.reduce<HourlyProfileEntry | null>((highest, entry) => {
    if (!highest || entry.avgOccupancy > highest.avgOccupancy) {
      return entry;
    }

    return highest;
  }, null);
  const demandInsight =
    percentIncrease > 10
      ? `Consumo aumenta ${percentIncrease.toFixed(0)}% durante o horario comercial em relacao a madrugada.`
      : `Perfil de consumo permanece estavel entre horario comercial e madrugada, com variacao de ${Math.abs(percentIncrease).toFixed(0)}%.`;
  const peakHour = occupancyPeak?.hour ?? data.nextIdealHour ?? 0;
  const peakTariff = occupancyPeak?.tariff ?? getTariffForHour(peakHour);
  const nextIdealText =
    data.nextIdealHour === null
      ? 'Nao ha janela barata prevista nas proximas 24 horas.'
      : `Proxima janela mais economica: ${data.nextIdealHour}h.`;
  const occupancyInsight =
    peakTariff < LOW_TARIFF_THRESHOLD
      ? `Pico de ocupacao as ${peakHour}h coincide com ${getTariffLabel(peakTariff)}, favorecendo recebimento e expedicao. ${nextIdealText}`
      : `Pico de ocupacao as ${peakHour}h coincide com ${getTariffLabel(peakTariff)}. ${nextIdealText}`;

  return [
    {
      title: 'Insight - Consumo',
      text: demandInsight,
      variant: 'blue',
    },
    {
      title: 'Insight - Estoque',
      text: occupancyInsight,
      variant: 'amber',
    },
  ];
}

export function buildEnergyPrices(): LogisticsData['energyPrices'] {
  return getHourlyTariffs([...TARIFFS]);
}
