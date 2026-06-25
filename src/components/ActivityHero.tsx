import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import type { Activity } from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';

type ActivityHeroProps = {
  activity: Activity;
  eyebrow: string;
  headingId?: string;
};

function getIssueLabel(issueUrl: string) {
  return `#${issueUrl.split('/').at(-1)}`;
}

export function ActivityHero({ activity, eyebrow, headingId }: ActivityHeroProps) {
  const { t } = useI18n();
  const [issueQrCodeUrl, setIssueQrCodeUrl] = useState('');

  useEffect(() => {
    QRCode.toDataURL(activity.issueUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 160,
    })
      .then(setIssueQrCodeUrl)
      .catch(() => setIssueQrCodeUrl(''));
  }, [activity.issueUrl]);

  return (
    <section className="activity-hero" aria-labelledby={headingId}>
      <p className="eyebrow">{eyebrow}</p>
      <header className="activity-heading-row">
        <h1 className="activity-heading" id={headingId}>
          <span>{activity.id.padStart(2, '0')}</span> {activity.title}
        </h1>
        <a
          className="activity-details-link"
          href={activity.issueUrl}
          rel="noreferrer"
          target="_blank"
        >
          <span className="activity-details-label">
            {t('activity.detail.moreDetails')}
          </span>
          {issueQrCodeUrl ? (
            <img
              className="activity-details-qr"
              src={issueQrCodeUrl}
              alt={t('activity.detail.moreDetailsQr')}
            />
          ) : null}
          <span className="issue-link">{getIssueLabel(activity.issueUrl)}</span>
        </a>
      </header>
      {activity.details ? (
        <p className="site-description">{activity.details}</p>
      ) : null}
    </section>
  );
}
