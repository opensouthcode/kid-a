import { useSearchParams } from 'react-router-dom';
import { ActivityHero } from '../components/ActivityHero';
import { BackHomeButton } from '../components/BackHomeButton';
import { TopBar } from '../components/TopBar';
import { useActivitiesData } from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';

function normalizeActivityId(value: string | null) {
  const activityNumber = Number(value);

  if (!Number.isInteger(activityNumber)) {
    return '';
  }

  return String(activityNumber);
}

export function ActivityPage() {
  const activities = useActivitiesData();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const activityId = normalizeActivityId(searchParams.get('id'));
  const activity = activities.find((entry) => entry.id === activityId);

  return (
    <>
      <TopBar showLanguageSwitcher />
      <section className="activity-detail-content" aria-labelledby="activity-title">
        <BackHomeButton />

        {activity ? (
          <ActivityHero
            activity={activity}
            eyebrow={t('activity.detail.eyebrow')}
            headingId="activity-title"
          />
        ) : (
          <>
            <p className="eyebrow">{t('activity.detail.eyebrow')}</p>
            <h1 id="activity-title">{t('activity.detail.notFound')}</h1>
          </>
        )}
      </section>
    </>
  );
}
