import { useEffect, useState } from 'react';
import { API_CONFIG } from '../config/api';
import { SENSOR_MAP } from '../config/channels';
import { DEFAULT_OCCUPANCY_CONFIG, DEFAULT_TEMPERATURE_CONFIG } from '../domain/constants/dashboard';
import { DEFAULT_THRESHOLD_CONFIG } from '../domain/constants/thresholds';
import { checkAlerts } from '../domain/transformers/alertTransformer';
import { buildOperationalSeries, getLatestElectricalSnapshot } from '../domain/transformers/operationalSeriesTransformer';
import type { Alert, OperationalData } from '../domain/types';
import { getCachedMeasurements } from '../services/cache/cacheSelectors';
import { getMeasurementCacheKey } from '../services/cache/cacheKeys';
import { subscribeToCacheUpdates } from '../services/cache/cacheEvents';

export function useRealtimeData(channel: string): {
  data: OperationalData | null;
  historical: OperationalData[];
  prediction: OperationalData[];
  alerts: Alert[];
  isLoading: boolean;
  isStale: boolean;
} {
  const [state, setState] = useState({
    data: null as OperationalData | null,
    historical: [] as OperationalData[],
    prediction: [] as OperationalData[],
    alerts: [] as Alert[],
    isLoading: true,
    isStale: true,
  });

  useEffect(() => {
    const loadFromCache = () => {
      const measurements = getCachedMeasurements(channel);

      if (measurements.length === 0) {
        setState({
          data: null,
          historical: [],
          prediction: [],
          alerts: [],
          isLoading: false,
          isStale: true,
        });
        return;
      }

      const series = buildOperationalSeries(
        measurements,
        { ...SENSOR_MAP },
        { ...DEFAULT_TEMPERATURE_CONFIG },
        { ...DEFAULT_OCCUPANCY_CONFIG },
      );
      const latest = series[series.length - 1] ?? null;
      const historicalCutoff = latest
        ? latest.timestamp.getTime() - 60 * 60 * 1000
        : Date.now() - 60 * 60 * 1000;
      const historical = series.filter((entry) => entry.timestamp.getTime() >= historicalCutoff);
      const electricalSnapshot = getLatestElectricalSnapshot(measurements);
      const alerts = latest
        ? checkAlerts(
            {
              temperature: latest.temperature,
              freezerEnergy: latest.freezerEnergy,
              occupancy: latest.occupancy,
              voltage: electricalSnapshot.voltage,
              powerFactor: electricalSnapshot.powerFactor,
            },
            { ...DEFAULT_THRESHOLD_CONFIG },
          )
        : [];

      setState({
        data: latest,
        historical,
        prediction: [],
        alerts,
        isLoading: false,
        isStale: latest ? Date.now() - latest.timestamp.getTime() > API_CONFIG.staleAfterMs : true,
      });
    };

    loadFromCache();

    return subscribeToCacheUpdates((detail) => {
      if (detail.key === getMeasurementCacheKey(channel)) {
        loadFromCache();
      }
    });
  }, [channel]);

  return state;
}
