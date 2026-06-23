import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { BackHomeButton } from '../components/BackHomeButton';
import { TopBar } from '../components/TopBar';
import {
  builtInMagicLinks,
  createMagicLinkUrl,
  getMagicLinkPath,
} from '../access/magic-links';
import { useUsersData, type User } from '../contexts/DataLayerContext';
import {
  createRemoteMagicLink,
  isRemoteDataLayerEnabled,
} from '../data/remote-data-client';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';

type GeneratedMagicLink = {
  expiresAt?: string;
  url: string;
  user: User;
};

const roleLabelKeys: Record<User['role'], MessageKey> = {
  desk: 'access.role.desk',
  lead: 'access.role.lead',
  wheel: 'access.role.wheel',
};

function getBuiltInMagicLinkForUser(user: User) {
  return builtInMagicLinks.find((magicLink) => magicLink.userId === user.id);
}

export function AdminPage() {
  const users = useUsersData();
  const staffUsers = users.filter((user) => user.role !== 'lead' || user.activityId);
  const { locale, t } = useI18n();
  const isRemoteDataLayer = isRemoteDataLayerEnabled();
  const [password, setPassword] = useState('');
  const [durationHours, setDurationHours] = useState(12);
  const [selectedUserId, setSelectedUserId] = useState(staffUsers[0]?.id ?? '');
  const [generatedMagicLink, setGeneratedMagicLink] =
    useState<GeneratedMagicLink>();
  const [qrSourceUrl, setQrSourceUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const selectedUser = staffUsers.find((user) => user.id === selectedUserId);
  const formatExpiration = (expiresAt: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(expiresAt));

  useEffect(() => {
    if (selectedUserId || !staffUsers[0]) {
      return;
    }

    setSelectedUserId(staffUsers[0].id);
  }, [selectedUserId, staffUsers]);

  useEffect(() => {
    if (!qrSourceUrl) {
      setQrCodeUrl('');
      return;
    }

    QRCode.toDataURL(qrSourceUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 260,
    })
      .then((nextQrCodeUrl) => {
        setQrCodeUrl(nextQrCodeUrl);
        setStatusMessage('');
      })
      .catch(() => {
        setQrCodeUrl('');
        setStatusMessage(t('admin.error.qr'));
      });
  }, [qrSourceUrl, t]);

  const copyMagicLink = (url: string) => {
    if (!navigator.clipboard) {
      setStatusMessage(t('admin.copy.manual').replace('{url}', url));
      return;
    }

    navigator.clipboard
      .writeText(url)
      .then(() => setStatusMessage(t('admin.copy.success')))
      .catch(() => setStatusMessage(t('admin.copy.error')));
  };

  const generateRemoteMagicLink = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!selectedUser) {
      setStatusMessage(t('admin.error.user'));
      return;
    }

    setStatusMessage(t('admin.generating'));
    setGeneratedMagicLink(undefined);
    setQrSourceUrl('');

    try {
      const createdMagicLink = await createRemoteMagicLink({
        durationHours,
        password,
        userId: selectedUser.id,
      });
      const url = createMagicLinkUrl(
        getMagicLinkPath(selectedUser),
        createdMagicLink.token,
      );

      setGeneratedMagicLink({
        expiresAt: createdMagicLink.expiresAt,
        url,
        user: selectedUser,
      });
      setStatusMessage(t('admin.generated'));
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : t('admin.error.generate'),
      );
    }
  };

  const renderMagicLinkCard = (magicLink: GeneratedMagicLink) => (
    <article className="magic-link-card" key={magicLink.url}>
      <div>
        <span>{t(roleLabelKeys[magicLink.user.role])}</span>
        <strong>{magicLink.user.name}</strong>
        {magicLink.expiresAt ? (
          <small>
            {t('admin.link.expires').replace(
              '{time}',
              formatExpiration(magicLink.expiresAt),
            )}
          </small>
        ) : (
          <small>{t('admin.demo.noExpiry')}</small>
        )}
      </div>
      <textarea readOnly value={magicLink.url} />
      <div className="magic-link-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => copyMagicLink(magicLink.url)}
        >
          {t('admin.copy')}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setQrSourceUrl(magicLink.url)}
        >
          {t('admin.showQr')}
        </button>
      </div>
    </article>
  );

  const demoMagicLinks = staffUsers.flatMap((user) => {
    const magicLink = getBuiltInMagicLinkForUser(user);

    return magicLink
      ? [
          {
            url: createMagicLinkUrl(magicLink.path, magicLink.token),
            user,
          },
        ]
      : [];
  });

  return (
    <>
      <TopBar showLanguageSwitcher />
      <section className="admin-content" aria-labelledby="admin-title">
        <BackHomeButton />
        <p className="eyebrow">{t('admin.eyebrow')}</p>
        <h1 id="admin-title">{t('admin.title')}</h1>
        <p className="site-description">
          {isRemoteDataLayer ? t('admin.description') : t('admin.demo.description')}
        </p>

        <div className="admin-layout">
          <section className="admin-panel">
            {isRemoteDataLayer ? (
              <form className="admin-form" onSubmit={generateRemoteMagicLink}>
                <label>
                  {t('admin.password')}
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <label>
                  {t('admin.user')}
                  <select
                    value={selectedUserId}
                    onChange={(event) => setSelectedUserId(event.target.value)}
                  >
                    {staffUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} - {t(roleLabelKeys[user.role])}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('admin.duration')}
                  <input
                    min={1}
                    max={168}
                    type="number"
                    value={durationHours}
                    onChange={(event) =>
                      setDurationHours(Math.max(1, Number(event.target.value)))
                    }
                  />
                </label>
                <button className="access-button" type="submit">
                  {t('admin.generate')}
                </button>
              </form>
            ) : (
              <div className="admin-demo-links">
                <p>{t('admin.demo.notice')}</p>
                {demoMagicLinks.map(renderMagicLinkCard)}
              </div>
            )}

            {statusMessage ? (
              <p className="admin-status" role="status">
                {statusMessage}
              </p>
            ) : null}
            {generatedMagicLink ? renderMagicLinkCard(generatedMagicLink) : null}
          </section>

          <aside className="qr-panel admin-qr-panel" aria-label={t('admin.qr.title')}>
            {qrSourceUrl && qrCodeUrl ? (
              <>
                <h2>{t('admin.qr.title')}</h2>
                <img src={qrCodeUrl} alt={t('admin.qr.alt')} />
                <p>{t('admin.qr.instructions')}</p>
              </>
            ) : (
              <p>{t('admin.qr.empty')}</p>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
