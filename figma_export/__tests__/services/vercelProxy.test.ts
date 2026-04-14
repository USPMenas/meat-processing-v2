import handler, { buildTargetUrl, getForwardPath } from '../../api/index.js';

function createMockResponse() {
  const headers = new Map<string, string>();

  return {
    body: undefined as Buffer | string | undefined,
    headers,
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: Buffer) {
      this.body = payload;
      return this;
    },
    json(payload: unknown) {
      this.body = JSON.stringify(payload);
      return this;
    },
  };
}

describe('vercel proxy route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes forwarded paths from strings and arrays', () => {
    expect(getForwardPath('lab')).toBe('lab');
    expect(getForwardPath(['analytics', 'lab', 'consumption'])).toBe(
      'analytics/lab/consumption',
    );
    expect(getForwardPath('')).toBe('');
  });

  it('builds the upstream URL while preserving query params', () => {
    const targetUrl = buildTargetUrl({
      path: ['analytics', 'lab', 'consumption'],
      from_time: '2026-04-13T00:00:00',
      to_time: '2026-04-14T00:00:00',
    });

    expect(targetUrl?.toString()).toBe(
      'http://143.107.102.8:8090/analytics/lab/consumption?from_time=2026-04-13T00%3A00%3A00&to_time=2026-04-14T00%3A00%3A00',
    );
  });

  it('returns 400 JSON when the forwarded path is missing', async () => {
    const req = {
      method: 'GET',
      query: {},
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).toBe(JSON.stringify({ detail: 'Missing proxy path.' }));
  });

  it('forwards successful requests to the upstream path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const req = {
      method: 'GET',
      query: {
        path: 'lab',
        from_time: '2026-04-13T00:00:00',
        to_time: '2026-04-14T00:00:00',
      },
      headers: {
        accept: 'application/json',
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchSpy).toHaveBeenCalledWith(
      new URL(
        'http://143.107.102.8:8090/lab?from_time=2026-04-13T00%3A00%3A00&to_time=2026-04-14T00%3A00%3A00',
      ),
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
  });
});
