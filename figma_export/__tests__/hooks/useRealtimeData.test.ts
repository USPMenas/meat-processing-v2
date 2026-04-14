import { renderHook, waitFor } from '@testing-library/react';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { cacheManager } from '@/services/cache/cacheManager';
import { getMeasurementCacheKey } from '@/services/cache/cacheKeys';
import type { ApiMeasurement } from '@/services/api/types';
import operationalExample from '../../analise-banco-de-dados/fixtures/useOperationalData-example.json';
import channelLabFixture from '../../analise-banco-de-dados/fixtures/channel-lab-1min.json';

function createMeasurement(
  sensor: string,
  activePower: number,
  current: number,
  timestamp: string,
): ApiMeasurement {
  return {
    channel: 'lab',
    sensor,
    apparent_power: activePower,
    active_power: activePower,
    reactive_power: 1,
    power_factor: 0.95,
    current,
    voltage: 128,
    timestamp,
  };
}

describe('useRealtimeData', () => {
  beforeEach(() => {
    cacheManager.clearAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cacheManager.clearAll();
  });

  it('returns operational data derived from cached measurements', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-07T12:00:00.000Z').getTime());
    cacheManager.set(getMeasurementCacheKey('lab'), channelLabFixture.measurements);

    const { result } = renderHook(() => useRealtimeData('lab'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.freezerEnergy).toBeCloseTo(
      operationalExample.derived.freezerEnergyKw,
      2,
    );
    expect(result.current.data?.equipmentEnergy).toBeCloseTo(
      operationalExample.derived.equipmentEnergyKw,
      2,
    );
    expect(
      Math.abs(
        (result.current.data?.temperature ?? 0) - operationalExample.derived.temperatureC,
      ),
    ).toBeLessThan(0.2);
    expect(result.current.data?.occupancy).toBeCloseTo(
      operationalExample.derived.occupancyPct,
      0,
    );
    expect(result.current.historical.length).toBeGreaterThan(0);
    expect(result.current.prediction).toEqual([]);
    expect(result.current.alerts).toHaveLength(0);
    expect(result.current.isStale).toBe(true);
  });

  it('generates alerts when thresholds are exceeded', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-07T12:00:30.000Z').getTime());
    cacheManager.set(getMeasurementCacheKey('lab'), [
      createMeasurement('fase1', 3, 0.2, '2026-04-07T12:00:00'),
      createMeasurement('fase2', 2, 0.2, '2026-04-07T12:00:00'),
      createMeasurement('fase3', 18, 0.08, '2026-04-07T12:00:00'),
    ]);

    const { result } = renderHook(() => useRealtimeData('lab'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.freezerEnergy).toBe(18);
    expect(result.current.data?.temperature).toBe(2);
    expect(result.current.isStale).toBe(false);
    expect(result.current.alerts.map((alert) => alert.variable)).toEqual(
      expect.arrayContaining(['Energia do Congelador', 'Ocupacao']),
    );
    expect(result.current.alerts.map((alert) => alert.variable)).not.toContain('Temperatura');
  });
});
