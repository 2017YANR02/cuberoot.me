'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { EventId, Penalty, Solve } from '../_lib/types';
import { makeSolve } from '../_lib/storage/db';
import { checkMbldEntry, formatMbldResult, isMbldDnf, mbldPoints } from '../_lib/stats';
import type { MbldEntryCheck, MbldEntryError } from '../_lib/stats';
import { obtmCount, parseScrambleStrict } from '../_lib/cube/moves';
import { applyMoves, applyScramble, isSolvedFaces } from '../_lib/cube/state';
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
 *   "DNF" / "DNS" → the corresponding penalty with a 0 ms time
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
  if (/^dns$/i.test(s)) return { ms: 0, penalty: 'DNS' };
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

/** Strict non-negative-integer parse — rejects "", "1.5", "1e3", "-2", "abc". */
function parseCount(input: string): number | null {
  const t = input.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Read the three MBLD boxes and hand them to the shared rule in stats.ts.
 * Every impossible attempt is rejected HERE, at the entry point, so a garbage
 * result never reaches storage where the ranking rules would have to guess
 * what the user meant. The rule itself (and its boundaries) lives in
 * `checkMbldEntry`; this wrapper only does string → number and reason → text.
 */
function parseMbldEntry(solvedStr: string, attemptedStr: string, timeStr: string): MbldEntryCheck {
  const t = parseTimeStr(timeStr);
  return checkMbldEntry(
    parseCount(solvedStr),
    parseCount(attemptedStr),
    t && t.penalty === 'ok' ? t.ms : null,
  );
}

/** Localized wording for a rejected MBLD entry. */
function mbldErrorText(reason: MbldEntryError): string {
  if (reason === 'attempted') {
    return tr({ zh: '尝试个数必须是不小于 2 的整数', en: 'Attempted must be a whole number of at least 2' });
  }
  if (reason === 'solved') {
    return tr({ zh: '还原个数必须是不小于 0 的整数', en: 'Solved must be a whole number of at least 0' });
  }
  if (reason === 'solved-exceeds-attempted') {
    return tr({ zh: '还原个数不能多于尝试个数', en: 'Solved cannot be greater than attempted' });
  }
  return tr({ zh: '请输入大于 0 的时间，例如 58:02', en: 'Enter a time greater than zero, e.g. 58:02' });
}

/** Assemble the Solve an accepted MBLD entry describes, deriving its penalty
 *  from WCA 9f12c so the score and the penalty can never disagree. */
function buildMbldSolve(parse: Extract<MbldEntryCheck, { ok: true }>, base: Solve): Solve {
  const withMbld: Solve = { ...base, mbld: { solved: parse.solved, attempted: parse.attempted } };
  return isMbldDnf(withMbld) ? { ...withMbld, penalty: 'DNF' } : withMbld;
}

/**
 * Validation verdict for a typed FMC solution.
 *  - `empty`    nothing typed yet
 *  - `invalid`  a token the NxN parser can't read (`token` is the first one)
 *  - `solved` / `unsolved`  parsed fine; `count` is the OBTM move count
 */
type FmcCheck =
  | { kind: 'empty' }
  | { kind: 'invalid'; token: string }
  | { kind: 'solved'; count: number }
  | { kind: 'unsolved'; count: number };

/** Parse + apply an FMC solution against its scramble. Never throws. */
function checkFmcSolution(solution: string, scramble: string): FmcCheck {
  const text = solution.trim();
  if (!text) return { kind: 'empty' };
  const { moves, bad } = parseScrambleStrict(text);
  if (bad.length > 0) return { kind: 'invalid', token: bad[0] };
  if (moves.length === 0) return { kind: 'empty' };
  const count = obtmCount(moves);
  try {
    const after = applyMoves(applyScramble(3, scramble), 3, moves);
    return { kind: isSolvedFaces(after) ? 'solved' : 'unsolved', count };
  } catch {
    // A scramble our parser can't build a state from — still report the count,
    // just don't claim the solution is verified.
    return { kind: 'unsolved', count };
  }
}

export default function ManualEntryModal({ event, currentScramble, onClose, onSubmit }: Props) {
  const [timeStr, setTimeStr] = useState('');
  const [scramble, setScramble] = useState('');
  const [penalty, setPenalty] = useState<Penalty>('ok');
  const [comment, setComment] = useState('');
  const [stepCount, setStepCount] = useState('');
  const [solution, setSolution] = useState('');
  const [mbldSolved, setMbldSolved] = useState('');
  const [mbldAttempted, setMbldAttempted] = useState('');
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const firstTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isMobile = useIsMobile(480);

  const isFmc = event === '333fm';
  const isMbld = event === '333mbld';
  const effectiveScramble = scramble.trim() || currentScramble;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (isFmc) firstTextareaRef.current?.focus();
    else firstInputRef.current?.focus();
  }, [isFmc]);

  const fmcCheck = useMemo<FmcCheck | null>(
    () => (isFmc ? checkFmcSolution(solution, effectiveScramble) : null),
    [isFmc, solution, effectiveScramble],
  );
  const derivedCount = fmcCheck && (fmcCheck.kind === 'solved' || fmcCheck.kind === 'unsolved')
    ? fmcCheck.count
    : null;

  // MBLD is parsed as a unit (solved + attempted + time) — the three boxes are
  // only meaningful together, so one verdict drives the error line and Save.
  const mbldParse = useMemo<MbldEntryCheck | null>(
    () => (isMbld ? parseMbldEntry(mbldSolved, mbldAttempted, timeStr) : null),
    [isMbld, mbldSolved, mbldAttempted, timeStr],
  );

  let parsed: { ms: number; penalty: Penalty } | null = null;
  let parseErr: string | null = null;
  if (isMbld) {
    if (mbldParse?.ok) parsed = { ms: mbldParse.ms, penalty: 'ok' };
    else if (mbldParse) parseErr = mbldErrorText(mbldParse.reason);
  } else if (isFmc) {
    // The typed solution drives the count; the numeric box is an override for
    // people transcribing a result off a comp sheet without retyping the alg.
    const override = stepCount.trim();
    if (override !== '') {
      const n = Number(override);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        parseErr = tr({ zh: '步数必须是非负整数', en: 'Move count must be a non-negative integer'
    });
      } else {
        parsed = { ms: n * 1000, penalty: 'ok' };
      }
    } else if (derivedCount !== null) {
      parsed = { ms: derivedCount * 1000, penalty: 'ok' };
    } else if (fmcCheck?.kind !== 'invalid') {
      // An invalid token is already named by <FmcStatus> — don't say it twice.
      parseErr = tr({ zh: '请输入解法或步数', en: 'Enter a solution or a move count'
    });
    }
  } else {
    const r = parseTimeStr(timeStr);
    if (timeStr.trim() === '') {
      parseErr = tr({ zh: '请输入时间', en: 'Enter time'
    });
    } else if (!r) {
      if (/^\+2\s+/i.test(timeStr.trim())) {
        parseErr = tr({ zh: '+2 时间须 ≥ 2 秒', en: '+2 time must be ≥ 2 seconds'
        });
      } else {
        parseErr = tr({ zh: '时间格式无效', en: 'Invalid time'
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
    // FMC has no schema field for the solution — it lives in `comment` (which
    // is documented multi-line), with any note appended below it.
    const note = comment.trim();
    const finalComment = isFmc
      ? ([solution.trim(), note].filter(Boolean).join('\n') || undefined)
      : (note || undefined);
    const solve = makeSolve({
      timeMs: parsed.ms,
      scramble: effectiveScramble,
      event,
      penalty: finalPenalty,
      comment: finalComment,
    });
    // MBLD carries its own payload and derives its penalty from WCA 9f12c, so
    // it never takes the penalty radios (which are hidden for this event).
    onSubmit(isMbld && mbldParse?.ok ? buildMbldSolve(mbldParse, solve) : solve);
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
        <h2 id={titleId}>{tr({ zh: '手动录入成绩', en: 'Manual entry'
        })}</h2>

        {isFmc ? (
          <div className="modal-section">
            <label className="manual-label">
              {tr({ zh: '解法', en: 'Solution' })}
              <textarea
                ref={firstTextareaRef}
                className="manual-textarea"
                rows={isMobile ? 4 : 3}
                placeholder={tr({ zh: "例如：R U R' U' F2 …", en: "e.g. R U R' U' F2 …" })}
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                style={textareaStyle}
                spellCheck={false}
              />
            </label>
            <FmcStatus check={fmcCheck} />
            <label className="manual-label" style={{ marginTop: 8 }}>
              {tr({ zh: '步数（留空则按解法自动计算）', en: 'Move count (optional — derived from the solution)' })}
              <input
                ref={firstInputRef}
                className="manual-input"
                type="text"
                inputMode="numeric"
                placeholder={derivedCount !== null ? String(derivedCount) : tr({ zh: '例如：26', en: 'e.g. 26' })}
                value={stepCount}
                onChange={(e) => setStepCount(e.target.value)}
                style={timeInputStyle}
              />
            </label>
            {parseErr && solution.length + stepCount.length > 0 && (
              <div className="manual-err">{parseErr}</div>
            )}
          </div>
        ) : isMbld ? (
          <div className="modal-section">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label className="manual-label">
                {tr({ zh: '已还原', en: 'Solved' })}
                <input
                  ref={firstInputRef}
                  className="manual-input"
                  type="text"
                  inputMode="numeric"
                  placeholder={tr({ zh: '例如：11', en: 'e.g. 11' })}
                  value={mbldSolved}
                  onChange={(e) => setMbldSolved(e.target.value)}
                  style={timeInputStyle}
                />
              </label>
              <label className="manual-label">
                {tr({ zh: '已尝试', en: 'Attempted' })}
                <input
                  className="manual-input"
                  type="text"
                  inputMode="numeric"
                  placeholder={tr({ zh: '例如：13', en: 'e.g. 13' })}
                  value={mbldAttempted}
                  onChange={(e) => setMbldAttempted(e.target.value)}
                  style={timeInputStyle}
                />
              </label>
            </div>
            <label className="manual-label" style={{ marginTop: 8 }}>
              {tr({ zh: '用时（分:秒）', en: 'Time (mm:ss)' })}
              <input
                className="manual-input"
                type="text"
                placeholder={tr({ zh: '例如：58:02', en: 'e.g. 58:02' })}
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                style={timeInputStyle}
              />
            </label>
            <MbldStatus
              parse={mbldParse}
              touched={mbldSolved.length + mbldAttempted.length + timeStr.length > 0}
              event={event}
            />
          </div>
        ) : (
          <div className="modal-section">
            <label className="manual-label">
              {tr({ zh: '时间', en: 'Time' })}
              <input
                ref={firstInputRef}
                className="manual-input"
                type="text"
                placeholder={tr({ zh: '例如：12.34 或 1:23.45 或 DNF', en: 'e.g. 12.34 or 1:23.45 or DNF' })}
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                style={timeInputStyle}
              />
            </label>
            {parseErr && timeStr.length > 0 && (
              <div className="manual-err">{parseErr}</div>
            )}
          </div>
        )}

        {/* MBLD's penalty is derived from its score (WCA 9f12c), so offering
            the radios would let the two disagree. */}
        {!isFmc && !isMbld && (
          <div className="modal-section">
            <div className="manual-label">{tr({ zh: '罚时', en: 'Penalty'
            })}</div>
            <div className="manual-radios" style={radiosStyle}>
              {(['ok', '+2', 'DNF', 'DNS'] as Penalty[]).map(p => (
                <label key={p} className="manual-radio" style={radioStyle}>
                  <input
                    className="manual-radio-input"
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
            {tr({ zh: '打乱（留空则用当前打乱）', en: 'Scramble (optional, defaults to current)'
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
            {isFmc
              ? tr({ zh: '注释（保存在解法之后）', en: 'Comment (saved below the solution)' })
              : tr({ zh: '注释', en: 'Comment' })}
            <textarea
              className="manual-textarea"
              rows={isMobile ? 3 : 2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={tr({ zh: '可选备注…', en: 'Optional notes…'
            })}
              style={textareaStyle}
            />
          </label>
        </div>

        <div className="modal-actions" style={actionsStyle}>
          <button
            className="primary modal-action-btn"
            disabled={!canSave}
            onClick={handleSave}
            style={actionBtnStyle}
          >
            {tr({ zh: '保存', en: 'Save'
            })}
          </button>
          <button className="modal-action-btn" onClick={onClose} style={actionBtnStyle}>{tr({ zh: '取消', en: 'Cancel' })}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Live verdict under the MBLD boxes: either the reason the entry is rejected,
 * or the WCA result string it will be stored as — including the 9f12c DNF, so
 * the user is told *before* saving that e.g. 2/6 does not count.
 */
function MbldStatus({ parse, touched, event }: { parse: MbldEntryCheck | null; touched: boolean; event: EventId }) {
  if (!parse || !touched) return null;
  if (!parse.ok) {
    return <div className="manual-err" role="status">{mbldErrorText(parse.reason)}</div>;
  }
  const preview: Solve = {
    id: '',
    timeMs: parse.ms,
    penalty: 'ok',
    scramble: '',
    event,
    ts: 0,
    mbld: { solved: parse.solved, attempted: parse.attempted },
  };
  const dnf = isMbldDnf(preview);
  const points = mbldPoints(preview) ?? 0;
  return (
    <div
      role="status"
      style={{
        marginTop: 4,
        fontSize: 12,
        color: dnf ? 'var(--signal-warning)' : 'var(--signal-success)',
      }}
    >
      {formatMbldResult(preview)}
      {' · '}
      {tr({ zh: `净得分 ${points}`, en: `${points} point${points === 1 || points === -1 ? '' : 's'}` })}
      {dnf && (
        <> · {tr({
          zh: '按规则 9f12c 记 DNF（净得分小于 0，或只还原了 1 个）',
          en: 'Scored DNF by Regulation 9f12c (net score below 0, or only 1 solved)',
        })}</>
      )}
    </div>
  );
}

/** Live verdict under the FMC solution box. */
function FmcStatus({ check }: { check: FmcCheck | null }) {
  if (!check || check.kind === 'empty') return null;
  if (check.kind === 'invalid') {
    return (
      <div className="manual-err" role="status">
        {tr({ zh: `无法识别的记号：${check.token}`, en: `Invalid token: ${check.token}` })}
      </div>
    );
  }
  const solved = check.kind === 'solved';
  return (
    <div
      role="status"
      style={{
        marginTop: 4,
        fontSize: 12,
        color: solved ? 'var(--signal-success)' : 'var(--signal-warning)',
      }}
    >
      {solved
        ? tr({ zh: `已还原 · ${check.count} 步`, en: `Solved — ${check.count} moves` })
        : tr({ zh: `未还原 · ${check.count} 步`, en: `Not solved — ${check.count} moves` })}
    </div>
  );
}
