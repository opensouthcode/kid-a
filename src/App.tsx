import { NavLink, Route, Routes } from 'react-router-dom';
import { useI18n } from './i18n/I18nProvider';
import { isSupportedLocale, supportedLocales } from './i18n/messages';
import { appRoutes } from './routes';

function App() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="eyebrow">{t('app.eyebrow')}</p>
          <h1>{t('app.title')}</h1>
          <p className="site-description">{t('app.description')}</p>
        </div>

        <label className="language-picker">
          <span>{t('language.label')}</span>
          <select
            value={locale}
            onChange={(event) => {
              const nextLocale = event.target.value;

              if (!isSupportedLocale(nextLocale)) {
                throw new Error(`Unsupported locale: ${nextLocale}`);
              }

              setLocale(nextLocale);
            }}
          >
            {supportedLocales.map((availableLocale) => (
              <option key={availableLocale} value={availableLocale}>
                {t(`language.${availableLocale}`)}
              </option>
            ))}
          </select>
        </label>
      </header>

      <nav className="route-nav" aria-label={t('navigation.label')}>
        {appRoutes.map((route) => (
          <NavLink
            key={route.path}
            to={route.path}
            end={route.path === '/'}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            {t(route.titleKey)}
          </NavLink>
        ))}
      </nav>

      <main>
        <Routes>
          {appRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <section className="page-card">
                  <p className="eyebrow">{t(route.roleKey)}</p>
                  <h2>{t(route.titleKey)}</h2>
                  <p>{t(route.descriptionKey)}</p>
                </section>
              }
            />
          ))}
        </Routes>
      </main>
    </div>
  );
}

export default App;
