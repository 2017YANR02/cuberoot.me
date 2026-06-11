'use client';

/**
 * 非 3x3 puzzle 在线整解最优求解器(EPIC 3 范式组件)。
 * 输入打乱(或一键随机生成)→ Rust WASM 全空间精确表求最优解 + 步数。
 * 本体 puzzle 无关:pocket(2x2x2)先行,pyraminx / skewb / sq1 后续各自
 * 写一个 spec + 路由页复用(见 solver/VARIANT_PLAYBOOK.md §8)。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { Dices, LoaderCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { ClearButton } from '@/components/ClearButton';
import { pooledScramble, prewarmScramble } from '@/lib/cubing-scramble';
import { getRustCrossPool, poolSizeForDevice, type PoolNeed } from '@/lib/rust-cross-pool';
import type { RustCrossPool, MovesTimed } from '@/lib/rust-cross-client';
import './puzzle_optimal_solver.css';

export interface OptimalSolverSpec {
  /** WCA event id(打乱生成 + 2D 平面展开图都用它) */
  event: string;
  /** 页面标题(h1 + 浏览器 tab),只写简体+英文,zhHant 走 zh:inject */
  title: { zh: string; en: string; zhHant?: string };
  /** 说明文案(度量 / God's number 等) */
  lead: { zh: string; en: string; zhHant?: string };
  /** 度量名(HTM 等,结果行展示) */
  metric: string;
  /** worker 池 need 键(零表下载,距离表 wasm 内现场 BFS) */
  need: PoolNeed;
  /** 单条最优解(len + sols[0].m,m 可带整体旋转前缀如 "x y'") */
  solve: (pool: RustCrossPool, scramble: string) => Promise<MovesTimed>;
  /** 合法记号(token 级校验,如 /^[URFDLB][2']?$/) */
  tokenRe: RegExp;
}

interface SolveOutcome {
  scramble: string;
  len: number;
  solution: string;
  ms: number;
}

export function PuzzleOptimalSolver({ spec }: { spec: OptimalSolverSpec }) {
  const { i18n } = useTranslation();
  void i18n;
  useDocumentTitle(spec.title.zh, spec.title.en, spec.title.zhHant);

  const [scramble, setScramble] = useQueryState(
    'scramble',
    parseAsString.withDefault(''),
  );
  const [generating, setGenerating] = useState(false);
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState<SolveOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // 随机按钮首击免冷启:挂载后 idle 预热打乱池(222 级别建表很轻)。
  useEffect(() => {
    const id = window.setTimeout(() => prewarmScramble(spec.event), 800);
    return () => window.clearTimeout(id);
  }, [spec.event]);

  const trimmed = scramble.trim();
  const badToken = useMemo(() => {
    if (!trimmed) return null;
    return trimmed.split(/\s+/).find((t) => !spec.tokenRe.test(t)) ?? null;
  }, [trimmed, spec.tokenRe]);

  // 打乱变化 → 防抖求解(首查 wasm 现场 BFS 建表 ~1s,之后查表毫秒级)。
  useEffect(() => {
    const id = ++seq.current;
    setError(null);
    if (!trimmed || badToken) {
      setResult(null);
      setSolving(false);
      return;
    }
    setSolving(true);
    const timer = window.setTimeout(() => {
      const pool = getRustCrossPool(spec.need, Math.min(2, poolSizeForDevice()));
      spec.solve(pool, trimmed)
        .then((r) => {
          if (seq.current !== id) return;
          setResult({ scramble: trimmed, len: r.len, solution: r.sols[0]?.m ?? '', ms: r.ms });
          setSolving(false);
        })
        .catch((e) => {
          if (seq.current !== id) return;
          setError(String(e?.message ?? e));
          setSolving(false);
        });
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, badToken, spec.need]);

  const randomScramble = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const s = await pooledScramble(spec.event);
      if (s) void setScramble(s.trim());
    } finally {
      setGenerating(false);
    }
  };

  const showResult = result && result.scramble === trimmed && !badToken;

  return (
    <div className="pos-page">
      <h1>{tr(spec.title)}</h1>
      <p className="pos-lead">{tr(spec.lead)}</p>

      <div className="pos-input-row">
        <div className="pos-input-wrap">
          <input
            className="pos-input"
            type="text"
            value={scramble}
            onChange={(e) => void setScramble(e.target.value)}
            placeholder={tr({ zh: '输入打乱,如 R U R\' F2 U\'', en: "Enter a scramble, e.g. R U R' F2 U'",
                zhHant: "輸入打亂,如 R U R' F2 U'"
            })}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
          />
          {scramble !== '' && (
            <ClearButton variant="inline" onClick={() => { void setScramble(''); }} />
          )}
        </div>
        <button
          type="button"
          className="pos-random-btn"
          onClick={() => void randomScramble()}
          disabled={generating}
        >
          {generating
            ? <LoaderCircle size={16} className="pos-spin" aria-hidden />
            : <Dices size={16} aria-hidden />}
          {tr({ zh: '随机打乱', en: 'Random',
              zhHant: "隨機打亂"
        })}
        </button>
      </div>

      {badToken && (
        <p className="pos-error">
          {tr({ zh: '无法识别的记号', en: 'Unrecognized token',
              zhHant: "無法識別的記號"
        })}: <code>{badToken}</code>
        </p>
      )}

      {trimmed && !badToken && (
        <div className="pos-preview">
          <ScramblePreview2D event={spec.event} scramble={trimmed} size={84} />
        </div>
      )}

      {error && (
        <p className="pos-error">{tr({ zh: '求解失败', en: 'Solve failed',
            zhHant: "求解失敗"
        })}: {error}</p>
      )}

      {trimmed && !badToken && !error && (
        <div className="pos-result" aria-live="polite">
          {solving && !showResult && (
            <p className="pos-solving">
              <LoaderCircle size={14} className="pos-spin" aria-hidden />
              {tr({ zh: '求解中(首次需建表,约 1 秒)…', en: 'Solving (first run builds the table, ~1s)…',
                  zhHant: "求解中(首次需建表,約 1 秒)…"
            })}
            </p>
          )}
          {showResult && (
            <>
              <div className="pos-result-len">
                <span className="pos-result-num">{result.len}</span>
                <span className="pos-result-metric">
                  {tr({ zh: '步', en: result.len === 1 ? 'move' : 'moves' })} ({spec.metric})
                </span>
                <span className="pos-result-ms">{result.ms < 1 ? '<1' : Math.round(result.ms)} ms</span>
              </div>
              {result.len === 0
                ? <p className="pos-result-solved">{tr({ zh: '已是还原态', en: 'Already solved',
                    zhHant: "已是還原態"
                })}</p>
                : <p className="pos-result-sol">{result.solution}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
