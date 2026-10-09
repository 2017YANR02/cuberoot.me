'use client';
import './timer-data-settings.css';
import { useEffect, useRef, useState } from 'react';
import type { Solve } from '@cuberoot/shared/timer';
import { TimerRoomDialog } from './TimerRoomDialog';
import { ClearButton } from './ClearButton';

export interface TimerReplayImportModalProps {
  language: 'en' | 'zh';
  load(input: string, signal: AbortSignal): Promise<Solve | null>;
  onOpen(solve: Solve): void;
  onClose(): void;
}

/** One paste flow for Web and installed clients, including cancellation of late responses. */
export function TimerReplayImportModal({ language, load, onOpen, onClose }: TimerReplayImportModalProps) {
  const tr = <T,>(text: { en: T; zh: T }) => text[language];
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const close = () => { request.current?.abort(); onClose(); };
  const submit = async () => {
    if (request.current && !request.current.signal.aborted) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(false);
    try {
      const solve = await load(input, controller.signal);
      if (controller.signal.aborted) return;
      if (solve) { onOpen(solve); onClose(); } else setError(true);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); } }
  };
  return <TimerRoomDialog title={tr({ en: 'Paste replay', zh: '粘贴回放' })} language={language} onClose={close}>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label className="settings-row">
        <span className="settings-row-label">{tr({ en: 'Replay URL or token', zh: '回放链接或 token' })}</span>
        <span className="settings-row-control">
          <input autoFocus className="settings-row-control-input" value={input} disabled={busy} onChange={event => { setInput(event.target.value); setError(false); }} />
          {input && !busy && <ClearButton ariaLabel={tr({ en: 'Clear', zh: '清除' })} variant="standalone" onClick={() => { setInput(''); setError(false); }} />}
        </span>
      </label>
      {error && <p role="alert">{tr({ en: 'Unable to read this replay. Check the link or token and try again.', zh: '无法读取回放，请检查链接或 token 后重试。' })}</p>}
      <div className="modal-actions"><button className="modal-action-btn" type="submit" disabled={busy || !input.trim()} aria-busy={busy}>{busy ? tr({ en: 'Loading…', zh: '加载中…' }) : tr({ en: 'Open', zh: '打开' })}</button></div>
    </form>
  </TimerRoomDialog>;
}
