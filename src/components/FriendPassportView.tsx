import { CheckCircleFillIcon } from '@primer/octicons-react';
import {
  useGetPassportForKid,
  type Kid,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import { FriendStarButton } from './FriendStarButton';
import { ProgressCounter } from './ProgressCounter';

type FriendPassportViewProps = {
  kid: Kid;
};

export function FriendPassportView({ kid }: FriendPassportViewProps) {
  const getPassportForKid = useGetPassportForKid();
  const { t } = useI18n();
  const passport = getPassportForKid(kid.id);
  const completedActivities = passport.activities.filter(
    (activity) => activity.completedAt,
  ).length;

  return (
    <section className="friend-passport-view" aria-labelledby="friend-passport-title">
      <div className="friend-passport-header">
        <div>
          <span
            className={`kid-gender-icon ${kid.gender}`}
            aria-label={t(`registration.gender.${kid.gender}`)}
            role="img"
          />
          <h3 id="friend-passport-title">{kid.name}</h3>
          <FriendStarButton kid={kid} />
        </div>
        <ProgressCounter
          completed={completedActivities}
          total={passport.activities.length}
        />
      </div>
      <div className="friend-passport-activity-grid">
        {passport.activities.map((activity) => (
          <article
            className={
              activity.completedAt
                ? 'friend-passport-activity completed'
                : 'friend-passport-activity'
            }
            key={activity.id}
          >
            <span>{activity.id.toString().padStart(2, '0')}</span>
            {activity.completedAt ? (
              <CheckCircleFillIcon
                aria-label={t('kid.activity.completed')}
                size={18}
              />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
