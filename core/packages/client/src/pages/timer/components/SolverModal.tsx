import { useEffect, useId, useRef, useState } from 'react';
import {
  solvedCubie,
  applySequence,
  parseMoves,
  formatMoves,
  invertSequence,
} from '../scramble/kociemba/cube';
import { warmup333, solve333 } from '../scramble/kociemba/random_state';

interface Props {
  isZh: boolean;
  onClose: () => void;
}

type Mode = 'scramble' | 'facelet';

export default function SolverModal({ isZh, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('scramble');
  const [input, setInput] = useState('');
  const [solving, setSolving] = useState(false);
  const [ready, setReady] = useState(false);
  const [solution, setSolution] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const firstInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Initial focus → input textarea. Mount-only.
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    warmup333().then(() => { if (!cancelled) setReady(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleSolve = async () => {
    setErr(null);
    setSolution(null);
    setCopied(false);
    if (mode === 'facelet') {
      // Facelet→cubie conversion not implemented in this codebase.
      setErr(isZh ? '暂不支持 Facelet 模式，请用 Scramble 模式。' : 'Facelet mode not supported. Use Scramble mode.');
      return;
    }
    const txt = input.trim();
    if (!txt) {
      setErr(isZh ? '请输入打乱' : 'Enter a scramble');
      return;
    }
    let moves: number[];
    try {
      moves = parseMoves(txt);
    } catch (e) {
      setErr(isZh ? `打乱解析失败：${(e as Error).message}` : `Parse error: ${(e as Error).message}`);
      return;
    }
    setSolving(true);
    try {
      await warmup333();
      const state = applySequence(solvedCubie(), moves);
      // Two equivalent options: solve(state) gives a sequence that takes state→solved.
      // We feed the "scrambled" state directly and report what the solver returns.
      const sol = await solve333(state);
      setSolution(sol.trim());
    } catch (e) {
      setErr(isZh ? `求解失败：${(e as Error).message}` : `Solve failed: ${(e as Error).message}`);
    } finally {
      setSolving(false);
    }
  };

  const onCopy = async () => {
    if (!solution) return;
    try {
      await navigator.clipboard.writeText(solution);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const moveCount = solution ? solution.split(/\s+/).filter(Boolean).length : 0;

  // Reverse-as-scramble helper (turn solution back into a scramble).
  const reverseStr = solution
    ? formatMoves(invertSequence(parseMoves(solution)))
    : '';

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div
        className="timer-modal solver-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{isZh ? '通用求解器' : 'Solver'}</h2>

        <div className="modal-section">
          <div className="solver-radios">
            <label className="manual-radio">
              <input
                type="radio"
                name="solver-mode"
                value="scramble"
                checked={mode === 'scramble'}
                onChange={() => setMode('scramble')}
              />
              {isZh ? '打乱' : 'Scramble'}
            </label>
            <label className="manual-radio disabled">
              <input
                type="radio"
                name="solver-mode"
                value="facelet"
                checked={mode === 'facelet'}
                disabled
                onChange={() => setMode('facelet')}
              />
              {isZh ? 'Facelet（54 字符，暂不支持）' : 'Facelet (54 chars, not supported)'}
            </label>
          </div>
        </div>

        <div className="modal-section">
          <label className="manual-label">
            {isZh ? '输入' : 'Input'}
            <textarea
              ref={firstInputRef}
              className="manual-textarea solver-input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'scramble'
                ? `R U R' U' F2 L D ...`
                : `UUUUUUUUUR...`
              }
            />
          </label>
          {err && <div className="manual-err">{err}</div>}
        </div>

        {!ready && (
          <div className="modal-section solver-loading">
            {isZh ? '正在加载求解器…' : 'Loading solver…'}
          </div>
        )}

        {solution !== null && (
          <div className="modal-section">
            <h3 className="settings-h3">{isZh ? '解' : 'Solution'} ({moveCount} {isZh ? '步' : 'moves'})</h3>
            <div className="scramble-text">{solution}</div>
            {reverseStr && (
              <div className="solver-rev">
                <div className="solver-rev-lbl">{isZh ? '逆序（作为打乱）：' : 'Inverse (as scramble):'}</div>
                <div className="scramble-text">{reverseStr}</div>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button
            className="primary"
            disabled={solving || !ready}
            onClick={handleSolve}
          >
            {solving ? (isZh ? '求解中…' : 'Solving…') : (isZh ? '求解' : 'Solve')}
          </button>
          {solution && (
            <button onClick={onCopy}>{copied ? (isZh ? '已复制' : 'Copied') : (isZh ? '复制' : 'Copy')}</button>
          )}
          <button onClick={onClose}>{isZh ? '关闭' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}
