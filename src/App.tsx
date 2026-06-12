import { useEffect, useRef, useState } from 'react';
import {
  CheckCircleFillIcon,
  IterationsIcon,
  LocationIcon,
  PeopleIcon,
  PersonIcon,
  SmileyGrinIcon,
} from '@primer/octicons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import conference from './data/conference.json';
import kidActivities from './data/passportActivities.json';
import sampleKid from './data/sampleKid.json';
import { useI18n } from './i18n/I18nProvider';
import {
  isSupportedLocale,
  supportedLocales,
  type MessageKey,
} from './i18n/messages';

type AccessRole = {
  id: string;
  labelKey: MessageKey;
  isEnabled: boolean;
};

type KidActivity = {
  id: number;
  isCompleted: boolean;
};

type KidOption = {
  id: 'wheel' | 'friends';
  labelKey: MessageKey;
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

const kidOptions: KidOption[] = [
  {
    id: 'wheel',
    labelKey: 'kid.option.wheel',
  },
  {
    id: 'friends',
    labelKey: 'kid.option.friends',
  },
];

function App() {
  const { locale, setLocale, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const passportActivities: KidActivity[] = kidActivities;
  const completedActivities = passportActivities.filter(
    (activity) => activity.isCompleted,
  ).length;

  const isKidPage = location.pathname === '/passport';

  useEffect(() => {
    if (!isAccessDialogOpen && !isUserMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccessDialogOpen(false);
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAccessDialogOpen, isUserMenuOpen]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !userMenuRef.current?.contains(event.target)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);

    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isUserMenuOpen]);

  const openKidPage = () => {
    setIsAccessDialogOpen(false);
    navigate('/passport');
  };

  const logOutKid = () => {
    setIsUserMenuOpen(false);
    navigate('/');
  };

  return (
    <div className={isKidPage ? 'app-shell kid-shell' : 'app-shell'}>
      <main className={isKidPage ? 'kid-page' : 'welcome-card'}>
        <div className="user-toolbar" aria-label={t('user.toolbar')}>
          {!isKidPage ? (
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
          ) : null}
          {isKidPage ? (
            <button
              className="progress-summary"
              type="button"
              disabled
              aria-label={`${completedActivities}/16 ${t('kid.option.map')}`}
            >
              <LocationIcon size={16} aria-hidden="true" />
              <strong>{completedActivities}/16</strong>
            </button>
          ) : null}
          {isKidPage ? (
            <div className="user-menu-wrapper" ref={userMenuRef}>
              <button
                className="user-avatar kid-avatar"
                title={t('user.kid.menu')}
                aria-label={t('user.kid.menu')}
                aria-expanded={isUserMenuOpen}
                type="button"
                onClick={() => setIsUserMenuOpen((isOpen) => !isOpen)}
              >
                <SmileyGrinIcon size={22} aria-hidden="true" />
                <span>{sampleKid.name}</span>
              </button>
              {isUserMenuOpen ? (
                <section className="user-menu" aria-label={t('user.kid.menu')}>
                  <div className="user-menu-name">
                    <span>{t('user.kid.nameLabel')}</span>
                    <strong>{sampleKid.name}</strong>
                  </div>
                  <div className="user-menu-language">
                    <span>{t('language.label')}</span>
                    <div className="language-switcher" aria-label={t('language.label')}>
                      {supportedLocales.map((availableLocale) => (
                        <button
                          key={availableLocale}
                          type="button"
                          className={
                            availableLocale === locale ? 'active' : undefined
                          }
                          aria-pressed={availableLocale === locale}
                          onClick={() => {
                            if (!isSupportedLocale(availableLocale)) {
                              throw new Error(
                                `Unsupported locale: ${availableLocale}`,
                              );
                            }

                            setLocale(availableLocale);
                          }}
                        >
                          {t(`language.${availableLocale}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="logout-button"
                    type="button"
                    onClick={logOutKid}
                  >
                    {t('user.kid.logout')}
                  </button>
                </section>
              ) : null}
            </div>
          ) : (
            <div className="user-avatar guest-avatar" title={t('user.guest')} aria-label={t('user.guest')}>
              <PersonIcon size={20} aria-hidden="true" />
            </div>
          )}
        </div>

        {isKidPage ? (
          <section className="kid-content" aria-labelledby="kid-page-title">
            <nav className="passport-nav" aria-label={t('kid.options.title')}>
              {kidOptions.map((option) => (
                <button
                  className="passport-nav-button"
                  type="button"
                  disabled
                  key={option.id}
                >
                  {option.id === 'wheel' ? (
                    <IterationsIcon size={16} aria-hidden="true" />
                  ) : (
                    <PeopleIcon size={16} aria-hidden="true" />
                  )}
                  {t(option.labelKey)}
                </button>
              ))}
            </nav>
            <p className="eyebrow">{conference.title}</p>
            <h1 id="kid-page-title">{t('kid.title')}</h1>

            <section className="activity-section" aria-label={t('kid.activities.title')}>
              <div className="activity-grid">
                {passportActivities.map((activity) => (
                  <article
                    className={
                      activity.isCompleted
                        ? 'activity-card completed'
                        : 'activity-card'
                    }
                    key={activity.id}
                  >
                    <span className="activity-number">
                      {activity.id.toString().padStart(2, '0')}
                    </span>
                    {activity.isCompleted ? (
                      <CheckCircleFillIcon
                        aria-label={t('kid.activity.completed')}
                        className="activity-completed-icon"
                        size={34}
                      />
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

          </section>
        ) : (
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
                <section className="access-popover" aria-label={t('access.title')}>
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
        )}

      </main>
    </div>
  );
}

export default App;
