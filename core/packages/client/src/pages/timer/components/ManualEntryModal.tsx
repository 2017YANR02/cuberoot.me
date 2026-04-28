import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { EventId, Penalty, Solve } from '../types';
import { makeSolve } from '../storage/db';

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
  // h:m:s.cs / m:s.cs / s.cs
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
    // Stored ms = displayed ms - 2000 (i.e. raw "before +2" time). If the user
    // typed e.g. "+2 1.50" the raw becomes negative and would corrupt PB
    // tracking — reject it here and let the caller surface a hint.
    if (total < 2000) return null;
    return { ms: total - 2000, penalty: '+2' };
  }
  return { ms: total, penalty };
}

/** True iff viewport ≤ 480px. Drives full-width modal + tap-friendly inputs. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 480px)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 480px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

export default function ManualEntryModal({ event, currentScramble, isZh, onClose, onSubmit }: Props) {
  const [timeStr, setTimeStr] = useState('');
  const [scramble, setScramble] = useState('');
  const [penalty, setPenalty] = useState<Penalty>('ok');
  const [comment, setComment] = useState('');
  const [stepCount, setStepCount] = useState('');
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();

  const isFmc = event === '333fm';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Initial focus → first input. Mount-only.
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  let parsed: { ms: number; penalty: Penalty } | null = null;
  let parseErr: string | null = null;
  if (isFmc) {
    const n = Number(stepCount.trim());
    if (stepCount.trim() === '') {
      parseErr = isZh ? '请输入步数' : 'Enter move count';
    } else if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      parseErr = isZh ? '步数必须是非负整数' : 'Move count must be a non-negative integer';
    } else {
      parsed = { ms: n * 1000, penalty: 'ok' };
    }
  } else {
    const r = parseTimeStr(timeStr);
    if (timeStr.trim() === '') {
      parseErr = isZh ? '请输入时间' : 'Enter time';
    } else if (!r) {
      // Surface +2 < 2s specially — parseTimeStr rejects it as null.
      if (/^\+2\s+/i.test(timeStr.trim())) {
        parseErr = isZh ? '+2 时间须 ≥ 2 秒' : '+2 time must be ≥ 2 seconds';
      } else {
        parseErr = isZh ? '时间格式无效' : 'Invalid time';
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

  // Mobile-only style overrides. Phone gets a full-width modal, taller time
  // input (44px+), tap-friendly radios, and stacked Save / Cancel actions.
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
        <h2 id={titleId}>{isZh ? '手动录入成绩' : 'Manual entry'}</h2>

        <div className="modal-section">
          <label className="manual-label">
            {isFmc ? (isZh ? '步数' : 'Move count') : (isZh ? '时间' : 'Time')}
            {isFmc ? (
              <input
                ref={firstInputRef}
                className="manual-input"
                type="text"
                inputMode="numeric"
                placeholder={isZh ? '例如：26' : 'e.g. 26'}
                value={stepCount}
                onChange={(e) => setStepCount(e.target.value)}
                style={timeInputStyle}
              />
            ) : (
              <input
                ref={firstInputRef}
                className="manual-input"
                type="text"
                placeholder={isZh ? '例如：12.34 或 1:23.45 或 DNF' : 'e.g. 12.34 or 1:23.45 or DNF'}
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
            <div className="manual-label">{isZh ? '罚时' : 'Penalty'}</div>
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
            {isZh ? '打乱（留空则用当前打乱）' : 'Scramble (optional, defaults to current)'}
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
            {isZh ? '注释' : 'Comment'}
            <textarea
              className="manual-textarea"
              rows={isMobile ? 3 : 2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={isZh ? '可选备注…' : 'Optional notes…'}
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
            {isZh ? '保存' : 'Save'}
          </button>
          <button onClick={onClose} style={actionBtnStyle}>{isZh ? '取消' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  );
}
