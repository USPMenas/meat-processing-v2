export interface ApiMeasurement {
  channel: string;
  sensor: string;
  apparent_power: number;
  active_power: number;
  reactive_power: number;
  power_factor: number;
  current: number;
  voltage: number;
  timestamp: string;
}

export interface ChannelMeasurementsRequest {
  channel: string;
  from_time: string;
  to_time: string;
}

export interface ChannelMeasurementsResponse {
  channel: string;
  from: string;
  to: string;
  count: number;
  measurements: ApiMeasurement[];
}

export interface SensorMeasurementsRequest extends ChannelMeasurementsRequest {
  sensor: string;
}

export interface SensorMeasurementsResponse extends ChannelMeasurementsResponse {
  sensor: string;
}

export interface ApiErrorResponse {
  detail: string;
}

export interface AnalyticsWindowRequest {
  channel: string;
  from_time?: string;
  to_time?: string;
}

export interface ConsumptionResult {
  sensor: string;
  total_kwh: number;
  min_demand_kw: number;
  max_demand_kw: number;
}

export interface ConsumptionResponse {
  channel: string;
  from: string;
  to: string;
  results: ConsumptionResult[];
}

export interface DemandPeaksResult {
  sensor: string;
  peak_kw: number;
  timestamp: string;
}

export interface DemandPeaksResponse {
  channel: string;
  from: string;
  to: string;
  results: DemandPeaksResult[];
}

export interface ElectricalHealthResult {
  sensor: string;
  avg_voltage: number;
  avg_power_factor: number;
}

export interface ElectricalHealthResponse {
  channel: string;
  from: string;
  to: string;
  results: ElectricalHealthResult[];
}

export interface HourlyProfileResult {
  hour: string;
  sensor: string;
  avg_power_kw: number;
}

export interface HourlyProfileResponse {
  channel: string;
  from: string;
  to: string;
  results: HourlyProfileResult[];
}

export interface CurrentBySensorResult {
  sensor: string;
  avg_current: number;
}

export interface CurrentBySensorResponse {
  channel: string;
  from: string;
  to: string;
  results: CurrentBySensorResult[];
}

export type AnalyticsResponseMap = {
  consumption: ConsumptionResponse;
  demand_peaks: DemandPeaksResponse;
  electrical_health: ElectricalHealthResponse;
  hourly_profile: HourlyProfileResponse;
  current_by_sensor: CurrentBySensorResponse;
};

export type AnalyticsType = keyof AnalyticsResponseMap;
