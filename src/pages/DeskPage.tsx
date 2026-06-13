import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import {
  useAddRegisteredKid,
  useUserData,
  type UserData,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import type { Locale } from '../i18n/messages';
import {
  isKidGender,
  isValidKidAge,
  kidGenderOptions,
  maximumKidAge,
  minimumKidAge,
  parseRegistrationPayload,
  type KidGender,
} from '../registration';

export function DeskPage() {
  const addRegisteredKid = useAddRegisteredKid();
  const navigate = useNavigate();
  const user = useUserData();
  const { locale, t } = useI18n();
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [qrPayload, setQrPayload] = useState('');
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<KidGender>('preferNotToSay');
  const [languagePreference, setLanguagePreference] = useState<Locale>(locale);
  const [formError, setFormError] = useState('');
  const [registeredKid, setRegisteredKid] = useState<UserData>();

  useEffect(() => {
    if (user.role !== 'desk') {
      navigate('/', { replace: true });
    }
  }, [navigate, user.role]);

  const readQrPayload = () => {
    try {
      const registration = parseRegistrationPayload(qrPayload);

      if (!registration) {
        setFormError(t('desk.error.invalidQr'));
        return;
      }

      setNickname(registration.nickname);
      setAge(String(registration.age));
      setGender(registration.gender);
      setLanguagePreference(registration.languagePreference);
      setFormError('');
    } catch {
      setFormError(t('desk.error.invalidQr'));
    }
  };

  const confirmRegistration = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextAge = Number(age);

    if (!nickname.trim()) {
      setFormError(t('registration.error.nickname'));
      return;
    }

    if (!isValidKidAge(nextAge)) {
      setFormError(t('registration.error.age'));
      return;
    }

    if (!isKidGender(gender)) {
      setFormError(t('registration.error.gender'));
      return;
    }

    const nextRegisteredKid = addRegisteredKid({
      age: nextAge,
      gender,
      languagePreference,
      nickname,
    });

    setRegisteredKid(nextRegisteredKid);
    setFormError('');
    setIsRegistrationOpen(false);
  };

  return (
    <>
      <TopBar showLanguageSwitcher />
      <section className="registration-content" aria-labelledby="desk-title">
        <button
          className="link-button"
          type="button"
          onClick={() => navigate('/')}
        >
          {t('navigation.home')}
        </button>
        <p className="eyebrow">{t('desk.eyebrow')}</p>
        <h1 id="desk-title">{t('desk.title')}</h1>
        <p className="site-description">{t('desk.description')}</p>
        <button
          className="access-button"
          type="button"
          aria-expanded={isRegistrationOpen}
          onClick={() => setIsRegistrationOpen((isOpen) => !isOpen)}
        >
          {t('desk.registerKid')}
        </button>

        {registeredKid ? (
          <section className="confirmation-card" aria-live="polite">
            <strong>{t('desk.confirmed.title')}</strong>
            <p>
              {registeredKid.name} {t('desk.confirmed.description')}
            </p>
          </section>
        ) : null}

        {isRegistrationOpen ? (
          <form className="desk-registration" onSubmit={confirmRegistration}>
            <label>
              <span>{t('desk.qrData')}</span>
              <textarea
                value={qrPayload}
                onChange={(event) => setQrPayload(event.target.value)}
                placeholder={t('desk.qrData.placeholder')}
              />
            </label>
            <button className="secondary-button" type="button" onClick={readQrPayload}>
              {t('desk.readQr')}
            </button>
            <div className="registration-form compact">
              <label>
                <span>{t('registration.nickname')}</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>{t('registration.age')}</span>
                <input
                  type="number"
                  min={minimumKidAge}
                  max={maximumKidAge}
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>{t('registration.gender')}</span>
                <div className="segmented-toggle" role="group">
                  {kidGenderOptions.map((option) => (
                    <button
                      className={gender === option ? 'active' : undefined}
                      key={option}
                      type="button"
                      aria-pressed={gender === option}
                      onClick={() => setGender(option)}
                    >
                      {t(`registration.gender.${option}`)}
                    </button>
                  ))}
                </div>
              </label>
              <label>
                <span>{t('registration.languagePreference')}</span>
                <output className="language-display">
                  {t(`language.${languagePreference}`)}
                </output>
              </label>
            </div>
            {formError ? <p className="form-error">{formError}</p> : null}
            <button className="access-button" type="submit">
              {t('desk.confirm')}
            </button>
          </form>
        ) : null}
      </section>
    </>
  );
}
