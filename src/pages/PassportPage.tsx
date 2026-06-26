import {
  IterationsIcon,
  LocationIcon,
  SyncIcon,
} from '@primer/octicons-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FriendPassportView } from '../components/FriendPassportView';
import { KidsSection, SelectedKidPassport } from '../components/KidsSection';
import { PassportActivityMosaic } from '../components/PassportActivityMosaic';
import { ProgressCounter } from '../components/ProgressCounter';
import { TopBar } from '../components/TopBar';
import {
  useActivitiesData,
  useConferenceData,
  useCurrentUser,
  useFindKidById,
  useGetWheelShotSummaryForKid,
  usePassportData,
  useReloadPassportActivities,
  useReloadPrizeAwardsForKid,
  type Kid,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import { createKidPassportUrl } from '../utils/kid-id';

export function PassportPage() {
  const activities = useActivitiesData();
  const conference = useConferenceData();
  const currentUser = useCurrentUser();
  const findKidById = useFindKidById();
  const getWheelShotSummaryForKid = useGetWheelShotSummaryForKid();
  const passport = usePassportData();
  const reloadPassportActivities = useReloadPassportActivities();
  const reloadPrizeAwardsForKid = useReloadPrizeAwardsForKid();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const publicKidId = searchParams.get('kid') ?? searchParams.get('id') ?? '';
  const [publicKid, setPublicKid] = useState<Kid | undefined>();
  const [publicKidStatus, setPublicKidStatus] = useState<
    'idle' | 'loading' | 'notFound'
  >('idle');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrError, setQrError] = useState('');
  const [isQrExpanded, setIsQrExpanded] = useState(false);
  const [selectedFriendKid, setSelectedFriendKid] = useState<Kid | undefined>();
  const completedActivities = passport.activities.filter(
    (activity) => activity.completedAt,
  ).length;
  const displayedKidId =
    publicKid?.id ?? (currentUser.role === 'kid' ? currentUser.id : '');
  const kidPassportPayload = displayedKidId
    ? createKidPassportUrl(displayedKidId)
    : '';
  const wheelShotSummary =
    currentUser.role === 'kid'
      ? getWheelShotSummaryForKid(currentUser.id)
      : {
          availableShots: 0,
          awards: [],
          earnedShots: 0,
          usedShots: 0,
        };

  useEffect(() => {
    if (!publicKidId && currentUser.role !== 'kid') {
      navigate('/', { replace: true });
    }
  }, [currentUser.role, navigate, publicKidId]);

  useEffect(() => {
    const trimmedPublicKidId = publicKidId.trim();

    if (!trimmedPublicKidId) {
      setPublicKid(undefined);
      setPublicKidStatus('idle');
      return;
    }

    setPublicKidStatus('loading');
    findKidById(trimmedPublicKidId)
      .then((kid) => {
        setPublicKid(kid);
        setPublicKidStatus(kid ? 'idle' : 'notFound');
      })
      .catch((error) => {
        console.error(`Unable to load public passport for ${trimmedPublicKidId}.`, error);
        setPublicKid(undefined);
        setPublicKidStatus('notFound');
      });
  }, [findKidById, publicKidId]);

  useEffect(() => {
    if (currentUser.role === 'kid') {
      reloadPassportActivities(currentUser.id);
      reloadPrizeAwardsForKid(currentUser.id);
    }
  }, [currentUser.id, currentUser.role]);

  useEffect(() => {
    if (!kidPassportPayload) {
      setQrCodeUrl('');
      return;
    }

    QRCode.toDataURL(kidPassportPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 420,
    })
      .then((nextQrCodeUrl) => {
        setQrCodeUrl(nextQrCodeUrl);
        setQrError('');
      })
      .catch(() => {
        setQrCodeUrl('');
        setQrError(t('kid.qr.error'));
      });
  }, [kidPassportPayload, t]);

  useEffect(() => {
    if (!isQrExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsQrExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQrExpanded]);

  const passportQrButton = qrCodeUrl ? (
    <button
      className="kid-qr-corner-button"
      type="button"
      aria-label={t('kid.qr.open')}
      title={t('kid.qr.open')}
      onClick={() => setIsQrExpanded(true)}
    >
      <img src={qrCodeUrl} alt={t('kid.qr.alt')} />
    </button>
  ) : null;
  const passportQrModal = isQrExpanded ? (
    <div
      className="kid-qr-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kid-qr-title"
      onClick={() => setIsQrExpanded(false)}
    >
      <section
        className="kid-qr-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="kid-qr-title">{t('kid.qr.title')}</h2>
        <img src={qrCodeUrl} alt={t('kid.qr.alt')} />
        <p>{t('kid.qr.instructions')}</p>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setIsQrExpanded(false)}
        >
          {t('kid.qr.close')}
        </button>
      </section>
    </div>
  ) : null;

  if (publicKidId) {
    return (
      <>
        <TopBar showLanguageSwitcher showUserMenu={currentUser.role !== 'guest'} />
        <section className="kid-content" aria-label={t('kid.title')}>
          <p className="eyebrow">{conference.title}</p>
          {publicKid ? (
            <FriendPassportView kid={publicKid} />
          ) : publicKidStatus === 'notFound' ? (
            <h1>{t('kid.notFound')}</h1>
          ) : null}
        {passportQrButton}
        </section>
        {passportQrModal}
      </>
    );
  }

  if (currentUser.role !== 'kid') {
    return null;
  }

  return (
    <>
      <TopBar
        customButtons={
          <>
            <button
              className="toolbar-icon-button"
              type="button"
              aria-label={t('kid.activities.reload')}
              title={t('kid.activities.reload')}
              onClick={() => reloadPassportActivities()}
            >
              <SyncIcon size={18} aria-hidden="true" />
            </button>
            <button
              className="progress-summary"
              type="button"
              disabled
              aria-label={`${completedActivities}/${passport.activities.length} ${t('kid.option.map')}`}
            >
              <LocationIcon size={16} aria-hidden="true" />
              <ProgressCounter
                completed={completedActivities}
                total={passport.activities.length}
              />
            </button>
          </>
        }
        showUserMenu
        onLogout={() => navigate('/')}
      />
      <section className="kid-content" aria-labelledby="kid-page-title">
        <p className="eyebrow">{conference.title}</p>
        <div className="passport-title-row">
          <h1 id="kid-page-title">{t('kid.title')}</h1>
        </div>
        <section
          className={
            wheelShotSummary.availableShots > 0
              ? 'passport-wheel-card available'
              : 'passport-wheel-card'
          }
          aria-label={t('kid.wheel.title')}
        >
          <div className="passport-wheel-copy">
            <span className="passport-wheel-icon">
              <IterationsIcon size={22} aria-hidden="true" />
            </span>
            <div>
              <h2>{t('kid.wheel.title')}</h2>
              <p>
                {wheelShotSummary.availableShots > 0
                  ? wheelShotSummary.availableShots === 1
                    ? t('kid.wheel.availableSingular')
                    : t('kid.wheel.availablePlural').replace(
                        '{count}',
                        String(wheelShotSummary.availableShots),
                      )
                  : t('kid.wheel.none')}
              </p>
            </div>
          </div>
          <strong className="passport-wheel-count">
            {wheelShotSummary.availableShots}
          </strong>
          {wheelShotSummary.awards.length > 0 ? (
            <div className="passport-prize-history">
              <span>{t('kid.wheel.prizes')}</span>
              <ol>
                {wheelShotSummary.awards.map((award) => (
                  <li
                    className={
                      award.prizeKind === 'final' ? 'final-award' : undefined
                    }
                    key={award.id}
                  >
                    {award.prizeTitle}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
        {passportQrButton}
        {qrError ? <p className="form-error">{qrError}</p> : null}
        {passportQrModal}

        <section
          className="activity-section"
          aria-label={t('kid.activities.title')}
        >
          <PassportActivityMosaic
            activities={passport.activities}
            getActivityTitle={(activityId) =>
              activities.find((entry) => entry.id === String(activityId))
                ?.title ?? ''
            }
          />
        </section>
        <KidsSection
          blockedKidId={currentUser.id}
          onKidSelected={setSelectedFriendKid}
        />
        {selectedFriendKid ? (
          <SelectedKidPassport
            kid={selectedFriendKid}
            onClose={() => setSelectedFriendKid(undefined)}
          />
        ) : null}
      </section>
    </>
  );
}
