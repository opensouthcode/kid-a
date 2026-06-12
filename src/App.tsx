import { PersonIcon } from '@primer/octicons-react';
import { useI18n } from './i18n/I18nProvider';
import { isSupportedLocale, supportedLocales } from './i18n/messages';

function App() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="app-shell">
      <main className="welcome-card">
        <div className="user-toolbar" aria-label={t('user.toolbar')}>
          <div className="language-switcher" aria-label={t('language.label')}>
            {supportedLocales.map((availableLocale) => (
              <button
                key={availableLocale}
                type="button"
                className={availableLocale === locale ? 'active' : undefined}
                aria-pressed={availableLocale === locale}
                onClick={() => {
                  if (!isSupportedLocale(availableLocale)) {
                    throw new Error(`Unsupported locale: ${availableLocale}`);
                  }

                  setLocale(availableLocale);
                }}
              >
                {t(`language.${availableLocale}`)}
              </button>
            ))}
          </div>
          <div className="guest-avatar" title={t('user.guest')} aria-label={t('user.guest')}>
            <PersonIcon size={20} aria-hidden="true" />
          </div>
        </div>

        <section className="welcome-content">
          <p className="eyebrow">{t('app.eyebrow')}</p>
          <h1>{t('app.title')}</h1>
          <p className="site-description">{t('app.description')}</p>
          <button className="access-button" type="button">
            {t('app.access')}
          </button>
        </section>

      </main>
    </div>
  );
}

export default App;
