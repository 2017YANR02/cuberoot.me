'use client';

import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { tr } from '@/i18n/tr';
import { CompactSelect } from '@/components/CompactSelect';
import { downloadText } from '@/lib/scramble-dist/download';
import { startScrollDiagnostic, type ScrollDiagnosticMode, type ScrollDiagnosticReport } from '@/lib/scroll-diagnostics';
import './scroll-diagnostics.css';

const STORAGE_KEY = 'scroll-diagnostics.v1';
const MODES = [
  {value:'original', zh:'原效果', en:'Original'},
  {value:'lighter', zh:'较轻毛玻璃', en:'Lighter glass'},
  {value:'no-blur', zh:'关闭毛玻璃', en:'No backdrop filters'},
  {value:'no-image', zh:'隐藏背景图', en:'Hide scenery'},
] as const;
let closeCurrent: (() => void) | undefined;
function readReports(): ScrollDiagnosticReport[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(r => r?.version === 1 && r.environment && r.frames && Array.isArray(r.gestures)).slice(-4) : [];
  } catch { return []; }
}

/** Loaded by the appearance menu only on request; never starts recording on mount. */
export function openScrollDiagnostics() {
  if (closeCurrent) return;
  const previousFocus = document.activeElement;
  const host = document.createElement('div');
  host.setAttribute('data-scroll-diagnostic-ui', '');
  document.body.append(host);
  const root = createRoot(host);
  const close = () => {
    root.unmount(); host.remove(); closeCurrent = undefined;
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  };
  closeCurrent = close;
  root.render(<ScrollDiagnostics onClose={close} />);
}

function ScrollDiagnostics({onClose}: {onClose: () => void}) {
  const [mode, setMode] = useState<ScrollDiagnosticMode>('original');
  const [recording, setRecording] = useState(false);
  const [marked, setMarked] = useState(false);
  const [reports, setReports] = useState(readReports);
  const recorder = useRef<ReturnType<typeof startScrollDiagnostic> | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const [error, setError] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    return () => {
      mounted.current = false;
      if (pending.current) clearTimeout(pending.current);
      recorder.current?.stop('closed');
    };
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  const start = () => {
    setRecording(true); setMarked(false); setError(false);
    // Let the controls collapse before measuring. No panel updates during sampling.
    pending.current = setTimeout(() => {
      pending.current = null;
      try {
        recorder.current = startScrollDiagnostic(mode, report => {
          const next = [...reports, report].slice(-4);
          try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Export remains available in memory. */ }
          recorder.current = null;
          if (mounted.current) { setReports(next); setRecording(false); }
        });
      } catch {
        document.body.removeAttribute('data-scroll-diagnostic');
        if (mounted.current) { setError(true); setRecording(false); }
      }
    }, 300);
  };
  const stop = () => {
    if (pending.current) { clearTimeout(pending.current); pending.current = null; setRecording(false); }
    recorder.current?.stop();
  };
  const latest = reports.at(-1);
  const exportReport = () => downloadText('cuberoot-scroll-diagnostics.json', JSON.stringify({
    version:1, exportedAt:new Date().toISOString(),
    interpretation:'rAF gaps are main-thread callback intervals, not measured display FPS. Unsupported APIs are unknown. Unmoved swipes are clues, not confirmed browser failures. Compare the same page and gestures.',
    runs:reports,
  }, null, 2));

  return <section className={`scroll-diagnostics${recording ? ' is-recording' : ''}`} aria-label={tr({zh:'滚动诊断',en:'Scroll diagnostics'})}>
    <div className="scroll-diagnostics-heading">
      <strong>{recording ? tr({zh:'记录中，最多 30 秒',en:'Recording, up to 30 seconds'}) : tr({zh:'滚动诊断',en:'Scroll diagnostics'})}</strong>
      <button ref={closeButton} type="button" onClick={onClose}>{tr({zh:'关闭',en:'Close'})}</button>
    </div>
    {recording ? <div className="scroll-diagnostics-actions">
      <button type="button" onClick={() => { recorder.current?.mark(); setMarked(true); }}>{marked ? tr({zh:'已标记，可再次标记',en:'Marked; tap to mark again'}) : tr({zh:'刚才卡住了',en:'It just froze'})}</button>
      <button type="button" onClick={stop}>{tr({zh:'停止并查看',en:'Stop and review'})}</button>
    </div> : <>
      <p>{tr({zh:'先选原效果，点开始后上下滑动。再在同一页、同一位置换一种模式重复。诊断结束会恢复原效果。',en:'Start with Original and scroll up and down. Repeat another mode at the same position on the same page. The original appearance returns when recording ends.'})}</p>
      <CompactSelect value={mode} onChange={setMode} label={tr(MODES.find(item => item.value === mode)!)}
        popupClassName="scroll-diagnostics-options"
        ariaLabel={tr({zh:'诊断对照模式',en:'Diagnostic comparison mode'})}
        items={MODES.map(item => ({value:item.value,label:tr(item)}))} />
      <p className="scroll-diagnostics-note">{tr({zh:'只记录手势位移、页面位置、性能时序和外观状态。最近 4 次留在此标签页，不含输入内容，不自动上传。',en:'Records gesture movement, page position, performance timing and appearance. The last 4 runs stay in this tab, without input content or automatic uploads.'})}</p>
      <div className="scroll-diagnostics-actions">
        <button type="button" onClick={start}>{tr({zh:'开始记录 30 秒',en:'Record for 30 seconds'})}</button>
        {!!reports.length && <button type="button" onClick={exportReport}>{tr({zh:'下载诊断报告',en:'Download report'})}</button>}
      </div>
      {latest && <div className="scroll-diagnostics-result" role="status">
        <p>{tr({zh:'最近一次',en:'Latest run'})}: {tr(MODES.find(item => item.value === latest.mode) ?? MODES[0])} · {Math.round(latest.durationMs/1000)}s</p>
        <p>{tr({zh:'触摸手势',en:'Touch gestures'})}: {latest.gestures.length} · {tr({zh:'疑似滑动未移动',en:'Possibly unmoved swipes'})}: {latest.unmovedSwipes}</p>
        <p>{tr({zh:'滑动期间回调间隔 P95',en:'Active callback interval P95'})}: {latest.activeFrames.p95Ms === null ? '—' : `${latest.activeFrames.p95Ms} ms`}</p>
        <p className="scroll-diagnostics-note">{tr({zh:'这些是排查线索，不是屏幕帧率。Safari 未提供的指标会注明缺失，不能据此认定没有卡顿。',en:'These are diagnostic clues, not display FPS. Unavailable Safari metrics are marked as missing and do not prove smooth rendering.'})}</p>
      </div>}
      {error && <p role="alert">{tr({zh:'本次诊断未能启动，请关闭后重试。',en:'Recording could not start. Close and try again.'})}</p>}
    </>}
  </section>;
}
