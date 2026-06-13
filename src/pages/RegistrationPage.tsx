import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { useI18n } from '../i18n/I18nProvider';
import { supportedLocales, type Locale } from '../i18n/messages';
import {
  ageGaugeMaximum,
  ageGaugeMiddle,
  ageGaugeMinimum,
  createRegistrationPayload,
  isKidGender,
  isValidKidAge,
  kidGenderOptions,
  type KidGender,
} from '../registration';

const fallbackAgeGaugeValue = Math.round((ageGaugeMinimum + ageGaugeMaximum) / 2);

function getAgeGaugeValue(age: string) {
  const ageNumber = Number(age);

  if (!Number.isInteger(ageNumber)) {
    return fallbackAgeGaugeValue;
  }

  return Math.min(Math.max(ageNumber, ageGaugeMinimum), ageGaugeMaximum);
}

export function RegistrationPage() {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<KidGender>('preferNotToSay');
  const [languagePreference, setLanguagePreference] = useState<Locale>(locale);
  const [registrationPayload, setRegistrationPayload] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!registrationPayload) {
      setQrCodeUrl('');
      return;
    }

    QRCode.toDataURL(registrationPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
    })
      .then(setQrCodeUrl)
      .catch(() => setFormError(t('registration.error.qr')));
  }, [registrationPayload, t]);

  const submitRegistration = (event: React.FormEvent<HTMLFormElement>) => {
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

    setFormError('');
    setRegistrationPayload(
      JSON.stringify(
        createRegistrationPayload({
          age: nextAge,
          gender,
          languagePreference,
          nickname,
        }),
      ),
    );
  };

  return (
    <>
      <TopBar showLanguageSwitcher />
      <section className="registration-content" aria-labelledby="register-title">
        <button
          className="link-button"
          type="button"
          onClick={() => navigate('/')}
        >
          {t('navigation.home')}
        </button>
        <p className="eyebrow">{t('registration.eyebrow')}</p>
        <h1 id="register-title">{t('registration.title')}</h1>
        <p className="site-description">{t('registration.description')}</p>
        <p className="registration-notice">{t('registration.deskOnly')}</p>

        <div className="registration-layout">
          <form className="registration-form" onSubmit={submitRegistration}>
            <label>
              <span>{t('registration.nickname')}</span>
              <input
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                autoComplete="nickname"
                required
              />
            </label>
            <label>
              <span>{t('registration.age')}</span>
              <div className="age-control">
                <input
                  type="number"
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  required
                />
                <input
                  type="range"
                  min={ageGaugeMinimum}
                  max={ageGaugeMaximum}
                  value={getAgeGaugeValue(age)}
                  aria-label={t('registration.ageGauge')}
                  onChange={(event) => setAge(event.target.value)}
                />
                <div className="age-gauge-labels" aria-hidden="true">
                  <span>{ageGaugeMinimum}</span>
                  <span>{ageGaugeMiddle}</span>
                  <span>{ageGaugeMaximum}</span>
                </div>
              </div>
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
              <div className="segmented-toggle language-toggle" role="group">
                {supportedLocales.map((availableLocale) => (
                  <button
                    className={
                      languagePreference === availableLocale ? 'active' : undefined
                    }
                    key={availableLocale}
                    type="button"
                    aria-pressed={languagePreference === availableLocale}
                    onClick={() => setLanguagePreference(availableLocale)}
                  >
                    {t(`language.${availableLocale}`)}
                  </button>
                ))}
              </div>
            </label>
            {formError ? <p className="form-error">{formError}</p> : null}
            <button className="access-button" type="submit">
              {t('registration.generateQr')}
            </button>
          </form>

          <aside className="qr-panel" aria-label={t('registration.qr.title')}>
            {registrationPayload && qrCodeUrl ? (
              <>
                <h2>{t('registration.qr.title')}</h2>
                <img src={qrCodeUrl} alt={t('registration.qr.alt')} />
                <p>{t('registration.qr.instructions')}</p>
                <textarea readOnly value={registrationPayload} />
              </>
            ) : (
              <p>{t('registration.qr.empty')}</p>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
