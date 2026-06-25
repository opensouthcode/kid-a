import { SyncIcon } from '@primer/octicons-react';
import { useEffect, useState } from 'react';
import {
  useGetPassportForKid,
  useReloadPassportActivitiesForKids,
  type Kid,
} from '../contexts/DataLayerContext';
import { useGetFriendKids } from '../contexts/LocalDataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import { FriendPassportView } from './FriendPassportView';
import { KidFinder } from './KidFinder';
import { KidGenderIcon } from './KidGenderIcon';
import { ProgressCounter } from './ProgressCounter';

type KidsSectionProps = {
  blockedKidId?: string;
  onKidSelected: (kid: Kid) => void;
};

export function KidsSection({
  blockedKidId = '',
  onKidSelected,
}: KidsSectionProps) {
  const getFriendKids = useGetFriendKids();
  const getPassportForKid = useGetPassportForKid();
  const reloadPassportActivitiesForKids = useReloadPassportActivitiesForKids();
  const { t } = useI18n();
  const [isFriendPickerOpen, setIsFriendPickerOpen] = useState(false);
  const [isRefreshingFriends, setIsRefreshingFriends] = useState(false);
  const friends = getFriendKids().filter((kid) => kid.id !== blockedKidId);
  const friendKidIds = friends.map((kid) => kid.id).join(',');

  const refreshFriendPassports = async () => {
    if (!friendKidIds) {
      return;
    }

    setIsRefreshingFriends(true);

    try {
      await reloadPassportActivitiesForKids(friends.map((kid) => kid.id));
    } catch (error) {
      console.error('Unable to refresh friends passport progress.', error);
    } finally {
      setIsRefreshingFriends(false);
    }
  };

  useEffect(() => {
    void refreshFriendPassports();
  }, [friendKidIds]);

  return (
    <section className="welcome-friends-list" aria-label={t('friends.home.title')}>
      <div className="welcome-friends-header">
        <h2>{t('friends.home.title')}</h2>
        {friends.length > 0 ? (
          <button
            className="welcome-friends-refresh-button"
            type="button"
            aria-label={t('friends.refresh')}
            title={t('friends.refresh')}
            disabled={isRefreshingFriends}
            onClick={() => {
              void refreshFriendPassports();
            }}
          >
            <SyncIcon size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {friends.length > 0 ? (
        <ol>
          {friends.map((kid) => {
            const friendPassport = getPassportForKid(kid.id);
            const completedActivities = friendPassport.activities.filter(
              (activity) => activity.completedAt,
            ).length;

            return (
              <li key={kid.id}>
                <button
                  className="welcome-friend-button"
                  type="button"
                  onClick={() => onKidSelected(kid)}
                >
                  <KidGenderIcon
                    gender={kid.gender}
                    label={t(`registration.gender.${kid.gender}`)}
                  />
                  <strong>{kid.name}</strong>
                  <ProgressCounter
                    completed={completedActivities}
                    total={friendPassport.activities.length}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
      {!isFriendPickerOpen ? (
        <button
          className="secondary-button welcome-find-button"
          type="button"
          onClick={() => setIsFriendPickerOpen(true)}
        >
          {t('friends.add.open')}
        </button>
      ) : null}
      {isFriendPickerOpen ? (
        <>
          <section className="friend-picker-panel" aria-label={t('friends.add.title')}>
            <KidFinder
              blockedKidId={blockedKidId}
              blockedKidMessage="friends.error.self"
              messages={{
                confirmButton: 'friends.picker.confirmButton',
                confirmKid: 'friends.picker.confirm',
                invalidKidQr: 'friends.error.invalidKidQr',
                kidNotFound: 'friends.error.kidNotFound',
                manualKid: 'friends.picker.manualKid',
                manualKidSearch: 'friends.picker.search',
                scanApproved: 'friends.picker.scanApproved',
                scannerActive: 'friends.picker.scanActive',
                scanQr: 'friends.picker.scanTitle',
                scanQrShort: 'friends.picker.scanShort',
              }}
              onKidSelected={(kid) => {
                setIsFriendPickerOpen(false);
                onKidSelected(kid);
              }}
            />
          </section>
          <button
            className="secondary-button welcome-find-button"
            type="button"
            onClick={() => setIsFriendPickerOpen(false)}
          >
            {t('friends.add.close')}
          </button>
        </>
      ) : null}
    </section>
  );
}

type SelectedKidPassportProps = {
  kid: Kid;
  onClose: () => void;
};

export function SelectedKidPassport({ kid, onClose }: SelectedKidPassportProps) {
  const { t } = useI18n();

  return (
    <div
      className="kid-qr-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="friend-passport-title"
      onClick={onClose}
    >
      <section
        className="kid-qr-dialog friend-passport-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="dialog-close-button"
          type="button"
          aria-label={t('friends.dialog.close')}
          title={t('friends.dialog.close')}
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
        <FriendPassportView kid={kid} />
      </section>
    </div>
  );
}
