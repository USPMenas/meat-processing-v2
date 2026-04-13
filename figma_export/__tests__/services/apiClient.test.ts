import { ApiClient, ApiError } from '@/services/api/client';
import invalidFromTimeErrorFixture from '../../analise-banco-de-dados/fixtures/error-invalid-from-time-400.json';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it('joins internal base URLs without dropping the internal path segment', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const client = new ApiClient({
      baseUrl: '/internal/',
      fetchFn,
      retryDelaysMs: [],
    });

    await client.get('/recent/lab');

    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('/internal/recent/lab'),
      expect.any(Object),
    );
  });

  it('calls the global fetch through a safe wrapper instead of reusing it as a method', async () => {
    const contexts: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(function wrappedFetch(this: unknown) {
        contexts.push(this);

        if (this && this !== globalThis) {
          throw new Error('Illegal invocation');
        }

        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), { status: 200 }),
        );
      }),
    );

    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      retryDelaysMs: [],
    });

    await expect(client.get<{ ok: boolean }>('/metrics')).resolves.toEqual({ ok: true });
    expect(contexts).toHaveLength(1);
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
