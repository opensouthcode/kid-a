import {
  CheckCircleFillIcon,
  IterationsIcon,
  LocationIcon,
  PeopleIcon,
} from '@primer/octicons-react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import {
  useConferenceData,
  usePassportData,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';

type KidOption = {
  id: 'wheel' | 'friends';
  labelKey: MessageKey;
};

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

export function PassportPage() {
  const conference = useConferenceData();
  const passport = usePassportData();
  const navigate = useNavigate();
  const { t } = useI18n();
  const completedActivities = passport.activities.filter(
    (activity) => activity.isCompleted,
  ).length;

  return (
    <>
      <TopBar
        customButtons={
          <button
            className="progress-summary"
            type="button"
            disabled
            aria-label={`${completedActivities}/${passport.activities.length} ${t('kid.option.map')}`}
          >
            <LocationIcon size={16} aria-hidden="true" />
            <strong>
              {completedActivities}/{passport.activities.length}
            </strong>
          </button>
        }
        showUserMenu
        onLogout={() => navigate('/')}
      />
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

        <section
          className="activity-section"
          aria-label={t('kid.activities.title')}
        >
          <div className="activity-grid">
            {passport.activities.map((activity) => (
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
    </>
  );
}
