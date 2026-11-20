'use client';
import { useEffect, useRef, useState } from 'react';
import { TIMER_LIVE_SHARE_COPY as labels, timerLiveWatchUrl } from '@cuberoot/shared/timer/live-share';
import type { TimerLiveShareController } from './timer-live-share';
import { RoomQrCode } from './RoomQrModal';
import './timer-live-share.css';

export function TimerLiveShareStatus({ controller: c, language }: { controller: TimerLiveShareController; language: 'en' | 'zh' }) {
  if (!c.session) return null;
  const tr = <T,>(v: { en: T; zh: T }) => v[language];
  return <span role="status" className="timer-live-watch-status" data-no-timer>{c.paused
    ? tr(labels.paused) : c.connection === 'connected'
      ? tr(labels.watching(c.viewers))
      : tr(labels.disconnected)}</span>;
}

export function TimerLiveShareSettings({ controller: c, watchBase, language, copy }: {
  controller: TimerLiveShareController; watchBase: string; language: 'en' | 'zh'; copy(text: string): Promise<void>;
}) {
  const tr = <T,>(v: { en: T; zh: T }) => v[language];
  const [qr, setQr] = useState(false), [copied, setCopied] = useState<'none' | 'ok' | 'error'>('none');
  const mounted = useRef(true);
  const currentId = useRef(c.session?.id); currentId.current = c.session?.id;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setQr(false); setCopied('none'); }, [c.session?.id]);
  const url = c.session ? timerLiveWatchUrl(watchBase, c.session) : null;
  return <section className="settings-section timer-live-share" data-no-timer>
    <h4>{tr(labels.title)}</h4>
    <p className="hint">{tr(labels.description)}</p>
    <div className="timer-live-share-actions">
      {!c.session ? <button type="button" className="hint-btn" disabled={c.busy || c.paused} onClick={() => void c.start()}>
        {c.busy ? tr(labels.creating) : tr(labels.create)}</button> : <>
        <button type="button" className="hint-btn" disabled={c.busy || c.paused} onClick={() => {
          const id = c.session?.id;
          void copy(url!).then(() => { if (mounted.current && id === currentId.current) setCopied('ok'); })
            .catch(() => { if (mounted.current) setCopied('error'); });
        }}>{copied === 'ok' ? tr(labels.copied) : tr(labels.copy)}</button>
        <button type="button" className="hint-btn" disabled={c.paused} aria-expanded={qr} onClick={() => setQr(!qr)}>{tr(labels.qr)}</button>
        <button type="button" className="hint-btn" disabled={c.busy} onClick={() => void c.stop()}>{tr(labels.end)}</button>
      </>}
    </div>
    {c.session && <p role="status">{c.paused ? tr(labels.paused)
      : c.connection === 'connected' ? tr(labels.watching(c.viewers))
        : c.connection === 'error' ? tr(labels.unavailable)
          : tr(labels.connecting)}</p>}
    {(c.error || copied === 'error') && <p role="alert">{c.paused && c.session
      ? tr(labels.revokeError)
      : tr(labels.error)}</p>}
    {qr && url && !c.paused && <RoomQrCode url={url} />}
  </section>;
}
