import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegistrationFields } from '../components/RegistrationFields';
import { TopBar } from '../components/TopBar';
import {
  useAddRegisteredKid,
  useUserData,
  useUsersData,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import type { Locale } from '../i18n/messages';
import {
  isKidGender,
  isValidKidAge,
  parseRegistrationPayload,
  type KidGender,
} from '../registration';

export function DeskPage() {
  const addRegisteredKid = useAddRegisteredKid();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(undefined);
  const navigate = useNavigate();
  const streamRef = useRef<MediaStream>(undefined);
  const user = useUserData();
  const users = useUsersData();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { locale, t } = useI18n();
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<KidGender>('preferNotToSay');
  const [languagePreference, setLanguagePreference] = useState<Locale>(locale);
  const [formError, setFormError] = useState('');
  const [invalidQrPreview, setInvalidQrPreview] = useState('');
  const kids = users.filter((availableUser) => availableUser.role === 'kid');
  const lastRegisteredKids = [...kids].reverse().slice(0, 3);
  const kidCount = kids.length;

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
        setInvalidQrPreview(qrPayload);
        return;
      }

      setNickname(registration.nickname);
      setAge(String(registration.age));
      setGender(registration.gender);
      setLanguagePreference(registration.languagePreference);
      setFormError('');
      setInvalidQrPreview('');
    } catch {
      setFormError(t('desk.error.invalidQr'));
      setInvalidQrPreview(qrPayload);
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

  const getCameraStream = async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'environment' },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw error;
      }

      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
    }
  };

  const startScanner = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setFormError(t('desk.error.cameraUnsupported'));
      return;
    }

    try {
      setFormError('');
      setInvalidQrPreview('');
      const stream = await getCameraStream();

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error('Video element is not available');
      }

      videoRef.current.srcObject = stream;
      setIsScannerActive(true);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      await videoRef.current.play();
      frameRef.current = window.requestAnimationFrame(scanVideoFrame);
    } catch (error) {
      stopScanner();
      setFormError(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? t('desk.error.cameraPermission')
          : t('desk.error.cameraStart'),
      );
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

    addRegisteredKid({
      age: nextAge,
      gender,
      languagePreference,
      nickname,
    });

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
            <section className="scanner-panel" aria-label={t('desk.scanQr')}>
              {isScannerActive ? <p>{t('desk.scanner.active')}</p> : null}
              <div
                className={isScannerActive ? 'scanner-view' : 'scanner-view hidden'}
              >
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  aria-label={t('desk.cameraPreview')}
                />
                <canvas ref={canvasRef} hidden />
              </div>
              {isScannerActive ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={stopScanner}
                >
                  {t('desk.stopScanner')}
                </button>
              ) : (
                <button
                  className="scanner-toggle-button"
                  type="button"
                  aria-label={t('desk.scanQr')}
                  title={t('desk.scanQr')}
                  onClick={startScanner}
                >
                  <span className="qr-icon" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  <span>{t('desk.scanQrShort')}</span>
                </button>
              )}
            </section>
            <RegistrationFields
              age={age}
              gender={gender}
              languagePreference={languagePreference}
              nickname={nickname}
              setAge={setAge}
              setGender={setGender}
              setLanguagePreference={setLanguagePreference}
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
          <button className="access-button desk-submit-button" type="submit">
            {t('desk.confirm')}
          </button>
        </form>

        <section className="desk-summary" aria-label={t('desk.summary.title')}>
          <article>
            <span>{t('desk.summary.lastKid')}</span>
            {lastRegisteredKids.length > 0 ? (
              <ul className="last-kids-list">
                {lastRegisteredKids.map((kid) => (
                  <li key={kid.id}>
                    {kid.gender === 'boy' || kid.gender === 'girl' ? (
                      <span
                        className={`kid-gender-icon ${kid.gender}`}
                        aria-label={t(`registration.gender.${kid.gender}`)}
                        role="img"
                      />
                    ) : null}
                    <strong>{kid.name}</strong>
                  </li>
                ))}
              </ul>
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
