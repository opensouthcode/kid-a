import { AlertIcon } from '@primer/octicons-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityHero } from '../components/ActivityHero';
import { KidFinder } from '../components/KidFinder';
import { KidList } from '../components/KidList';
import { ProgressCounter } from '../components/ProgressCounter';
import { TopBar } from '../components/TopBar';
import {
  useAccessSessionStatus,
  useActivitiesData,
  useCurrentUser,
  useGetActivityCompletedKids,
  useGetPassportForKid,
  useMarkPassportActivityDone,
  useReloadPassportActivities,
  type Kid,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';

export function ActivityLeadPage() {
  const accessSessionStatus = useAccessSessionStatus();
  const currentUser = useCurrentUser();
  const activities = useActivitiesData();
  const getActivityCompletedKids = useGetActivityCompletedKids();
  const getPassportForKid = useGetPassportForKid();
  const markPassportActivityDone = useMarkPassportActivityDone();
  const reloadPassportActivities = useReloadPassportActivities();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const leadActivityId = currentUser.role === 'lead' ? currentUser.activityId : undefined;
  const activityId = leadActivityId ?? 1;
  const [confirmedKidId, setConfirmedKidId] = useState('');
  const [confirmedKid, setConfirmedKid] = useState<Kid | undefined>();
  const [passportCompletedKidId, setPassportCompletedKidId] = useState('');
  const [lastCompletedKidId, setLastCompletedKidId] = useState('');
  const [activityCompletedKids, setActivityCompletedKids] = useState<{
    count: number;
    kids: Array<{ completedAt: string; kid: Kid }>;
  }>({ count: 0, kids: [] });
  const passport = confirmedKid
    ? getPassportForKid(confirmedKid.id)
    : { activities: [] };
  const leadActivity = passport.activities.find(
    (activity) => activity.id === activityId,
  );
  const activity = activities.find((entry) => entry.id === String(activityId));
  const completedActivities = passport.activities.filter(
    (activity) => activity.completedAt,
  ).length;
  const shouldShowWheelReminder =
    Boolean(leadActivity) &&
    !leadActivity?.completedAt &&
    (completedActivities + 1) % 4 === 0 &&
    completedActivities + 1 < passport.activities.length;
  const formatCompletionTime = (completedAt: string) =>
    new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(completedAt));
  const lastCompletedKids = activityCompletedKids
    .kids
    .map((entry) => entry.kid);
  const completedAtByKidId = Object.fromEntries(
    activityCompletedKids.kids.map((entry) => [
      entry.kid.id,
      formatCompletionTime(entry.completedAt),
    ]),
  );
  const leadActivityCompletedTime = leadActivity?.completedAt
    ? formatCompletionTime(leadActivity.completedAt)
    : '';
  const hasJustCompletedActivity = lastCompletedKidId === confirmedKidId;
  const shouldShowJustCompletedWheelShot =
    hasJustCompletedActivity &&
    completedActivities % 4 === 0 &&
    completedActivities < passport.activities.length;
  const shouldShowAlreadyCompletedWarning =
    Boolean(leadActivity?.completedAt) && !hasJustCompletedActivity;

  useEffect(() => {
    if (accessSessionStatus.state === 'loading') {
      return;
    }

    if (currentUser.role !== 'lead') {
      navigate('/', { replace: true });
    }
  }, [accessSessionStatus.state, currentUser.role, navigate]);

  useEffect(() => {
    if (confirmedKidId) {
      reloadPassportActivities(confirmedKidId);
    }
  }, [confirmedKidId, reloadPassportActivities]);

  const refreshActivityCompletedKids = useCallback(() =>
    getActivityCompletedKids(activityId)
      .then(setActivityCompletedKids)
      .catch((error) => {
        console.error('Unable to load activity completed kids.', error);
      }), [activityId, getActivityCompletedKids]);

  useEffect(() => {
    refreshActivityCompletedKids();
  }, [refreshActivityCompletedKids]);

  if (accessSessionStatus.state === 'loading' || currentUser.role !== 'lead') {
    return null;
  }

  const confirmKid = (kid: Kid) => {
    setConfirmedKidId(kid.id);
    setConfirmedKid(kid);
    setPassportCompletedKidId('');
    setLastCompletedKidId('');
  };
  const clearConfirmedKid = () => {
    setConfirmedKidId('');
    setConfirmedKid(undefined);
    setPassportCompletedKidId('');
    setLastCompletedKidId('');
  };
  const returnToKidScan = () => {
    setConfirmedKidId('');
    setConfirmedKid(undefined);
  };

  const markActivity = () => {
    if (!confirmedKid || !leadActivity) {
      return;
    }

    if (leadActivity.completedAt) {
      return;
    }

    const nextCompletedActivities = markPassportActivityDone(
      confirmedKid.id,
      leadActivity.id,
    );
    setLastCompletedKidId(confirmedKid.id);
    setActivityCompletedKids((currentActivityCompletedKids) => {
      const alreadyCompleted = currentActivityCompletedKids.kids.some(
        (entry) => entry.kid.id === confirmedKid.id,
      );

      if (alreadyCompleted) {
        return currentActivityCompletedKids;
      }

      return {
        count: currentActivityCompletedKids.count + 1,
        kids: [
          { completedAt: new Date().toISOString(), kid: confirmedKid },
          ...currentActivityCompletedKids.kids,
        ].slice(0, 5),
      };
    });

    if (nextCompletedActivities === passport.activities.length) {
      setPassportCompletedKidId(confirmedKid.id);
      return;
    }

    returnToKidScan();
  };

  return (
    <>
      <TopBar showUserMenu onLogout={() => navigate('/')} />
      <section className="lead-content" aria-labelledby="lead-activity-title">
        {activity ? (
          <ActivityHero
            activity={activity}
            eyebrow={t('activity.detail.eyebrow')}
            headingId="lead-activity-title"
          />
        ) : null}

        <div className="lead-controls-panel">
          <section
            className={
              confirmedKid
                ? 'lead-card lead-kid-card lead-selected-kid-card'
                : 'lead-card lead-kid-card lead-kid-search-card'
            }
            aria-live="polite"
          >
            {confirmedKid ? (
              <>
                <div className="selected-kid-summary">
                  <div>
                    <span className="selected-kid-label">{t('lead.selectedKid')}</span>
                    <strong>{confirmedKid.name}</strong>
                    <code>{confirmedKid.id}</code>
                  </div>
                  <ProgressCounter
                    completed={completedActivities}
                    total={passport.activities.length}
                  />
                </div>
                <div className="selected-kid-actions">
                  {shouldShowWheelReminder ? (
                    <p className="wheel-reminder">{t('lead.wheelReminder')}</p>
                  ) : null}
                  {shouldShowAlreadyCompletedWarning ? (
                    <p className="activity-done-warning" role="status">
                      <AlertIcon size={18} aria-hidden="true" />
                      {leadActivityCompletedTime
                        ? t('lead.mark.completedAt').replace(
                            '{time}',
                            leadActivityCompletedTime,
                          )
                        : t('lead.mark.completed')}
                    </p>
                  ) : null}
                  {passportCompletedKidId === confirmedKidId ? (
                    <p className="completion-message passport-complete-message" role="status">
                      {t('lead.passportComplete')}
                    </p>
                  ) : null}
                  {shouldShowJustCompletedWheelShot ? (
                    <p className="wheel-reminder" role="status">
                      {t('lead.wheelShotAvailable')}
                    </p>
                  ) : null}
                  {hasJustCompletedActivity &&
                  !shouldShowJustCompletedWheelShot &&
                  passportCompletedKidId !== confirmedKidId ? (
                    <p className="completion-message" role="status">
                      {t('lead.mark.success')}
                    </p>
                  ) : null}
                  {leadActivity?.completedAt ? (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={clearConfirmedKid}
                    >
                      {t('lead.closeKid')}
                    </button>
                  ) : (
                    <button
                      className="access-button"
                      type="button"
                      disabled={!leadActivity}
                      onClick={markActivity}
                    >
                      {t('lead.mark.submit')}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <KidFinder onKidSelected={confirmKid} />
            )}
          </section>
        </div>

        <section className="lead-summary-card" aria-label={t('lead.summary.title')}>
          <div className="lead-summary-header">
            <h2>{t('lead.summary.title')}</h2>
            <p className="lead-total-counter">
              <strong>{activityCompletedKids.count}</strong>
            </p>
          </div>
          {lastCompletedKids.length > 0 ? (
            <KidList
              animatedKidId={lastCompletedKidId}
              detailsByKidId={completedAtByKidId}
              kids={lastCompletedKids}
              onAnimatedKidDone={() => setLastCompletedKidId('')}
            />
          ) : (
            <p className="lead-empty-summary">{t('lead.summary.empty')}</p>
          )}
        </section>

      </section>
    </>
  );
}
