import { setMagicTokenStore } from '../../server/access-tokens.js';
import { handleApiRequest } from '../../server/api.js';
import { ensureDbInitialized } from '../../server/db-bootstrap.js';
import { createDbMagicTokenStore, createDbStore } from '../../server/db-store.js';
import { setStoreAdapter } from '../../server/store.js';

type NetlifyEvent = {
  body?: string | null;
  headers?: Record<string, string | undefined>;
  httpMethod: string;
  rawUrl?: string;
  path: string;
};

function configureStores() {
  setStoreAdapter(createDbStore());
  setMagicTokenStore(createDbMagicTokenStore());
}

export async function handler(event: NetlifyEvent) {
  await ensureDbInitialized();
  configureStores();
  const response = await handleApiRequest({
    body: event.body,
    headers: event.headers,
    method: event.httpMethod,
    url: event.rawUrl ?? event.path,
  });

  return {
    body: response.body,
    headers: response.headers,
    statusCode: response.status,
  };
}
