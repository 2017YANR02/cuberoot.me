'use client';
import './timer-data-settings.css';
import { useEffect, useRef, useState } from 'react';
import { TIMER_REPLAY_INPUT_COPY } from '@cuberoot/shared/timer/replay-input';
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
  return <TimerRoomDialog title={tr(TIMER_REPLAY_INPUT_COPY.title)} language={language} onClose={close}>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label className="settings-row">
        <span className="settings-row-label">{tr(TIMER_REPLAY_INPUT_COPY.input)}</span>
        <span className="settings-row-control">
          <input autoComplete="off" autoFocus className="settings-row-control-input" value={input} disabled={busy} onChange={event => { setInput(event.target.value); setError(false); }} />
          {input && !busy && <ClearButton ariaLabel={tr(TIMER_REPLAY_INPUT_COPY.clear)} variant="standalone" onClick={() => { setInput(''); setError(false); }} />}
        </span>
      </label>
      {error && <p role="alert">{tr(TIMER_REPLAY_INPUT_COPY.error)}</p>}
      <div className="modal-actions"><button className="modal-action-btn" type="submit" disabled={busy || !input.trim()} aria-busy={busy}>{busy ? tr(TIMER_REPLAY_INPUT_COPY.loading) : tr(TIMER_REPLAY_INPUT_COPY.open)}</button></div>
    </form>
  </TimerRoomDialog>;
}
