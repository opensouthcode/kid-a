import { setMagicTokenStore } from '../../server/access-tokens.js';
import { handleApiRequest } from '../../server/api.js';
import { ensureDbInitialized } from '../../server/db-bootstrap.js';
import { createDbMagicTokenStore, createDbStore } from '../../server/db-store.js';
import { setStoreAdapter } from '../../server/store.js';

function configureStores() {
  setStoreAdapter(createDbStore());
  setMagicTokenStore(createDbMagicTokenStore());
}

export default async function handler(request: Request) {
  await ensureDbInitialized();
  configureStores();
  const response = await handleApiRequest({
    body: request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.text(),
    headers: Object.fromEntries(request.headers),
    method: request.method,
    url: request.url,
  });

  return new Response(response.body, {
    headers: response.headers,
    status: response.status,
  });
}

export const config = {
  path: '/api/*',
};
