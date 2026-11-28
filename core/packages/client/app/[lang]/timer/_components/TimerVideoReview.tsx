'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpen, Images, Video } from '@app-foundation/icons/lucide';
import { ClearButton } from '@/components/ClearButton';
import SettingsDialog from '@/components/SettingsDialog';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useT } from '@/hooks/useT';
import { closeVideoCamera, requestVideoCamera } from '@/lib/video-recon/engine/camera-source';
import './timer-video-review.css';

function LoadingWorkspace() {
  const t = useT();
  return <LoadingIndicator>{t('正在载入视频工具', 'Loading video tools')}</LoadingIndicator>;
}

const Workspace = dynamic(() => import('../../video-recon/VideoReconClient').then(module => module.VideoReconWorkspace),
  { ssr: false, loading: LoadingWorkspace });

interface Props {
  scramble: string;
  onTimedCapture?: (deviceId?: string) => void;
  onBusyChange?: (busy: boolean) => void;
  onSourceOpen?: () => void;
  onViewfinderChange?: (active: boolean) => void;
}

export function TimerVideoReview({ scramble, onTimedCapture, onBusyChange, onSourceOpen, onViewfinderChange }: Props) {
  const t = useT();
  const [source, setSource] = useState<{ mode: 'record' | 'detector'; scramble: string; file?: File }>();
  const [busy, setBusy] = useState(false);
  const reviewRegion = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<Promise<MediaStream> | undefined>(undefined);
  const takeCamera = useCallback(() => {
    const request = pending.current;
    pending.current = undefined;
    return request;
  }, []);
  const releasePending = useCallback(() => {
    void takeCamera()?.then(closeVideoCamera, () => {});
  }, [takeCamera]);
  useEffect(() => releasePending, [releasePending]);
  const mode = source?.mode;
  useEffect(() => {
    if (mode) reviewRegion.current?.focus({ preventScroll: true });
  }, [mode]);
  const reportBusy = useCallback((value: boolean) => {
    setBusy(value);
    onBusyChange?.(value);
  }, [onBusyChange]);
  const openFile = (file: File) => {
    releasePending();
    onSourceOpen?.();
    setSource({ mode: 'detector', scramble, file });
  };
  const recordButton = <button className="btn-secondary timer-video-source-action" type="button" disabled={busy} onClick={() => {
    releasePending();
    pending.current = requestVideoCamera(undefined, true);
    // Keep the permission request attached while the workspace is loading.
    void pending.current.catch(() => {});
    onSourceOpen?.();
    setSource({ mode: 'record', scramble });
  }}><Video size={18} aria-hidden />{t('录制', 'Record')}</button>;
  const chooseVideoButton = <button className="btn-secondary timer-video-source-action" type="button" disabled={busy} onClick={() => input.current?.click()}>
    {mode === 'record' ? <Images size={22} aria-hidden /> : <FolderOpen size={18} aria-hidden />}<span>{t('选视频', 'Choose video')}</span>
  </button>;
  return <div className="timer-video-review" data-source={mode} ref={reviewRegion} tabIndex={mode && -1}
    role={mode && 'region'} aria-label={mode && (mode === 'record' ? t('录制', 'Record') : t('视频复盘', 'Video reconstruction'))}>
    {!source && <div className="timer-video-source-actions">{recordButton}{chooseVideoButton}</div>}
    <input type="file" ref={input} hidden accept="video/*,.mp4,.mov,.webm" onChange={event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (file) openFile(file);
    }} />
    {source && <Workspace key={source.mode} mode={source.mode} onTimerBusyChange={reportBusy}
      timerSource={{ scramble: source.scramble, file: source.file, takeCamera, onTimedCapture, onViewfinderChange, onRecordedFile: openFile,
        switchSourceAction: source.mode === 'record' ? chooseVideoButton : recordButton }} />}
  </div>;
}

export default function TimerVideoReviewDialog({ onClose, ...props }: Props & { onClose: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  return <SettingsDialog heading label={t('视频复盘', 'Video reconstruction')} panelClassName="timer-video-dialog timer-video-glass af-glass-surface"
    dismissDisabled={busy} onClose={onClose} renderCloseButton={(close, closing) => <ClearButton variant="standalone"
      ariaLabel={t('关闭', 'Close')} disabled={closing} onClick={() => { if (busy) setConfirmExit(true); else close(); }} />}>
    {close => <>
      {busy && confirmExit && <div className="timer-video-confirm-exit" role="alert">
        <p>{t('退出会丢弃正在进行的录制或复盘。', 'Leaving will discard the recording or reconstruction in progress.')}</p>
        <div className="timer-video-source-actions">
          <button type="button" className="btn-secondary timer-video-source-action" autoFocus onClick={() => setConfirmExit(false)}>{t('继续', 'Continue')}</button>
          <button type="button" className="btn-secondary timer-video-source-action" onClick={close}>{t('丢弃并退出', 'Discard and leave')}</button>
        </div>
      </div>}
      <TimerVideoReview {...props} onBusyChange={setBusy} />
    </>}
  </SettingsDialog>;
}
