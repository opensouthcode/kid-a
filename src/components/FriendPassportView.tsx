import { useEffect } from 'react';
import {
  useGetPassportForKid,
  useGetWheelShotSummaryForKid,
  useReloadPassportActivities,
  type Kid,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import { FriendStarButton } from './FriendStarButton';
import { KidGenderIcon } from './KidGenderIcon';
import { PassportActivityMosaic } from './PassportActivityMosaic';
import { ProgressCounter } from './ProgressCounter';
import { WheelShotPill } from './WheelShotPill';

type FriendPassportViewProps = {
  kid: Kid;
};

export function FriendPassportView({ kid }: FriendPassportViewProps) {
  const getPassportForKid = useGetPassportForKid();
  const getWheelShotSummaryForKid = useGetWheelShotSummaryForKid();
  const reloadPassportActivities = useReloadPassportActivities();
  const { t } = useI18n();
  const passport = getPassportForKid(kid.id);
  const wheelShotSummary =
    passport.wheelShotSummary ?? getWheelShotSummaryForKid(kid.id);
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
          <KidGenderIcon
            gender={kid.gender}
            label={t(`registration.gender.${kid.gender}`)}
          />
          <h3 id="friend-passport-title">{kid.name}</h3>
          <FriendStarButton kid={kid} />
        </div>
        <div className="passport-header-counters">
          <ProgressCounter
            completed={completedActivities}
            total={passport.activities.length}
          />
          <WheelShotPill summary={wheelShotSummary} />
        </div>
      </div>
      <PassportActivityMosaic
        activities={passport.activities}
        className="friend-passport-mosaic"
      />
    </section>
  );
}
