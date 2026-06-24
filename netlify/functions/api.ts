import { connectLambda } from '@netlify/blobs';
import { createBlobMagicTokenStore, setMagicTokenStore } from '../../server/access-tokens.js';
import { handleApiRequest } from '../../server/api.js';
import { createBlobStore } from '../../server/blob-store.js';
import { createDbMagicTokenStore, createDbStore } from '../../server/db-store.js';
import { setStoreAdapter } from '../../server/store.js';

type NetlifyEvent = {
  blobs?: string;
  body?: string | null;
  headers?: Record<string, string | undefined>;
  httpMethod: string;
  rawUrl?: string;
  path: string;
};

function definedHeaders(headers: NetlifyEvent['headers']) {
  return Object.fromEntries(
    Object.entries(headers ?? {}).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

function configureStores() {
  const storeBackend = process.env.KID_A_STORE_BACKEND ?? 'blob';
  const tokenBackend = process.env.KID_A_TOKEN_BACKEND ?? storeBackend;

  if (storeBackend !== 'blob' && storeBackend !== 'db') {
    throw new Error('KID_A_STORE_BACKEND must be blob or db');
  }

  if (tokenBackend !== 'blob' && tokenBackend !== 'db') {
    throw new Error('KID_A_TOKEN_BACKEND must be blob or db');
  }

  setStoreAdapter(storeBackend === 'db' ? createDbStore() : createBlobStore());
  setMagicTokenStore(
    tokenBackend === 'db' ? createDbMagicTokenStore() : createBlobMagicTokenStore(),
  );
}

export async function handler(event: NetlifyEvent) {
  if (event.blobs) {
    connectLambda({
      blobs: event.blobs,
      headers: definedHeaders(event.headers),
    });
  }

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
