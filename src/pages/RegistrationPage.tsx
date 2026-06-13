import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { useI18n } from '../i18n/I18nProvider';
import {
  createRegistrationPayload,
  isKidGender,
  isValidKidAge,
  kidGenderOptions,
  maximumKidAge,
  minimumKidAge,
  type KidGender,
} from '../registration';

export function RegistrationPage() {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<KidGender>('preferNotToSay');
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
          languagePreference: locale,
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
              <select
                value={gender}
                onChange={(event) => setGender(event.target.value as KidGender)}
              >
                {kidGenderOptions.map((option) => (
                  <option key={option} value={option}>
                    {t(`registration.gender.${option}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('registration.languagePreference')}</span>
              <output className="language-display">{t(`language.${locale}`)}</output>
              <small>{t('registration.languageGlobalHint')}</small>
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
