import type { User } from '../data/data-model';

export type BuiltInMagicLink = {
  path: '/desk' | '/lead' | '/wheel';
  token: string;
  userId: string;
};

const magicLinkTokenStorageKey = 'kid-a:magic-link:token';

export const builtInMagicLinks: BuiltInMagicLink[] = [
  { path: '/desk', token: 'sample-desk', userId: 'cia' },
  { path: '/wheel', token: 'sample-wheel', userId: 'flash' },
  { path: '/lead', token: 'sample-lead', userId: 'beny' },
];

export function getMagicLinkPath(user: User): BuiltInMagicLink['path'] {
  return user.role === 'lead'
    ? '/lead'
    : user.role === 'wheel'
      ? '/wheel'
      : '/desk';
}

export function createMagicLinkUrl(path: BuiltInMagicLink['path'], token: string) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const url = new URL(`${basePath}${path}`, window.location.origin);

  url.searchParams.set('token', token);

  return url.toString();
}

export function getStoredMagicLinkToken() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.sessionStorage.getItem(magicLinkTokenStorageKey) ?? undefined;
}

export function clearMagicLinkSession() {
  window.sessionStorage.removeItem(magicLinkTokenStorageKey);
}

export function initializeMagicLinkSession() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token')?.trim();

  if (!token) {
    return;
  }

  window.sessionStorage.setItem(magicLinkTokenStorageKey, token);
  url.searchParams.delete('token');
  window.history.replaceState(window.history.state, '', url);
}

export function resolveBuiltInMagicLink(token: string | undefined) {
  if (!token) {
    return undefined;
  }

  return builtInMagicLinks.find((magicLink) => magicLink.token === token);
}

export function magicLinkRequestHeaders(): Record<string, string> {
  const token = getStoredMagicLinkToken();

  return token ? { 'X-Access-Token': token } : {};
}
