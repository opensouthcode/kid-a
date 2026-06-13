import type { Kid } from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';

type KidListProps = {
  animatedKidId?: string;
  detailsByKidId?: Record<string, string>;
  kids: Kid[];
  onAnimatedKidDone?: (kid: Kid) => void;
};

export function KidList({
  animatedKidId = '',
  detailsByKidId = {},
  kids,
  onAnimatedKidDone,
}: KidListProps) {
  const { t } = useI18n();

  return (
    <ul className="last-kids-list">
      {kids.map((kid) => (
        <li
          className={kid.id === animatedKidId ? 'just-added' : undefined}
          key={kid.id}
          onAnimationEnd={() => {
            if (kid.id === animatedKidId) {
              onAnimatedKidDone?.(kid);
            }
          }}
        >
          <span
            className={`kid-gender-icon ${kid.gender}`}
            aria-label={t(`registration.gender.${kid.gender}`)}
            role="img"
          />
          <code>{kid.id}</code>
          <strong>{kid.name}</strong>
          {detailsByKidId[kid.id] ? (
            <time className="last-kid-time">{detailsByKidId[kid.id]}</time>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
