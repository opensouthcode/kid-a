import { StarFillIcon, StarIcon } from '@primer/octicons-react';
import type { Kid } from '../contexts/DataLayerContext';
import { useIsFriend, useToggleFriend } from '../contexts/LocalDataLayerContext';
import { useI18n } from '../i18n/I18nProvider';

type FriendStarButtonProps = {
  kid: Kid;
};

export function FriendStarButton({ kid }: FriendStarButtonProps) {
  const isFriend = useIsFriend();
  const toggleFriend = useToggleFriend();
  const { t } = useI18n();
  const friendSelected = isFriend(kid.id);
  const label = friendSelected
    ? t('friends.star.remove').replace('{name}', kid.name)
    : t('friends.star.add').replace('{name}', kid.name);

  return (
    <button
      className={friendSelected ? 'friend-star-button active' : 'friend-star-button'}
      type="button"
      aria-label={label}
      aria-pressed={friendSelected}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        toggleFriend(kid);
      }}
    >
      {friendSelected ? (
        <StarFillIcon size={30} aria-hidden="true" />
      ) : (
        <StarIcon size={30} aria-hidden="true" />
      )}
    </button>
  );
}
