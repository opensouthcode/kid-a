import type { UserRole } from '../data/data-model';

export type BuiltInMagicLink = {
  activityId?: number;
  path: '/desk' | '/lead' | '/wheel';
  role: UserRole;
  token: string;
};

const magicLinkTokenStorageKey = 'kid-a:magic-link:token';

export const builtInMagicLinks: BuiltInMagicLink[] = [
  { path: '/desk', role: 'desk', token: 'sample-desk' },
  { path: '/wheel', role: 'wheel', token: 'sample-wheel' },
];

export function getMagicLinkPath(role: UserRole): BuiltInMagicLink['path'] {
  return role === 'lead'
    ? '/lead'
    : role === 'wheel'
      ? '/wheel'
      : '/desk';
}

export function createBuiltInLeadMagicLink(activityId: number): BuiltInMagicLink {
  return {
    activityId,
    path: '/lead',
    role: 'lead',
    token: `sample-lead-${activityId}`,
  };
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

function getUrlMagicLinkToken() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const url = new URL(window.location.href);
  return url.searchParams.get('token')?.trim() || undefined;
}

export function getActiveMagicLinkToken() {
  return getUrlMagicLinkToken() ?? getStoredMagicLinkToken();
}

export function clearMagicLinkSession() {
  window.sessionStorage.removeItem(magicLinkTokenStorageKey);
}

export function initializeMagicLinkSession() {
  const url = new URL(window.location.href);
  const token = getUrlMagicLinkToken();

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

  const builtInMagicLink = builtInMagicLinks.find(
    (magicLink) => magicLink.token === token,
  );

  if (builtInMagicLink) {
    return builtInMagicLink;
  }

  const leadTokenMatch = token.match(/^sample-lead-(\d+)$/);
  const activityId = leadTokenMatch?.[1] ? Number(leadTokenMatch[1]) : undefined;

  return activityId ? createBuiltInLeadMagicLink(activityId) : undefined;
}

export function magicLinkRequestHeaders(): Record<string, string> {
  const token = getActiveMagicLinkToken();

  return token ? { 'X-Access-Token': token } : {};
}
