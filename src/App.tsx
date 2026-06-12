import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { useConferenceData } from './data/DataLayerContext';
import { useI18n } from './i18n/I18nProvider';
import type { MessageKey } from './i18n/messages';
import { PassportPage } from './pages/PassportPage';

type AccessRole = {
  id: string;
  labelKey: MessageKey;
  isEnabled: boolean;
};

const accessRoles: AccessRole[] = [
  {
    id: 'kid',
    labelKey: 'access.role.kid',
    isEnabled: true,
  },
  {
    id: 'desk',
    labelKey: 'access.role.desk',
    isEnabled: false,
  },
  {
    id: 'wheel',
    labelKey: 'access.role.wheel',
    isEnabled: false,
  },
  {
    id: 'lead',
    labelKey: 'access.role.lead',
    isEnabled: false,
  },
  {
    id: 'parent',
    labelKey: 'access.role.parent',
    isEnabled: false,
  },
];

function App() {
  const conference = useConferenceData();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const isKidPage = location.pathname === '/passport';

  useEffect(() => {
    if (!isAccessDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccessDialogOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAccessDialogOpen]);

  const openKidPage = () => {
    setIsAccessDialogOpen(false);
    navigate('/passport');
  };

  return (
    <div className={isKidPage ? 'app-shell kid-shell' : 'app-shell'}>
      <main className={isKidPage ? 'kid-page' : 'welcome-card'}>
        {isKidPage ? (
          <PassportPage />
        ) : (
          <>
            <TopBar showLanguageSwitcher showGuestAvatar />
            <section className="welcome-content">
              <p className="eyebrow">{conference.shortName}</p>
              <h1>
                {t('app.titlePrefix')} {conference.title}
              </h1>
              <p className="site-description">{t('app.description')}</p>
              <div className="access-menu">
                <button
                  className="access-button"
                  type="button"
                  aria-expanded={isAccessDialogOpen}
                  onClick={() => setIsAccessDialogOpen((isOpen) => !isOpen)}
                >
                  {t('app.access')}
                </button>
                {isAccessDialogOpen ? (
                  <section
                    className="access-popover"
                    aria-label={t('access.title')}
                  >
                    <h2>{t('access.title')}</h2>
                    <div className="role-list">
                      {accessRoles.map((role) => (
                        <button
                          className={
                            role.isEnabled ? 'role-card enabled' : 'role-card'
                          }
                          disabled={!role.isEnabled}
                          key={role.id}
                          type="button"
                          onClick={role.isEnabled ? openKidPage : undefined}
                        >
                          {t(role.labelKey)}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
