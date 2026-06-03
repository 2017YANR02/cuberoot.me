'use client';

// 3BLD 记忆回想训练 (memo recall trainer) — a NEW module merged from the Android
// app (RememberFragment). No web equivalent. Closed practice loop:
//
//   GENERATE  random-move scramble -> codereader(scramble, config) -> authentic
//             corner + edge letter pairs (reuses the verified Phase-1 engine).
//   MEMORIZE  show the letter pairs (LetterReadout-style chips), with an optional
//             联想词 / association-word overlay (zh-only, dynamic-imported so the
//             576-entry dictionary is code-split out of the entry chunk).
//   DELAY     optional math distractor: 3 arithmetic problems gate recall,
//             simulating BLD memo delay (the Android delay dialog).
//   RECALL    hide the memo, type the pairs back.
//   SCORE     per-pair correct/wrong diff, accuracy %, memorize + recall time.
//
// Config (buffer / scheme / piece-set) flows through the shared BldConfigBar +
// useBldConfigStore. Nothing heavy persisted.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Play,
  Eye,
  EyeOff,
  Lightbulb,
  Calculator,
  Check,
  X,
  RotateCcw,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import CubingPreview from '@/components/CubingPreview';
import { BldConfigBar } from '../_components/BldConfigBar';
import {
  useBldConfigStore,
  useBldConfigHydrated,
} from '../_store/bld-config-store';
import { codereader } from '../_lib/read-engine';
import { scramble333 } from '@/app/[lang]/timer/_lib/scramble/nxnxn';
import type { LetterCell } from '../_lib/types';
import '../3bld.css';

type Phase = 'idle' | 'memorize' | 'delay' | 'recall' | 'score';
type PieceSet = 'both' | 'corner' | 'edge';

interface MemoGroup {
  /** 'corner' | 'edge' */
  kind: 'corner' | 'edge';
  /** 2-letter pairs, e.g. ['DE','GA',...]. */
  pairs: string[];
}

interface MathProblem {
  a: number;
  b: number;
  op: '+' | '-' | '×';
  answer: number;
}

// ── helpers ──

// Group a LetterCell[] (one cell per letter) into space-free 2-letter UPPER pairs.
function cellsToPairs(cells: LetterCell[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i + 1 < cells.length; i += 2) {
    pairs.push((cells[i].letter + cells[i + 1].letter).toUpperCase());
  }
  return pairs;
}

// Three simple arithmetic problems (single-digit operands, non-negative result).
function makeMathProblems(rng: () => number): MathProblem[] {
  const out: MathProblem[] = [];
  for (let i = 0; i < 3; i++) {
    const op = (['+', '-', '×'] as const)[Math.floor(rng() * 3)];
    let a = Math.floor(rng() * 9) + 1;
    let b = Math.floor(rng() * 9) + 1;
    if (op === '-' && b > a) [a, b] = [b, a];
    const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
    out.push({ a, b, op, answer });
  }
  return out;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function MemoRecallPage(): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('盲拧记忆回想训练', '3BLD Memo Recall Trainer');

  const hydrated = useBldConfigHydrated();
  const config = useBldConfigStore((s) => s.config);

  // ── options ──
  const [pieceSet, setPieceSet] = useState<PieceSet>('corner');
  const [showAssoc, setShowAssoc] = useState(false);
  const [useDistractor, setUseDistractor] = useState(false);

  // ── round state ──
  const [phase, setPhase] = useState<Phase>('idle');
  const [scramble, setScramble] = useState('');
  const [groups, setGroups] = useState<MemoGroup[]>([]);

  // assoc dictionary (lazy, code-split). null = not loaded yet.
  const [assoc, setAssoc] = useState<Record<string, string> | null>(null);
  const [assocLoading, setAssocLoading] = useState(false);

  // distractor
  const [mathProblems, setMathProblems] = useState<MathProblem[]>([]);
  const [mathInputs, setMathInputs] = useState<string[]>(['', '', '']);

  // recall
  const [recallText, setRecallText] = useState('');
  const recallRef = useRef<HTMLTextAreaElement | null>(null);

  // timing
  const memoStartRef = useRef(0);
  const recallStartRef = useRef(0);
  const [memoMs, setMemoMs] = useState(0);
  const [recallMs, setRecallMs] = useState(0);
  const [liveMs, setLiveMs] = useState(0);

  // ── lazy-load the 联想词 dictionary on first toggle-on (code-split) ──
  const loadAssoc = useCallback(() => {
    if (assoc || assocLoading) return;
    setAssocLoading(true);
    import('../_data/assoc-words.json')
      .then((mod) => {
        const data = (mod.default ?? mod) as Record<string, string>;
        setAssoc(data);
      })
      .catch(() => {
        /* dictionary unavailable — recall still works, words just blank */
        setAssoc({});
      })
      .finally(() => setAssocLoading(false));
  }, [assoc, assocLoading]);

  useEffect(() => {
    if (showAssoc) loadAssoc();
  }, [showAssoc, loadAssoc]);

  // ── live timer (rAF) during memorize / recall ──
  useEffect(() => {
    if (phase !== 'memorize' && phase !== 'recall') return;
    let raf = 0;
    const tick = () => {
      const base = phase === 'memorize' ? memoStartRef.current : recallStartRef.current;
      setLiveMs(Date.now() - base);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // ── GENERATE ──
  const startRound = useCallback(() => {
    const scr = scramble333(Math.random);
    const read = codereader(scr, config);

    const next: MemoGroup[] = [];
    if (pieceSet === 'corner' || pieceSet === 'both') {
      next.push({ kind: 'corner', pairs: cellsToPairs(read.corners) });
    }
    if (pieceSet === 'edge' || pieceSet === 'both') {
      next.push({ kind: 'edge', pairs: cellsToPairs(read.edges) });
    }

    // Guard against an empty read (already-solved piece set): regenerate a few
    // times so the user never lands on a 0-pair memo.
    const total = next.reduce((n, g) => n + g.pairs.length, 0);
    if (total === 0) {
      // retry once with a fresh scramble (extremely rare for random-move 3x3)
      const scr2 = scramble333(Math.random);
      const read2 = codereader(scr2, config);
      const retry: MemoGroup[] = [];
      if (pieceSet === 'corner' || pieceSet === 'both') retry.push({ kind: 'corner', pairs: cellsToPairs(read2.corners) });
      if (pieceSet === 'edge' || pieceSet === 'both') retry.push({ kind: 'edge', pairs: cellsToPairs(read2.edges) });
      setScramble(scr2);
      setGroups(retry);
    } else {
      setScramble(scr);
      setGroups(next);
    }

    setRecallText('');
    setMathInputs(['', '', '']);
    setMemoMs(0);
    setRecallMs(0);
    setLiveMs(0);
    memoStartRef.current = Date.now();
    setPhase('memorize');
  }, [config, pieceSet]);

  // ── MEMORIZE -> (DELAY) -> RECALL ──
  const finishMemorize = useCallback(() => {
    setMemoMs(Date.now() - memoStartRef.current);
    if (useDistractor) {
      setMathProblems(makeMathProblems(Math.random));
      setMathInputs(['', '', '']);
      setPhase('delay');
    } else {
      recallStartRef.current = Date.now();
      setPhase('recall');
    }
  }, [useDistractor]);

  const finishDelay = useCallback(() => {
    recallStartRef.current = Date.now();
    setPhase('recall');
  }, []);

  // ── RECALL -> SCORE ──
  const finishRecall = useCallback(() => {
    setRecallMs(Date.now() - recallStartRef.current);
    setPhase('score');
  }, []);

  // ── scoring ──
  // Parse the recall textarea into per-group pair lists. Each non-empty token of
  // 2 alpha chars is a pair; we split corner/edge groups by line when there are
  // two groups (one line per group), else flatten everything.
  const parsedRecall = useMemo(() => {
    const tokens = recallText
      .toUpperCase()
      .replace(/[^A-Z\n]/g, ' ')
      .split('\n')
      .map((line) =>
        line
          .trim()
          .split(/\s+/)
          .join('')
          .match(/.{1,2}/g) ?? [],
      );
    return tokens; // string[][] per line
  }, [recallText]);

  // Map parsed lines onto groups: if there are N groups, line i -> group i.
  // If the user put everything on one line, fall back to sequential consumption.
  const scored = useMemo(() => {
    if (phase !== 'score') return null;

    // Build the flat expected sequence + per-group boundaries.
    const expectedGroups = groups.map((g) => g.pairs);

    // Decide assignment of recall lines to groups.
    let recallGroups: string[][];
    const nonEmptyLines = parsedRecall.filter((l) => l.length > 0);
    if (groups.length > 1 && nonEmptyLines.length >= groups.length) {
      // one line per group
      recallGroups = [];
      let li = 0;
      for (let gi = 0; gi < groups.length; gi++) {
        // skip blank lines while seeking the gi-th non-empty line
        while (li < parsedRecall.length && parsedRecall[li].length === 0) li++;
        recallGroups.push(parsedRecall[li] ?? []);
        li++;
      }
    } else {
      // flatten: sequentially carve the single stream into the group sizes
      const flat = parsedRecall.flat();
      recallGroups = [];
      let idx = 0;
      for (const exp of expectedGroups) {
        recallGroups.push(flat.slice(idx, idx + exp.length));
        idx += exp.length;
      }
      // any leftover typed pairs get appended to the last group as extras
      if (idx < flat.length && recallGroups.length > 0) {
        recallGroups[recallGroups.length - 1] = recallGroups[recallGroups.length - 1].concat(flat.slice(idx));
      }
    }

    let correct = 0;
    let totalExpected = 0;
    const detail = groups.map((g, gi) => {
      const exp = g.pairs;
      const got = recallGroups[gi] ?? [];
      totalExpected += exp.length;
      const cells = exp.map((e, i) => {
        const typed = got[i] ?? '';
        const ok = typed === e;
        if (ok) correct += 1;
        return { expected: e, typed, ok };
      });
      // surface extra typed pairs beyond the expected length as wrong cells
      for (let i = exp.length; i < got.length; i++) {
        cells.push({ expected: '', typed: got[i], ok: false });
      }
      return { kind: g.kind, cells };
    });

    const accuracy = totalExpected > 0 ? (correct / totalExpected) * 100 : 0;
    return { detail, correct, totalExpected, accuracy };
  }, [phase, groups, parsedRecall]);

  const allMathCorrect = useMemo(
    () => mathProblems.every((p, i) => mathInputs[i].trim() !== '' && Number(mathInputs[i]) === p.answer),
    [mathProblems, mathInputs],
  );

  // focus recall textarea when entering recall
  useEffect(() => {
    if (phase === 'recall') {
      const id = window.setTimeout(() => recallRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [phase]);

  // ── derived labels ──
  const groupLabel = (kind: 'corner' | 'edge'): string =>
    kind === 'corner' ? (isZh ? '角块' : 'Corners') : (isZh ? '棱块' : 'Edges');

  const opSymbol = (op: MathProblem['op']) => op; // already display-ready

  if (!hydrated) return <div className="bld-trainer-root" />;

  const stepOrder: { id: Phase; zh: string; en: string }[] = useDistractor
    ? [
        { id: 'memorize', zh: '记忆', en: 'Memorize' },
        { id: 'delay', zh: '延迟', en: 'Delay' },
        { id: 'recall', zh: '回想', en: 'Recall' },
        { id: 'score', zh: '评分', en: 'Score' },
      ]
    : [
        { id: 'memorize', zh: '记忆', en: 'Memorize' },
        { id: 'recall', zh: '回想', en: 'Recall' },
        { id: 'score', zh: '评分', en: 'Score' },
      ];
  const stepIndex = stepOrder.findIndex((s) => s.id === phase);

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>{isZh ? '盲拧记忆回想训练' : '3BLD Memo Recall'}</h1>
      </div>

      {/* config */}
      <div className="bld-section">
        <BldConfigBar
          show={{
            corner: pieceSet !== 'edge',
            edge: pieceSet !== 'corner',
            hueSkip: false,
          }}
        />
      </div>

      {/* phase tracker (only once a round is going) */}
      {phase !== 'idle' && (
        <div className="bld-memo-phasebar">
          {stepOrder.map((s, i) => (
            <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span
                className={
                  'bld-memo-step' +
                  (i === stepIndex ? ' is-active' : i < stepIndex ? ' is-done' : '')
                }
              >
                {i < stepIndex && <Check size={13} />}
                {isZh ? s.zh : s.en}
              </span>
              {i < stepOrder.length - 1 && <span className="bld-memo-step-sep">›</span>}
            </span>
          ))}
        </div>
      )}

      {/* ── IDLE: options + generate ── */}
      {phase === 'idle' && (
        <>
          <div className="bld-section">
            <div className="bld-memo-options">
              <div className="bld-field" style={{ maxWidth: 220 }}>
                <label className="bld-field-label" htmlFor="bld-memo-pieceset">
                  {isZh ? '练习对象' : 'Practice set'}
                </label>
                <select
                  id="bld-memo-pieceset"
                  className="bld-select"
                  value={pieceSet}
                  onChange={(e) => setPieceSet(e.target.value as PieceSet)}
                >
                  <option value="corner">{isZh ? '仅角块' : 'Corners only'}</option>
                  <option value="edge">{isZh ? '仅棱块' : 'Edges only'}</option>
                  <option value="both">{isZh ? '角块 + 棱块' : 'Corners + edges'}</option>
                </select>
              </div>

              <label className="bld-check">
                <input
                  type="checkbox"
                  checked={showAssoc}
                  onChange={(e) => setShowAssoc(e.target.checked)}
                />
                <Lightbulb size={15} />
                {isZh ? '显示联想词' : 'Association words'}
              </label>

              <label className="bld-check">
                <input
                  type="checkbox"
                  checked={useDistractor}
                  onChange={(e) => setUseDistractor(e.target.checked)}
                />
                <Calculator size={15} />
                {isZh ? '记忆后做算术（延迟干扰）' : 'Math distractor (delay)'}
              </label>
            </div>

            {showAssoc && !isZh && (
              <p className="bld-memo-assoc-note">
                Association words are Chinese-only; they appear when the language is set to 中文.
              </p>
            )}
          </div>

          <div className="bld-section">
            <button type="button" className="bld-btn bld-btn-primary" onClick={startRound}>
              <Play size={15} />
              {isZh ? '开始一轮' : 'Start round'}
            </button>
          </div>

          <div className="bld-section">
            <p className="bld-input-summary">
              {isZh
                ? '随机生成一条打乱，按当前编码方案读出字母对，记住后隐藏并回想填写。'
                : 'Generates a random scramble, reads the letter pairs in the current scheme, hides them, and asks you to recall.'}
            </p>
          </div>
        </>
      )}

      {/* ── MEMORIZE ── */}
      {phase === 'memorize' && (
        <div className="bld-memo-stage">
          <div className="bld-memo-stage-head">
            <h2 className="bld-memo-stage-title">
              <Eye size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />
              {isZh ? '记忆' : 'Memorize'}
            </h2>
            <span className="bld-memo-timerpill">
              <Clock size={14} />
              {formatSeconds(liveMs)}
            </span>
            <span className="bld-spacer" />
            {assocLoading && (
              <span className="bld-spinner">
                <span className="bld-inline-spin" style={{ display: 'inline-flex' }}>
                  <Lightbulb size={14} />
                </span>
              </span>
            )}
          </div>

          {groups.map((g) => (
            <div className="bld-memo-group" key={g.kind}>
              <span className="bld-memo-group-label">{groupLabel(g.kind)}</span>
              {g.pairs.length === 0 ? (
                <span className="bld-readout-empty">{isZh ? '无（已还原）' : 'none (solved)'}</span>
              ) : (
                <div className="bld-memo-pairs">
                  {g.pairs.map((p, i) => {
                    const word = showAssoc && isZh ? assoc?.[p] : undefined;
                    return (
                      <div className="bld-memo-pair" key={i}>
                        <span className="bld-memo-pair-letters">{p}</span>
                        {showAssoc && isZh && (
                          <span className={'bld-memo-pair-word' + (word ? '' : ' is-missing')}>
                            {word ?? '—'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <div className="bld-memo-actions">
            <button type="button" className="bld-btn bld-btn-primary" onClick={finishMemorize}>
              <EyeOff size={15} />
              {isZh ? '记好了，隐藏并回想' : 'Hide & recall'}
            </button>
            <button type="button" className="bld-btn bld-btn-ghost" onClick={() => setPhase('idle')}>
              {isZh ? '取消' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* ── DELAY (math distractor) ── */}
      {phase === 'delay' && (
        <div className="bld-memo-stage">
          <div className="bld-memo-stage-head">
            <h2 className="bld-memo-stage-title">
              <Calculator size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />
              {isZh ? '延迟干扰' : 'Delay'}
            </h2>
          </div>
          <p className="bld-memo-recall-hint">
            {isZh
              ? '先解出下面 3 道算术题，再回想字母对（模拟盲拧记忆延迟）。'
              : 'Answer these 3 problems before recalling (simulating BLD memo delay).'}
          </p>

          <div className="bld-memo-math-list">
            {mathProblems.map((p, i) => {
              const val = mathInputs[i];
              const answered = val.trim() !== '';
              const ok = answered && Number(val) === p.answer;
              return (
                <div className="bld-memo-math-row" key={i}>
                  <span className="bld-memo-math-q">
                    {p.a} {opSymbol(p.op)} {p.b} =
                  </span>
                  <input
                    className="bld-input bld-memo-math-input"
                    inputMode="numeric"
                    value={val}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d-]/g, '');
                      setMathInputs((prev) => prev.map((x, j) => (j === i ? v : x)));
                    }}
                    aria-label={`${p.a} ${p.op} ${p.b}`}
                  />
                  {answered && (
                    <span className={'bld-memo-math-mark ' + (ok ? 'is-ok' : 'is-bad')}>
                      {ok ? <Check size={18} /> : <X size={18} />}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bld-memo-actions">
            <button
              type="button"
              className="bld-btn bld-btn-primary"
              onClick={finishDelay}
              disabled={!allMathCorrect}
            >
              <ArrowRight size={15} />
              {isZh ? '继续回想' : 'Continue to recall'}
            </button>
            {!allMathCorrect && (
              <span className="bld-memo-recall-hint">
                {isZh ? '答对全部 3 题后解锁。' : 'Solve all 3 to unlock.'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── RECALL ── */}
      {phase === 'recall' && (
        <div className="bld-memo-stage">
          <div className="bld-memo-stage-head">
            <h2 className="bld-memo-stage-title">
              <EyeOff size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />
              {isZh ? '回想' : 'Recall'}
            </h2>
            <span className="bld-memo-timerpill">
              <Clock size={14} />
              {formatSeconds(liveMs)}
            </span>
          </div>

          <p className="bld-memo-recall-hint">
            {groups.length > 1
              ? isZh
                ? '每个部位一行（角块一行、棱块一行），字母对可空格分隔。'
                : 'One line per piece type (corners, then edges); pairs may be space-separated.'
              : isZh
                ? '依次输入字母对，可用空格分隔。'
                : 'Type the pairs in order; spaces optional.'}
          </p>

          <textarea
            ref={recallRef}
            className="bld-modal-textarea bld-memo-recall-input"
            value={recallText}
            onChange={(e) => setRecallText(e.target.value)}
            placeholder={
              groups.length > 1
                ? (isZh ? '角块: DE GA …\n棱块: ge ki …' : 'Corners: DE GA …\nEdges: ge ki …')
                : (isZh ? 'DE GA WX …' : 'DE GA WX …')
            }
            spellCheck={false}
            autoCapitalize="characters"
            autoCorrect="off"
          />

          <div className="bld-memo-actions">
            <button type="button" className="bld-btn bld-btn-primary" onClick={finishRecall}>
              <Check size={15} />
              {isZh ? '提交评分' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {/* ── SCORE ── */}
      {phase === 'score' && scored && (
        <div className="bld-memo-stage">
          <div className="bld-memo-stage-head">
            <h2 className="bld-memo-stage-title">{isZh ? '评分' : 'Score'}</h2>
          </div>

          <div className="bld-memo-score-summary">
            <span
              className={
                'bld-memo-score-acc' + (scored.accuracy === 100 ? ' is-perfect' : '')
              }
            >
              {scored.accuracy.toFixed(0)}%
            </span>
            <span className="bld-memo-score-metric">
              {isZh ? '正确' : 'Correct'} <b>{scored.correct}</b> / {scored.totalExpected}
            </span>
            <span className="bld-memo-score-metric">
              {isZh ? '记忆' : 'Memo'} <b>{formatSeconds(memoMs)}</b>
            </span>
            <span className="bld-memo-score-metric">
              {isZh ? '回想' : 'Recall'} <b>{formatSeconds(recallMs)}</b>
            </span>
            <span className="bld-memo-score-metric">
              {isZh ? '合计' : 'Total'} <b>{formatSeconds(memoMs + recallMs)}</b>
            </span>
          </div>

          {scored.detail.map((d) => (
            <div className="bld-memo-group" key={d.kind}>
              <span className="bld-memo-group-label">{groupLabel(d.kind)}</span>
              <div className="bld-memo-diff">
                {d.cells.map((c, i) => (
                  <div
                    className={'bld-memo-diff-cell ' + (c.ok ? 'is-correct' : 'is-wrong')}
                    key={i}
                  >
                    <span className="bld-memo-diff-got">{c.typed || '··'}</span>
                    {!c.ok && (
                      <span className="bld-memo-diff-exp">
                        {c.expected ? (
                          <>
                            {isZh ? '应为 ' : 'want '}
                            {c.expected}
                          </>
                        ) : (
                          <s>{isZh ? '多余' : 'extra'}</s>
                        )}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="bld-section" style={{ margin: 0 }}>
            <span className="bld-memo-group-label" style={{ marginBottom: 6 }}>
              {isZh ? '打乱' : 'Scramble'}
            </span>
            <div className="bld-scramble-text">{scramble}</div>
          </div>

          <div className="bld-cube-wrap" style={{ marginTop: 4 }}>
            <CubingPreviewSafe scramble={scramble} />
          </div>

          <div className="bld-memo-actions">
            <button type="button" className="bld-btn bld-btn-primary" onClick={startRound}>
              <ArrowRight size={15} />
              {isZh ? '下一轮' : 'Next round'}
            </button>
            <button type="button" className="bld-btn" onClick={() => setPhase('idle')}>
              <RotateCcw size={15} />
              {isZh ? '回到设置' : 'Back to setup'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Light static 2D preview wrapper (CubingPreview lazy-loads cubing.js itself).
function CubingPreviewSafe({ scramble }: { scramble: string }): JSX.Element | null {
  if (!scramble) return null;
  return <CubingPreview event="333" scramble={scramble} visualization="2D" size={12} />;
}
