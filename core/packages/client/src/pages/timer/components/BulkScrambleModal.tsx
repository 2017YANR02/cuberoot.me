import { useEffect, useId, useRef, useState } from 'react';
import type { EventId } from '../types';
import { EVENTS } from '../types';
import { generateScramble } from '../scramble';
import { warmup333 } from '../scramble/kociemba/random_state';

interface Props {
  defaultEvent: EventId;
  isZh: boolean;
  onClose: () => void;
}

export default function BulkScrambleModal({ defaultEvent, isZh, onClose }: Props) {
  const [event, setEvent] = useState<EventId>(defaultEvent);
  const [count, setCount] = useState(12);
  const [scrambles, setScrambles] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const firstSelectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Initial focus → event picker. Mount-only.
  useEffect(() => {
    firstSelectRef.current?.focus();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setCopied(false);
    try {
      // For 333-style events, ensure Kociemba is warmed up so we don't fall
      // back to random-move scrambles for the whole batch.
      if (['333', '333oh', '333fm'].includes(event)) {
        await warmup333();
      }
      const out: string[] = [];
      for (let i = 0; i < count; i++) {
        out.push(generateScramble(event));
      }
      setScrambles(out);
    } finally {
      setGenerating(false);
    }
  };

  const formatted = scrambles.map((s, i) => `${i + 1}) ${s}`).join('\n');

  const onCopy = async () => {
    if (!scrambles.length) return;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const onDownload = () => {
    if (!scrambles.length) return;
    const blob = new Blob([formatted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuberoot-scrambles-${event}-${count}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        className="timer-modal bulk-scramble-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{isZh ? '批量打乱' : 'Bulk scrambles'}</h2>

        <div className="modal-section bulk-controls">
          <label className="manual-label inline">
            {isZh ? '项目' : 'Event'}
            <select ref={firstSelectRef} value={event} onChange={(e) => setEvent(e.target.value as EventId)}>
              {EVENTS.filter(e => e.group !== 'll' && e.group !== 'cfop' && e.id !== 'custom').map(ev => (
                <option key={ev.id} value={ev.id}>{isZh ? ev.nameZh : ev.nameEn}</option>
              ))}
            </select>
          </label>
          <label className="manual-label inline">
            {isZh ? '数量' : 'Count'}
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setCount(Math.max(1, Math.min(100, Math.round(n))));
              }}
            />
          </label>
          <button
            className="primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (isZh ? '生成中…' : 'Generating…') : (isZh ? '生成' : 'Generate')}
          </button>
        </div>

        {scrambles.length > 0 && (
          <div className="modal-section">
            <div className="bulk-list">
              {scrambles.map((s, i) => (
                <div className="bulk-row" key={i}>
                  <span className="bulk-idx">{i + 1})</span>
                  <span className="bulk-scramble">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          {scrambles.length > 0 && (
            <>
              <button onClick={onCopy}>{copied ? (isZh ? '已复制' : 'Copied') : (isZh ? '全部复制' : 'Copy all')}</button>
              <button onClick={onDownload}>{isZh ? '下载 .txt' : 'Download .txt'}</button>
            </>
          )}
          <button onClick={onClose}>{isZh ? '关闭' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}
