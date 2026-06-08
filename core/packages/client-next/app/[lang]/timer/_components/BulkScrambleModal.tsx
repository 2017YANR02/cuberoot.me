'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { EventId } from '../_lib/types';
import { EVENTS } from '../_lib/types';
import { generateScramble } from '../_lib/scramble';
import { warmup333 } from '../_lib/scramble/kociemba/random_state';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';

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
  const isMobile = useIsMobile(480);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    firstSelectRef.current?.focus();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setCopied(false);
    try {
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
      /* ignore */
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

  const modalStyle: CSSProperties | undefined = isMobile
    ? { maxWidth: '100%', maxHeight: '95dvh', width: '100%', padding: 14 }
    : undefined;
  const overlayStyle: CSSProperties | undefined = isMobile
    ? { padding: 0, alignItems: 'stretch' }
    : undefined;
  const controlsStyle: CSSProperties | undefined = isMobile
    ? { flexDirection: 'column', alignItems: 'stretch', gap: 10 }
    : undefined;
  const fieldStyle: CSSProperties | undefined = isMobile
    ? { width: '100%' }
    : undefined;
  const numberInputStyle: CSSProperties | undefined = isMobile
    ? { width: '100%', minHeight: 44, fontSize: 16, padding: '8px 10px' }
    : undefined;
  const selectStyle: CSSProperties | undefined = isMobile
    ? { width: '100%', minHeight: 44, fontSize: 16, padding: '8px 10px' }
    : undefined;
  const generateBtnStyle: CSSProperties | undefined = isMobile
    ? { width: '100%', minHeight: 44, fontSize: 15, padding: '10px 14px' }
    : undefined;
  const listStyle: CSSProperties | undefined = isMobile
    ? { maxHeight: '60dvh' }
    : undefined;
  const actionsStyle: CSSProperties | undefined = isMobile
    ? { flexDirection: 'column', alignItems: 'stretch', gap: 8 }
    : undefined;
  const actionBtnStyle: CSSProperties | undefined = isMobile
    ? { width: '100%', minHeight: 44, fontSize: 15 }
    : undefined;

  return (
    <div className="timer-modal-overlay" style={overlayStyle} onClick={onClose}>
      <div
        className="timer-modal bulk-scramble-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
      >
        <h2 id={titleId}>{tr({ zh: '批量打乱', en: 'Bulk scrambles',
            zhHant: "批次打亂"
        })}</h2>

        <div className="modal-section bulk-controls" style={controlsStyle}>
          <label className="manual-label inline" style={fieldStyle}>
            {tr({ zh: '项目', en: 'Event',
                zhHant: "專案"
            })}
            <select
              ref={firstSelectRef}
              value={event}
              onChange={(e) => setEvent(e.target.value as EventId)}
              style={selectStyle}
            >
              {EVENTS.filter(e => e.group !== 'll' && e.group !== 'cfop' && e.id !== 'custom').map(ev => (
                <option key={ev.id} value={ev.id}>{isZh ? ev.nameZh : ev.nameEn}</option>
              ))}
            </select>
          </label>
          <label className="manual-label inline" style={fieldStyle}>
            {tr({ zh: '数量', en: 'Count',
                zhHant: "數量"
            })}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={count}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setCount(Math.max(1, Math.min(100, Math.round(n))));
              }}
              style={numberInputStyle}
            />
          </label>
          <button
            className="primary"
            onClick={handleGenerate}
            disabled={generating}
            style={generateBtnStyle}
          >
            {generating ? (tr({ zh: '生成中…', en: 'Generating…' })) : (tr({ zh: '生成', en: 'Generate' }))}
          </button>
        </div>

        {scrambles.length > 0 && (
          <div className="modal-section">
            <div className="bulk-list" style={listStyle}>
              {scrambles.map((s, i) => (
                <div className="bulk-row" key={i}>
                  <span className="bulk-idx">{i + 1})</span>
                  <span className="bulk-scramble">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions" style={actionsStyle}>
          {scrambles.length > 0 && (
            <>
              <button onClick={onCopy} style={actionBtnStyle}>
                {copied ? (tr({ zh: '已复制', en: 'Copied',
                    zhHant: "已複製"
                })) : (tr({ zh: '全部复制', en: 'Copy all',
                    zhHant: "全部複製"
                }))}
              </button>
              <button onClick={onDownload} style={actionBtnStyle}>
                {tr({ zh: '下载 .txt', en: 'Download .txt',
                    zhHant: "下載 .txt"
                })}
              </button>
            </>
          )}
          <button onClick={onClose} style={actionBtnStyle}>{tr({ zh: '关闭', en: 'Close',
              zhHant: "關閉"
        })}</button>
        </div>
      </div>
    </div>
  );
}
