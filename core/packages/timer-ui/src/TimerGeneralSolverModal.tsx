'use client';
import { useEffect, useRef, useState } from 'react';
import { TimerRoomDialog } from './TimerRoomDialog';
import { ClearButton } from './ClearButton';
import { createGeneralSolver } from './scramble/general-solver';
import type { TimerToolTransport } from './TimerTools';
import './timer-tools.css';

export default function TimerGeneralSolverModal({ language, onClose, transport }: {
  language: 'en' | 'zh'; onClose(): void; transport: TimerToolTransport;
}) {
  const tr = (copy: { en: string; zh: string }) => copy[language];
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ solution: string; inverse: string } | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const exportRevision = useRef(0);
  const [solver] = useState(createGeneralSolver);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { exportRevision.current++; request.current?.abort(); solver.reset(); }, [solver]);
  const changeInput = (value: string) => {
    exportRevision.current++; setExportFailed(false);
    request.current?.abort(); request.current = null;
    setInput(value); setBusy(false); setAnswer(null); setError(false); setCopied(false);
  };
  const solve = async () => {
    if (!input.trim() || request.current) return;
    const controller = new AbortController(); request.current = controller;
    exportRevision.current++; setExportFailed(false);
    setBusy(true); setAnswer(null); setError(false); setCopied(false);
    try {
      const result = await solver.solve(input.trim(), controller.signal);
      if (!controller.signal.aborted) setAnswer(result);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  };
  const copyAnswer = async () => {
    if (!answer) return;
    const revision = exportRevision.current;
    setExportFailed(false);
    try { await transport.copy(answer.solution); if (revision === exportRevision.current) setCopied(true); }
    catch { if (revision === exportRevision.current) setExportFailed(true); }
  };
  return <TimerRoomDialog title={tr({ zh: '通用求解器', en: 'Solver' })} className="timer-tool-dialog solver-modal" language={language} onClose={onClose}>
    <label className="timer-tool-field">{tr({ zh: '输入打乱', en: 'Enter a scramble' })}
      <textarea value={input} rows={3} onChange={e => changeInput(e.target.value)} placeholder="R U R' U' F2 L D" />
      {input && <ClearButton ariaLabel={tr({ zh: '清除', en: 'Clear' })} variant="standalone" onClick={() => changeInput('')} />}
    </label>
    {error && <p role="alert">{tr({ zh: '求解失败，请检查打乱后重试。', en: 'Solve failed. Check the scramble and try again.' })}</p>}
    {answer && <div className="timer-tool-answer">
      <h3>{tr({ zh: '解', en: 'Solution' })} ({answer.solution.trim().split(/\s+/).filter(Boolean).length} {tr({ zh: '步', en: 'moves' })})</h3>
      <p className="timer-tool-notation" data-solver-solution>{answer.solution}</p>
      <p>{tr({ zh: '逆序（作为打乱）：', en: 'Inverse (as scramble):' })}</p>
      <p className="timer-tool-notation">{answer.inverse}</p>
    </div>}
    {exportFailed && <p role="alert">{tr({ zh: '复制失败，请重试。', en: 'Copy failed. Please try again.' })}</p>}
    <div className="timer-tool-actions">
      <button type="button" disabled={busy || !input.trim()} onClick={() => void solve()}>{busy ? tr({ zh: '求解中…', en: 'Solving…' }) : tr({ zh: '求解', en: 'Solve' })}</button>
      {answer?.solution && <button type="button" onClick={() => void copyAnswer()}>{copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制', en: 'Copy' })}</button>}
      <button type="button" onClick={onClose}>{tr({ zh: '关闭', en: 'Close' })}</button>
    </div>
  </TimerRoomDialog>;
}
