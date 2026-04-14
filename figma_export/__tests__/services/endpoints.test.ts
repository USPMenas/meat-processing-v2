import { createApiEndpoints } from '@/services/api/endpoints';

describe('api endpoints', () => {
  it('builds channel measurement requests with typed params', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ ok: true }),
    };
    const endpoints = createApiEndpoints(client as never);

    await endpoints.getChannelMeasurements(
      'main-channel',
      '2026-04-01T00:00:00.000Z',
      '2026-04-07T00:00:00.000Z',
    );

    expect(client.get).toHaveBeenCalledWith('/main-channel', {
      from_time: '2026-04-01T00:00:00',
      to_time: '2026-04-07T00:00:00',
    });
  });

  it('builds sensor measurement requests with encoded path segments', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ ok: true }),
    };
    const endpoints = createApiEndpoints(client as never);

    await endpoints.getSensorMeasurements(
      'main channel',
      'freezer sensor',
      '2026-04-01T00:00:00.000Z',
      '2026-04-07T00:00:00.000Z',
    );

    expect(client.get).toHaveBeenCalledWith('/main%20channel/freezer%20sensor', {
      from_time: '2026-04-01T00:00:00',
      to_time: '2026-04-07T00:00:00',
    });
  });

  it('builds analytics requests and omits empty params', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ ok: true }),
    };
    const endpoints = createApiEndpoints(client as never);

    await endpoints.getConsumption('main');
    await endpoints.getDemandPeaks('main', '2026-04-01T00:00:00.000Z', '2026-04-07T00:00:00.000Z');
    await endpoints.getElectricalHealth('main', '2026-04-01T00:00:00.000Z', '2026-04-07T00:00:00.000Z');
    await endpoints.getHourlyProfile('main', '2026-04-01T00:00:00.000Z', '2026-04-07T00:00:00.000Z');
    await endpoints.getCurrentBySensor('main', '2026-04-01T00:00:00.000Z', '2026-04-07T00:00:00.000Z');

    expect(client.get).toHaveBeenNthCalledWith(1, '/analytics/main/consumption', undefined);
    expect(client.get).toHaveBeenNthCalledWith(2, '/analytics/main/demand_peaks', {
      from_time: '2026-04-01T00:00:00',
      to_time: '2026-04-07T00:00:00',
    });
    expect(client.get).toHaveBeenNthCalledWith(3, '/analytics/main/electrical_health', {
      from_time: '2026-04-01T00:00:00',
      to_time: '2026-04-07T00:00:00',
    });
    expect(client.get).toHaveBeenNthCalledWith(4, '/analytics/main/hourly_profile', {
      from_time: '2026-04-01T00:00:00',
      to_time: '2026-04-07T00:00:00',
    });
    expect(client.get).toHaveBeenNthCalledWith(5, '/analytics/main/current_by_sensor', {
      from_time: '2026-04-01T00:00:00',
      to_time: '2026-04-07T00:00:00',
    });
  });
});
