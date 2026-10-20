'use client';

import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReconstructHost } from '@cuberoot/timer-ui/reconstruct-report';
import dynamic from 'next/dynamic';
import type { Solve } from '@cuberoot/shared/timer';
import { readTimerReplay } from '@cuberoot/shared/timer/replay-client';
import { reconRecording, type ReconSnapshot, type ReconAnnotation, type ReconIntakeInput, type ReconIntakeCase } from '@cuberoot/shared/recon-ground-truth';
import { usePopoverDismiss } from '@cuberoot/timer-ui/popover-dismiss';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { ClearButton } from '@/components/ClearButton';
import Link from '@/components/AppLink';
import { useIsAdmin } from '@/lib/auth-store';
import { apiUrl } from '@/lib/api-base';
import { sessionFetch } from '@/lib/session-fetch';
import { submitReconIntake, intakeRequest } from '@/lib/recon-intake-api';
import { tr } from '@/i18n/tr';
import './recon-intake.css';

const ReconstructReport = dynamic(() => import('@cuberoot/timer-ui/reconstruct-report'), { ssr: false });

export default function ReconIntakeAction({ solve, snapshot, host }: {
  solve: Solve; snapshot: ReconSnapshot | null; host: ReconstructHost;
}) {
  const admin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [target, setTarget] = useState<{ solve: Solve; source: string } | null>(null);
  const [mode, setMode] = useState<'correct' | 'needs-fix' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const panel = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  usePanelClamp(open, panel);
  usePopoverDismiss(open, () => { if (!busy) setOpen(false); }, panel, trigger);
  const resolveTarget = async () => {
    setBusy(true); setError('');
    try {
      const found = await readTimerReplay(link.trim(), [], { apiUrl, fetcher: sessionFetch });
      if (!found || found.event !== '333' || !found.moves?.length) throw new Error(tr({ zh: '请使用含原始动作的标准三阶回放链接。', en: 'Use a standard 3×3 replay with recorded moves.' }));
      setTarget({ solve: found, source: link.trim() });
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const choose = async (verdict: 'correct' | 'needs-fix') => {
    setError('');
    // A different URL is always previewed before an administrator confirms it.
    if (verdict === 'needs-fix' || target) { setMode(verdict); setOpen(false); return; }
    if (!snapshot) return;
    setBusy(true);
    try {
      await submitReconIntake(crypto.randomUUID(), {
        source: '', recording: reconRecording(solve), observed: snapshot, annotations: [], verdict,
        language: tr({ en: 'en' as const, zh: 'zh' as const }), hadOverride: !!solve.reconstruction?.length,
      });
      setSaved(true); setOpen(false);
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  if (!admin || solve.event !== '333' || !solve.moves?.length) return null;
  const resolved = target?.solve ?? solve;
  const unresolvedLink = !!link.trim() && !target;
  return <div className="ri-action">
    <button className="ri-button" ref={trigger} type="button" onClick={() => { setOpen(v => !v); setError(''); }}
      aria-expanded={open}>{tr({ zh: '收录样本', en: 'Collect sample' })}</button>
    {saved && <Link href="/recon/ground-truth?view=queue" prefetch={false}>{tr({ zh: '已收录 · 查看队列', en: 'Saved · View queue' })}</Link>}
    {open && <div ref={panel} className="ri-popover" data-site-surface="popover">
      <label>{tr({ zh: '其他复盘链接（选填，留空使用当前复盘）', en: 'Another replay link (optional; blank uses this replay)' })}
        <span className="ri-input"><input className="ri-field ri-link-input" value={link} disabled={busy} onChange={e => { setLink(e.target.value); setTarget(null); }} />
          {link && <ClearButton onClick={() => { if (!busy) { setLink(''); setTarget(null); } }} />}</span>
      </label>
      {unresolvedLink && <button className="ri-button" type="button" disabled={busy} onClick={() => void resolveTarget()}>{tr({ zh: '读取链接', en: 'Load link' })}</button>}
      {target && <p>{(target.solve.timeMs / 1000).toFixed(3)}s · {target.solve.scramble}</p>}
      <p>{tr({ zh: '确认后保存默认化简步骤为预期，自动测试尚未运行。', en: 'Confirmation saves the default simplified steps as expected output. Automated tests have not run yet.' })}</p>
      {!snapshot && !target && <p>{tr({ zh: '等待复盘完成；第一版支持标准三阶 CFOP。', en: 'Waiting for reconstruction. Version 1 supports standard 3×3 CFOP.' })}</p>}
      <button className="ri-button ri-primary" type="button" disabled={busy || unresolvedLink || (!snapshot && !target)} onClick={() => void choose('correct')}>
        {tr({ zh: '确认正确并收录 · 待测试', en: 'Confirm correct · Queue tests' })}</button>
      <button className="ri-button" type="button" disabled={busy || unresolvedLink} onClick={() => void choose('needs-fix')}>
        {tr({ zh: '批注问题并收录', en: 'Annotate and collect' })}</button>
      {error && <p role="alert">{error}</p>}
    </div>}
    {mode && createPortal(<ReconIntakeEditor solve={resolved} host={host} mode={mode} source={target?.source ?? ''}
      onClose={() => setMode(null)} onSaved={() => { setMode(null); setSaved(true); }} />, document.body)}
  </div>;
}

/** Used both at collection time and to revise a queue entry. */
export function ReconIntakeEditor({ solve, host, mode, source, existing, onClose, onSaved }: {
  solve: Solve; host: ReconstructHost; mode: 'correct' | 'needs-fix'; source: string;
  existing?: ReconIntakeCase; onClose: () => void; onSaved: () => void;
}) {
  const [snapshot, setSnapshot] = useState<ReconSnapshot | null>(null);
  const [annotations, setAnnotations] = useState<ReconAnnotation[]>(existing?.input.annotations ?? []);
  const [selected, setSelected] = useState<ReconAnnotation['range']>(null);
  const [observed, setObserved] = useState('');
  const [problem, setProblem] = useState('');
  const [algorithm, setAlgorithm] = useState('');
  const [effect, setEffect] = useState('');
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [submissionId] = useState(() => existing?.id ?? '');
  const requestId = useRef(submissionId);
  const pendingNoteId = useRef('');
  const form = useRef<HTMLTextAreaElement>(null);
  const dismiss = useModalDismiss(onClose, saving);
  const receiveSnapshot = useCallback((next: ReconSnapshot | null) => setSnapshot(next), []);
  const add = () => {
    if (!problem.trim()) return;
    pendingNoteId.current ||= crypto.randomUUID();
    const noteId = pendingNoteId.current;
    setAnnotations(items => [...items, { id: noteId, range: selected, observed,
      problem: problem.trim(), expectedAlgorithm: algorithm.trim(), expectedEffect: effect.trim() }]);
    pendingNoteId.current = '';
    setProblem(''); setAlgorithm(''); setEffect('');
  };
  const save = async () => {
    if (!snapshot) return;
    setSaving(true); setError('');
    try {
      if (problem.trim()) pendingNoteId.current ||= crypto.randomUUID();
      const notes = problem.trim() ? [...annotations, { id: pendingNoteId.current, range: selected, observed,
        problem: problem.trim(), expectedAlgorithm: algorithm.trim(), expectedEffect: effect.trim() }] : annotations;
      const input: ReconIntakeInput = {
        source, recording: reconRecording(solve), observed: snapshot, annotations: notes, verdict: mode,
        language: tr({ en: 'en' as const, zh: 'zh' as const }), hadOverride: !!solve.reconstruction?.length,
      };
      requestId.current ||= crypto.randomUUID();
      if (existing) await intakeRequest(`/${existing.id}/review`, { revision: existing.revision, action: 'revise', input });
      else await submitReconIntake(requestId.current, input);
      onSaved();
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  };
  const reviewHost: ReconstructHost = {
    ...host, renderIntakeAction: undefined,
    renderAnnotationAction: mode === 'needs-fix' ? (line, seek) => <button className="ri-button ri-annotate" type="button" onClick={() => {
      seek(); setSelected({ fromIdx: line.fromIdx, toIdx: line.toIdx });
      const displayed = snapshot?.lines.find(item => item.key === line.key) ?? line;
      setObserved(`${displayed.moves.join(' ')} // ${displayed.label ?? ''}`); form.current?.focus();
    }}>{tr({ zh: '批注', en: 'Annotate' })}</button> : undefined,
  };
  return <div className="ri-backdrop" {...dismiss}>
    <section className="ri-dialog" role="dialog" aria-modal="true" aria-label={tr({ zh: '复盘样本批注', en: 'Review reconstruction sample' })} data-site-surface="panel"
      onKeyDownCapture={event => { if (event.key === 'Escape') { event.stopPropagation(); if (!saving) onClose(); } }}>
      <div className="ri-heading"><h2>{tr({ zh: '收录复盘样本', en: 'Collect reconstruction sample' })}</h2>
        <button className="ri-button" type="button" disabled={saving} onClick={onClose}>{tr({ zh: '关闭', en: 'Close' })}</button></div>
      <ReconstructReport solve={solve} isZh={tr({ zh: true, en: false })} host={reviewHost} hideActions hideDate onReviewSnapshot={receiveSnapshot} />
      {!snapshot && <p>{tr({ zh: '等待分析完成；暂仅支持标准三阶 CFOP。', en: 'Waiting for analysis; standard 3×3 CFOP only for now.' })}</p>}
      {mode === 'needs-fix' && <div className="ri-editor">
        <p>{tr({ zh: '点击步骤旁的“批注”定位。未批注的部分不代表已确认正确。', en: 'Select Annotate beside a step. Unannotated steps are not automatically approved.' })}</p>
        <button className="ri-button" type="button" onClick={() => { setSelected(null); setObserved(''); }}>{tr({ zh: '批注整条复盘', en: 'Annotate whole replay' })}</button>
        <p>{selected ? `${selected.fromIdx + 1}–${selected.toIdx + 1}` : tr({ zh: '整条复盘', en: 'Whole replay' })} {observed}</p>
        <label>{tr({ zh: '问题说明', en: 'Problem' })}<textarea className="ri-field ri-textarea" ref={form} value={problem} onChange={e => setProblem(e.target.value)} maxLength={4000} /></label>
        <label>{tr({ zh: '预期公式（选填，精确匹配默认化简步骤）', en: 'Expected algorithm (optional; exact default notation)' })}<textarea className="ri-field ri-textarea" value={algorithm} onChange={e => setAlgorithm(e.target.value)} maxLength={4000} /></label>
        <label>{tr({ zh: '预期效果（选填）', en: 'Expected behavior (optional)' })}<textarea className="ri-field ri-textarea" value={effect} onChange={e => setEffect(e.target.value)} maxLength={4000} /></label>
        <button className="ri-button" type="button" disabled={!problem.trim()} onClick={add}>{tr({ zh: '添加批注，继续下一条', en: 'Add annotation and continue' })}</button>
        {annotations.map(note => <div key={note.id} className="ri-note"><p>{note.observed}</p><p>{note.problem}</p><p>{note.expectedAlgorithm} {note.expectedEffect}</p>
          <button className="ri-button" type="button" onClick={() => setAnnotations(items => items.filter(item => item.id !== note.id))}>{tr({ zh: '移除批注', en: 'Remove annotation' })}</button></div>)}
      </div>}
      {error && <p role="alert">{error}</p>}
      <button className="ri-button ri-primary" type="button" disabled={saving || !snapshot || (mode === 'needs-fix' && !annotations.length && !problem.trim())} onClick={() => void save()}>
        {mode === 'correct' ? tr({ zh: '确认当前复盘正确并收录', en: 'Confirm this reconstruction and collect' })
          : tr({ zh: '提交批注 · 待修正', en: 'Submit annotations · Needs correction' })}</button>
    </section>
  </div>;
}
