'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  solvedCubie,
  applySequence,
  parseMoves,
  formatMoves,
  invertSequence,
} from '../_lib/scramble/kociemba/cube';
import { warmup333, solve333 } from '../_lib/scramble/kociemba/random_state';
import { tr } from '@/i18n/tr';

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
      setErr(tr({ zh: '暂不支持 Facelet 模式，请用 Scramble 模式。', en: 'Facelet mode not supported. Use Scramble mode.'
    }));
      return;
    }
    const txt = input.trim();
    if (!txt) {
      setErr(tr({ zh: '请输入打乱', en: 'Enter a scramble'
    }));
      return;
    }
    let moves: number[];
    try {
      moves = parseMoves(txt);
    } catch (e) {
      setErr((isZh ? `打乱解析失败：${(e as Error).message}` : `Parse error: ${(e as Error).message}`));
      return;
    }
    setSolving(true);
    try {
      await warmup333();
      const state = applySequence(solvedCubie(), moves);
      const sol = await solve333(state);
      setSolution(sol.trim());
    } catch (e) {
      setErr((isZh ? `求解失败：${(e as Error).message}` : `Solve failed: ${(e as Error).message}`));
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
      /* ignore */
    }
  };

  const moveCount = solution ? solution.split(/\s+/).filter(Boolean).length : 0;

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
        <h2 id={titleId}>{tr({ zh: '通用求解器', en: 'Solver' })}</h2>

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
              {tr({ zh: '打乱', en: 'Scramble'
            })}
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
              {tr({ zh: 'Facelet（54 字符，暂不支持）', en: 'Facelet (54 chars, not supported)'
            })}
            </label>
          </div>
        </div>

        <div className="modal-section">
          <label className="manual-label">
            {tr({ zh: '输入', en: 'Input'
            })}
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
            {tr({ zh: '正在加载求解器…', en: 'Loading solver…'
            })}
          </div>
        )}

        {solution !== null && (
          <div className="modal-section">
            <h3 className="settings-h3">{tr({ zh: '解', en: 'Solution' })} ({moveCount} {tr({ zh: '步', en: 'moves' })})</h3>
            <div className="scramble-text">{solution}</div>
            {reverseStr && (
              <div className="solver-rev">
                <div className="solver-rev-lbl">{tr({ zh: '逆序（作为打乱）：', en: 'Inverse (as scramble):'
                })}</div>
                <div className="scramble-text">{reverseStr}</div>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button
            className="primary modal-action-btn"
            disabled={solving || !ready}
            onClick={handleSolve}
          >
            {solving ? tr({ zh: '求解中…', en: 'Solving…' }) : tr({ zh: '求解', en: 'Solve' })}
          </button>
          {solution && (
            <button className="modal-action-btn" onClick={onCopy}>{copied ? tr({ zh: '已复制', en: 'Copied'
                                  }) : tr({ zh: '复制', en: 'Copy'
                                      })}</button>
          )}
          <button className="modal-action-btn" onClick={onClose}>{tr({ zh: '关闭', en: 'Close'
        })}</button>
        </div>
      </div>
    </div>
  );
}
