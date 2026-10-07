'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENTS, TIMER_EVENT_PICKER_GROUPS, timerScrambleStatus, type EventId, type TimerScrambleRequest } from '@cuberoot/shared/timer';
import { TimerRoomDialog } from './TimerRoomDialog';
import { TimerPuzzlePicker } from './TimerPuzzlePicker';
import { createRandomScrambleClient } from './random-scramble';
import type { TimerToolTransport } from './TimerTools';
import './timer-tools.css';

export default function TimerBulkScrambleModal({ defaultEvent, language, onClose, onDismissChange, transport, randomOptions }: {
  defaultEvent: EventId; language: 'en' | 'zh'; onClose(): void;
  onDismissChange?(dismiss: (() => boolean) | null): void;
  transport: TimerToolTransport; randomOptions: Pick<TimerScrambleRequest, 'cnMode' | 'scramble222Mode'>;
}) {
  const tr = (copy: { en: string; zh: string }) => copy[language];
  const allowed = new Set(EVENTS.filter(e => e.group !== 'll' && e.group !== 'cfop' && e.id !== 'custom').map(e => e.id));
  const [event, setEvent] = useState<EventId>(allowed.has(defaultEvent) ? defaultEvent : '333');
  const [count, setCount] = useState(12);
  const [scrambles, setScrambles] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const exportRevision = useRef(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(false); pickerRef.current = pickerOpen;
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const dismiss = useCallback(() => {
    if (pickerRef.current) { pickerRef.current = false; setPickerOpen(false); }
    else closeRef.current();
    return true;
  }, []);
  useEffect(() => { onDismissChange?.(dismiss); return () => onDismissChange?.(null); }, [dismiss, onDismissChange]);
  const [client] = useState(createRandomScrambleClient);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    exportRevision.current++;
    request.current?.abort(); request.current = null; client.reset();
    setGenerating(false); setScrambles([]); setFailed(false); setCopied(false); setExportFailed(false);
    return () => { exportRevision.current++; request.current?.abort(); client.reset(); };
  }, [event, count, randomOptions.cnMode, randomOptions.scramble222Mode, client]);
  const groups = TIMER_EVENT_PICKER_GROUPS.map(group => ({
    id: group.id, label: tr({ zh: group.nameZh, en: group.nameEn }),
    items: group.items.filter(item => allowed.has(item.id)).map(item => ({
      id: item.id, label: tr({ zh: item.nameZh, en: item.nameEn }), iconClass: item.iconClass, textLabel: item.textLabel,
    })),
  }));
  const generate = async () => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    exportRevision.current++;
    setGenerating(true); setFailed(false); setCopied(false); setExportFailed(false); setScrambles([]);
    try {
      const out: string[] = [];
      for (let i = 0; i < count; i++) {
        const result = await client.generate({ event, ...randomOptions }, controller.signal);
        if (controller.signal.aborted) return;
        if (!result.ok || result.kind !== 'generated') throw new Error('Generation failed');
        out.push(result.scramble);
      }
      setScrambles(out);
    } catch { if (!controller.signal.aborted) setFailed(true); }
    finally { if (request.current === controller) { request.current = null; setGenerating(false); } }
  };
  const formatted = scrambles.map((s, i) => `${i + 1}) ${s}`).join('\n');
  const exportBatch = async (copy: boolean) => {
    const revision = exportRevision.current;
    setExportFailed(false);
    try {
      if (copy) await transport.copy(formatted);
      else await transport.download(formatted, `cuberoot-scrambles-${event}-${count}.txt`);
      if (revision === exportRevision.current && copy) setCopied(true);
    } catch { if (revision === exportRevision.current) setExportFailed(true); }
  };
  return <TimerRoomDialog title={tr({ zh: '批量打乱', en: 'Bulk scrambles' })} className="timer-tool-dialog bulk-scramble-modal" language={language} onClose={dismiss}>
    <div className="timer-tool-controls">
      <TimerPuzzlePicker groups={groups} selectedEvent={event} onSelect={id => setEvent(id as EventId)} puzzleLabel={tr({ zh: '项目', en: 'Event' })} open={pickerOpen} onOpenChange={setPickerOpen} dataNoTimer />
      <label className="timer-tool-field">{tr({ zh: '数量', en: 'Count' })}<input type="number" inputMode="numeric" min={1} max={100} value={count} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) setCount(Math.max(1, Math.min(100, Math.round(n)))); }} /></label>
      <button type="button" disabled={generating} onClick={() => void generate()}>{generating ? tr({ zh: '生成中…', en: 'Generating…' }) : tr({ zh: '生成', en: 'Generate' })}</button>
    </div>
    {failed && <p role="alert">{tr(timerScrambleStatus('error-generated').message)}</p>}
    {scrambles.length > 0 && <div className="timer-tool-list">{scrambles.map((s, i) => <div className="timer-tool-row" key={i}><span>{i + 1})</span><span>{s}</span></div>)}</div>}
    {exportFailed && <p role="alert">{tr({ zh: '操作失败，请重试。', en: 'Action failed. Please try again.' })}</p>}
    <div className="timer-tool-actions">
      {scrambles.length > 0 && <>
        <button type="button" onClick={() => void exportBatch(true)}>{copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '全部复制', en: 'Copy all' })}</button>
        <button type="button" onClick={() => void exportBatch(false)}>{tr({ zh: '下载 .txt', en: 'Download .txt' })}</button>
      </>}
      <button type="button" onClick={onClose}>{tr({ zh: '关闭', en: 'Close' })}</button>
    </div>
  </TimerRoomDialog>;
}
