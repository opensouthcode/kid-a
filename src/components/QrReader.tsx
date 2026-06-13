import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';

export type QrReaderMessages = {
  cameraPermissionError: string;
  cameraPreview: string;
  cameraStartError: string;
  cameraUnsupportedError: string;
  scanApproved: string;
  scannerActive: string;
  scanQr: string;
  scanQrShort: string;
  stopScanner: string;
};

type QrReaderProps = {
  messages: QrReaderMessages;
  onError: (message: string) => void;
  onRead: (value: string) => void;
};

export function QrReader({ messages, onError, onRead }: QrReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(undefined);
  const streamRef = useRef<MediaStream>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasApprovedScan, setHasApprovedScan] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);

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

  useEffect(() => {
    if (!hasApprovedScan) {
      return;
    }

    const timeoutId = window.setTimeout(() => setHasApprovedScan(false), 2500);

    return () => window.clearTimeout(timeoutId);
  }, [hasApprovedScan]);

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
        setHasApprovedScan(true);
        onRead(qrCode.data);
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
      onError(messages.cameraUnsupportedError);
      return;
    }

    try {
      setHasApprovedScan(false);
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
      onError(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? messages.cameraPermissionError
          : messages.cameraStartError,
      );
    }
  };

  return (
    <section className="scanner-panel" aria-label={messages.scanQr}>
      {isScannerActive ? <p>{messages.scannerActive}</p> : null}
      <div className={isScannerActive ? 'scanner-view' : 'scanner-view hidden'}>
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label={messages.cameraPreview}
        />
        <canvas ref={canvasRef} hidden />
      </div>
      {isScannerActive ? (
        <button className="secondary-button" type="button" onClick={stopScanner}>
          {messages.stopScanner}
        </button>
      ) : (
        <button
          className={
            hasApprovedScan
              ? 'scanner-toggle-button approved'
              : 'scanner-toggle-button'
          }
          type="button"
          aria-label={messages.scanQr}
          title={messages.scanQr}
          onClick={startScanner}
        >
          {hasApprovedScan ? (
            <span className="scan-approved-icon" aria-hidden="true" />
          ) : (
            <span className="qr-icon" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </span>
          )}
          <span>
            {hasApprovedScan ? messages.scanApproved : messages.scanQrShort}
          </span>
        </button>
      )}
    </section>
  );
}
