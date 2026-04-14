const UPSTREAM_BASE_URL = 'http://143.107.102.8:8090';
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'host',
  'transfer-encoding',
]);

function getForwardPath(pathParam) {
  if (Array.isArray(pathParam)) {
    return pathParam.join('/');
  }

  if (typeof pathParam === 'string') {
    return pathParam;
  }

  return '';
}

function getTargetUrl(req) {
  const targetUrl = new URL(`${UPSTREAM_BASE_URL}/${getForwardPath(req.query.path)}`);
  const originalUrl = new URL(req.url, 'https://proxy.local');

  originalUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
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
  try {
    const upstreamResponse = await fetch(getTargetUrl(req), {
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
