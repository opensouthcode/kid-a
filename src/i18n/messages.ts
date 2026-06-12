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
  },
} as const;

export type MessageKey = keyof (typeof messages)[typeof defaultLocale];
