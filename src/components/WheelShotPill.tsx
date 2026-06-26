import { IterationsIcon } from '@primer/octicons-react';
import type { PassportWheelShotSummary } from '../data/data-model';
import { useI18n } from '../i18n/I18nProvider';

type WheelShotPillProps = {
  summary?: PassportWheelShotSummary;
};

export function WheelShotPill({ summary }: WheelShotPillProps) {
  const { t } = useI18n();
  const safeSummary = summary ?? {
    availableShots: 0,
    earnedShots: 0,
    usedShots: 0,
  };
  const label = t('kid.wheel.shotsMade')
    .replace('{used}', String(safeSummary.usedShots))
    .replace('{earned}', String(safeSummary.earnedShots))
    .replace('{available}', String(safeSummary.availableShots));

  return (
    <span
      className={
        safeSummary.availableShots > 0
          ? 'wheel-shot-pill available'
          : 'wheel-shot-pill'
      }
      aria-label={label}
      title={label}
    >
      <IterationsIcon size={14} aria-hidden="true" />
      {safeSummary.usedShots}/{safeSummary.earnedShots}
    </span>
  );
}
