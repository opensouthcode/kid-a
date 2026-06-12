export const supportedLocales = ['en', 'es'] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = 'en';

export function isSupportedLocale(value: string | null): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}

export const messages = {
  en: {
    'app.titlePrefix': 'Welcome to',
    'app.description':
      'A playful space inside OpenSouthCode where kids can explore activities, collect progress with their QR passport, and get ready for surprises.',
    'app.access': 'Access',
    'access.title': 'Choose User',
    'kid.title': 'Passport',
    'kid.activities.title': 'Activities',
    'kid.activity.completed': 'Completed',
    'kid.options.title': 'More things to explore',
    'kid.option.wheel': 'Wheel',
    'kid.option.friends': 'Friends',
    'kid.option.map': 'Map',
    'language.label': 'Language',
    'language.en': 'EN',
    'language.es': 'ES',
    'user.toolbar': 'User and language',
    'user.guest': 'Guest user',
    'user.kid.menu': 'Kid profile',
    'user.kid.nameLabel': 'Name',
    'user.kid.logout': 'Log out',
    'routes.home.title': 'Home',
    'routes.home.role': 'Welcome',
    'routes.home.description':
      'A friendly starting point for families and volunteers.',
    'routes.kid.title': 'Kid area',
    'routes.kid.role': 'Kid',
    'routes.kid.description':
      'A future space for each kid with their language preference.',
    'routes.registration.title': 'Registration',
    'routes.registration.role': 'Family onboarding',
    'routes.registration.description':
      'A placeholder for joining OpenSouthKids activities.',
    'routes.wheel.title': 'Wheel',
    'routes.wheel.role': 'Activity choice',
    'routes.wheel.description':
      'A future interactive wheel for choosing activities.',
    'routes.activityLead.title': 'Activity lead',
    'routes.activityLead.role': 'Volunteer',
    'routes.activityLead.description':
      'A placeholder for guiding activity setup and follow-up.',
    'routes.parent.title': 'Parent area',
    'routes.parent.role': 'Parent or guardian',
    'routes.parent.description':
      'A future view for family information and activity context.',
    'routes.dashboard.title': 'Dashboard',
    'routes.dashboard.role': 'Organization',
    'routes.dashboard.description':
      'A lightweight placeholder for operational visibility.',
    'routes.map.title': 'Map',
    'routes.map.role': 'Navigation',
    'routes.map.description':
      'A future map for finding activities and meeting points.',
  },
  es: {
    'app.titlePrefix': 'Bienvenida a',
    'app.description':
      'Un espacio divertido dentro de OpenSouthCode donde peques pueden explorar actividades, guardar su progreso con su pasaporte QR y prepararse para sorpresas.',
    'app.access': 'Acceder',
    'access.title': 'Elegir usuario',
    'kid.title': 'Pasaporte',
    'kid.activities.title': 'Actividades',
    'kid.activity.completed': 'Completada',
    'kid.options.title': 'Más cosas por explorar',
    'kid.option.wheel': 'Ruleta',
    'kid.option.friends': 'Amistades',
    'kid.option.map': 'Mapa',
    'language.label': 'Idioma',
    'language.en': 'EN',
    'language.es': 'ES',
    'user.toolbar': 'Usuario e idioma',
    'user.guest': 'Usuario invitado',
    'user.kid.menu': 'Perfil infantil',
    'user.kid.nameLabel': 'Nombre',
    'user.kid.logout': 'Cerrar sesión',
    'routes.home.title': 'Inicio',
    'routes.home.role': 'Bienvenida',
    'routes.home.description':
      'Un punto de partida amable para familias y voluntariado.',
    'routes.kid.title': 'Zona infantil',
    'routes.kid.role': 'Niña o niño',
    'routes.kid.description':
      'Un futuro espacio para cada peque con su preferencia de idioma.',
    'routes.registration.title': 'Registro',
    'routes.registration.role': 'Alta familiar',
    'routes.registration.description':
      'Un marcador para unirse a las actividades de OpenSouthKids.',
    'routes.wheel.title': 'Ruleta',
    'routes.wheel.role': 'Elección de actividad',
    'routes.wheel.description':
      'Una futura ruleta interactiva para elegir actividades.',
    'routes.activityLead.title': 'Guía de actividad',
    'routes.activityLead.role': 'Voluntariado',
    'routes.activityLead.description':
      'Un marcador para preparar y cerrar actividades.',
    'routes.parent.title': 'Zona familiar',
    'routes.parent.role': 'Madre, padre o tutor',
    'routes.parent.description':
      'Una vista futura para información familiar y contexto de actividad.',
    'routes.dashboard.title': 'Panel',
    'routes.dashboard.role': 'Organización',
    'routes.dashboard.description':
      'Un marcador ligero para visibilidad operativa.',
    'routes.map.title': 'Mapa',
    'routes.map.role': 'Navegación',
    'routes.map.description':
      'Un mapa futuro para encontrar actividades y puntos de encuentro.',
  },
} as const;

export type MessageKey = keyof (typeof messages)[typeof defaultLocale];
