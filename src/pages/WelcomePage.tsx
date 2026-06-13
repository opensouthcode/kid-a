import { SampleAccessDialog } from '../components/SampleAccessDialog';
import { TopBar } from '../components/TopBar';
import { useConferenceData } from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';

export function WelcomePage() {
  const conference = useConferenceData();
  const { t } = useI18n();

  return (
    <>
      <TopBar showLanguageSwitcher showGuestAvatar />
      <section className="welcome-content">
        <p className="eyebrow">{conference.shortName}</p>
        <h1>
          {t('app.titlePrefix')} {conference.title}
        </h1>
        <p className="site-description">{t('app.description')}</p>
        <SampleAccessDialog />
      </section>
    </>
  );
}
