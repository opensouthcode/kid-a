import { createServer, type IncomingMessage } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setMagicTokenStore } from './access-tokens.js';
import { handleApiRequest, isApiPath } from './api.js';
import { ensureDbInitialized } from './db-bootstrap.js';
import { createDbMagicTokenStore, createDbStore } from './db-store.js';
import { setStoreAdapter } from './store.js';

const port = Number(process.env.PORT ?? 3000);
const distDir = path.resolve(process.env.KID_A_DIST_DIR ?? 'dist');
const currentFilePath = fileURLToPath(import.meta.url);
const serverRoot = path.dirname(currentFilePath);

setStoreAdapter(createDbStore());
setMagicTokenStore(createDbMagicTokenStore());
await ensureDbInitialized();

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

function resolveStaticPath(requestPath: string) {
  const decodedPath = decodeURIComponent(requestPath);
  const withoutBasePath = decodedPath.startsWith('/kid-a/')
    ? decodedPath.slice('/kid-a'.length)
    : decodedPath;
  const normalizedPath = withoutBasePath === '/kid-a' ? '/' : withoutBasePath;
  const relativePath = normalizedPath === '/' ? 'index.html' : `.${normalizedPath}`;
  const resolvedPath = path.resolve(distDir, relativePath);

  if (resolvedPath !== distDir && !resolvedPath.startsWith(`${distDir}${path.sep}`)) {
    return path.join(distDir, 'index.html');
  }

  return resolvedPath;
}

async function getStaticFile(requestPath: string) {
  const requestedFile = resolveStaticPath(requestPath);

  try {
    const fileStat = await stat(requestedFile);

    if (fileStat.isFile()) {
      return requestedFile;
    }
  } catch {
    // Fall through to the SPA entry point.
  }

  return path.join(distDir, 'index.html');
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', 'http://kid-a.local');

  if (isApiPath(requestUrl.pathname)) {
    const apiResponse = await handleApiRequest({
      body: await readRequestBody(request),
      headers: request.headers,
      method: request.method ?? 'GET',
      url: request.url ?? '/',
    });

    response.writeHead(apiResponse.status, apiResponse.headers);
    response.end(apiResponse.body);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Method not allowed');
    return;
  }

  try {
    const staticFile = await getStaticFile(requestUrl.pathname);
    const content = request.method === 'HEAD' ? undefined : await readFile(staticFile);
    const contentType =
      mimeTypes[path.extname(staticFile)] ?? 'application/octet-stream';

    response.writeHead(200, { 'Content-Type': contentType });
    response.end(content);
  } catch (error) {
    console.error(error);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Unable to serve application');
  }
});

server.listen(port, () => {
  console.log(
    `Kid-A Node server listening on http://localhost:${port} (${serverRoot})`,
  );
});
