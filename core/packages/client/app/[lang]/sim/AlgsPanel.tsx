/**
 * AlgsPanel — 公式库浏览面板。
 * puzzle 跟随主设置「类型/阶数」(2x2~5x5) → 选 set (OLL/PLL/F2L/...) → case → setup + auto-play。
 * 数据走 shared loadAlg → /api/alg/sets/:p/:s。
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { ALG_CATALOG, loadAlg, type AlgPuzzle, type AlgFile, type AlgCase } from '@cuberoot/shared';
import './algs-panel.css';
import { useT } from "@/hooks/useT";
import { tr } from '@/i18n/tr';

interface Props {
  onSelect: (setup: string, alg: string, caseName: string) => void;
  /** Active puzzle from the main 类型/阶数 (SimPuzzle: an NxN order number, or a puzzle id
   *  string like 'skewb'). Resolved to an AlgPuzzle; puzzles without sets show a placeholder. */
  activePuzzle: number | string;
}

const ORDER_TO_PUZZLE: Record<number, AlgPuzzle> = {
  2: '2x2',
  3: '3x3',
  4: '4x4',
  5: '5x5',
};

/** SimPuzzle (NxN order, or puzzle id) → AlgPuzzle in ALG_CATALOG, else undefined (no sets).
 *  Non-NxN ids ('skewb'/'pyraminx'/'megaminx'/'sq1') match their AlgPuzzle key 1:1. */
function resolveAlgPuzzle(p: number | string): AlgPuzzle | undefined {
  if (typeof p === 'number') return ORDER_TO_PUZZLE[p];
  return p in ALG_CATALOG ? (p as AlgPuzzle) : undefined;
}

export default function AlgsPanel({ onSelect, activePuzzle }: Props) {
  const t = useT();

  // The alg set follows the main 类型/阶数; puzzles without sets → placeholder.
  const puzzle = resolveAlgPuzzle(activePuzzle);
  const sets = puzzle ? (ALG_CATALOG[puzzle] ?? []) : [];
  const [setSlug, setSetSlug] = useState<string>(sets[0]?.slug ?? '');
  const [data, setData] = useState<AlgFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    if (sets[0] && !sets.find((s) => s.slug === setSlug)) {
      setSetSlug(sets[0].slug);
    }
  }, [puzzle, sets, setSlug]);

  useEffect(() => {
    if (!puzzle || !setSlug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setActiveIdx(null);
    loadAlg(puzzle, setSlug)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'load failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [puzzle, setSlug]);

  const cases = useMemo<AlgCase[]>(() => data?.cases ?? [], [data]);

  const choose = (idx: number) => {
    const c = cases[idx];
    if (!c) return;
    const algEntry = c.algs?.[0]?.[0];
    if (!algEntry?.alg) return;
    setActiveIdx(idx);
    onSelect(c.setup, algEntry.alg, c.name);
  };

  if (!puzzle) {
    return (
      <div className="sim-algs">
        <div className="sim-algs-msg">{t('该魔方暂无公式集', 'No algs for this puzzle yet')}</div>
      </div>
    );
  }

  return (
    <div className="sim-algs">
      <div className="sim-algs-sets">
        <select
          value={setSlug}
          onChange={(e) => setSetSlug(e.target.value)}
        >
          {sets.map((s) => (
            <option key={s.slug} value={s.slug}>
              {tr(s)}
            </option>
          ))}
        </select>
        <span className="sim-algs-hint">
          {t('点公式 = 摆出此情形;下方回放区按播放看动画', 'Click case = set up the position; hit play below to watch the alg')}
        </span>
      </div>
      <div className="sim-algs-list">
        {loading ? <div className="sim-algs-msg">{t('加载中…', 'Loading…')}</div> : null}
        {error ? <div className="sim-algs-msg error">{error}</div> : null}
        {!loading && !error && cases.length === 0 ? (
          <div className="sim-algs-msg">{t('暂无数据', 'No data')}</div>
        ) : null}
        {cases.map((c, i) => {
          const algText = c.algs?.[0]?.[0]?.alg ?? '';
          return (
            <button
              key={i}
              className={'sim-algs-item' + (i === activeIdx ? ' active' : '')}
              onClick={() => choose(i)}
              disabled={!algText}
            >
              <span className="sim-algs-name">{c.name}</span>
              <span className="sim-algs-alg">{algText}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
