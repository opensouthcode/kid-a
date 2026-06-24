import { connectLambda } from '@netlify/blobs';
import { createBlobMagicTokenStore, setMagicTokenStore } from '../../server/access-tokens.js';
import { handleApiRequest } from '../../server/api.js';
import { createBlobStore } from '../../server/blob-store.js';
import { createDbMagicTokenStore, createDbStore } from '../../server/db-store.js';
import { createDualMagicTokenStore, createDualStore } from '../../server/dual-store.js';
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
  const storeRead = process.env.KID_A_STORE_READ ?? 'blob';
  const strictDualWrites = process.env.KID_A_DUAL_WRITE_STRICT !== 'false';

  if (storeBackend !== 'blob' && storeBackend !== 'db' && storeBackend !== 'dual') {
    throw new Error('KID_A_STORE_BACKEND must be blob, db, or dual');
  }

  if (storeRead !== 'blob' && storeRead !== 'db') {
    throw new Error('KID_A_STORE_READ must be blob or db');
  }

  if (storeBackend === 'dual') {
    const blobStore = createBlobStore();
    const dbStore = createDbStore();
    const blobTokenStore = createBlobMagicTokenStore();
    const dbTokenStore = createDbMagicTokenStore();
    const primary = storeRead === 'db' ? dbStore : blobStore;
    const secondary = storeRead === 'db' ? blobStore : dbStore;
    const primaryTokenStore = storeRead === 'db' ? dbTokenStore : blobTokenStore;
    const secondaryTokenStore = storeRead === 'db' ? blobTokenStore : dbTokenStore;

    setStoreAdapter(
      createDualStore({ primary, secondary, strict: strictDualWrites }),
    );
    setMagicTokenStore(
      createDualMagicTokenStore({
        primary: primaryTokenStore,
        secondary: secondaryTokenStore,
        strict: strictDualWrites,
      }),
    );
    return;
  }

  setStoreAdapter(storeBackend === 'db' ? createDbStore() : createBlobStore());
  setMagicTokenStore(
    storeBackend === 'db' ? createDbMagicTokenStore() : createBlobMagicTokenStore(),
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
