import { buildEnergyPrices, generateLogisticsInsights } from '@/domain/transformers/logisticsTransformer';
import type { HourlyProfileEntry, LogisticsData, OccupancyForecastEntry } from '@/domain/types';

function buildHourlyData(): HourlyProfileEntry[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const avgEnergy = hour >= 8 && hour < 18 ? 20 : hour >= 22 || hour < 6 ? 12 : 14;
    const avgOccupancy = hour === 8 ? 92 : hour >= 8 && hour < 18 ? 76 : 35;
    const tariff = hour >= 22 || hour < 6 ? 0.5 : hour >= 18 && hour < 21 ? 0.85 : 0.65;

    return {
      hour,
      avgEnergy,
      avgOccupancy,
      tariff,
    };
  });
}

function buildForecast(hourlyData: HourlyProfileEntry[]): OccupancyForecastEntry[] {
  return hourlyData.map((entry) => ({
    hour: entry.hour,
    occupancy: entry.avgOccupancy,
    energyPrice: entry.tariff,
  }));
}

describe('logisticsTransformer', () => {
  it('generates an insight about higher business-hour consumption', () => {
    const hourlyData = buildHourlyData();
    const data: LogisticsData = {
      avgEnergy24h: 15.8,
      peakOccupancy: 92,
      lowEnergyHours: 8,
      nextIdealHour: 22,
      hourlyData,
      hourlyProfile: hourlyData,
      occupancyForecast: buildForecast(hourlyData),
      energyPrices: buildEnergyPrices(),
    };

    const insights = generateLogisticsInsights(data);

    expect(insights[0]?.text).toMatch(/Consumo aumenta/i);
    expect(insights[0]?.text).toMatch(/horario comercial/i);
  });

  it('mentions the occupancy peak and the next cheaper window', () => {
    const hourlyData = buildHourlyData();
    const data: LogisticsData = {
      avgEnergy24h: 15.8,
      peakOccupancy: 92,
      lowEnergyHours: 8,
      nextIdealHour: 22,
      hourlyData,
      hourlyProfile: hourlyData,
      occupancyForecast: buildForecast(hourlyData),
      energyPrices: buildEnergyPrices(),
    };

    const insights = generateLogisticsInsights(data);

    expect(insights[1]?.text).toMatch(/8h/i);
    expect(insights[1]?.text).toMatch(/22h/i);
  });
});
