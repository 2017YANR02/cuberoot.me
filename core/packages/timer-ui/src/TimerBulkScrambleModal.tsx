'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TIMER_BULK_SCRAMBLE_COPY, TIMER_BULK_SCRAMBLE_COUNTS, TIMER_EVENT_PICKER_GROUPS, TIMER_MORE_ACTION_COPY,
  clampTimerBulkScrambleCount, isTimerBulkScrambleEvent, timerBulkScrambleBatch, timerScrambleStatus,
  type EventId, type TimerScrambleRequest,
} from '@cuberoot/shared/timer';
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
  const [event, setEvent] = useState<EventId>(isTimerBulkScrambleEvent(defaultEvent) ? defaultEvent : '333');
  const [count, setCount] = useState<number>(TIMER_BULK_SCRAMBLE_COUNTS.initial);
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
    items: group.items.filter(item => isTimerBulkScrambleEvent(item.id)).map(item => ({
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
  const batch = timerBulkScrambleBatch(event, scrambles);
  const exportBatch = async (copy: boolean) => {
    const revision = exportRevision.current;
    setExportFailed(false);
    try {
      if (copy) await transport.copy(batch.text);
      else await transport.download(batch.text, batch.filename);
      if (revision === exportRevision.current && copy) setCopied(true);
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError') && revision === exportRevision.current) setExportFailed(true); }
  };
  return <TimerRoomDialog title={tr(TIMER_MORE_ACTION_COPY['more.bulk'])} className="timer-tool-dialog bulk-scramble-modal" language={language} onClose={dismiss}>
    <div className="timer-tool-controls">
      <TimerPuzzlePicker groups={groups} selectedEvent={event} onSelect={id => setEvent(id as EventId)} puzzleLabel={tr(TIMER_BULK_SCRAMBLE_COPY.event)} open={pickerOpen} onOpenChange={setPickerOpen} dataNoTimer />
      <label className="timer-tool-field">{tr(TIMER_BULK_SCRAMBLE_COPY.count)}<input type="number" inputMode="numeric" min={TIMER_BULK_SCRAMBLE_COUNTS.min} max={TIMER_BULK_SCRAMBLE_COUNTS.max} value={count} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) setCount(clampTimerBulkScrambleCount(n)); }} /></label>
      <button type="button" disabled={generating} onClick={() => void generate()}>{tr(generating ? TIMER_BULK_SCRAMBLE_COPY.generating : TIMER_BULK_SCRAMBLE_COPY.generate)}</button>
    </div>
    {failed && <p role="alert">{tr(timerScrambleStatus('error-generated').message)}</p>}
    {batch.rows.length > 0 && <div className="timer-tool-list">{batch.rows.map(row => <div className="timer-tool-row" key={row.number}><span>{row.number}</span><span>{row.scramble}</span></div>)}</div>}
    {exportFailed && <p role="alert">{tr(TIMER_BULK_SCRAMBLE_COPY.exportFailed)}</p>}
    <div className="timer-tool-actions">
      {scrambles.length > 0 && <>
        <button type="button" onClick={() => void exportBatch(true)}>{tr(copied ? TIMER_BULK_SCRAMBLE_COPY.copied : TIMER_BULK_SCRAMBLE_COPY.copy)}</button>
        <button type="button" onClick={() => void exportBatch(false)}>{tr(TIMER_BULK_SCRAMBLE_COPY.download)}</button>
      </>}
      <button type="button" onClick={onClose}>{tr({ zh: '关闭', en: 'Close' })}</button>
    </div>
  </TimerRoomDialog>;
}
