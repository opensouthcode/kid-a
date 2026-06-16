import { XIcon } from '@primer/octicons-react';
import { useEffect, useState } from 'react';
import {
  useCurrentUser,
  type Kid,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import { FriendPassportView } from './FriendPassportView';
import { KidsSection } from './KidsSection';

type FriendsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function FriendsDialog({ isOpen, onClose }: FriendsDialogProps) {
  const currentUser = useCurrentUser();
  const { t } = useI18n();
  const [selectedFriendKid, setSelectedFriendKid] = useState<Kid | undefined>();

  useEffect(() => {
    if (!isOpen) {
      setSelectedFriendKid(undefined);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="kid-qr-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={selectedFriendKid ? 'friend-passport-title' : undefined}
      aria-label={!selectedFriendKid ? t('friends.home.title') : undefined}
      onClick={onClose}
    >
      <section
        className="kid-qr-dialog friends-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="dialog-close-button"
          type="button"
          aria-label={t('friends.dialog.close')}
          title={t('friends.dialog.close')}
          onClick={onClose}
        >
          <XIcon size={18} aria-hidden="true" />
        </button>
        {selectedFriendKid ? (
          <FriendPassportView kid={selectedFriendKid} />
        ) : (
          <KidsSection
            blockedKidId={currentUser.id}
            onKidSelected={setSelectedFriendKid}
          />
        )}
      </section>
    </div>
  );
}
