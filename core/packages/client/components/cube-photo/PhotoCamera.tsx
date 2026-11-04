'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ImagePlus, LoaderCircle, RotateCcw } from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import { useCameraStream } from '@/hooks/useCameraStream';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import { captureCameraPhoto } from '@/lib/camera-photo';
import './photo-camera.css';

function cameraError(code: string) {
  if (code === 'NotAllowedError' || code === 'SecurityError') return tr({
    zh: '请在浏览器的网站设置中允许使用相机，然后重试。',
    en: 'Allow camera access in your browser’s site settings, then retry.',
  });
  if (code === 'NotFoundError') return tr({ zh: '未找到摄像头，可以选择已有照片。', en: 'No camera found. You can choose an existing photo.' });
  if (code === 'Unsupported') return tr({ zh: '当前浏览器无法使用网页相机，请使用 HTTPS 页面或选择已有照片。', en: 'Camera access is unavailable in this browser. Use HTTPS or choose an existing photo.' });
  if (code === 'NotReadableError') return tr({ zh: '摄像头暂时无法使用，请关闭占用相机的应用后重试。', en: 'The camera is unavailable. Close other apps using it, then retry.' });
  return tr({ zh: '无法完成拍摄，请重试或选择已有照片。', en: 'Could not take a photo. Retry or choose an existing photo.' });
}

export default function PhotoCamera({ onCapture, onClose, onChoosePhoto }: {
  onCapture: (file: File) => void;
  onClose: () => void;
  onChoosePhoto: () => void;
}) {
  const camera = useCameraStream();
  const video = useRef<HTMLVideoElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const capturing = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const backdropProps = useModalDismiss(onClose);
  const titleId = useId();
  const error = camera.error ?? captureError;

  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      mounted.current = false;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const element = video.current;
    setReady(false);
    if (!element || !camera.stream) return;
    let cancelled = false;
    element.srcObject = camera.stream;
    void element.play().catch(() => { if (!cancelled) setCaptureError('PlaybackFailed'); });
    return () => { cancelled = true; element.srcObject = null; };
  }, [camera.stream]);

  async function shoot() {
    if (!video.current || !ready || capturing.current) return;
    capturing.current = true;
    setBusy(true);
    setCaptureError(null);
    try {
      const file = await captureCameraPhoto(video.current);
      if (mounted.current) onCapture(file);
    } catch {
      if (mounted.current) setCaptureError('CaptureFailed');
    } finally {
      capturing.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return createPortal(<div className="photo-camera-backdrop" {...backdropProps}>
    <div ref={panel} className="photo-camera-panel" data-site-surface="panel" role="dialog" aria-modal="true" aria-labelledby={titleId}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <header className="photo-camera-header">
        <h2 id={titleId}>{tr({ zh: '拍照', en: 'Take photo' })}</h2>
        <ClearButton variant="standalone" onClick={onClose} ariaLabel={tr({ zh: '关闭相机', en: 'Close camera' })} />
      </header>
      <div className="photo-camera-preview">
        <video ref={video} autoPlay muted playsInline hidden={!!error} onLoadedData={() => setReady(true)}
          aria-label={tr({ zh: '相机预览', en: 'Camera preview' })} />
        {error ? <div className="photo-camera-status" role="alert">
          <p>{cameraError(error)}</p>
          <button type="button" className="cube-photo-action" onClick={() => { setCaptureError(null); setReady(false); camera.retry(); }}>
            <RotateCcw size={17} aria-hidden />{tr({ zh: '重试', en: 'Retry' })}
          </button>
        </div> : !ready && <div className="photo-camera-status" role="status">
          <LoaderCircle size={24} className="photo-camera-spinner" aria-hidden />
          <span>{tr({ zh: '正在打开相机…', en: 'Opening camera…' })}</span>
        </div>}
      </div>
      <footer className="photo-camera-actions">
        <button type="button" className="cube-photo-action" onClick={onChoosePhoto}><ImagePlus size={17} aria-hidden />{tr({ zh: '选择照片', en: 'Choose photo' })}</button>
        <button type="button" className="cube-photo-action cube-photo-primary" disabled={!ready || busy || !!error} onClick={() => void shoot()}>
          <Camera size={18} aria-hidden />{tr({ zh: '拍摄并识别', en: 'Capture and identify' })}
        </button>
      </footer>
    </div>
  </div>, document.body);
}
