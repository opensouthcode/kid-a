import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrReader } from '../components/QrReader';
import { KidList } from '../components/KidList';
import { RegisterKidForm } from '../components/RegisterKidForm';
import { TopBar } from '../components/TopBar';
import {
  useAddRegisteredKid,
  useCurrentUser,
  useKidsData,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import type { Locale } from '../i18n/messages';
import {
  isKidGender,
  isValidKidAge,
  parseRegistrationPayload,
  type KidGender,
} from '../utils/kid-registration';

export function DeskPage() {
  const addRegisteredKid = useAddRegisteredKid();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const kids = useKidsData();
  const { locale, t } = useI18n();
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<KidGender>('preferNotToSay');
  const [language, setLanguage] = useState<Locale>(locale);
  const [formError, setFormError] = useState('');
  const [invalidQrPreview, setInvalidQrPreview] = useState('');
  const [isConfirmAttentionActive, setIsConfirmAttentionActive] = useState(false);
  const [lastAnimatedKidId, setLastAnimatedKidId] = useState('');
  const lastRegisteredKids = [...kids].reverse().slice(0, 3);
  const kidCount = kids.length;

  useEffect(() => {
    if (currentUser.role !== 'desk') {
      navigate('/', { replace: true });
    }
  }, [currentUser.role, navigate]);

  if (currentUser.role !== 'desk') {
    return null;
  }

  const clearRegistrationForm = () => {
    setNickname('');
    setAge('');
    setGender('preferNotToSay');
    setLanguage(locale);
  };

  const readQrPayload = (qrPayload: string) => {
    try {
      const registration = parseRegistrationPayload(qrPayload);

      if (!registration) {
        setFormError(t('desk.error.invalidQr'));
        setInvalidQrPreview(qrPayload);
        return;
      }

      setNickname(registration.nickname);
      setAge(String(registration.age));
      setGender(registration.gender);
      setLanguage(registration.language);
      setIsConfirmAttentionActive(true);
      setFormError('');
      setInvalidQrPreview('');
    } catch {
      setFormError(t('desk.error.invalidQr'));
      setInvalidQrPreview(qrPayload);
    }
  };

  const confirmRegistration = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextAge = Number(age);

    if (!nickname.trim()) {
      setFormError(t('registration.error.nickname'));
      setInvalidQrPreview('');
      return;
    }

    if (!isValidKidAge(nextAge)) {
      setFormError(t('registration.error.age'));
      setInvalidQrPreview('');
      return;
    }

    if (!isKidGender(gender)) {
      setFormError(t('registration.error.gender'));
      setInvalidQrPreview('');
      return;
    }

    const registeredKid = addRegisteredKid({
      age: nextAge,
      gender,
      language,
      nickname,
    });

    setLastAnimatedKidId(registeredKid.id);
    setIsConfirmAttentionActive(false);
    clearRegistrationForm();
    setFormError('');
    setInvalidQrPreview('');
  };

  return (
    <>
      <TopBar showUserMenu onLogout={() => navigate('/')} />
      <section className="registration-content" aria-labelledby="desk-title">
        <p className="eyebrow">{t('desk.eyebrow')}</p>
        <h1 id="desk-title">{t('desk.title')}</h1>
        <p className="site-description">{t('desk.description')}</p>

        <form className="desk-registration" onSubmit={confirmRegistration}>
          <div className="desk-registration-layout">
            <QrReader
              labelKeys={{
                scanQr: 'desk.scanQr',
                scanQrShort: 'desk.scanQrShort',
              }}
              onError={(message) => {
                setFormError(message);
                setInvalidQrPreview('');
              }}
              onRead={readQrPayload}
            />
            <RegisterKidForm
              age={age}
              gender={gender}
              language={language}
              nickname={nickname}
              setAge={setAge}
              setGender={setGender}
              setLanguage={setLanguage}
              setNickname={setNickname}
            />
          </div>
          {formError ? (
            <div className="form-error">
              <p>{formError}</p>
              {invalidQrPreview ? (
                <pre className="invalid-qr-preview">{invalidQrPreview}</pre>
              ) : null}
            </div>
          ) : null}
          <button
            className={
              isConfirmAttentionActive
                ? 'access-button desk-submit-button attention'
                : 'access-button desk-submit-button'
            }
            type="submit"
            onAnimationEnd={() => setIsConfirmAttentionActive(false)}
          >
            {t('desk.confirm')}
          </button>
        </form>

        <section className="desk-summary" aria-label={t('desk.summary.title')}>
          <article>
            <span>{t('desk.summary.lastKid')}</span>
            {lastRegisteredKids.length > 0 ? (
              <KidList
                animatedKidId={lastAnimatedKidId}
                kids={lastRegisteredKids}
                onAnimatedKidDone={() => setLastAnimatedKidId('')}
              />
            ) : (
              <strong>{t('desk.summary.none')}</strong>
            )}
          </article>
          <article className="kid-count-card">
            <strong>{kidCount}</strong>
          </article>
        </section>
      </section>
    </>
  );
}
