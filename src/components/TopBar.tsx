import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PersonIcon, SmileyGrinIcon } from '@primer/octicons-react';
import { useUserData } from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import { isSupportedLocale, supportedLocales } from '../i18n/messages';

type TopBarProps = {
  customButtons?: ReactNode;
  onLogout?: () => void;
  showGuestAvatar?: boolean;
  showLanguageSwitcher?: boolean;
  showUserMenu?: boolean;
};

function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
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
  );
}

export function TopBar({
  customButtons,
  onLogout,
  showGuestAvatar = false,
  showLanguageSwitcher = false,
  showUserMenu = false,
}: TopBarProps) {
  const { t } = useI18n();
  const user = useUserData();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !userMenuRef.current?.contains(event.target)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isUserMenuOpen]);

  const logOut = () => {
    setIsUserMenuOpen(false);
    onLogout?.();
  };

  return (
    <div className="user-toolbar" aria-label={t('user.toolbar')}>
      {showLanguageSwitcher ? <LanguageSwitcher /> : null}
      {customButtons}
      {showUserMenu ? (
        <div className="user-menu-wrapper" ref={userMenuRef}>
          <button
            className="user-avatar kid-avatar"
            title={t('user.menu')}
            aria-label={t('user.menu')}
            aria-expanded={isUserMenuOpen}
            type="button"
            onClick={() => setIsUserMenuOpen((isOpen) => !isOpen)}
          >
            <SmileyGrinIcon size={22} aria-hidden="true" />
            <span>{user.name}</span>
          </button>
          {isUserMenuOpen ? (
            <section className="user-menu" aria-label={t('user.menu')}>
              <div className="user-menu-name">
                <span>{t('user.nameLabel')}</span>
                <strong>{user.name}</strong>
              </div>
              <div className="user-menu-language">
                <span>{t('language.label')}</span>
                <LanguageSwitcher />
              </div>
              <button className="logout-button" type="button" onClick={logOut}>
                {t('user.logout')}
              </button>
            </section>
          ) : null}
        </div>
      ) : null}
      {showGuestAvatar ? (
        <div
          className="user-avatar guest-avatar"
          title={t('user.guest')}
          aria-label={t('user.guest')}
        >
          <PersonIcon size={20} aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}
