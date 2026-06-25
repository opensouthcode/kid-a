import type { Kid } from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import { KidGenderIcon } from './KidGenderIcon';

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
          <KidGenderIcon
            gender={kid.gender}
            label={t(`registration.gender.${kid.gender}`)}
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
