'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { EventId } from '../_lib/types';
import { EVENTS } from '../_lib/types';
import { TIMER_EVENT_PICKER_GROUPS } from '@cuberoot/shared/timer';
import { TimerPuzzlePicker } from '@cuberoot/timer-ui';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { generateScramble } from '../_lib/scramble';
import { warmup333 } from '../_lib/scramble/kociemba/random_state';
import { isNonWcaEvent, nextNonWcaScramble } from '../_lib/scramble/nonwca';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';

interface Props {
  defaultEvent: EventId;
  isZh: boolean;
  onClose: () => void;
}

export default function BulkScrambleModal({ defaultEvent, onClose }: Props) {
  const [event, setEvent] = useState<EventId>(defaultEvent);
  const [count, setCount] = useState(12);
  const [scrambles, setScrambles] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const firstSelectRef = useRef<HTMLDivElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const backdropProps = useModalBackdrop(onClose);
  const allowedEvents = new Set(EVENTS.filter(e => e.group !== 'll' && e.group !== 'cfop' && e.id !== 'custom').map(e => e.id));
  const groups = TIMER_EVENT_PICKER_GROUPS.map(group => ({
    id: group.id, label: tr({ zh: group.nameZh, en: group.nameEn }),
    items: group.items.filter(item => allowedEvents.has(item.id)).map(item => ({
      id: item.id, label: tr({ zh: item.nameZh, en: item.nameEn }), iconClass: item.iconClass, textLabel: item.textLabel,
    })),
  }));
  const isMobile = useIsMobile(480);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pickerOpen) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pickerOpen]);

  useEffect(() => {
    firstSelectRef.current?.querySelector('button')?.focus();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setCopied(false);
    try {
      if (['333', '333oh', '333fm'].includes(event)) {
        await warmup333();
      }
      // Non-WCA puzzles are generated off-thread. Consume the real async
      // provider results directly; never copy a temporary loading '' into a
      // bulk sheet and never build a second host-owned queue.
      if (isNonWcaEvent(event)) {
        const out: string[] = [];
        for (let i = 0; i < count; i++) {
          const scramble = await nextNonWcaScramble(event);
          if (!scramble) throw new Error(`scramble provider failed: ${event}`);
          out.push(scramble);
        }
        setScrambles(out);
        return;
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
    <div className="timer-modal-overlay" style={overlayStyle} {...backdropProps}>
      <div
        className="timer-modal bulk-scramble-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
      >
        <h2 id={titleId}>{tr({ zh: '批量打乱', en: 'Bulk scrambles'
        })}</h2>

        <div className="modal-section bulk-controls" style={controlsStyle}>
          <div className="manual-label inline" style={fieldStyle} ref={firstSelectRef}>
            {tr({ zh: '项目', en: 'Event'
            })}
            <TimerPuzzlePicker
              groups={groups}
              selectedEvent={event}
              onSelect={id => setEvent(id as EventId)}
              puzzleLabel={tr({ zh: '项目', en: 'Event' })}
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              dataNoTimer
            />
          </div>
          <label className="manual-label inline" style={fieldStyle}>
            {tr({ zh: '数量', en: 'Count'
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
            {generating ? tr({ zh: '生成中…', en: 'Generating…' }) : tr({ zh: '生成', en: 'Generate' })}
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
              <button className="modal-action-btn" onClick={onCopy} style={actionBtnStyle}>
                {copied ? tr({ zh: '已复制', en: 'Copied'
                                              }) : tr({ zh: '全部复制', en: 'Copy all'
                                                  })}
              </button>
              <button className="modal-action-btn" onClick={onDownload} style={actionBtnStyle}>
                {tr({ zh: '下载 .txt', en: 'Download .txt'
                })}
              </button>
            </>
          )}
          <button className="modal-action-btn" onClick={onClose} style={actionBtnStyle}>{tr({ zh: '关闭', en: 'Close'
        })}</button>
        </div>
      </div>
    </div>
  );
}
