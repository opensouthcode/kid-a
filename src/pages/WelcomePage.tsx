import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KidsSection, SelectedKidPassport } from '../components/KidsSection';
import { SampleAccessDialog } from '../components/SampleAccessDialog';
import { TopBar } from '../components/TopBar';
import {
  useActivitiesData,
  useConferenceData,
  useCurrentUser,
  type Kid,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';

export function WelcomePage() {
  const activities = useActivitiesData();
  const conference = useConferenceData();
  const currentUser = useCurrentUser();
  const { t } = useI18n();
  const [selectedFriendKid, setSelectedFriendKid] = useState<Kid | undefined>();
  const blockedKidId = currentUser.role === 'kid' ? currentUser.id : '';

  return (
    <>
      <TopBar
        navigateOnAvatar
        showLanguageSwitcher
        showUserMenu={currentUser.role !== 'guest'}
      />
      <section className="welcome-content">
        <p className="eyebrow">{conference.shortName}</p>
        <h1>
          {t('app.titlePrefix')} {conference.title}
        </h1>
        <p className="site-description">{t('app.description')}</p>
        <SampleAccessDialog />
        <section className="welcome-activity-list" aria-label={t('activity.list.title')}>
          <h2>{t('activity.list.title')}</h2>
          <ol>
            {activities.map((activity) => (
              <li key={activity.id}>
                <Link to={`/activity?id=${activity.id.padStart(2, '0')}`}>
                  <span>{activity.id.padStart(2, '0')}</span>
                  {activity.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>
        <KidsSection
          blockedKidId={blockedKidId}
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
