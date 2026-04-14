import { apiClient, ApiClient } from './client';
import type {
  ChannelMeasurementsResponse,
  ConsumptionResponse,
  CurrentBySensorResponse,
  DemandPeaksResponse,
  ElectricalHealthResponse,
  HourlyProfileResponse,
  SensorMeasurementsResponse,
} from './types';

function buildAnalyticsParams(fromTime?: string, toTime?: string): Record<string, string> | undefined {
  const params = Object.fromEntries(
    Object.entries({
      from_time: fromTime,
      to_time: toTime,
    }).filter(([, value]) => typeof value === 'string' && value.length > 0),
  );

  return Object.keys(params).length > 0 ? params : undefined;
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function formatDate(dateString?: string): string | undefined {
  if (!dateString) {
    return undefined;
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date value: ${dateString}`);
  }

  return date.toISOString().replace(/\.\d{3}Z$/, '');
}

export interface ApiEndpoints {
  getChannelMeasurements: (
    channel: string,
    fromTime: string,
    toTime: string,
  ) => Promise<ChannelMeasurementsResponse>;
  getSensorMeasurements: (
    channel: string,
    sensor: string,
    fromTime: string,
    toTime: string,
  ) => Promise<SensorMeasurementsResponse>;
  getConsumption: (
    channel: string,
    fromTime?: string,
    toTime?: string,
  ) => Promise<ConsumptionResponse>;
  getDemandPeaks: (
    channel: string,
    fromTime?: string,
    toTime?: string,
  ) => Promise<DemandPeaksResponse>;
  getElectricalHealth: (
    channel: string,
    fromTime?: string,
    toTime?: string,
  ) => Promise<ElectricalHealthResponse>;
  getHourlyProfile: (
    channel: string,
    fromTime?: string,
    toTime?: string,
  ) => Promise<HourlyProfileResponse>;
  getCurrentBySensor: (
    channel: string,
    fromTime?: string,
    toTime?: string,
  ) => Promise<CurrentBySensorResponse>;
}

export function createApiEndpoints(client: ApiClient): ApiEndpoints {
  return {
    getChannelMeasurements: (channel, fromTime, toTime) =>
      client.get<ChannelMeasurementsResponse>(`/${encodePathSegment(channel)}`, {
        from_time: formatDate(fromTime),
        to_time: formatDate(toTime),
      }),
    getSensorMeasurements: (channel, sensor, fromTime, toTime) =>
      client.get<SensorMeasurementsResponse>(
        `/${encodePathSegment(channel)}/${encodePathSegment(sensor)}`,
        {
          from_time: formatDate(fromTime),
          to_time: formatDate(toTime),
        },
      ),
    getConsumption: (channel, fromTime, toTime) =>
      client.get<ConsumptionResponse>(
        `/analytics/${encodePathSegment(channel)}/consumption`,
        buildAnalyticsParams(formatDate(fromTime), formatDate(toTime)),
      ),
    getDemandPeaks: (channel, fromTime, toTime) =>
      client.get<DemandPeaksResponse>(
        `/analytics/${encodePathSegment(channel)}/demand_peaks`,
        buildAnalyticsParams(formatDate(fromTime), formatDate(toTime)),
      ),
    getElectricalHealth: (channel, fromTime, toTime) =>
      client.get<ElectricalHealthResponse>(
        `/analytics/${encodePathSegment(channel)}/electrical_health`,
        buildAnalyticsParams(formatDate(fromTime), formatDate(toTime)),
      ),
    getHourlyProfile: (channel, fromTime, toTime) =>
      client.get<HourlyProfileResponse>(
        `/analytics/${encodePathSegment(channel)}/hourly_profile`,
        buildAnalyticsParams(formatDate(fromTime), formatDate(toTime)),
      ),
    getCurrentBySensor: (channel, fromTime, toTime) =>
      client.get<CurrentBySensorResponse>(
        `/analytics/${encodePathSegment(channel)}/current_by_sensor`,
        buildAnalyticsParams(formatDate(fromTime), formatDate(toTime)),
      ),
  };
}

export const apiEndpoints = createApiEndpoints(apiClient);

export const {
  getChannelMeasurements,
  getSensorMeasurements,
  getConsumption,
  getDemandPeaks,
  getElectricalHealth,
  getHourlyProfile,
  getCurrentBySensor,
} = apiEndpoints;
