import { useState } from 'react';
import {
  useFindKidByManualNumber,
  useFindKidByQrIdData,
  type Kid,
} from '../contexts/DataLayerContext';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';
import { QrReader } from './QrReader';

type KidFinderMessages = {
  confirmButton: MessageKey;
  confirmKid: MessageKey;
  invalidKidQr: MessageKey;
  kidNotFound: MessageKey;
  manualKid: MessageKey;
  manualKidSearch: MessageKey;
  scanApproved: MessageKey;
  scannerActive: MessageKey;
  scanQr: MessageKey;
  scanQrShort: MessageKey;
};

type KidFinderProps = {
  blockedKidId?: string;
  blockedKidMessage?: MessageKey;
  messages?: KidFinderMessages;
  onKidSelected: (kid: Kid) => void;
};

const defaultMessages: KidFinderMessages = {
  confirmButton: 'lead.manualKid.confirmButton',
  confirmKid: 'lead.manualKid.confirm',
  invalidKidQr: 'lead.error.invalidKidQr',
  kidNotFound: 'lead.error.kidNotFound',
  manualKid: 'lead.manualKid',
  manualKidSearch: 'lead.manualKid.search',
  scanApproved: 'lead.scan.approved',
  scannerActive: 'lead.scan.active',
  scanQr: 'lead.scan.title',
  scanQrShort: 'lead.scan.short',
};

export function KidFinder({
  blockedKidId = '',
  blockedKidMessage,
  messages = defaultMessages,
  onKidSelected,
}: KidFinderProps) {
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

  const readKidQrPayload = async (qrPayload: string) => {
    let matchingKid: Kid | undefined;

    try {
      matchingKid = await findKidByQrIdData(qrPayload);
    } catch (error) {
      console.error('Unable to find kid from QR data.', error);
      setFormError(t(messages.kidNotFound));
      return;
    }

    if (!matchingKid) {
      setFormError(t(messages.invalidKidQr));
      return;
    }

    if (matchingKid.id === blockedKidId && blockedKidMessage) {
      setFormError(t(blockedKidMessage));
      return;
    }

    selectKid(matchingKid);
  };

  const searchManualKid = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    let matchingKid: Kid | undefined;

    try {
      matchingKid = await findKidByManualNumber(manualKidNumber);
    } catch (error) {
      console.error('Unable to find kid by manual number.', error);
      setPendingKid(undefined);
      setFormError(t(messages.kidNotFound));
      return;
    }

    if (!matchingKid) {
      setPendingKid(undefined);
      setFormError(t(messages.kidNotFound));
      return;
    }

    if (matchingKid.id === blockedKidId && blockedKidMessage) {
      setPendingKid(undefined);
      setFormError(t(blockedKidMessage));
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
          scanApproved: t(messages.scanApproved),
          scannerActive: t(messages.scannerActive),
          scanQr: t(messages.scanQr),
          scanQrShort: t(messages.scanQrShort),
          stopScanner: t('scanner.stopScanner'),
        }}
        onError={(message) => setFormError(message)}
        onRead={(qrPayload) => {
          void readKidQrPayload(qrPayload);
        }}
      />
      <div className="manual-kid-panel">
        <form className="manual-kid-search" onSubmit={searchManualKid}>
          <label>
            {t(messages.manualKid)}
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
            {t(messages.manualKidSearch)}
          </button>
        </form>
        {pendingKid ? (
          <div className="kid-confirmation" role="status">
            <p>
              {t(messages.confirmKid).replace('{nickname}', pendingKid.name)}
            </p>
            <button
              className="access-button"
              type="button"
              onClick={() => selectKid(pendingKid)}
            >
              {t(messages.confirmButton)}
            </button>
          </div>
        ) : null}
        {formError ? <p className="form-error">{formError}</p> : null}
      </div>
    </div>
  );
}
