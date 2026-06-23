import QRCode from 'qrcode';
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
import { createKidPassportUrl } from '../utils/kid-id';

type PrintablePassportQr = {
  id: string;
  qrCodeUrl: string;
};

const PASSPORT_QR_COUNT = 200;
const PASSPORT_QR_ID_PREFIX = '26OSK';

const createPassportQrId = (number: number) =>
  `${PASSPORT_QR_ID_PREFIX}${String(number).padStart(4, '0')}`;

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
  const [printablePassportQrs, setPrintablePassportQrs] = useState<
    PrintablePassportQr[]
  >([]);
  const [isGeneratingPrintQrs, setIsGeneratingPrintQrs] = useState(false);
  const [isPrintQrSheetOpen, setIsPrintQrSheetOpen] = useState(false);
  const [shouldPrintQrSheet, setShouldPrintQrSheet] = useState(false);
  const [printQrError, setPrintQrError] = useState('');
  const lastRegisteredKids = [...kids].reverse().slice(0, 3);
  const kidCount = kids.length;

  useEffect(() => {
    if (currentUser.role !== 'desk') {
      navigate('/', { replace: true });
    }
  }, [currentUser.role, navigate]);

  useEffect(() => {
    if (
      !shouldPrintQrSheet ||
      !isPrintQrSheetOpen ||
      printablePassportQrs.length !== PASSPORT_QR_COUNT
    ) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
        setShouldPrintQrSheet(false);
      });
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isPrintQrSheetOpen, printablePassportQrs.length, shouldPrintQrSheet]);

  if (currentUser.role !== 'desk') {
    return null;
  }

  const clearRegistrationForm = () => {
    setNickname('');
    setAge('');
    setGender('preferNotToSay');
    setLanguage(locale);
  };

  const printPassportQrs = () => {
    setPrintQrError('');
    setIsGeneratingPrintQrs(true);

    Promise.all(
      Array.from({ length: PASSPORT_QR_COUNT }, (_, index) => {
        const id = createPassportQrId(index + 1);

        return QRCode.toDataURL(createKidPassportUrl(id), {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 160,
        }).then((qrCodeUrl) => ({
          id,
          qrCodeUrl,
        }));
      }),
    )
      .then((nextPrintablePassportQrs) => {
        setPrintablePassportQrs(nextPrintablePassportQrs);
        setIsPrintQrSheetOpen(true);
        setShouldPrintQrSheet(true);
      })
      .catch(() => {
        setPrintQrError(t('desk.printQr.error'));
        setShouldPrintQrSheet(false);
      })
      .finally(() => setIsGeneratingPrintQrs(false));
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

  if (isPrintQrSheetOpen) {
    return (
      <main className="print-page">
        <div className="print-page-actions">
          <button
            className="access-button secondary-action"
            type="button"
            onClick={() => {
              setIsPrintQrSheetOpen(false);
              setShouldPrintQrSheet(false);
            }}
          >
            {t('desk.printQr.back')}
          </button>
          <button
            className="access-button"
            type="button"
            onClick={() => window.print()}
          >
            {t('desk.printQr')}
          </button>
        </div>
        <section className="print-qr-sheet" aria-label={t('desk.printQr.sheet')}>
          {printablePassportQrs.map((passportQr) => (
            <article className="passport-print-qr" key={passportQr.id}>
              <img src={passportQr.qrCodeUrl} alt="" />
              <span>{passportQr.id}</span>
            </article>
          ))}
        </section>
      </main>
    );
  }

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
              messages={{
                cameraPermissionError: t('scanner.error.cameraPermission'),
                cameraPreview: t('scanner.cameraPreview'),
                cameraStartError: t('scanner.error.cameraStart'),
                cameraUnsupportedError: t('scanner.error.cameraUnsupported'),
                scanApproved: t('scanner.scanApproved'),
                scannerActive: t('scanner.active'),
                scanQr: t('desk.scanQr'),
                scanQrShort: t('desk.scanQrShort'),
                stopScanner: t('scanner.stopScanner'),
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
          {printQrError ? <p className="form-error">{printQrError}</p> : null}
          <div className="desk-actions">
            <button
              className="access-button secondary-action"
              type="button"
              disabled={isGeneratingPrintQrs}
              onClick={printPassportQrs}
            >
              {isGeneratingPrintQrs
                ? t('desk.printQr.generating')
                : t('desk.printQr')}
            </button>
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
          </div>
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
