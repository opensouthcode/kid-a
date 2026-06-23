import { connectLambda } from '@netlify/blobs';
import { createBlobMagicTokenStore, setMagicTokenStore } from '../../server/access-tokens.js';
import { handleApiRequest } from '../../server/api.js';
import { createBlobStore } from '../../server/blob-store.js';
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

export async function handler(event: NetlifyEvent) {
  if (event.blobs) {
    connectLambda({
      blobs: event.blobs,
      headers: definedHeaders(event.headers),
    });
  }

  setStoreAdapter(createBlobStore());
  setMagicTokenStore(createBlobMagicTokenStore());
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
