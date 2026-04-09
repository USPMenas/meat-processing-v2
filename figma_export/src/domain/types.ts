import type {
  ApiMeasurement,
  ConsumptionResponse,
  CurrentBySensorResponse,
  DemandPeaksResponse,
  ElectricalHealthResponse,
  HourlyProfileResponse,
} from '../services/api/types';

export type { ApiMeasurement } from '../services/api/types';

export interface OperationalData {
  freezerEnergy: number;
  equipmentEnergy: number;
  temperature: number;
  occupancy: number;
  timestamp: Date;
}

export type OperationalChartPeriod = '24h' | '7d' | '30d';

export interface OperationalHistoryPoint {
  freezerEnergy: number;
  equipmentEnergy: number;
  temperature: number;
  occupancy: number;
  timestamp: string;
}

export interface OperationalHistoryCachePayload {
  anchorMeasurementAt: string | null;
  period: OperationalChartPeriod;
  points: OperationalHistoryPoint[];
}

export interface BackupSnapshotManifestChannel {
  channel: string;
  snapshotId: string;
  sensors: string[];
  latestMeasurementAt: string;
  measurementRange: {
    from: string;
    to: string;
  };
}

export interface BackupSnapshotManifest {
  generatedAt: string;
  source: string;
  defaultChannel: string;
  channels: BackupSnapshotManifestChannel[];
}

export interface BackupOperationalSeries {
  recentMeasurements: ApiMeasurement[];
  histories: Record<OperationalChartPeriod, OperationalHistoryCachePayload>;
}

export interface BackupLogisticsDataset {
  hourlyProfile: HourlyProfileResponse;
  currentBySensor: CurrentBySensorResponse;
}

export interface BackupBusinessDataset {
  consumption: ConsumptionResponse;
  demandPeaks: DemandPeaksResponse;
  electricalHealth: ElectricalHealthResponse;
}

export interface BackupChannelSnapshot {
  channel: string;
  generatedAt: string;
  source: string;
  sensors: string[];
  latestMeasurementAt: string;
  measurementRange: {
    from: string;
    to: string;
  };
  operational: BackupOperationalSeries;
  logistics: BackupLogisticsDataset;
  business: BackupBusinessDataset;
}

export interface HourlyProfileEntry {
  hour: number;
  avgEnergy: number;
  avgOccupancy: number;
  tariff: number;
}

export interface OccupancyForecastEntry {
  hour: number;
  occupancy: number;
  energyPrice: number;
}

export interface InsightCard {
  title: string;
  text: string;
  variant: 'blue' | 'amber';
}

export interface EnergyPrice {
  hour: number;
  price: number;
}

export interface DailyEntry {
  date: string;
  label: string;
  totalKwh: number;
  averageTemperature: number;
  averageOccupancy: number;
  energyCost: number;
  revenue: number;
}

export interface HourlyAvgEntry {
  hour: number;
  avgEnergy: number;
  avgOccupancy: number;
  tariff: number;
}

export interface CumulativeEntry {
  day: number;
  label: string;
  energyAccum: number;
  revenueAccum: number;
}

export interface MonthlyEntry {
  month: string;
  totalKwh: number;
  energyCost: number;
  revenue: number;
}

export interface LogisticsData {
  avgEnergy24h: number;
  peakOccupancy: number;
  lowEnergyHours: number;
  nextIdealHour: number | null;
  hourlyData: HourlyProfileEntry[];
  hourlyProfile: HourlyProfileEntry[];
  occupancyForecast: OccupancyForecastEntry[];
  energyPrices: EnergyPrice[];
}

export interface BusinessData {
  currentRevenue: number;
  projectedRevenue: number;
  energyCost: number;
  projectedEnergyCost: number;
  margin: number;
  projectedMargin: number;
  revenueChange: number;
  costChange: number;
  monthlyComparison: MonthlyEntry[];
  dailyData: DailyEntry[];
  hourlyAverages: HourlyAvgEntry[];
  cumulativeData: CumulativeEntry[];
  referenceDate: Date | null;
}

export type AlertType = 'warning' | 'critical' | 'info';

export interface Alert {
  type: AlertType;
  variable: string;
  message: string;
  value: number;
  expected: number;
}

export interface TariffConfig {
  name: string;
  startHour: number;
  endHour: number;
  rate: number;
}

export interface ThresholdConfig {
  temperatureCritical: number;
  temperatureWarningHigh: number;
  temperatureWarningLow: number;
  freezerEnergyWarning: number;
  occupancyWarning: number;
  occupancyCritical: number;
  voltageMin: number;
  voltageMax: number;
  powerFactorMin?: number;
}

export interface SensorMap {
  freezerSensors: string[];
  equipmentSensors: string[];
}

export interface TemperatureConfig {
  baseTemperature: number;
  avgPower: number;
  sensitivityFactor: number;
  noiseAmplitude: number;
  minTemperature?: number;
  maxTemperature?: number;
  sourceSensorIds?: string[];
}

export interface OccupancyConfig {
  baseOccupancy: number;
  avgCurrent: number;
  maxCurrent: number;
  noiseAmplitude: number;
  scaleFactor?: number;
  minOccupancy?: number;
  maxOccupancy?: number;
  sourceSensorIds?: string[];
}

export interface OperationalSnapshot {
  latest: OperationalData | null;
  series: OperationalData[];
  measurements: ApiMeasurement[];
}

export interface CacheEntry<T> {
  version: string;
  lastSync: string;
  data: T;
  updatedAt?: string;
}
