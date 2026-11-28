'use client';

import { Film, HelpCircle, MonitorDown, Timer } from '@app-foundation/icons/lucide';
import dynamic from 'next/dynamic';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PageBackLink from '@/components/PageBackLink';
import { Tooltip } from '@/components/Tooltip';
import { useT } from '@/hooks/useT';
import type { VideoReconHandoff } from '../video-recon/VideoReconClient';
import FrameCountPage from './FrameCountPage';

const VideoReconWorkspace = dynamic(
  () => import('../video-recon/VideoReconClient').then(module => module.VideoReconWorkspace),
  { loading: VideoToolsLoading },
);
const MODES = ['frames', 'detector', 'record'] as const;
type Mode = (typeof MODES)[number];
const subscribe = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function VideoToolsLoading() {
  const t = useT();
  return <LoadingIndicator>{t('正在载入视频工具', 'Loading video tools')}</LoadingIndicator>;
}

export default function VideoToolsPage({ title }: { title: string }) {
  const t = useT();
  const [requestedMode, setMode] = useQueryState('mode', parseAsStringEnum<Mode>([...MODES]).withDefault('frames').withOptions({ history: 'push' }));
  // The prerendered shell is the same for every query. Read the mode after hydration.
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const mode = hydrated ? requestedMode : 'frames';
  const [hasOpenedFrames, setHasOpenedFrames] = useState(false);
  const [hasOpenedRecon, setHasOpenedRecon] = useState(false);
  const [lastReconMode, setLastReconMode] = useState<Exclude<Mode, 'frames'>>('detector');
  const [handoff, setHandoff] = useState<VideoReconHandoff>();
  const [timerBusy, setTimerBusy] = useState(false);
  const counting = mode === 'frames';

  useEffect(() => {
    if (!hydrated) return;
    if (counting) setHasOpenedFrames(true);
    else {
      setHasOpenedRecon(true);
      setLastReconMode(mode);
    }
  }, [counting, hydrated, mode]);

  const help = counting ? t('逐帧计时说明', 'Frame-by-frame timing guide') : t('视频复盘说明', 'Video reconstruction guide');
  const tabs = [
    { value: 'frames' as const, label: t('数帧', 'framecount'), Icon: Timer },
    { value: lastReconMode, label: t('视频复盘', 'Video reconstruction'), Icon: Film },
  ];

  return <main className={counting ? 'video-tools-page frame-count-page' : 'video-tools-page'}>
    <header className="fc-header">
      <PageBackLink />
      <h1 className="fc-title">
        {title}
        <Tooltip content={help}>{tip => <Link {...tip}
          href={counting ? '/frame-count-about' : '/video-recon-about'} className="fc-title-help" aria-label={help}>
          <HelpCircle size={18} strokeWidth={1.75} aria-hidden />
        </Link>}</Tooltip>
      </h1>
      <div className="video-tools-modes" role="group" aria-label={title}>
        {tabs.map(({ value, label, Icon }) => <button key={value} type="button" className="btn-secondary video-tools-mode"
          aria-pressed={counting === (value === 'frames')} disabled={timerBusy} onClick={() => { if (counting !== (value === 'frames')) void setMode(value); }}>
          <Icon size={16} aria-hidden />{label}
        </button>)}
      </div>
      {counting && <Link className="fc-offline-link" href="/download#frame-count-desktop" aria-label={t('离线桌面版', 'Offline desktop app')}>
        <MonitorDown size={15} strokeWidth={1.75} aria-hidden />
        <span>{t('离线桌面版', 'Offline desktop app')}</span>
      </Link>}
      <HeaderToggles />
    </header>
    {(counting || hasOpenedFrames) && <FrameCountPage active={counting} onReconstruct={next => {
      setHandoff(next);
      void setMode('detector');
    }} />}
    <div hidden={counting}>
      {(!counting || hasOpenedRecon) && <VideoReconWorkspace mode={counting ? null : mode}
        handoff={handoff} onModeChange={setMode} onTimerBusyChange={setTimerBusy} />}
    </div>
  </main>;
}
