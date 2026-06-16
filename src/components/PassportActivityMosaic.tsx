import type { CSSProperties } from 'react';
import passportHero from '../assets/passport-hero.png';
import type { PassportActivity } from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';

type PassportActivityMosaicProps = {
  activities: PassportActivity[];
  className?: string;
  getActivityTitle?: (activityId: number) => string;
};

const passportColumnCount = 4;

type PassportCellStyle = CSSProperties & {
  '--passport-cell-x': string;
  '--passport-cell-y': string;
};

function getPassportCellStyle(activityId: number): PassportCellStyle {
  const normalizedIndex = Math.max(activityId - 1, 0);
  const column = normalizedIndex % passportColumnCount;
  const row = Math.floor(normalizedIndex / passportColumnCount);
  const maxOffset = passportColumnCount - 1;

  return {
    '--passport-cell-x': `${(column * 100) / maxOffset}%`,
    '--passport-cell-y': `${(row * 100) / maxOffset}%`,
    backgroundImage: `url(${passportHero})`,
  };
}

export function PassportActivityMosaic({
  activities,
  className,
  getActivityTitle,
}: PassportActivityMosaicProps) {
  const { t } = useI18n();

  return (
    <div className={['passport-mosaic', className].filter(Boolean).join(' ')}>
      {activities.map((activity) => {
        const activityNumber = activity.id.toString().padStart(2, '0');
        const activityTitle = getActivityTitle?.(activity.id) ?? '';
        const activityStatus = activity.completedAt
          ? t('kid.activity.completed')
          : t('kid.activity.pending');
        const activityLabel = [activityNumber, activityTitle, activityStatus]
          .filter(Boolean)
          .join(' - ');

        return (
          <article
            aria-label={activityLabel}
            className={
              activity.completedAt
                ? 'passport-mosaic-cell completed'
                : 'passport-mosaic-cell'
            }
            key={activity.id}
            style={getPassportCellStyle(activity.id)}
          >
            <span className="passport-mosaic-number" aria-hidden="true">
              {activityNumber}
            </span>
          </article>
        );
      })}
    </div>
  );
}
