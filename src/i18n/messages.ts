export const supportedLocales = ['en', 'es'] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = 'en';

export function isSupportedLocale(value: string | null): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}

export const messages = {
  en: {
    'app.eyebrow': 'OpenSouthKids',
    'app.title': 'A small app for big adventures',
    'app.description':
      'The first frontend version keeps the Epic 0 roles visible, bilingual, and ready to deploy.',
    'language.label': 'Language',
    'language.en': 'English',
    'language.es': 'Spanish',
    'navigation.label': 'Main routes',
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
    'app.eyebrow': 'OpenSouthKids',
    'app.title': 'Una pequeña app para grandes aventuras',
    'app.description':
      'La primera versión frontend mantiene visibles, bilingües y desplegables los roles de Epic 0.',
    'language.label': 'Idioma',
    'language.en': 'Inglés',
    'language.es': 'Español',
    'navigation.label': 'Rutas principales',
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
