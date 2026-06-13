import { AlertIcon } from '@primer/octicons-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityHero } from '../components/ActivityHero';
import { KidList } from '../components/KidList';
import { ProgressCounter } from '../components/ProgressCounter';
import { QrReader } from '../components/QrReader';
import { TopBar } from '../components/TopBar';
import {
  useActivitiesData,
  useCurrentUser,
  useGetPassportForKid,
  useKidsData,
  useMarkPassportActivityDone,
  type Kid,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';

function getKidSequenceNumber(kidId: string) {
  const numericId = kidId.replace(/\D/g, '');
  const sequenceDigits = numericId.slice(-4);

  return sequenceDigits ? Number(sequenceDigits) : undefined;
}

function findKidByManualNumber(kids: Kid[], rawSearchValue: string) {
  const searchedNumber = Number(rawSearchValue);

  if (!Number.isInteger(searchedNumber)) {
    return undefined;
  }

  return kids.find((kid) => getKidSequenceNumber(kid.id) === searchedNumber);
}

export function ActivityLeadPage() {
  const currentUser = useCurrentUser();
  const activities = useActivitiesData();
  const getPassportForKid = useGetPassportForKid();
  const kids = useKidsData();
  const markPassportActivityDone = useMarkPassportActivityDone();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const leadActivityId = currentUser.role === 'lead' ? currentUser.activityId : undefined;
  const activityId = leadActivityId ?? 1;
  const [confirmedKidId, setConfirmedKidId] = useState('');
  const [manualKidNumber, setManualKidNumber] = useState('');
  const [pendingKidId, setPendingKidId] = useState('');
  const [formError, setFormError] = useState('');
  const [lastCompletedKidId, setLastCompletedKidId] = useState('');
  const confirmedKid = kids.find((kid) => kid.id === confirmedKidId);
  const pendingKid = kids.find((kid) => kid.id === pendingKidId);
  const passport = confirmedKid
    ? getPassportForKid(confirmedKid.id)
    : { activities: [] };
  const leadActivity = passport.activities.find(
    (activity) => activity.id === activityId,
  );
  const activity = activities.find((entry) => entry.id === String(activityId));
  const completedActivities = passport.activities.filter(
    (activity) => activity.isCompleted,
  ).length;
  const shouldShowWheelReminder =
    Boolean(leadActivity) &&
    !leadActivity?.isCompleted &&
    (completedActivities + 1) % 4 === 0;
  const formatCompletionTime = (completedAt: string) =>
    new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(completedAt));
  const getKidActivity = (kid: Kid) =>
    getPassportForKid(kid.id).activities.find(
      (activity) => activity.id === activityId,
    );
  const activityCompletedKids = kids
    .map((kid) => ({
      completedAt: getKidActivity(kid)?.completedAt,
      kid,
    }))
    .filter(
      (entry): entry is { completedAt: string; kid: Kid } =>
        typeof entry.completedAt === 'string',
    )
    .sort(
      (firstEntry, secondEntry) =>
        new Date(secondEntry.completedAt).getTime() -
        new Date(firstEntry.completedAt).getTime(),
    );
  const lastCompletedKids = activityCompletedKids
    .slice(0, 3)
    .map((entry) => entry.kid);
  const completedAtByKidId = Object.fromEntries(
    activityCompletedKids.map((entry) => [
      entry.kid.id,
      formatCompletionTime(entry.completedAt),
    ]),
  );
  const leadActivityCompletedTime = leadActivity?.completedAt
    ? formatCompletionTime(leadActivity.completedAt)
    : '';

  useEffect(() => {
    if (currentUser.role !== 'lead') {
      navigate('/', { replace: true });
    }
  }, [currentUser.role, navigate]);

  if (currentUser.role !== 'lead') {
    return null;
  }

  const confirmKid = (kid: Kid) => {
    setConfirmedKidId(kid.id);
    setPendingKidId('');
    setFormError('');
    setLastCompletedKidId('');
  };
  const clearConfirmedKid = () => {
    setConfirmedKidId('');
    setPendingKidId('');
    setFormError('');
    setLastCompletedKidId('');
  };
  const returnToKidScan = () => {
    setConfirmedKidId('');
    setPendingKidId('');
    setManualKidNumber('');
    setFormError('');
  };

  const readKidQrPayload = (qrPayload: string) => {
    const matchingKid = kids.find((kid) => kid.qrIdData === qrPayload);

    if (!matchingKid) {
      setFormError(t('lead.error.invalidKidQr'));
      return;
    }

    confirmKid(matchingKid);
  };

  const searchManualKid = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const matchingKid = findKidByManualNumber(kids, manualKidNumber);

    if (!matchingKid) {
      setPendingKidId('');
      setFormError(t('lead.error.kidNotFound'));
      return;
    }

    setPendingKidId(matchingKid.id);
    setFormError('');
  };

  const markActivity = () => {
    if (!confirmedKid || !leadActivity) {
      setFormError(t('lead.error.selectKid'));
      return;
    }

    if (leadActivity.isCompleted) {
      setFormError(t('lead.error.activityCompleted'));
      return;
    }

    markPassportActivityDone(confirmedKid.id, leadActivity.id);
    setLastCompletedKidId(confirmedKid.id);
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
                  {leadActivity?.isCompleted ? (
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
                  {lastCompletedKidId === confirmedKidId ? (
                    <p className="completion-message" role="status">
                      {t('lead.mark.success')}
                    </p>
                  ) : null}
                  {leadActivity?.isCompleted ? (
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
              <div className="kid-acquisition-layout">
                <QrReader
                  messages={{
                    cameraPermissionError: t('scanner.error.cameraPermission'),
                    cameraPreview: t('scanner.cameraPreview'),
                    cameraStartError: t('scanner.error.cameraStart'),
                    cameraUnsupportedError: t('scanner.error.cameraUnsupported'),
                    scanApproved: t('lead.scan.approved'),
                    scannerActive: t('lead.scan.active'),
                    scanQr: t('lead.scan.title'),
                    scanQrShort: t('lead.scan.short'),
                    stopScanner: t('scanner.stopScanner'),
                  }}
                  onError={(message) => setFormError(message)}
                  onRead={readKidQrPayload}
                />
                <div className="manual-kid-panel">
                  <form className="manual-kid-search" onSubmit={searchManualKid}>
                    <label>
                      {t('lead.manualKid')}
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={manualKidNumber}
                        onChange={(event) => {
                          setManualKidNumber(event.target.value);
                          setPendingKidId('');
                        }}
                      />
                    </label>
                    <button className="secondary-button" type="submit">
                      {t('lead.manualKid.search')}
                    </button>
                  </form>
                  {pendingKid ? (
                    <div className="kid-confirmation" role="status">
                      <p>
                        {t('lead.manualKid.confirm').replace(
                          '{nickname}',
                          pendingKid.name,
                        )}
                      </p>
                      <button
                        className="access-button"
                        type="button"
                        onClick={() => confirmKid(pendingKid)}
                      >
                        {t('lead.manualKid.confirmButton')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="lead-summary-card" aria-label={t('lead.summary.title')}>
          <div className="lead-summary-header">
            <h2>{t('lead.summary.title')}</h2>
            <p className="lead-total-counter">
              <strong>{activityCompletedKids.length}</strong>
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

        {formError ? <p className="form-error">{formError}</p> : null}
      </section>
    </>
  );
}
