import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  defaultLocale,
  isSupportedLocale,
  messages,
  type Locale,
  type MessageKey,
} from './messages';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const localeStorageKey = 'kid-a.locale';

function getInitialLocale(): Locale {
  const storedLocale = window.localStorage.getItem(localeStorageKey);

  if (isSupportedLocale(storedLocale)) {
    return storedLocale;
  }

  const browserLocale = window.navigator.language.split('-')[0] ?? defaultLocale;

  if (isSupportedLocale(browserLocale)) {
    return browserLocale;
  }

  return defaultLocale;
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setSelectedLocale] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(localeStorageKey, nextLocale);
    setSelectedLocale(nextLocale);
  }, []);

  const t = useCallback(
    (key: MessageKey) => {
      return messages[locale][key];
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }

  return context;
}
