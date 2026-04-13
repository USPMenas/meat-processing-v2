// @vitest-environment node

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRuntimeService } from '../../server/runtime-service.mjs';

function createSnapshot() {
  return {
    channel: 'lab',
    generatedAt: '2026-04-10T09:41:00.000Z',
    source: 'backup_2026-04-10.db',
    sensors: ['fase1', 'fase2', 'fase3'],
    latestMeasurementAt: '2026-03-31T10:24:17',
    measurementRange: {
      from: '2025-12-01T19:20:42',
      to: '2026-03-31T10:24:17',
    },
    operational: {
      recentMeasurements: [
        {
          channel: 'lab',
          sensor: 'fase1',
          apparent_power: 5,
          active_power: 5,
          reactive_power: 1,
          power_factor: 0.95,
          current: 0.08,
          voltage: 127,
          timestamp: '2026-03-31T10:24:17',
        },
      ],
      histories: {
        '24h': {
          anchorMeasurementAt: '2026-03-31T10:24:17',
          period: '24h',
          points: [
            {
              freezerEnergy: 6,
              equipmentEnergy: 8,
              temperature: -19,
              occupancy: 62,
              timestamp: '2026-03-31T10:24:17',
            },
          ],
        },
        '7d': {
          anchorMeasurementAt: '2026-03-31T10:24:17',
          period: '7d',
          points: [
            {
              freezerEnergy: 6,
              equipmentEnergy: 8,
              temperature: -19,
              occupancy: 62,
              timestamp: '2026-03-31T10:24:17',
            },
          ],
        },
        '30d': {
          anchorMeasurementAt: '2026-03-31T10:24:17',
          period: '30d',
          points: [
            {
              freezerEnergy: 6,
              equipmentEnergy: 8,
              temperature: -19,
              occupancy: 62,
              timestamp: '2026-03-31T10:24:17',
            },
          ],
        },
      },
    },
    logistics: {
      hourlyProfile: {
        channel: 'lab',
        from: '2026-03-01T00:00:00',
        to: '2026-03-31T10:24:17',
        results: [],
      },
      currentBySensor: {
        channel: 'lab',
        from: '2026-03-01T00:00:00',
        to: '2026-03-31T10:24:17',
        results: [],
      },
    },
    business: {
      consumption: {
        channel: 'lab',
        from: '2026-03-01T00:00:00',
        to: '2026-03-31T10:24:17',
        results: [],
      },
      demandPeaks: {
        channel: 'lab',
        from: '2026-03-01T00:00:00',
        to: '2026-03-31T10:24:17',
        results: [],
      },
      electricalHealth: {
        channel: 'lab',
        from: '2026-03-01T00:00:00',
        to: '2026-03-31T10:24:17',
        results: [],
      },
    },
  };
}

async function writeJson(filePath: string, payload: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

describe('runtime service', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(path.join(os.tmpdir(), 'runtime-service-'));
    await writeJson(
      path.join(rootDir, 'src', 'data', 'backup', 'lab.snapshot.json'),
      createSnapshot(),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(rootDir, { force: true, recursive: true });
  });

  it('coalesces concurrent bootstrap refreshes and falls back to the last good snapshot', async () => {
    const lastGoodSnapshot = {
      ...createSnapshot(),
      generatedAt: '2026-04-10T10:00:00.000Z',
      source: 'last-good-runtime',
    };
    await writeJson(
      path.join(rootDir, '.runtime-cache', 'lab.snapshot.json'),
      lastGoodSnapshot,
    );

    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const service = createRuntimeService({
      rootDir,
      fetchImpl,
    });

    const [first, second] = await Promise.all([
      service.getBootstrapSnapshot('lab'),
      service.getBootstrapSnapshot('lab'),
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({
      snapshotStatus: 'last_good',
      snapshotSource: 'last-good-runtime',
      latestMeasurementAt: '2026-03-31T10:24:17',
      refreshError: 'offline',
      isSnapshotFreshEnough: false,
    });
    expect(second).toMatchObject({
      snapshotStatus: 'last_good',
      snapshotSource: 'last-good-runtime',
      refreshError: 'offline',
    });
  });

  it('probes the last 72h when the current 30-minute window is empty', async () => {
    const emptyWindow = {
      channel: 'lab',
      from: '2026-04-10T17:06:48',
      to: '2026-04-10T17:36:48',
      count: 0,
      measurements: [],
    };
    const probeWindow = {
      channel: 'lab',
      from: '2026-04-10T14:26:48',
      to: '2026-04-10T14:36:48',
      count: 3,
      measurements: [
        {
          channel: 'lab',
          sensor: 'fase1',
          apparent_power: 23.8,
          active_power: 23.2,
          reactive_power: 5.3,
          power_factor: 0.97,
          current: 0.18,
          voltage: 127.7,
          timestamp: '2026-04-10T14:36:48',
        },
        {
          channel: 'lab',
          sensor: 'fase2',
          apparent_power: 5.1,
          active_power: 1.2,
          reactive_power: 4.9,
          power_factor: 0.24,
          current: 0.04,
          voltage: 130.2,
          timestamp: '2026-04-10T14:36:48',
        },
        {
          channel: 'lab',
          sensor: 'fase3',
          apparent_power: 7.9,
          active_power: 6.1,
          reactive_power: 4.9,
          power_factor: 0.78,
          current: 0.06,
          voltage: 129.8,
          timestamp: '2026-04-10T14:36:48',
        },
      ],
    };
    const hydrateWindow = {
      ...probeWindow,
      from: '2026-04-10T14:06:48',
      to: '2026-04-10T14:36:48',
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(emptyWindow), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(probeWindow), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(hydrateWindow), { status: 200 }),
      );
    const service = createRuntimeService({
      rootDir,
      fetchImpl,
      probeOffsetsMinutes: [180],
    });

    const response = await service.getRecentMeasurements('lab', {
      shouldProbe: true,
      now: new Date('2026-04-10T20:36:48.000Z'),
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(response).toMatchObject({
      source: 'probed_window',
      anchorAt: '2026-04-10T14:36:48',
      probeWindow: {
        from: '2026-04-10T14:26:48',
        to: '2026-04-10T14:36:48',
      },
    });
    expect(response.measurements).toHaveLength(3);
  });

  it('returns one daily sample per day for the history endpoint', async () => {
    const measurementBundle = {
      channel: 'lab',
      count: 3,
      measurements: [
        {
          channel: 'lab',
          sensor: 'fase1',
          apparent_power: 23.8,
          active_power: 23.2,
          reactive_power: 5.3,
          power_factor: 0.97,
          current: 0.18,
          voltage: 127.7,
          timestamp: '2026-04-09T18:57:07',
        },
        {
          channel: 'lab',
          sensor: 'fase2',
          apparent_power: 5.1,
          active_power: 1.2,
          reactive_power: 4.9,
          power_factor: 0.24,
          current: 0.04,
          voltage: 130.2,
          timestamp: '2026-04-09T18:57:07',
        },
        {
          channel: 'lab',
          sensor: 'fase3',
          apparent_power: 7.9,
          active_power: 6.1,
          reactive_power: 4.9,
          power_factor: 0.78,
          current: 0.06,
          voltage: 129.8,
          timestamp: '2026-04-09T18:57:07',
        },
      ],
    };

    const fetchImpl = vi.fn(async (url: URL | string) => {
      const requestUrl = new URL(String(url));
      const fromTime = requestUrl.searchParams.get('from_time');
      const toTime = requestUrl.searchParams.get('to_time');

      if (
        fromTime === '2026-04-09T15:59:59' &&
        toTime === '2026-04-09T19:59:59'
      ) {
        return new Response(JSON.stringify(measurementBundle), { status: 200 });
      }

      if (
        fromTime === '2026-04-09T18:27:07' &&
        toTime === '2026-04-09T18:57:07'
      ) {
        return new Response(JSON.stringify(measurementBundle), { status: 200 });
      }

      return new Response(
        JSON.stringify({
          channel: 'lab',
          count: 0,
          measurements: [],
        }),
        { status: 200 },
      );
    });
    const service = createRuntimeService({
      rootDir,
      fetchImpl,
      historyProbeOffsetsMinutes: [240],
    });

    const response = await service.getHistory('lab', {
      days: 7,
      now: new Date('2026-04-10T20:36:48.000Z'),
    });

    expect(response.days).toBe(7);
    expect(response.samples).toHaveLength(7);
    expect(
      response.samples.find((sample) => sample.date === '2026-04-09'),
    ).toMatchObject({
      date: '2026-04-09',
      measurementAt: '2026-04-09T18:57:07',
    });
    expect(
      response.samples.filter((sample) => sample.measurements.length > 0),
    ).toHaveLength(1);
  });
});
