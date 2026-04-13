import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_CHANNEL = 'lab';
const DEFAULT_UPSTREAM_BASE_URL =
  process.env.API_SOURCE_BASE_URL?.trim() || 'http://143.107.102.8:8090';
const DEFAULT_BACKUP_TIMEOUT_MS = 180_000;
const DEFAULT_RUNTIME_CACHE_DIR = '.runtime-cache';
const DEFAULT_RECENT_WINDOW_MINUTES = 30;
const DEFAULT_PROBE_WINDOW_MINUTES = 10;
const DEFAULT_PROBE_OFFSETS_MINUTES = Object.freeze([
  30, 60, 120, 180, 240, 360, 480, 720, 1080, 1440, 2160, 2880, 3600, 4320,
]);
const DEFAULT_HISTORY_PROBE_WINDOW_MINUTES = 240;
const DEFAULT_HISTORY_PROBE_OFFSETS_MINUTES = Object.freeze([
  0, 240, 480, 720, 960, 1200,
]);
const DEFAULT_HISTORY_HYDRATE_WINDOW_MINUTES = 30;
const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
const DEFAULT_SNAPSHOT_FRESHNESS_THRESHOLD_HOURS = 72;
const NAIVE_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/;
const timeZoneFormatterCache = new Map();

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function subtractMinutes(date, minutes) {
  return addMinutes(date, -minutes);
}

function roundTo(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function parseNaiveTimestamp(value) {
  const match = NAIVE_TIMESTAMP_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid naive timestamp "${value}"`);
  }

  const [, year, month, day, hour, minute, second, milliseconds = '0'] = match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(milliseconds.padEnd(3, '0')),
    ),
  );
}

function formatNaiveTimestamp(date) {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-') +
    'T' +
    [
      String(date.getUTCHours()).padStart(2, '0'),
      String(date.getUTCMinutes()).padStart(2, '0'),
      String(date.getUTCSeconds()).padStart(2, '0'),
    ].join(':');
}

function formatDayKey(date) {
  return formatNaiveTimestamp(date).slice(0, 10);
}

function shiftDayKey(dayKey, amount) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount, 0, 0, 0));
  return [
    String(shifted.getUTCFullYear()).padStart(4, '0'),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function getTimeZoneFormatter(timeZone) {
  if (!timeZoneFormatterCache.has(timeZone)) {
    timeZoneFormatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
    );
  }

  return timeZoneFormatterCache.get(timeZone);
}

function formatZonedNaiveTimestamp(date, timeZone) {
  const formatter = getTimeZoneFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${lookup.year}-${lookup.month}-${lookup.day}T${lookup.hour}:${lookup.minute}:${lookup.second}`;
}

function latestMeasurementTimestamp(measurements) {
  if (!Array.isArray(measurements) || measurements.length === 0) {
    return null;
  }

  return measurements.reduce((latest, current) => {
    return current.timestamp > latest ? current.timestamp : latest;
  }, measurements[0].timestamp);
}

function createChannelUrl(baseUrl, channel, fromTime, toTime) {
  const url = new URL(`${encodeURIComponent(channel)}`, `${baseUrl}/`);
  url.searchParams.set('from_time', fromTime);
  url.searchParams.set('to_time', toTime);
  return url;
}

function safeErrorMessage(error) {
  return error instanceof Error ? error.message : 'Erro desconhecido.';
}

function hasNonEmptyHistory(snapshot, period) {
  return (
    Array.isArray(snapshot?.operational?.histories?.[period]?.points) &&
    snapshot.operational.histories[period].points.length > 0
  );
}

function isValidSnapshot(snapshot) {
  return (
    snapshot &&
    typeof snapshot.latestMeasurementAt === 'string' &&
    Array.isArray(snapshot.operational?.recentMeasurements) &&
    snapshot.operational.recentMeasurements.length > 0 &&
    hasNonEmptyHistory(snapshot, '24h') &&
    hasNonEmptyHistory(snapshot, '7d') &&
    hasNonEmptyHistory(snapshot, '30d')
  );
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJsonFile(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function downloadBackup(fetchImpl, url, outputPath, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Backup download failed with status ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, buffer);
  } finally {
    clearTimeout(timeoutId);
  }
}

function runSnapshotGenerator(pythonBinary, scriptPath, dbPath, outputDir) {
  return new Promise((resolve, reject) => {
    const processHandle = spawn(
      pythonBinary,
      [scriptPath, '--db', dbPath, '--output-dir', outputDir],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stderr = '';

    processHandle.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    processHandle.on('error', reject);
    processHandle.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `Snapshot generator failed with code ${code}`));
    });
  });
}

export function createRuntimeService(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const upstreamBaseUrl = (options.upstreamBaseUrl ?? DEFAULT_UPSTREAM_BASE_URL).replace(
    /\/$/,
    '',
  );
  const fetchImpl = options.fetchImpl ?? fetch;
  const pythonBinary = options.pythonBinary ?? process.env.PYTHON_BIN ?? 'python';
  const backupTimeoutMs = options.backupTimeoutMs ?? DEFAULT_BACKUP_TIMEOUT_MS;
  const channel = options.channel ?? DEFAULT_CHANNEL;
  const recentWindowMinutes =
    options.recentWindowMinutes ?? DEFAULT_RECENT_WINDOW_MINUTES;
  const probeWindowMinutes =
    options.probeWindowMinutes ?? DEFAULT_PROBE_WINDOW_MINUTES;
  const probeOffsetsMinutes =
    options.probeOffsetsMinutes ?? DEFAULT_PROBE_OFFSETS_MINUTES;
  const historyProbeWindowMinutes =
    options.historyProbeWindowMinutes ?? DEFAULT_HISTORY_PROBE_WINDOW_MINUTES;
  const historyProbeOffsetsMinutes =
    options.historyProbeOffsetsMinutes ?? DEFAULT_HISTORY_PROBE_OFFSETS_MINUTES;
  const historyHydrateWindowMinutes =
    options.historyHydrateWindowMinutes ?? DEFAULT_HISTORY_HYDRATE_WINDOW_MINUTES;
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const snapshotFreshnessThresholdHours =
    options.snapshotFreshnessThresholdHours ??
    DEFAULT_SNAPSHOT_FRESHNESS_THRESHOLD_HOURS;
  const runtimeCacheDir = path.join(
    rootDir,
    options.runtimeCacheDir ?? DEFAULT_RUNTIME_CACHE_DIR,
  );
  const bundledSnapshotPath =
    options.bundledSnapshotPath ??
    path.join(rootDir, 'src', 'data', 'backup', `${channel}.snapshot.json`);
  const lastGoodSnapshotPath = path.join(runtimeCacheDir, `${channel}.snapshot.json`);
  const snapshotGeneratorPath =
    options.snapshotGeneratorPath ??
    path.join(rootDir, 'scripts', 'generate_backup_snapshot.py');
  const refreshPromises = new Map();

  async function loadBundledSnapshot() {
    return readJsonFile(bundledSnapshotPath);
  }

  async function loadLastGoodSnapshot() {
    if (!(await exists(lastGoodSnapshotPath))) {
      return null;
    }

    return readJsonFile(lastGoodSnapshotPath);
  }

  async function saveLastGoodSnapshot(snapshot) {
    await writeJsonFile(lastGoodSnapshotPath, snapshot);
  }

  function buildBootstrapPayload({
    snapshot,
    snapshotStatus,
    message,
    refreshAttemptedAt,
    refreshFinishedAt,
    refreshDurationMs,
    refreshError,
  }) {
    const nowNaive = parseNaiveTimestamp(
      formatZonedNaiveTimestamp(new Date(), timeZone),
    );
    const latestMeasurementAt =
      typeof snapshot.latestMeasurementAt === 'string'
        ? snapshot.latestMeasurementAt
        : null;
    const snapshotAgeHours = latestMeasurementAt
      ? roundTo(
          Math.max(
            0,
            (nowNaive.getTime() - parseNaiveTimestamp(latestMeasurementAt).getTime()) /
              3_600_000,
          ),
          2,
        )
      : null;
    const isSnapshotFreshEnough =
      snapshotAgeHours !== null
        ? snapshotAgeHours <= snapshotFreshnessThresholdHours
        : false;

    return {
      channel,
      snapshot,
      snapshotStatus,
      snapshotGeneratedAt: snapshot.generatedAt,
      snapshotSource: snapshot.source,
      latestMeasurementAt: snapshot.latestMeasurementAt,
      refreshAttemptedAt,
      refreshFinishedAt,
      refreshDurationMs,
      refreshError,
      snapshotAgeHours,
      isSnapshotFreshEnough,
      message,
    };
  }

  async function renewSnapshot() {
    const tempId = randomUUID();
    const tempDbPath = path.join(runtimeCacheDir, `${channel}-${tempId}.db`);
    const tempOutputDir = path.join(runtimeCacheDir, `snapshot-${tempId}`);
    const refreshAttemptedAt = new Date().toISOString();
    const refreshStartedAt = Date.now();

    try {
      await downloadBackup(
        fetchImpl,
        `${upstreamBaseUrl}/backup/download`,
        tempDbPath,
        backupTimeoutMs,
      );
      await runSnapshotGenerator(
        pythonBinary,
        snapshotGeneratorPath,
        tempDbPath,
        tempOutputDir,
      );

      const snapshot = await readJsonFile(
        path.join(tempOutputDir, `${channel}.snapshot.json`),
      );

      if (!isValidSnapshot(snapshot)) {
        throw new Error(
          'O snapshot gerado ficou incompleto e nao pode substituir o baseline.',
        );
      }

      await saveLastGoodSnapshot(snapshot);

      return buildBootstrapPayload({
        snapshot,
        snapshotStatus: 'renewed',
        refreshAttemptedAt,
        refreshFinishedAt: new Date().toISOString(),
        refreshDurationMs: Date.now() - refreshStartedAt,
        refreshError: null,
        message: `Backup renovado com sucesso. Ultimo dado do snapshot: ${snapshot.latestMeasurementAt}.`,
      });
    } catch (error) {
      const refreshError = safeErrorMessage(error);
      const refreshFinishedAt = new Date().toISOString();
      const refreshDurationMs = Date.now() - refreshStartedAt;
      const lastGoodSnapshot = await loadLastGoodSnapshot();

      if (lastGoodSnapshot) {
        return buildBootstrapPayload({
          snapshot: lastGoodSnapshot,
          snapshotStatus: 'last_good',
          refreshAttemptedAt,
          refreshFinishedAt,
          refreshDurationMs,
          refreshError,
          message: `Falha ao renovar o backup; usando o ultimo snapshot bom. ${refreshError}`,
        });
      }

      const bundledSnapshot = await loadBundledSnapshot();
      return buildBootstrapPayload({
        snapshot: bundledSnapshot,
        snapshotStatus: 'bundled',
        refreshAttemptedAt,
        refreshFinishedAt,
        refreshDurationMs,
        refreshError,
        message: `Falha ao renovar o backup; usando o snapshot empacotado. ${refreshError}`,
      });
    } finally {
      await fs.rm(tempDbPath, { force: true }).catch(() => undefined);
      await fs.rm(tempOutputDir, { force: true, recursive: true }).catch(() => undefined);
    }
  }

  async function getBootstrapSnapshot(requestedChannel) {
    if (requestedChannel !== channel) {
      throw new Error(`Unsupported channel "${requestedChannel}"`);
    }

    const refreshKey = requestedChannel;
    if (!refreshPromises.has(refreshKey)) {
      refreshPromises.set(
        refreshKey,
        renewSnapshot().finally(() => {
          refreshPromises.delete(refreshKey);
        }),
      );
    }

    return refreshPromises.get(refreshKey);
  }

  async function getChannelMeasurements(fromTime, toTime) {
    return fetchJson(
      fetchImpl,
      createChannelUrl(upstreamBaseUrl, channel, fromTime, toTime),
      backupTimeoutMs,
    );
  }

  async function getRecentMeasurements(requestedChannel, options = {}) {
    if (requestedChannel !== channel) {
      throw new Error(`Unsupported channel "${requestedChannel}"`);
    }

    const now = options.now ?? new Date();
    const lastKnownAt = options.lastKnownAt ?? null;
    const shouldProbe = options.shouldProbe ?? true;
    const checkedAt = now.toISOString();
    const currentNaive = parseNaiveTimestamp(formatZonedNaiveTimestamp(now, timeZone));
    const recentWindow = {
      from: formatNaiveTimestamp(
        subtractMinutes(currentNaive, recentWindowMinutes),
      ),
      to: formatNaiveTimestamp(currentNaive),
    };
    const recentResponse = await getChannelMeasurements(
      recentWindow.from,
      recentWindow.to,
    );

    if (recentResponse.measurements.length > 0) {
      const anchorAt = latestMeasurementTimestamp(recentResponse.measurements);
      return {
        channel,
        measurements: recentResponse.measurements,
        anchorAt,
        checkedAt,
        probeWindow: recentWindow,
        source: 'recent_window',
        message: `Dados recentes encontrados em ${anchorAt}.`,
      };
    }

    if (!shouldProbe) {
      return {
        channel,
        measurements: [],
        anchorAt: lastKnownAt,
        checkedAt,
        probeWindow: recentWindow,
        source: 'empty',
        message: 'Nenhum dado novo encontrado na janela recente.',
      };
    }

    for (const offsetMinutes of probeOffsetsMinutes) {
      const probeEnd = subtractMinutes(currentNaive, offsetMinutes);
      const probeWindow = {
        from: formatNaiveTimestamp(subtractMinutes(probeEnd, probeWindowMinutes)),
        to: formatNaiveTimestamp(probeEnd),
      };
      const probeResponse = await getChannelMeasurements(
        probeWindow.from,
        probeWindow.to,
      );

      if (probeResponse.measurements.length === 0) {
        continue;
      }

      const anchorAt = latestMeasurementTimestamp(probeResponse.measurements);
      const anchorDate = parseNaiveTimestamp(anchorAt);
      const hydrateWindow = {
        from: formatNaiveTimestamp(
          subtractMinutes(anchorDate, recentWindowMinutes),
        ),
        to: anchorAt,
      };
      const hydrateResponse = await getChannelMeasurements(
        hydrateWindow.from,
        hydrateWindow.to,
      );

      return {
        channel,
        measurements:
          hydrateResponse.measurements.length > 0
            ? hydrateResponse.measurements
            : probeResponse.measurements,
        anchorAt,
        checkedAt,
        probeWindow,
        source: 'probed_window',
        message: `Dados recentes encontrados em ${anchorAt} apos busca retroativa.`,
      };
    }

    return {
      channel,
      measurements: [],
      anchorAt: lastKnownAt,
      checkedAt,
      probeWindow: null,
      source: 'empty',
      message: 'Sem dados novos nas ultimas 72 horas.',
    };
  }

  async function getHistory(requestedChannel, options = {}) {
    if (requestedChannel !== channel) {
      throw new Error(`Unsupported channel "${requestedChannel}"`);
    }

    const days = Number(options.days ?? 7);
    if (days !== 7 && days !== 30) {
      throw new Error(`Unsupported history window "${days}"`);
    }

    const now = options.now ?? new Date();
    const checkedAt = now.toISOString();
    const currentNaive = parseNaiveTimestamp(formatZonedNaiveTimestamp(now, timeZone));
    const todayKey = formatDayKey(currentNaive);
    const samples = [];

    async function getDailySample(dayKey) {
      const dayStart = parseNaiveTimestamp(`${dayKey}T00:00:00`);
      const dayEnd =
        dayKey === todayKey
          ? currentNaive
          : parseNaiveTimestamp(`${dayKey}T23:59:59`);

      for (const offsetMinutes of historyProbeOffsetsMinutes) {
        const probeEnd = subtractMinutes(dayEnd, offsetMinutes);
        if (probeEnd.getTime() < dayStart.getTime()) {
          continue;
        }

        const probeStartCandidate = subtractMinutes(
          probeEnd,
          historyProbeWindowMinutes,
        );
        const probeStart =
          probeStartCandidate.getTime() < dayStart.getTime()
            ? dayStart
            : probeStartCandidate;
        const probeResponse = await getChannelMeasurements(
          formatNaiveTimestamp(probeStart),
          formatNaiveTimestamp(probeEnd),
        );

        if (probeResponse.measurements.length === 0) {
          continue;
        }

        const measurementAt = latestMeasurementTimestamp(probeResponse.measurements);
        const measurementDate = parseNaiveTimestamp(measurementAt);
        const hydrateStartCandidate = subtractMinutes(
          measurementDate,
          historyHydrateWindowMinutes,
        );
        const hydrateStart =
          hydrateStartCandidate.getTime() < dayStart.getTime()
            ? dayStart
            : hydrateStartCandidate;
        const hydrateResponse = await getChannelMeasurements(
          formatNaiveTimestamp(hydrateStart),
          measurementAt,
        );

        return {
          date: dayKey,
          measurementAt,
          measurements:
            hydrateResponse.measurements.length > 0
              ? hydrateResponse.measurements
              : probeResponse.measurements,
        };
      }

      return {
        date: dayKey,
        measurementAt: null,
        measurements: [],
      };
    }

    for (let index = days - 1; index >= 0; index -= 1) {
      const dayKey = shiftDayKey(todayKey, -index);
      samples.push(await getDailySample(dayKey));
    }

    const daysWithData = samples.filter((sample) => sample.measurements.length > 0).length;

    return {
      channel,
      days,
      resolution: 'day',
      checkedAt,
      samples,
      message:
        daysWithData > 0
          ? `Historico diario atualizado com dados reais em ${daysWithData} de ${days} dias.`
          : `Nenhuma amostra diaria foi encontrada nos ultimos ${days} dias.`,
    };
  }

  return {
    getBootstrapSnapshot,
    getRecentMeasurements,
    getHistory,
  };
}

export {
  DEFAULT_HISTORY_PROBE_OFFSETS_MINUTES,
  DEFAULT_PROBE_OFFSETS_MINUTES,
};
