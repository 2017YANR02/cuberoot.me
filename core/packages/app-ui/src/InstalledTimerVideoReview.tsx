import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppearancePreferences } from '@cuberoot/shared/appearance';
import { TimerRoomDialog } from '@cuberoot/timer-ui';

export function InstalledTimerVideoReview({ language, origin, scramble, appearance, onClose, onDismissChange }: {
  language: 'en' | 'zh'; origin: string; scramble: string; appearance: AppearancePreferences | null; onClose(): void;
  onDismissChange(dismiss: (() => boolean) | null): void;
}) {
  const title = { zh: '视频复盘', en: 'Video review' }[language];
  const [src] = useState(() => {
    const url = new URL(`/${language}/timer?video=review`, origin);
    const context = new URLSearchParams({ scramble });
    if (appearance) context.set('appearance', JSON.stringify(appearance));
    url.hash = context.toString();
    return url.href;
  });
  const frame = useRef<HTMLIFrameElement>(null);
  const busy = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [height, setHeight] = useState(96);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const canClose = useCallback(() => !busy.current || window.confirm({ zh: '结束当前录制或分析并关闭？', en: 'End the current recording or analysis and close?' }[language]), [language]);
  const dismiss = useCallback(() => {
    if (canClose()) onClose();
    return true;
  }, [canClose, onClose]);
  useEffect(() => {
    onDismissChange(dismiss);
    return () => onDismissChange(null);
  }, [dismiss, onDismissChange]);
  useEffect(() => {
    const timeout = window.setTimeout(() => setStatus('failed'), 30000);
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin) return;
      if (event.data?.type === 'cuberoot:video-review:workspace') {
        setWorkspaceOpen(true);
        return;
      }
      if (event.data?.type === 'cuberoot:video-review:resize' && Number.isFinite(event.data.height)) {
        setHeight(Math.max(48, Math.min(1600, event.data.height)));
        return;
      }
      if (event.data?.type !== 'cuberoot:video-review:ready' || typeof event.data.busy !== 'boolean') return;
      window.clearTimeout(timeout);
      busy.current = event.data.busy;
      setStatus('ready');
    };
    window.addEventListener('message', receive);
    return () => { window.clearTimeout(timeout); window.removeEventListener('message', receive); };
  }, [attempt, origin]);
  return <TimerRoomDialog title={title} language={language} className={workspaceOpen ? 'installed-video-review is-workspace' : 'installed-video-review'} canClose={canClose} onClose={onClose}>
    {status === 'loading' && <p role="status">{{ zh: '正在加载视频复盘…', en: 'Loading video review…' }[language]}</p>}
    {status === 'failed' && <div role="status">
      <p>{{ zh: '视频复盘加载失败，请检查网络连接。', en: 'Could not load video review. Check your connection.' }[language]}</p>
      <button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1); }}>
        {{ zh: '重试', en: 'Retry' }[language]}
      </button>
    </div>}
    <iframe name="cuberoot-timer-video-review" ref={frame} key={attempt} src={src} title={title} style={{ height, visibility: status === 'ready' ? 'visible' : 'hidden' }} allow="camera; fullscreen"
      onError={() => setStatus('failed')} />
  </TimerRoomDialog>;
}
