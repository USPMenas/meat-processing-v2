import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuntimeService } from './runtime-service.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const isDev = process.argv.includes('--dev');
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 5173);
const runtimeService = createRuntimeService({ rootDir });

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function getContentType(filePath) {
  if (filePath.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }

  if (filePath.endsWith('.js')) {
    return 'application/javascript; charset=utf-8';
  }

  if (filePath.endsWith('.json')) {
    return 'application/json; charset=utf-8';
  }

  if (filePath.endsWith('.svg')) {
    return 'image/svg+xml';
  }

  if (filePath.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }

  return 'application/octet-stream';
}

async function handleInternalRequest(request, response) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method !== 'GET' || !url.pathname.startsWith('/internal/')) {
    return false;
  }

  const [, , action, channel] = url.pathname.split('/');

  try {
    if (action === 'bootstrap' && channel) {
      const payload = await runtimeService.getBootstrapSnapshot(channel);
      sendJson(response, 200, payload);
      return true;
    }

    if (action === 'recent' && channel) {
      const lastKnownAt = url.searchParams.get('lastKnownAt');
      const shouldProbe = url.searchParams.get('probe') !== '0';
      const payload = await runtimeService.getRecentMeasurements(channel, {
        lastKnownAt,
        shouldProbe,
      });
      sendJson(response, 200, payload);
      return true;
    }

    if (action === 'history' && channel) {
      const days = Number(url.searchParams.get('days') ?? '7');
      const payload = await runtimeService.getHistory(channel, { days });
      sendJson(response, 200, payload);
      return true;
    }

    sendJson(response, 404, { detail: 'Internal route not found.' });
    return true;
  } catch (error) {
    sendJson(response, 500, {
      detail: error instanceof Error ? error.message : 'Internal service error.',
    });
    return true;
  }
}

async function createProdHandler() {
  const distDir = path.join(rootDir, 'dist');
  const indexPath = path.join(distDir, 'index.html');

  return async (request, response) => {
    if (await handleInternalRequest(request, response)) {
      return;
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const relativePath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const filePath = path.join(distDir, relativePath);

    try {
      const stat = await fs.stat(filePath).catch(() => null);
      const targetPath = stat?.isFile() ? filePath : indexPath;
      const body = await fs.readFile(targetPath);

      response.writeHead(200, {
        'Content-Type': getContentType(targetPath),
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  };
}

async function createDevHandler() {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: rootDir,
    appType: 'spa',
    server: {
      middlewareMode: true,
      host,
    },
  });

  return {
    async handle(request, response) {
      if (await handleInternalRequest(request, response)) {
        return;
      }

      await new Promise((resolve, reject) => {
        vite.middlewares(request, response, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
    async close() {
      await vite.close();
    },
  };
}

const devHandler = isDev ? await createDevHandler() : null;
const prodHandler = isDev ? null : await createProdHandler();

const server = http.createServer(async (request, response) => {
  try {
    if (devHandler) {
      await devHandler.handle(request, response);
      return;
    }

    await prodHandler(request, response);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({
        detail: error instanceof Error ? error.message : 'Unexpected server error.',
      }),
    );
  }
});

server.listen(port, host, () => {
  console.log(
    `[runtime] ${isDev ? 'dev' : 'prod'} server listening on http://${host}:${port}`,
  );
});

const shutdown = async () => {
  await devHandler?.close();
  server.close();
};

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
