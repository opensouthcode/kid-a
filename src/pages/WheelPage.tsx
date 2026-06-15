import { AlertIcon, IterationsIcon } from '@primer/octicons-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type TransitionEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { KidFinder } from '../components/KidFinder';
import { ProgressCounter } from '../components/ProgressCounter';
import { TopBar } from '../components/TopBar';
import {
  getPrizeRemaining,
  useAwardPrizeToKid,
  useCurrentUser,
  useGetWheelShotSummaryForKid,
  useKidsData,
  usePrizesData,
  useUpdatePrize,
  type Kid,
  type Prize,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';

const regularPrizeWeight = 3;
const valuablePrizeWeight = 1;
const prizeColors = [
  '#ffbe0b',
  '#fb5607',
  '#ff006e',
  '#8338ec',
  '#3a86ff',
  '#06d6a0',
];
const outOfStockColor = '#c8c2b8';

type SpinNotice = {
  message: string;
  type: 'success' | 'warning';
};

function getWeightedSegments(prizes: Prize[]) {
  return prizes.flatMap((prize) =>
    Array.from(
      { length: prize.isValuable ? valuablePrizeWeight : regularPrizeWeight },
      () => prize,
    ),
  );
}

function getPrizeColor(prizes: Prize[], prize: Prize) {
  if (getPrizeRemaining(prize) <= 0) {
    return outOfStockColor;
  }

  const prizeIndex = prizes.findIndex((entry) => entry.id === prize.id);

  return prizeColors[prizeIndex % prizeColors.length] ?? prizeColors[0];
}

function createWheelBackground(prizes: Prize[], segments: Prize[]) {
  if (segments.length === 0) {
    return outOfStockColor;
  }

  const step = 100 / segments.length;

  return `conic-gradient(${segments
    .map((segment, index) => {
      const start = (index * step).toFixed(3);
      const end = ((index + 1) * step).toFixed(3);

      return `${getPrizeColor(prizes, segment)} ${start}% ${end}%`;
    })
    .join(', ')})`;
}

export function WheelPage() {
  const awardPrizeToKid = useAwardPrizeToKid();
  const currentUser = useCurrentUser();
  const getWheelShotSummaryForKid = useGetWheelShotSummaryForKid();
  const kids = useKidsData();
  const navigate = useNavigate();
  const prizes = usePrizesData();
  const updatePrize = useUpdatePrize();
  const { t } = useI18n();
  const [selectedKidId, setSelectedKidId] = useState('');
  const [pendingPrizeId, setPendingPrizeId] = useState('');
  const [managementError, setManagementError] = useState('');
  const [spinNotice, setSpinNotice] = useState<SpinNotice>();
  const [stockNotice, setStockNotice] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinRound, setSpinRound] = useState(0);
  const selectedKid = kids.find((kid) => kid.id === selectedKidId);
  const shotSummary = selectedKid
    ? getWheelShotSummaryForKid(selectedKid.id)
    : undefined;
  const hasAnyAvailableStock = prizes.some(
    (prize) => getPrizeRemaining(prize) > 0,
  );
  const wheelSegments = useMemo(() => getWeightedSegments(prizes), [prizes]);
  const wheelBackground = useMemo(
    () => createWheelBackground(prizes, wheelSegments),
    [prizes, wheelSegments],
  );

  useEffect(() => {
    if (currentUser.role !== 'wheel') {
      navigate('/', { replace: true });
    }
  }, [currentUser.role, navigate]);

  const selectKid = (kid: Kid) => {
    setSelectedKidId(kid.id);
    setPendingPrizeId('');
    setSpinNotice(undefined);
    setStockNotice('');
  };
  const clearKid = () => {
    setSelectedKidId('');
    setPendingPrizeId('');
    setSpinNotice(undefined);
    setStockNotice('');
  };
  const canSpin =
    Boolean(selectedKid) &&
    Boolean(shotSummary?.availableShots) &&
    hasAnyAvailableStock &&
    !isSpinning;
  const spinButtonLabel =
    spinNotice?.type === 'warning' && pendingPrizeId === ''
      ? t('wheel.spin.retry')
      : t('wheel.spin.start');

  const startSpin = () => {
    if (!selectedKid || !shotSummary) {
      setSpinNotice({
        message: t('wheel.spin.selectKid'),
        type: 'warning',
      });
      return;
    }

    if (shotSummary.availableShots <= 0) {
      setSpinNotice({
        message: t('wheel.spin.noShots'),
        type: 'warning',
      });
      return;
    }

    if (!hasAnyAvailableStock) {
      setSpinNotice({
        message: t('wheel.spin.noStock'),
        type: 'warning',
      });
      return;
    }

    const segmentIndex = Math.floor(Math.random() * wheelSegments.length);
    const segment = wheelSegments[segmentIndex];

    if (!segment) {
      setSpinNotice({
        message: t('wheel.spin.noStock'),
        type: 'warning',
      });
      return;
    }

    const segmentAngle = 360 / wheelSegments.length;
    const segmentCenter = segmentIndex * segmentAngle + segmentAngle / 2;
    const nextSpinRound = spinRound + 5;

    setPendingPrizeId(segment.id);
    setIsSpinning(true);
    setSpinNotice(undefined);
    setStockNotice('');
    setSpinRound(nextSpinRound);
    setRotation(360 * nextSpinRound - segmentCenter);
  };

  const finishPendingSpin = useCallback(() => {
    if (!pendingPrizeId || !selectedKid) {
      return;
    }

    const prize = prizes.find((entry) => entry.id === pendingPrizeId);

    if (!prize) {
      setIsSpinning(false);
      setPendingPrizeId('');
      setSpinNotice({
        message: t('wheel.spin.error'),
        type: 'warning',
      });
      return;
    }

    if (getPrizeRemaining(prize) <= 0) {
      setIsSpinning(false);
      setPendingPrizeId('');
      setSpinNotice({
        message: t('wheel.spin.outOfStock').replace('{prize}', prize.title),
        type: 'warning',
      });
      return;
    }

    const remainingAfterAward = getPrizeRemaining(prize) - 1;

    awardPrizeToKid(selectedKid.id, prize.id);
    setIsSpinning(false);
    setPendingPrizeId('');
    setSpinNotice({
      message: t('wheel.spin.success')
        .replace('{kid}', selectedKid.name)
        .replace('{prize}', prize.title),
      type: 'success',
    });

    if (remainingAfterAward === 0) {
      setStockNotice(t('wheel.spin.lastUnit').replace('{prize}', prize.title));
    }
  }, [awardPrizeToKid, pendingPrizeId, prizes, selectedKid, t]);

  useEffect(() => {
    if (!isSpinning || !pendingPrizeId) {
      return;
    }

    const timeoutId = window.setTimeout(finishPendingSpin, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [finishPendingSpin, isSpinning, pendingPrizeId]);

  const finishSpin = (event: TransitionEvent<HTMLDivElement>) => {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== 'transform'
    ) {
      return;
    }

    finishPendingSpin();
  };

  const updateManagedPrize = (prizeId: string, updates: Partial<Prize>) => {
    updatePrize(prizeId, updates);
    setManagementError('');
  };

  if (currentUser.role !== 'wheel') {
    return null;
  }

  return (
    <>
      <TopBar showUserMenu onLogout={() => navigate('/')} />
      <section className="wheel-content" aria-labelledby="wheel-title">
        <p className="eyebrow">{t('wheel.eyebrow')}</p>
        <h1 id="wheel-title">{t('wheel.title')}</h1>
        <p className="site-description">{t('wheel.description')}</p>

        <div className="wheel-layout">
          <section
            className={
              selectedKid
                ? 'lead-card wheel-kid-card selected'
                : 'lead-card wheel-kid-card'
            }
            aria-label={t('wheel.kid.title')}
          >
            {selectedKid && shotSummary ? (
              <>
                <div className="selected-kid-summary">
                  <div>
                    <span className="selected-kid-label">
                      {t('wheel.kid.selected')}
                    </span>
                    <strong>{selectedKid.name}</strong>
                    <code>{selectedKid.id}</code>
                  </div>
                  <ProgressCounter
                    completed={shotSummary.availableShots}
                    total={shotSummary.earnedShots}
                  />
                </div>
                <p className="wheel-shot-copy">
                  {shotSummary.availableShots > 0
                    ? t('wheel.kid.available').replace(
                        '{count}',
                        String(shotSummary.availableShots),
                      )
                    : t('wheel.kid.none')}
                </p>
                {shotSummary.awards.length > 0 ? (
                  <ol className="wheel-award-list">
                    {shotSummary.awards.map((award) => (
                      <li key={award.id}>{award.prizeTitle}</li>
                    ))}
                  </ol>
                ) : null}
                <button className="secondary-button" type="button" onClick={clearKid}>
                  {t('wheel.kid.next')}
                </button>
              </>
            ) : (
              <KidFinder onKidSelected={selectKid} />
            )}
          </section>

          <section className="wheel-stage-card" aria-label={t('wheel.stage.title')}>
            <div className="wheel-stage">
              <div className="wheel-pointer" aria-hidden="true" />
              <div
                className={isSpinning ? 'prize-wheel spinning' : 'prize-wheel'}
                style={{
                  background: wheelBackground,
                  transform: `rotate(${rotation}deg)`,
                }}
                onTransitionEnd={finishSpin}
              >
                <div className="wheel-center">
                  <IterationsIcon size={42} aria-hidden="true" />
                </div>
              </div>
            </div>
            <button
              className="access-button wheel-spin-button"
              type="button"
              disabled={!canSpin}
              onClick={startSpin}
            >
              {spinButtonLabel}
            </button>
            {!hasAnyAvailableStock ? (
              <p className="wheel-alert warning" role="status">
                <AlertIcon size={18} aria-hidden="true" />
                {t('wheel.spin.noStock')}
              </p>
            ) : null}
            {spinNotice ? (
              <p className={`wheel-alert ${spinNotice.type}`} role="status">
                {spinNotice.type === 'warning' ? (
                  <AlertIcon size={18} aria-hidden="true" />
                ) : null}
                {spinNotice.message}
              </p>
            ) : null}
            {stockNotice ? (
              <p className="wheel-alert warning" role="status">
                <AlertIcon size={18} aria-hidden="true" />
                {stockNotice}
              </p>
            ) : null}
          </section>
        </div>

        <section className="prize-manager" aria-labelledby="prize-manager-title">
          <div className="prize-manager-header">
            <div>
              <p className="eyebrow">{t('wheel.manage.eyebrow')}</p>
              <h2 id="prize-manager-title">{t('wheel.manage.title')}</h2>
            </div>
            <p>{t('wheel.manage.description')}</p>
          </div>
          {managementError ? <p className="form-error">{managementError}</p> : null}
          <div className="prize-list">
            {prizes.map((prize) => (
              <article
                className={
                  getPrizeRemaining(prize) > 0
                    ? 'prize-row'
                    : 'prize-row out-of-stock'
                }
                key={prize.id}
              >
                <label>
                  {t('wheel.manage.prizeTitle')}
                  <input
                    value={prize.title}
                    onChange={(event) => {
                      if (!event.target.value.trim()) {
                        setManagementError(t('wheel.manage.error.title'));
                        return;
                      }

                      updateManagedPrize(prize.id, {
                        title: event.target.value,
                      });
                    }}
                  />
                </label>
                <label>
                  {t('wheel.manage.initialUnits')}
                  <input
                    min="0"
                    type="number"
                    value={prize.initialUnits}
                    onChange={(event) =>
                      updateManagedPrize(prize.id, {
                        initialUnits: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  {t('wheel.manage.given')}
                  <input
                    min="0"
                    type="number"
                    value={prize.given}
                    onChange={(event) =>
                      updateManagedPrize(prize.id, {
                        given: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="valuable-toggle">
                  <input
                    checked={prize.isValuable}
                    type="checkbox"
                    onChange={(event) =>
                      updateManagedPrize(prize.id, {
                        isValuable: event.target.checked,
                      })
                    }
                  />
                  {t('wheel.manage.valuable')}
                </label>
                <strong className="prize-remaining">
                  {t('wheel.manage.remaining').replace(
                    '{count}',
                    String(getPrizeRemaining(prize)),
                  )}
                </strong>
              </article>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
