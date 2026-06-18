type NetlifyEvent = {
  body?: string | null;
  headers?: Record<string, string | undefined>;
  httpMethod: string;
  rawUrl?: string;
  path: string;
};

export async function handler(event: NetlifyEvent) {
  process.env.KID_A_DATA_DIR ??= '/tmp/kid-a-data';

  const { handleApiRequest } = await import('../../server/api.js');
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
