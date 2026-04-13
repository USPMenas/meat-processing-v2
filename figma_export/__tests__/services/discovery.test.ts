import type { ApiEndpoints } from '@/services/api/endpoints';
import type { ChannelMeasurementsResponse } from '@/services/api/types';
import { discoverChannelsAndSensors } from '@/services/api/discovery';
import { CacheManager } from '@/services/cache/cacheManager';

function createMemoryStorage() {
  const map = new Map<string, string>();

  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

function createResponse(
  channel: string,
  measurements: ChannelMeasurementsResponse['measurements'],
): ChannelMeasurementsResponse {
  return {
    channel,
    from: measurements[0]?.timestamp ?? '2026-04-07T00:00:00.000Z',
    to: measurements[measurements.length - 1]?.timestamp ?? '2026-04-07T00:00:00.000Z',
    count: measurements.length,
    measurements,
  };
}

function createDiscoveryEndpoints(
  mock: ReturnType<typeof vi.fn>,
): Pick<ApiEndpoints, 'getChannelMeasurements'> {
  return {
    getChannelMeasurements: (channel, fromTime, toTime) =>
      mock(channel, fromTime, toTime) as ReturnType<ApiEndpoints['getChannelMeasurements']>,
  };
}

describe('discoverChannelsAndSensors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts unique sensors from available channels and caches the result', async () => {
    const cacheManager = new CacheManager({ storage: createMemoryStorage() });
    const getChannelMeasurements = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse('lab', [
          {
            channel: 'lab',
            sensor: 'fase2',
            apparent_power: 2,
            active_power: 2,
            reactive_power: 1,
            power_factor: 0.9,
            current: 1,
            voltage: 127,
            timestamp: '2026-04-06T12:00:00',
          },
          {
            channel: 'lab',
            sensor: 'fase1',
            apparent_power: 3,
            active_power: 3,
            reactive_power: 1,
            power_factor: 0.9,
            current: 1,
            voltage: 128,
            timestamp: '2026-04-06T12:00:00',
          },
          {
            channel: 'lab',
            sensor: 'fase1',
            apparent_power: 3,
            active_power: 3,
            reactive_power: 1,
            power_factor: 0.9,
            current: 1,
            voltage: 128,
            timestamp: '2026-04-06T12:05:00',
          },
        ]),
      )
      .mockResolvedValueOnce(createResponse('mock01', []));

    const result = await discoverChannelsAndSensors({
      endpoints: createDiscoveryEndpoints(getChannelMeasurements),
      cacheManager,
      channelCandidates: ['lab', 'mock01'],
      probeOffsetsMinutes: [1440],
      now: () => new Date('2026-04-07T12:00:00.000Z'),
    });

    expect(result).toEqual({
      channels: ['lab'],
      sensorsByChannel: {
        lab: ['fase1', 'fase2'],
      },
    });

    await discoverChannelsAndSensors({
      endpoints: createDiscoveryEndpoints(getChannelMeasurements),
      cacheManager,
      channelCandidates: ['lab', 'mock01'],
      probeOffsetsMinutes: [1440],
      now: () => new Date('2026-04-07T12:05:00.000Z'),
    });

    expect(getChannelMeasurements).toHaveBeenCalledTimes(2);
  });

  it('falls back to the bundled backup manifest when the probes return empty data or fail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cacheManager = new CacheManager({ storage: createMemoryStorage() });
    const getChannelMeasurements = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(createResponse('mock01', []));

    const result = await discoverChannelsAndSensors({
      endpoints: createDiscoveryEndpoints(getChannelMeasurements),
      cacheManager,
      backupManifestLoader: async () => ({
        generatedAt: '2026-04-09T14:06:48Z',
        source: 'backup_2026-03-31.db',
        defaultChannel: 'lab',
        channels: [
          {
            channel: 'lab',
            snapshotId: 'lab',
            sensors: ['fase1', 'fase2', 'fase3'],
            latestMeasurementAt: '2026-03-31T10:24:17',
            measurementRange: {
              from: '2025-12-01T19:20:42',
              to: '2026-03-31T10:24:17',
            },
          },
        ],
      }),
      channelCandidates: ['lab', 'mock01'],
      probeOffsetsMinutes: [1440],
      now: () => new Date('2026-04-07T12:00:00.000Z'),
    });

    expect(result).toEqual({
      channels: ['lab'],
      sensorsByChannel: {
        lab: ['fase1', 'fase2', 'fase3'],
      },
    });
  });
});
