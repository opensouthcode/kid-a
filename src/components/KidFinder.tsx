import { useState } from 'react';
import {
  useFindKidByManualNumber,
  useFindKidByQrIdData,
  type Kid,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import { QrReader } from './QrReader';

type KidFinderProps = {
  onKidSelected: (kid: Kid) => void;
};

export function KidFinder({ onKidSelected }: KidFinderProps) {
  const findKidByManualNumber = useFindKidByManualNumber();
  const findKidByQrIdData = useFindKidByQrIdData();
  const { t } = useI18n();
  const [manualKidNumber, setManualKidNumber] = useState('');
  const [pendingKid, setPendingKid] = useState<Kid | undefined>();
  const [formError, setFormError] = useState('');

  const selectKid = (kid: Kid) => {
    setManualKidNumber('');
    setPendingKid(undefined);
    setFormError('');
    onKidSelected(kid);
  };

  const readKidQrPayload = (qrPayload: string) => {
    const matchingKid = findKidByQrIdData(qrPayload);

    if (!matchingKid) {
      setFormError(t('lead.error.invalidKidQr'));
      return;
    }

    selectKid(matchingKid);
  };

  const searchManualKid = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const matchingKid = findKidByManualNumber(manualKidNumber);

    if (!matchingKid) {
      setPendingKid(undefined);
      setFormError(t('lead.error.kidNotFound'));
      return;
    }

    setPendingKid(matchingKid);
    setFormError('');
  };

  return (
    <div className="kid-acquisition-layout">
      <QrReader
        messages={{
          cameraPermissionError: t('scanner.error.cameraPermission'),
          cameraPreview: t('scanner.cameraPreview'),
          cameraStartError: t('scanner.error.cameraStart'),
          cameraUnsupportedError: t('scanner.error.cameraUnsupported'),
          scanApproved: t('lead.scan.approved'),
          scannerActive: t('lead.scan.active'),
          scanQr: t('lead.scan.title'),
          scanQrShort: t('lead.scan.short'),
          stopScanner: t('scanner.stopScanner'),
        }}
        onError={(message) => setFormError(message)}
        onRead={readKidQrPayload}
      />
      <div className="manual-kid-panel">
        <form className="manual-kid-search" onSubmit={searchManualKid}>
          <label>
            {t('lead.manualKid')}
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={manualKidNumber}
              onChange={(event) => {
                setManualKidNumber(event.target.value);
                setPendingKid(undefined);
              }}
            />
          </label>
          <button className="secondary-button" type="submit">
            {t('lead.manualKid.search')}
          </button>
        </form>
        {pendingKid ? (
          <div className="kid-confirmation" role="status">
            <p>
              {t('lead.manualKid.confirm').replace('{nickname}', pendingKid.name)}
            </p>
            <button
              className="access-button"
              type="button"
              onClick={() => selectKid(pendingKid)}
            >
              {t('lead.manualKid.confirmButton')}
            </button>
          </div>
        ) : null}
        {formError ? <p className="form-error">{formError}</p> : null}
      </div>
    </div>
  );
}
