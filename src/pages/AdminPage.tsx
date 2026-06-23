import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import {
  createBuiltInLeadMagicLink,
  createMagicLinkUrl,
  getMagicLinkPath,
} from '../access/magic-links';
import { BackHomeButton } from '../components/BackHomeButton';
import { TopBar } from '../components/TopBar';
import {
  useActivitiesData,
  type Activity,
  type UserRole,
} from '../contexts/DataLayerContext';
import {
  createRemoteMagicLink,
  isRemoteDataLayerEnabled,
} from '../data/remote-data-client';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';

type GeneratedMagicLink = {
  activity?: Activity;
  expiresAt?: string;
  role: UserRole;
  url: string;
};

const roles: UserRole[] = ['desk', 'wheel', 'lead'];
const roleLabelKeys: Record<UserRole, MessageKey> = {
  desk: 'access.role.desk',
  lead: 'access.role.lead',
  wheel: 'access.role.wheel',
};

function getBuiltInToken(role: UserRole, activityId: number) {
  return role === 'lead' ? createBuiltInLeadMagicLink(activityId).token : `sample-${role}`;
}

export function AdminPage() {
  const activities = useActivitiesData();
  const { locale, t } = useI18n();
  const isRemoteDataLayer = isRemoteDataLayerEnabled();
  const [password, setPassword] = useState('');
  const [durationHours, setDurationHours] = useState(12);
  const [selectedRole, setSelectedRole] = useState<UserRole>('desk');
  const [selectedActivityId, setSelectedActivityId] = useState(
    Number(activities[0]?.id ?? 1),
  );
  const [generatedMagicLink, setGeneratedMagicLink] =
    useState<GeneratedMagicLink>();
  const [qrSourceUrl, setQrSourceUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const selectedActivity = activities.find(
    (activity) => Number(activity.id) === selectedActivityId,
  );
  const formatExpiration = (expiresAt: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(expiresAt));

  useEffect(() => {
    if (activities.some((activity) => Number(activity.id) === selectedActivityId)) {
      return;
    }

    setSelectedActivityId(Number(activities[0]?.id ?? 1));
  }, [activities, selectedActivityId]);

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

  const generateMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedRole === 'lead' && !selectedActivity) {
      setStatusMessage(t('admin.error.activity'));
      return;
    }

    setStatusMessage(isRemoteDataLayer ? t('admin.generating') : '');
    setGeneratedMagicLink(undefined);
    setQrSourceUrl('');

    try {
      const createdMagicLink = isRemoteDataLayer
        ? await createRemoteMagicLink({
            activityId:
              selectedRole === 'lead' ? selectedActivityId : undefined,
            durationHours,
            password,
            role: selectedRole,
          })
        : {
            activityId:
              selectedRole === 'lead' ? selectedActivityId : undefined,
            expiresAt: undefined,
            role: selectedRole,
            token: getBuiltInToken(selectedRole, selectedActivityId),
          };
      const url = createMagicLinkUrl(
        getMagicLinkPath(selectedRole),
        createdMagicLink.token,
      );

      setGeneratedMagicLink({
        activity: selectedRole === 'lead' ? selectedActivity : undefined,
        expiresAt: createdMagicLink.expiresAt,
        role: selectedRole,
        url,
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
        <span>{t(roleLabelKeys[magicLink.role])}</span>
        {magicLink.activity ? <strong>{magicLink.activity.title}</strong> : null}
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
            <form className="admin-form" onSubmit={generateMagicLink}>
              {isRemoteDataLayer ? (
                <label>
                  {t('admin.password')}
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
              ) : (
                <p>{t('admin.demo.notice')}</p>
              )}
              <label>
                {t('admin.role')}
                <select
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value as UserRole)}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {t(roleLabelKeys[role])}
                    </option>
                  ))}
                </select>
              </label>
              {selectedRole === 'lead' ? (
                <label>
                  {t('admin.activity')}
                  <select
                    value={selectedActivityId}
                    onChange={(event) =>
                      setSelectedActivityId(Number(event.target.value))
                    }
                  >
                    {activities.map((activity) => (
                      <option key={activity.id} value={Number(activity.id)}>
                        {activity.id.padStart(2, '0')} - {activity.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                {t('admin.duration')}
                <input
                  min={1}
                  max={168}
                  type="number"
                  value={durationHours}
                  disabled={!isRemoteDataLayer}
                  onChange={(event) =>
                    setDurationHours(Math.max(1, Number(event.target.value)))
                  }
                />
              </label>
              <button className="access-button" type="submit">
                {t('admin.generate')}
              </button>
            </form>

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
