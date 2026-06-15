import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useKidsData,
  useSetCurrentUser,
  useUsersData,
  type Kid,
  type User,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';

export function SampleAccessDialog() {
  const kids = useKidsData();
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

  const roleLabelKeys: Record<User['role'], MessageKey> = {
    desk: 'access.role.desk',
    lead: 'access.role.lead',
    wheel: 'access.role.wheel',
  };
  const enabledRoles = new Set<User['role']>(['desk', 'lead', 'wheel']);

  const openKidPage = (kid: Kid) => {
    setCurrentUser(kid);
    setIsAccessDialogOpen(false);
    navigate('/passport');
  };

  const openRolePage = (user: User) => {
    setCurrentUser(user);
    setIsAccessDialogOpen(false);
    navigate(
      user.role === 'lead' ? '/lead' : user.role === 'wheel' ? '/wheel' : '/desk',
    );
  };

  return (
    <div className="access-menu">
      <button
        className="access-button"
        type="button"
        aria-expanded={isAccessDialogOpen}
        onClick={() => setIsAccessDialogOpen((isOpen) => !isOpen)}
      >
        {t('app.access')}
      </button>
      <button
        className="secondary-button"
        type="button"
        onClick={() => navigate('/register')}
      >
        {t('registration.start')}
      </button>
      {isAccessDialogOpen ? (
        <section className="access-popover" aria-label={t('access.title')}>
          <h2>{t('access.title')}</h2>
          <div className="role-list">
            {kids.map((kid) => (
              <button
                className="role-card enabled"
                key={kid.id}
                type="button"
                onClick={() => openKidPage(kid)}
              >
                <strong>{kid.name}</strong>
                <small>{t('access.role.kid')}</small>
              </button>
            ))}
            {users.map((user) => (
              <button
                className={
                  enabledRoles.has(user.role) ? 'role-card enabled' : 'role-card'
                }
                disabled={!enabledRoles.has(user.role)}
                key={user.id}
                type="button"
                onClick={
                  enabledRoles.has(user.role) ? () => openRolePage(user) : undefined
                }
              >
                <strong>{user.name}</strong>
                <small>{t(roleLabelKeys[user.role])}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
