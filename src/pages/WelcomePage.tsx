import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import {
  useConferenceData,
  useSetCurrentUser,
  useUsersData,
  type UserData,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';

export function WelcomePage() {
  const conference = useConferenceData();
  const navigate = useNavigate();
  const setCurrentUser = useSetCurrentUser();
  const { t } = useI18n();
  const users = useUsersData();
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);

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

  const openKidPage = (user: UserData) => {
    setCurrentUser(user.id);
    setIsAccessDialogOpen(false);
    navigate('/passport');
  };

  return (
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
            <section className="access-popover" aria-label={t('access.title')}>
              <h2>{t('access.title')}</h2>
              <div className="role-list">
                {users.map((user) => (
                  <button
                    className={user.role === 'kid' ? 'role-card enabled' : 'role-card'}
                    disabled={user.role !== 'kid'}
                    key={user.id}
                    type="button"
                    onClick={
                      user.role === 'kid' ? () => openKidPage(user) : undefined
                    }
                  >
                    <strong>{user.name}</strong>
                    <small>{user.role}</small>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </>
  );
}
