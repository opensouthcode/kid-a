import { useEffect } from 'react';
import {
  useGetPassportForKid,
  useReloadPassportActivities,
  type Kid,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import { FriendStarButton } from './FriendStarButton';
import { PassportActivityMosaic } from './PassportActivityMosaic';
import { ProgressCounter } from './ProgressCounter';

type FriendPassportViewProps = {
  kid: Kid;
};

export function FriendPassportView({ kid }: FriendPassportViewProps) {
  const getPassportForKid = useGetPassportForKid();
  const reloadPassportActivities = useReloadPassportActivities();
  const { t } = useI18n();
  const passport = getPassportForKid(kid.id);
  const completedActivities = passport.activities.filter(
    (activity) => activity.completedAt,
  ).length;

  useEffect(() => {
    reloadPassportActivities(kid.id);
  }, [kid.id]);

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
      <PassportActivityMosaic
        activities={passport.activities}
        className="friend-passport-mosaic"
      />
    </section>
  );
}
