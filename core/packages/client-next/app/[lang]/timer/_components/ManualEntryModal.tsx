'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { EventId, Penalty, Solve } from '../_lib/types';
import { makeSolve } from '../_lib/storage/db';
import { useIsMobile } from '@/hooks/useIsMobile';
import { tr } from '@/i18n/tr';

interface Props {
  event: EventId;
  currentScramble: string;
  isZh: boolean;
  onClose: () => void;
  onSubmit: (solve: Solve) => void;
}

/**
 * Parse a time string into ms. Accepts:
 *   "DNF" → Infinity
 *   "12.34" / "12" / ".34"
 *   "1:23.45" / "1:23"
 *   "1:23:45.67"
 *   Optional "+2 " prefix returns { ms, plus2: true }.
 */
function parseTimeStr(input: string): { ms: number; penalty: Penalty } | null {
  let s = input.trim();
  if (!s) return null;
  let penalty: Penalty = 'ok';
  if (/^dnf$/i.test(s)) return { ms: 0, penalty: 'DNF' };
  if (/^\+2\s+/i.test(s)) {
    penalty = '+2';
    s = s.replace(/^\+2\s+/i, '');
  }
  const parts = s.split(':');
  if (parts.length > 3) return null;
  let h = 0, m = 0, sec = 0;
  if (parts.length === 3) {
    h = Number(parts[0]); m = Number(parts[1]); sec = Number(parts[2]);
  } else if (parts.length === 2) {
    m = Number(parts[0]); sec = Number(parts[1]);
  } else {
    sec = Number(parts[0]);
  }
  if (!isFinite(h) || !isFinite(m) || !isFinite(sec)) return null;
  if (h < 0 || m < 0 || sec < 0) return null;
  const total = h * 3600000 + m * 60000 + Math.round(sec * 1000);
  if (penalty === '+2') {
    if (total < 2000) return null;
    return { ms: total - 2000, penalty: '+2' };
  }
  return { ms: total, penalty };
}

export default function ManualEntryModal({ event, currentScramble, isZh, onClose, onSubmit }: Props) {
  const [timeStr, setTimeStr] = useState('');
  const [scramble, setScramble] = useState('');
  const [penalty, setPenalty] = useState<Penalty>('ok');
  const [comment, setComment] = useState('');
  const [stepCount, setStepCount] = useState('');
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile(480);

  const isFmc = event === '333fm';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  let parsed: { ms: number; penalty: Penalty } | null = null;
  let parseErr: string | null = null;
  if (isFmc) {
    const n = Number(stepCount.trim());
    if (stepCount.trim() === '') {
      parseErr = tr({ zh: '请输入步数', en: 'Enter move count',
          zhHant: "請輸入步數"
    });
    } else if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      parseErr = tr({ zh: '步数必须是非负整数', en: 'Move count must be a non-negative integer',
          zhHant: "步數必須是非負整數"
    });
    } else {
      parsed = { ms: n * 1000, penalty: 'ok' };
    }
  } else {
    const r = parseTimeStr(timeStr);
    if (timeStr.trim() === '') {
      parseErr = tr({ zh: '请输入时间', en: 'Enter time',
          zhHant: "請輸入時間"
    });
    } else if (!r) {
      if (/^\+2\s+/i.test(timeStr.trim())) {
        parseErr = tr({ zh: '+2 时间须 ≥ 2 秒', en: '+2 time must be ≥ 2 seconds',
            zhHant: "+2 時間須 ≥ 2 秒"
        });
      } else {
        parseErr = tr({ zh: '时间格式无效', en: 'Invalid time',
            zhHant: "時間格式無效"
        });
      }
    } else {
      parsed = r;
    }
  }

  const canSave = !parseErr && parsed !== null;

  const handleSave = () => {
    if (!parsed) return;
    const finalPenalty: Penalty = parsed.penalty !== 'ok' ? parsed.penalty : penalty;
    const solve = makeSolve({
      timeMs: parsed.ms,
      scramble: scramble.trim() || currentScramble,
      event,
      penalty: finalPenalty,
      comment: comment.trim() || undefined,
    });
    onSubmit(solve);
  };

  const modalStyle: CSSProperties | undefined = isMobile
    ? { maxWidth: '100%', maxHeight: '95dvh', width: '100%', padding: 14 }
    : undefined;
  const overlayStyle: CSSProperties | undefined = isMobile
    ? { padding: 0, alignItems: 'stretch' }
    : undefined;
  const timeInputStyle: CSSProperties | undefined = isMobile
    ? { minHeight: 44, fontSize: 16, padding: '10px 12px' }
    : undefined;
  const textareaStyle: CSSProperties | undefined = isMobile
    ? { fontSize: 16, padding: '10px 12px' }
    : undefined;
  const radiosStyle: CSSProperties | undefined = isMobile
    ? { gap: 18, flexWrap: 'wrap' }
    : undefined;
  const radioStyle: CSSProperties | undefined = isMobile
    ? { minHeight: 44, fontSize: 15, padding: '6px 0' }
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
        className="timer-modal manual-entry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
      >
        <h2 id={titleId}>{tr({ zh: '手动录入成绩', en: 'Manual entry',
            zhHant: "手動錄入成績"
        })}</h2>

        <div className="modal-section">
          <label className="manual-label">
            {isFmc ? (tr({ zh: '步数', en: 'Move count',
                zhHant: "步數"
            })) : (tr({ zh: '时间', en: 'Time',
                zhHant: "時間"
            }))}
            {isFmc ? (
              <input
                ref={firstInputRef}
                className="manual-input"
                type="text"
                inputMode="numeric"
                placeholder={tr({ zh: '例如：26', en: 'e.g. 26' })}
                value={stepCount}
                onChange={(e) => setStepCount(e.target.value)}
                style={timeInputStyle}
              />
            ) : (
              <input
                ref={firstInputRef}
                className="manual-input"
                type="text"
                placeholder={tr({ zh: '例如：12.34 或 1:23.45 或 DNF', en: 'e.g. 12.34 or 1:23.45 or DNF' })}
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                style={timeInputStyle}
              />
            )}
          </label>
          {parseErr && timeStr.length + stepCount.length > 0 && (
            <div className="manual-err">{parseErr}</div>
          )}
        </div>

        {!isFmc && (
          <div className="modal-section">
            <div className="manual-label">{tr({ zh: '罚时', en: 'Penalty',
                zhHant: "罰時"
            })}</div>
            <div className="manual-radios" style={radiosStyle}>
              {(['ok', '+2', 'DNF'] as Penalty[]).map(p => (
                <label key={p} className="manual-radio" style={radioStyle}>
                  <input
                    type="radio"
                    name="manual-penalty"
                    value={p}
                    checked={penalty === p}
                    onChange={() => setPenalty(p)}
                  />
                  {p === 'ok' ? 'OK' : p}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="modal-section">
          <label className="manual-label">
            {tr({ zh: '打乱（留空则用当前打乱）', en: 'Scramble (optional, defaults to current)',
                zhHant: "打亂（留空則用當前打亂）"
            })}
            <textarea
              className="manual-textarea"
              rows={isMobile ? 3 : 2}
              placeholder={currentScramble}
              value={scramble}
              onChange={(e) => setScramble(e.target.value)}
              style={textareaStyle}
            />
          </label>
        </div>

        <div className="modal-section">
          <label className="manual-label">
            {tr({ zh: '注释', en: 'Comment',
                zhHant: "註釋"
            })}
            <textarea
              className="manual-textarea"
              rows={isMobile ? 3 : 2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={tr({ zh: '可选备注…', en: 'Optional notes…',
                  zhHant: "可選備註…"
            })}
              style={textareaStyle}
            />
          </label>
        </div>

        <div className="modal-actions" style={actionsStyle}>
          <button
            className="primary"
            disabled={!canSave}
            onClick={handleSave}
            style={actionBtnStyle}
          >
            {tr({ zh: '保存', en: 'Save',
                zhHant: "儲存"
            })}
          </button>
          <button onClick={onClose} style={actionBtnStyle}>{tr({ zh: '取消', en: 'Cancel' })}</button>
        </div>
      </div>
    </div>
  );
}
