const UPSTREAM_BASE_URL = 'http://143.107.102.8:8090';
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'host',
  'transfer-encoding',
]);

export function getForwardPath(pathParam) {
  const pathValue = Array.isArray(pathParam) ? pathParam.join('/') : pathParam;

  if (typeof pathValue !== 'string') {
    return '';
  }

  return pathValue
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join('/');
}

export function buildTargetUrl(query = {}) {
  const forwardPath = getForwardPath(query.path);

  if (!forwardPath) {
    return null;
  }

  const targetUrl = new URL(`${UPSTREAM_BASE_URL}/${forwardPath}`);

  Object.entries(query).forEach(([key, value]) => {
    if (key === 'path' || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        targetUrl.searchParams.append(key, String(entry));
      });
      return;
    }

    targetUrl.searchParams.append(key, String(value));
  });

  return targetUrl;
}

async function readRequestBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return undefined;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

function copyHeaders(sourceHeaders, res) {
  sourceHeaders.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      return;
    }

    res.setHeader(key, value);
  });
}

function buildForwardHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).flatMap(([key, value]) => {
      if (HOP_BY_HOP_HEADERS.has(key.toLowerCase()) || value === undefined) {
        return [];
      }

      if (Array.isArray(value)) {
        return [[key, value.join(', ')]];
      }

      return [[key, value]];
    }),
  );
}

export default async function handler(req, res) {
  const targetUrl = buildTargetUrl(req.query ?? {});

  if (!targetUrl) {
    res.status(400).json({
      detail: 'Missing proxy path.',
    });
    return;
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers: buildForwardHeaders(req.headers),
      body: await readRequestBody(req),
      redirect: 'follow',
    });

    copyHeaders(upstreamResponse.headers, res);
    res.setHeader('cache-control', 'no-store');
    res.status(upstreamResponse.status).send(Buffer.from(await upstreamResponse.arrayBuffer()));
  } catch (error) {
    res.status(502).json({
      detail:
        error instanceof Error
          ? `Proxy request failed: ${error.message}`
          : 'Proxy request failed.',
    });
  }
}
