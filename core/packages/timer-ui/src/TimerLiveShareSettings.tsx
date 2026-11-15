'use client';
import { useEffect, useRef, useState } from 'react';
import { timerLiveWatchUrl } from '@cuberoot/shared/timer/live-share';
import type { TimerLiveShareController } from './timer-live-share';
import { RoomQrCode } from './RoomQrModal';
import './timer-live-share.css';

export function TimerLiveShareStatus({ controller: c, language }: { controller: TimerLiveShareController; language: 'en' | 'zh' }) {
  if (!c.session) return null;
  const tr = <T,>(v: { en: T; zh: T }) => v[language];
  return <span role="status" className="timer-live-watch-status" data-no-timer>{c.paused
    ? tr({ en: 'Sharing paused', zh: '分享已暂停' }) : c.connection === 'connected'
      ? tr({ en: `Sharing · ${c.viewers} watching`, zh: `正在分享 · ${c.viewers} 人观看` })
      : tr({ en: 'Sharing disconnected', zh: '分享连接已断开' })}</span>;
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
    <h4>{tr({ en: 'Live sharing', zh: '实时分享' })}</h4>
    <p className="hint">{tr({ en: 'Share up to the latest 200 solves in this session, timer and smart-cube reconstruction. Anyone with the link can watch. Expires after 4 hours.',
      zh: '分享当前分组最近最多 200 条成绩、计时与智能魔方复原过程。持有链接的人可以观看，4 小时后失效。' })}</p>
    <div className="timer-live-share-actions">
      {!c.session ? <button type="button" className="hint-btn" disabled={c.busy || c.paused} onClick={() => void c.start()}>
        {c.busy ? tr({ en: 'Creating…', zh: '正在创建…' }) : tr({ en: 'Create share link', zh: '生成分享链接' })}</button> : <>
        <button type="button" className="hint-btn" disabled={c.busy || c.paused} onClick={() => {
          const id = c.session?.id;
          void copy(url!).then(() => { if (mounted.current && id === currentId.current) setCopied('ok'); })
            .catch(() => { if (mounted.current) setCopied('error'); });
        }}>{copied === 'ok' ? tr({ en: 'Copied', zh: '已复制' }) : tr({ en: 'Copy link', zh: '复制链接' })}</button>
        <button type="button" className="hint-btn" disabled={c.paused} aria-expanded={qr} onClick={() => setQr(!qr)}>{tr({ en: 'QR code', zh: '二维码' })}</button>
        <button type="button" className="hint-btn" disabled={c.busy} onClick={() => void c.stop()}>{tr({ en: 'End sharing', zh: '结束分享' })}</button>
      </>}
    </div>
    {c.session && <p role="status">{c.paused ? tr({ en: 'Sharing paused', zh: '分享已暂停' })
      : c.connection === 'connected' ? tr({ en: `Sharing · ${c.viewers} watching`, zh: `正在分享 · ${c.viewers} 人观看` })
        : c.connection === 'error' ? tr({ en: 'Sharing unavailable. End this share and try again.', zh: '分享不可用，请结束后重新创建。' })
          : tr({ en: 'Reconnecting…', zh: '正在连接…' })}</p>}
    {(c.error || copied === 'error') && <p role="alert">{c.paused && c.session
      ? tr({ en: 'Link revocation failed. Retry End sharing.', zh: '链接撤销失败，请重试“结束分享”。' })
      : tr({ en: 'Operation failed. Please retry.', zh: '操作失败，请重试。' })}</p>}
    {qr && url && !c.paused && <RoomQrCode url={url} />}
  </section>;
}
