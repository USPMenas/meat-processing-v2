import { API_CONFIG } from '../../config/api';
import {
  DISCOVERY_CHANNEL_CANDIDATES,
  FRIGORIFICO_CHANNEL,
} from '../../config/channels';
import { apiEndpoints, type ApiEndpoints } from './endpoints';
import { loadBackupManifest } from '../backup/snapshot';
import { cacheManager, type CacheManager } from '../cache/cacheManager';
import type { BackupSnapshotManifest } from '../../domain/types';

const DISCOVERY_CACHE_KEY = 'cache_discovery_channels';
const DISCOVERY_TTL_MS = 24 * 60 * 60 * 1000;

export interface DiscoveryResult {
  channels: string[];
  sensorsByChannel: Record<string, string[]>;
}

interface DiscoveryOptions {
  endpoints?: Pick<ApiEndpoints, 'getChannelMeasurements'>;
  cacheManager?: CacheManager;
  backupManifestLoader?: () => Promise<BackupSnapshotManifest>;
  now?: () => Date;
  channelCandidates?: readonly string[];
  ttlMs?: number;
  probeOffsetsDays?: readonly number[];
  probeWindowHours?: number;
}

function addHours(date: Date, hours: number): Date {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function subtractDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right),
  );
}

export async function discoverChannelsAndSensors(
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const endpoints = options.endpoints ?? apiEndpoints;
  const manager = options.cacheManager ?? cacheManager;
  const backupManifestLoader = options.backupManifestLoader ?? loadBackupManifest;
  const now = options.now ?? (() => new Date());
  const ttlMs = options.ttlMs ?? DISCOVERY_TTL_MS;
  const probeOffsetsDays =
    options.probeOffsetsDays ?? API_CONFIG.staleFallbackProbeOffsetsDays;
  const probeWindowHours =
    options.probeWindowHours ?? API_CONFIG.staleFallbackProbeWindowHours;

  if (!manager.isExpired(DISCOVERY_CACHE_KEY, ttlMs)) {
    const cached = manager.get<DiscoveryResult>(DISCOVERY_CACHE_KEY)?.data;
    if (cached) {
      return cached;
    }
  }

  const channelCandidates = uniqueSorted([
    FRIGORIFICO_CHANNEL,
    ...(options.channelCandidates ?? DISCOVERY_CHANNEL_CANDIDATES),
  ]);
  const sensorsByChannel: Record<string, string[]> = {};
  const channels: string[] = [];
  let hadProbeError = false;

  for (const channel of channelCandidates) {
    for (const offsetDays of probeOffsetsDays) {
      try {
        const probeStart = subtractDays(now(), offsetDays);
        const probeEnd = addHours(probeStart, probeWindowHours);
        const response = await endpoints.getChannelMeasurements(
          channel,
          probeStart.toISOString(),
          probeEnd.toISOString(),
        );

        if (response.measurements.length === 0) {
          continue;
        }

        channels.push(channel);
        sensorsByChannel[channel] = uniqueSorted(
          response.measurements.map((measurement) => measurement.sensor),
        );
        break;
      } catch (error) {
        hadProbeError = true;
        console.error(
          `[Discovery] Failed to probe channel "${channel}" for offset ${offsetDays}d`,
          error,
        );
      }
    }
  }

  const discoveredChannels = uniqueSorted(channels);
  if (discoveredChannels.length === 0) {
    const backupManifest = await backupManifestLoader().catch(() => null);
    if (backupManifest && backupManifest.channels.length > 0) {
      const backupResult: DiscoveryResult = {
        channels: backupManifest.channels.map((entry) => entry.channel),
        sensorsByChannel: Object.fromEntries(
          backupManifest.channels.map((entry) => [entry.channel, [...entry.sensors]]),
        ),
      };

      manager.set(DISCOVERY_CACHE_KEY, backupResult);
      return backupResult;
    }
  }

  const result: DiscoveryResult = {
    channels: discoveredChannels.length > 0 ? discoveredChannels : channelCandidates,
    sensorsByChannel,
  };

  if (discoveredChannels.length > 0) {
    manager.set(DISCOVERY_CACHE_KEY, result);
  } else if (hadProbeError) {
    console.warn('[Discovery] Falling back to configured channel candidates.');
  }

  return result;
}
