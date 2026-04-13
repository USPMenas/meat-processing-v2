import { apiClient, ApiClient } from '../api/client';
import type { BootstrapResponse, HistoryResponse, RecentResponse } from './types';

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

export interface RuntimeEndpoints {
  getBootstrapSnapshot: (channel: string) => Promise<BootstrapResponse>;
  getRecentMeasurements: (
    channel: string,
    options?: {
      lastKnownAt?: string | null;
      shouldProbe?: boolean;
    },
  ) => Promise<RecentResponse>;
  getHistory: (channel: string, days: 7 | 30) => Promise<HistoryResponse>;
}

export function createRuntimeEndpoints(client: ApiClient): RuntimeEndpoints {
  return {
    getBootstrapSnapshot: (channel) =>
      client.get<BootstrapResponse>(`/bootstrap/${encodePathSegment(channel)}`),
    getRecentMeasurements: (channel, options) =>
      client.get<RecentResponse>(`/recent/${encodePathSegment(channel)}`, {
        ...(options?.lastKnownAt ? { lastKnownAt: options.lastKnownAt } : {}),
        probe: options?.shouldProbe === false ? '0' : '1',
      }),
    getHistory: (channel, days) =>
      client.get<HistoryResponse>(`/history/${encodePathSegment(channel)}`, {
        days: String(days),
      }),
  };
}

export const runtimeEndpoints = createRuntimeEndpoints(apiClient);
