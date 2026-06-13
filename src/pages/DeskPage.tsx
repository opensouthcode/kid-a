import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import {
  useAddRegisteredKid,
  useUserData,
  type UserData,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import { supportedLocales, type Locale } from '../i18n/messages';
import {
  ageGaugeMaximum,
  ageGaugeMiddle,
  ageGaugeMinimum,
  isKidGender,
  isValidKidAge,
  kidGenderOptions,
  parseRegistrationPayload,
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

export function DeskPage() {
  const addRegisteredKid = useAddRegisteredKid();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(undefined);
  const navigate = useNavigate();
  const streamRef = useRef<MediaStream>(undefined);
  const user = useUserData();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { locale, t } = useI18n();
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);
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

  const stopScanner = () => {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScannerActive(false);
  };

  useEffect(() => {
    return stopScanner;
  }, []);

  const readQrPayload = (qrPayload: string) => {
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

  const scanVideoFrame = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });

    if (!canvas || !context || !video) {
      frameRef.current = window.requestAnimationFrame(scanVideoFrame);
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

      if (qrCode?.data) {
        stopScanner();
        readQrPayload(qrCode.data);
        return;
      }
    }

    frameRef.current = window.requestAnimationFrame(scanVideoFrame);
  };

  const startScanner = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setFormError(t('desk.error.cameraUnsupported'));
      return;
    }

    try {
      setFormError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'environment' },
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error('Video element is not available');
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsScannerActive(true);
      frameRef.current = window.requestAnimationFrame(scanVideoFrame);
    } catch {
      stopScanner();
      setFormError(t('desk.error.cameraPermission'));
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
      <TopBar showUserMenu onLogout={() => navigate('/')} />
      <section className="registration-content" aria-labelledby="desk-title">
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
            <div className="desk-registration-layout">
              <section className="scanner-panel" aria-label={t('desk.scanQr')}>
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  aria-label={t('desk.cameraPreview')}
                />
                <canvas ref={canvasRef} hidden />
                <p>
                  {isScannerActive
                    ? t('desk.scanner.active')
                    : t('desk.scanner.idle')}
                </p>
                <div className="scanner-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={startScanner}
                    disabled={isScannerActive}
                  >
                    {t('desk.scanQr')}
                  </button>
                  {isScannerActive ? (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={stopScanner}
                    >
                      {t('desk.stopScanner')}
                    </button>
                  ) : null}
                </div>
              </section>
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
                          languagePreference === availableLocale
                            ? 'active'
                            : undefined
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
              </div>
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
