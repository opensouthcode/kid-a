import type { MessageKey } from './i18n/messages';

export type AppRoute = {
  path: string;
  titleKey: MessageKey;
  roleKey: MessageKey;
  descriptionKey: MessageKey;
};

export const appRoutes: AppRoute[] = [
  {
    path: '/',
    titleKey: 'routes.home.title',
    roleKey: 'routes.home.role',
    descriptionKey: 'routes.home.description',
  },
  {
    path: '/kid',
    titleKey: 'routes.kid.title',
    roleKey: 'routes.kid.role',
    descriptionKey: 'routes.kid.description',
  },
  {
    path: '/registration',
    titleKey: 'routes.registration.title',
    roleKey: 'routes.registration.role',
    descriptionKey: 'routes.registration.description',
  },
  {
    path: '/wheel',
    titleKey: 'routes.wheel.title',
    roleKey: 'routes.wheel.role',
    descriptionKey: 'routes.wheel.description',
  },
  {
    path: '/activity-lead',
    titleKey: 'routes.activityLead.title',
    roleKey: 'routes.activityLead.role',
    descriptionKey: 'routes.activityLead.description',
  },
  {
    path: '/parent',
    titleKey: 'routes.parent.title',
    roleKey: 'routes.parent.role',
    descriptionKey: 'routes.parent.description',
  },
  {
    path: '/dashboard',
    titleKey: 'routes.dashboard.title',
    roleKey: 'routes.dashboard.role',
    descriptionKey: 'routes.dashboard.description',
  },
  {
    path: '/map',
    titleKey: 'routes.map.title',
    roleKey: 'routes.map.role',
    descriptionKey: 'routes.map.description',
  },
];
