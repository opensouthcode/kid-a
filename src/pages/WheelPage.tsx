import { AlertIcon, IterationsIcon } from '@primer/octicons-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type TransitionEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { KidFinder } from '../components/KidFinder';
import { ProgressCounter } from '../components/ProgressCounter';
import { TopBar } from '../components/TopBar';
import {
  getPrizeRemaining,
  useAddPrize,
  useAccessSessionStatus,
  useAwardPassportCompletionPrize,
  useAwardPrizeToKid,
  useCurrentUser,
  useGetPassportForKid,
  useGetWheelShotSummaryForKid,
  useKidsData,
  useReloadPassportActivities,
  useReloadPrizeAwardsForKid,
  usePrizesData,
  useRefreshPrizes,
  useUpdatePrize,
  type Kid,
  type Prize,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';

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

type WonPrize = {
  awardId: string;
  dx: number;
  dy: number;
  isFlying: boolean;
  title: string;
};

function getWeightedSegments(prizes: Prize[]) {
  return prizes
    .filter((prize) => prize.kind !== 'final')
    .flatMap((prize) =>
      Array.from(
        {
          length:
            getPrizeRemaining(prize) > 0
              ? Math.max(
                  1,
                  prize.kind === 'valuable'
                    ? Math.ceil(getPrizeRemaining(prize) / 2)
                    : getPrizeRemaining(prize),
                )
              : 1,
        },
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
  const addPrize = useAddPrize();
  const accessSessionStatus = useAccessSessionStatus();
  const awardPassportCompletionPrize = useAwardPassportCompletionPrize();
  const awardPrizeToKid = useAwardPrizeToKid();
  const currentUser = useCurrentUser();
  const getPassportForKid = useGetPassportForKid();
  const getWheelShotSummaryForKid = useGetWheelShotSummaryForKid();
  const kids = useKidsData();
  const navigate = useNavigate();
  const prizes = usePrizesData();
  const reloadPassportActivities = useReloadPassportActivities();
  const reloadPrizeAwardsForKid = useReloadPrizeAwardsForKid();
  const refreshPrizes = useRefreshPrizes();
  const updatePrize = useUpdatePrize();
  const { t } = useI18n();
  const fillIntervalRef = useRef<number | undefined>(undefined);
  const fillTimeoutRef = useRef<number | undefined>(undefined);
  const resetTransitionTimeoutRef = useRef<number | undefined>(undefined);
  const winnerBadgeRef = useRef<HTMLParagraphElement>(null);
  const winnerHoldTimeoutRef = useRef<number | undefined>(undefined);
  const winnerClearTimeoutRef = useRef<number | undefined>(undefined);
  const awardItemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const [animatedWheelSegments, setAnimatedWheelSegments] = useState<
    Prize[] | undefined
  >();
  const [filledSegmentCount, setFilledSegmentCount] = useState(0);
  const [selectedKidId, setSelectedKidId] = useState('');
  const [pendingPrizeId, setPendingPrizeId] = useState('');
  const [managementError, setManagementError] = useState('');
  const [wonPrize, setWonPrize] = useState<WonPrize | undefined>();
  const [isPrizeManagerOpen, setIsPrizeManagerOpen] = useState(false);
  const [isFillingWheel, setIsFillingWheel] = useState(false);
  const [isResettingWheel, setIsResettingWheel] = useState(false);
  const [spinNotice, setSpinNotice] = useState<SpinNotice>();
  const [stockNotice, setStockNotice] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinRound, setSpinRound] = useState(0);
  const selectedKid = kids.find((kid) => kid.id === selectedKidId);
  const shotSummary = selectedKid
    ? getWheelShotSummaryForKid(selectedKid.id)
    : undefined;
  const selectedKidPassport = selectedKid
    ? getPassportForKid(selectedKid.id)
    : undefined;
  const completedActivities =
    selectedKidPassport?.activities.filter((activity) => activity.completedAt)
      .length ?? 0;
  const totalActivities = selectedKidPassport?.activities.length ?? 0;
  const isPassportComplete =
    totalActivities > 0 && completedActivities === totalActivities;
  const hasAnyAvailableStock = prizes.some(
    (prize) => prize.kind !== 'final' && getPrizeRemaining(prize) > 0,
  );
  const wheelSegments = useMemo(() => getWeightedSegments(prizes), [prizes]);
  const activeWheelSegments = animatedWheelSegments ?? wheelSegments;
  const visibleWheelSegments =
    isFillingWheel && animatedWheelSegments
      ? animatedWheelSegments.slice(0, filledSegmentCount)
      : activeWheelSegments;
  const wheelBackground = useMemo(
    () => createWheelBackground(prizes, visibleWheelSegments),
    [prizes, visibleWheelSegments],
  );

  useEffect(() => {
    if (accessSessionStatus.state === 'loading') {
      return;
    }

    if (currentUser.role !== 'wheel') {
      navigate('/', { replace: true });
    }
  }, [accessSessionStatus.state, currentUser.role, navigate]);

  useEffect(() => {
    if (selectedKidId) {
      reloadPassportActivities(selectedKidId);
      reloadPrizeAwardsForKid(selectedKidId);
    }
  }, [selectedKidId]);

  useEffect(() => {
    if (!isPrizeManagerOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPrizeManagerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPrizeManagerOpen]);

  useEffect(
    () => () => {
      window.clearInterval(fillIntervalRef.current);
      window.clearTimeout(fillTimeoutRef.current);
      window.clearTimeout(resetTransitionTimeoutRef.current);
      window.clearTimeout(winnerHoldTimeoutRef.current);
      window.clearTimeout(winnerClearTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!selectedKid || !shotSummary || !isPassportComplete) {
      return;
    }

    if (shotSummary.completionAward) {
      return;
    }

    try {
      awardPassportCompletionPrize(selectedKid.id);
      setSpinNotice(undefined);
    } catch (error) {
      setSpinNotice({
        message:
          error instanceof Error ? error.message : t('wheel.completion.error'),
        type: 'warning',
      });
    }
  }, [
    awardPassportCompletionPrize,
    isPassportComplete,
    prizes,
    selectedKid,
    shotSummary,
    t,
  ]);

  const selectKid = (kid: Kid) => {
    window.clearInterval(fillIntervalRef.current);
    window.clearTimeout(fillTimeoutRef.current);
    window.clearTimeout(resetTransitionTimeoutRef.current);
    window.clearTimeout(winnerHoldTimeoutRef.current);
    window.clearTimeout(winnerClearTimeoutRef.current);
    setAnimatedWheelSegments(undefined);
    setFilledSegmentCount(0);
    setIsFillingWheel(false);
    setSelectedKidId(kid.id);
    setPendingPrizeId('');
    setSpinNotice(undefined);
    setStockNotice('');
    setWonPrize(undefined);
  };
  const clearKid = () => {
    window.clearInterval(fillIntervalRef.current);
    window.clearTimeout(fillTimeoutRef.current);
    window.clearTimeout(resetTransitionTimeoutRef.current);
    window.clearTimeout(winnerHoldTimeoutRef.current);
    window.clearTimeout(winnerClearTimeoutRef.current);
    setAnimatedWheelSegments(undefined);
    setFilledSegmentCount(0);
    setIsFillingWheel(false);
    setSelectedKidId('');
    setPendingPrizeId('');
    setSpinNotice(undefined);
    setStockNotice('');
    setWonPrize(undefined);
  };
  const canSpin =
    Boolean(selectedKid) &&
    Boolean(shotSummary?.availableShots) &&
    Boolean(animatedWheelSegments?.length) &&
    filledSegmentCount === animatedWheelSegments?.length &&
    hasAnyAvailableStock &&
    !isFillingWheel &&
    !isSpinning;
  const spinButtonLabel =
    spinNotice?.type === 'warning' && pendingPrizeId === ''
      ? t('wheel.spin.retry')
      : t('wheel.spin.start');

  const fillWheel = ({ clearWinner = false }: { clearWinner?: boolean } = {}) => {
    const refreshedPrizes = refreshPrizes();
    const nextWheelSegments = getWeightedSegments(refreshedPrizes);

    if (nextWheelSegments.length === 0) {
      setSpinNotice({
        message: t('wheel.spin.noStock'),
        type: 'warning',
      });
      return;
    }

    window.clearInterval(fillIntervalRef.current);
    window.clearTimeout(fillTimeoutRef.current);
    window.clearTimeout(resetTransitionTimeoutRef.current);
    setAnimatedWheelSegments(nextWheelSegments);
    setFilledSegmentCount(0);
    setIsFillingWheel(true);
    setIsResettingWheel(true);
    setRotation(0);
    setSpinRound(0);
    setSpinNotice(undefined);
    setStockNotice('');

    if (clearWinner) {
      setWonPrize(undefined);
    }

    resetTransitionTimeoutRef.current = window.setTimeout(() => {
      setIsResettingWheel(false);
    }, 50);

    const fillDuration = 3000;
    const segmentInterval = Math.max(24, fillDuration / nextWheelSegments.length);

    fillIntervalRef.current = window.setInterval(() => {
      setFilledSegmentCount((currentCount) =>
        Math.min(currentCount + 1, nextWheelSegments.length),
      );
    }, segmentInterval);

    fillTimeoutRef.current = window.setTimeout(() => {
      window.clearInterval(fillIntervalRef.current);
      setFilledSegmentCount(nextWheelSegments.length);

      setIsFillingWheel(false);
    }, fillDuration);
  };

  useEffect(() => {
    if (
      !selectedKidId ||
      !shotSummary?.availableShots ||
      isSpinning ||
      isFillingWheel ||
      animatedWheelSegments
    ) {
      return;
    }

    fillWheel({ clearWinner: !wonPrize });
  }, [
    animatedWheelSegments,
    isFillingWheel,
    isSpinning,
    selectedKidId,
    shotSummary?.availableShots,
    wonPrize,
  ]);

  const startSpin = () => {
    if (isSpinning || isFillingWheel) {
      return;
    }

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

    if (!animatedWheelSegments?.length) {
      fillWheel({ clearWinner: true });
      return;
    }

    const segmentIndex = Math.floor(Math.random() * animatedWheelSegments.length);
    const segment = animatedWheelSegments[segmentIndex];

    if (!segment) {
      setSpinNotice({
        message: t('wheel.spin.noStock'),
        type: 'warning',
      });
      return;
    }

    const segmentAngle = 360 / animatedWheelSegments.length;
    const segmentCenter = segmentIndex * segmentAngle + segmentAngle / 2;
    const nextSpinRound = spinRound + 7;

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
      setAnimatedWheelSegments(undefined);
      setPendingPrizeId('');
      setSpinNotice({
        message: t('wheel.spin.error'),
        type: 'warning',
      });
      return;
    }

    if (getPrizeRemaining(prize) <= 0) {
      setIsSpinning(false);
      setAnimatedWheelSegments(undefined);
      setPendingPrizeId('');
      setSpinNotice({
        message: t('wheel.spin.outOfStock').replace('{prize}', prize.title),
        type: 'warning',
      });
      return;
    }

    const remainingAfterAward = getPrizeRemaining(prize) - 1;

    const award = awardPrizeToKid(selectedKid.id, prize.id);
    setIsSpinning(false);
    setAnimatedWheelSegments(undefined);
    setPendingPrizeId('');
    setWonPrize({
      awardId: award.id,
      dx: 0,
      dy: 0,
      isFlying: false,
      title: prize.title,
    });
    setSpinNotice(undefined);

    if (remainingAfterAward === 0) {
      setStockNotice(t('wheel.spin.lastUnit').replace('{prize}', prize.title));
    }
  }, [awardPrizeToKid, pendingPrizeId, prizes, selectedKid, t]);

  useEffect(() => {
    if (!wonPrize || wonPrize.isFlying) {
      return;
    }

    winnerHoldTimeoutRef.current = window.setTimeout(() => {
      const winnerBadge = winnerBadgeRef.current;
      const targetAward = awardItemRefs.current[wonPrize.awardId];

      if (!winnerBadge || !targetAward) {
        return;
      }

      const badgeRect = winnerBadge.getBoundingClientRect();
      const targetRect = targetAward.getBoundingClientRect();
      const dx =
        targetRect.left +
        targetRect.width / 2 -
        (badgeRect.left + badgeRect.width / 2);
      const dy =
        targetRect.top +
        targetRect.height / 2 -
        (badgeRect.top + badgeRect.height / 2);

      setWonPrize((currentWinner) =>
        currentWinner && currentWinner.awardId === wonPrize.awardId
          ? {
              ...currentWinner,
              dx,
              dy,
              isFlying: true,
            }
          : currentWinner,
      );
      winnerClearTimeoutRef.current = window.setTimeout(() => {
        setWonPrize((currentWinner) =>
          currentWinner?.awardId === wonPrize.awardId ? undefined : currentWinner,
        );
      }, 3000);
    }, 700);

    return () => window.clearTimeout(winnerHoldTimeoutRef.current);
  }, [wonPrize]);

  useEffect(() => {
    if (!isSpinning || !pendingPrizeId) {
      return;
    }

    const timeoutId = window.setTimeout(finishPendingSpin, 5000);

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

  const updateManagedPrize = (
    prizeId: string,
    updates: Partial<Omit<Prize, 'given'>>,
  ) => {
    updatePrize(prizeId, updates);
    setManagementError('');
  };
  const addManagedPrize = () => {
    addPrize(t('wheel.manage.newPrize'));
    setManagementError('');
  };

  if (accessSessionStatus.state === 'loading' || currentUser.role !== 'wheel') {
    return null;
  }

  return (
    <>
      <TopBar
        customButtons={
          <button
            className="stock-toolbar-button"
            type="button"
            onClick={() => setIsPrizeManagerOpen(true)}
          >
            {t('wheel.manage.open')}
          </button>
        }
        showUserMenu
        onLogout={() => navigate('/')}
      />
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
                    completed={completedActivities}
                    total={totalActivities}
                  />
                </div>
                <div className="wheel-shot-summary">
                  <div className="wheel-shot-previous">
                    <span>{t('wheel.kid.previousShots')}</span>
                    <strong>{shotSummary.usedShots}</strong>
                  </div>
                  <div className="wheel-shot-meter">
                    <span>{t('wheel.kid.remainingShots')}</span>
                    <strong>{shotSummary.availableShots}</strong>
                  </div>
                </div>
                {shotSummary.awards.length > 0 ? (
                  <ol className="wheel-award-list">
                    {shotSummary.awards.map((award) => (
                      <li
                        className={
                          award.prizeKind === 'final' ? 'final-award' : undefined
                        }
                        key={award.id}
                        ref={(element) => {
                          awardItemRefs.current[award.id] = element;
                        }}
                      >
                        {award.prizeTitle}
                      </li>
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
              {wonPrize ? (
                <p
                  className={
                    wonPrize.isFlying
                      ? 'wheel-winner-badge flying'
                      : 'wheel-winner-badge'
                  }
                  ref={winnerBadgeRef}
                  role="status"
                  style={
                    {
                      '--winner-dx': `${wonPrize.dx}px`,
                      '--winner-dy': `${wonPrize.dy}px`,
                    } as CSSProperties
                  }
                >
                  {wonPrize.title}
                </p>
              ) : null}
              <div className="wheel-pointer" aria-hidden="true" />
              <div
                className={[
                  'prize-wheel',
                  isSpinning ? 'spinning' : '',
                  isResettingWheel ? 'resetting' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  background: wheelBackground,
                  transform: `rotate(${rotation}deg)`,
                }}
                onClick={startSpin}
                onTransitionEnd={finishSpin}
              >
                <button
                  className={isFillingWheel ? 'wheel-center filling' : 'wheel-center'}
                  type="button"
                  disabled={!canSpin}
                  onClick={(event) => {
                    event.stopPropagation();
                    startSpin();
                  }}
                >
                  {isFillingWheel ? (
                    <>
                      <strong className="wheel-fill-counter">
                        {filledSegmentCount}
                      </strong>
                      <span>
                        {t('wheel.spin.loading').replace(
                          '{count}',
                          String(activeWheelSegments.length),
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <IterationsIcon size={34} aria-hidden="true" />
                      <span>{spinButtonLabel}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
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

        {isPrizeManagerOpen ? (
          <div
            className="prize-manager-overlay"
            role="presentation"
            onClick={() => setIsPrizeManagerOpen(false)}
          >
            <section
              className="prize-manager"
              role="dialog"
              aria-modal="true"
              aria-labelledby="prize-manager-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="prize-manager-header">
                <div>
                  <p className="eyebrow">{t('wheel.manage.eyebrow')}</p>
                  <h2 id="prize-manager-title">{t('wheel.manage.title')}</h2>
                </div>
                <p>{t('wheel.manage.description')}</p>
                <button
                  className="secondary-button prize-manager-add"
                  type="button"
                  onClick={addManagedPrize}
                >
                  {t('wheel.manage.addPrize')}
                </button>
                <button
                  className="secondary-button prize-manager-close"
                  type="button"
                  onClick={() => setIsPrizeManagerOpen(false)}
                >
                  {t('wheel.manage.close')}
                </button>
              </div>
              {managementError ? (
                <p className="form-error">{managementError}</p>
              ) : null}
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
                        min={prize.given}
                        type="number"
                        value={prize.initialUnits}
                        onChange={(event) =>
                          updateManagedPrize(prize.id, {
                            initialUnits: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <div className="prize-given">
                      <span>{t('wheel.manage.given')}</span>
                      <strong>{prize.given}</strong>
                    </div>
                    <label>
                      {t('wheel.manage.kind')}
                      <select
                        value={prize.kind}
                        onChange={(event) =>
                          updateManagedPrize(prize.id, {
                            kind: event.target.value as Prize['kind'],
                          })
                        }
                      >
                        <option value="normal">{t('wheel.manage.kind.normal')}</option>
                        <option value="valuable">
                          {t('wheel.manage.kind.valuable')}
                        </option>
                        <option value="final">{t('wheel.manage.kind.final')}</option>
                      </select>
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
          </div>
        ) : null}
      </section>
    </>
  );
}
