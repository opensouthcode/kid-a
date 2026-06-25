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

  return (
    <section className="activity-hero" aria-labelledby={headingId}>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="activity-heading" id={headingId}>
        <span>{activity.id.padStart(2, '0')}</span> {activity.title}
        <a
          className="issue-link title-issue-link"
          href={activity.issueUrl}
          rel="noreferrer"
          target="_blank"
        >
          {t('activity.detail.moreDetails')} {getIssueLabel(activity.issueUrl)}
        </a>
      </h1>
      {activity.details ? (
        <p className="site-description">{activity.details}</p>
      ) : null}
    </section>
  );
}
