import { ApiClient, ApiError } from '@/services/api/client';
import invalidFromTimeErrorFixture from '../../analise-banco-de-dados/fixtures/error-invalid-from-time-400.json';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON when the request succeeds', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      fetchFn,
      retryDelaysMs: [],
    });

    await expect(client.get<{ ok: boolean }>('/metrics')).resolves.toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('uses a same-origin /api base path when configured with a relative prefix', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const client = new ApiClient({
      baseUrl: '/api',
      fetchFn,
      retryDelaysMs: [],
    });

    await expect(
      client.get<{ ok: boolean }>('/lab', {
        from_time: '2026-04-13T19:49:41',
        to_time: '2026-04-13T20:49:41',
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchFn).toHaveBeenCalledWith(
      new URL(
        '/api/lab?from_time=2026-04-13T19%3A49%3A41&to_time=2026-04-13T20%3A49%3A41',
        window.location.origin,
      ).toString(),
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }),
    );
  });

  it('preserves analytics routes under the same-origin /api prefix', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    const client = new ApiClient({
      baseUrl: '/api',
      fetchFn,
      retryDelaysMs: [],
    });

    await expect(
      client.get<{ results: unknown[] }>('/analytics/lab/consumption', {
        from_time: '2026-04-12T19:49:41',
        to_time: '2026-04-13T20:49:41',
      }),
    ).resolves.toEqual({ results: [] });

    expect(fetchFn).toHaveBeenCalledWith(
      new URL(
        '/api/analytics/lab/consumption?from_time=2026-04-12T19%3A49%3A41&to_time=2026-04-13T20%3A49%3A41',
        window.location.origin,
      ).toString(),
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('falls back to the same-origin proxy when an insecure absolute base URL is injected on HTTPS pages', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: new URL('https://meat-processing-v2.vercel.app/'),
      configurable: true,
    });
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const client = new ApiClient({
      baseUrl: 'http://143.107.102.8:8090',
      fetchFn,
      retryDelaysMs: [],
    });

    await expect(client.get<{ ok: boolean }>('/lab')).resolves.toEqual({ ok: true });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://meat-processing-v2.vercel.app/api/lab',
      expect.objectContaining({
        method: 'GET',
      }),
    );

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
    });
  });

  it('does not retry when a 200 response contains HTML instead of JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response('<!DOCTYPE html><html><body>swagger</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new ApiClient({
      baseUrl: '/api',
      fetchFn,
      sleep,
      retryDelaysMs: [1000, 2000],
    });

    await expect(client.get('/lab')).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
      endpoint: '/lab',
      message: expect.stringContaining('text/html; charset=utf-8'),
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries with exponential backoff and eventually succeeds', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 42 }), { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      fetchFn,
      sleep,
      retryDelaysMs: [1000, 2000, 4000],
    });

    await expect(client.get<{ value: number }>('/retry')).resolves.toEqual({ value: 42 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('throws ApiError on timeout', async () => {
    const fetchFn = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      fetchFn,
      timeout: 5,
      retryDelaysMs: [],
    });

    await expect(client.get('/timeout')).rejects.toMatchObject({
      name: 'ApiError',
      status: 408,
      endpoint: '/timeout',
    });
  });

  it('does not retry non-retryable HTTP errors', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(invalidFromTimeErrorFixture), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      fetchFn,
      sleep,
      retryDelaysMs: [1000, 2000, 4000],
    });

    await expect(client.get('/bad-request')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      endpoint: '/bad-request',
      message: invalidFromTimeErrorFixture.detail,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
