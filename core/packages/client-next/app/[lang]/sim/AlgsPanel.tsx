/**
 * AlgsPanel — 公式库浏览面板。
 * 选 puzzle (2x2~5x5) → set (OLL/PLL/F2L/...) → case → setup + auto-play。
 * 数据走 shared loadAlg → /api/alg/sets/:p/:s。
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALG_CATALOG, loadAlg, type AlgPuzzle, type AlgFile, type AlgCase } from '@cuberoot/shared';
import './algs-panel.css';
import i18n from '@/i18n/i18n-client';

interface Props {
  onSelect: (setup: string, alg: string, caseName: string) => void;
  onOrderChange?: (order: number) => void;
  /** Active puzzle isn't NxN/sq1 — show a placeholder instead of the picker. */
  disabled?: boolean;
}

const PUZZLE_TO_ORDER: Partial<Record<AlgPuzzle, number>> = {
  '2x2': 2,
  '3x3': 3,
  '4x4': 4,
  '5x5': 5,
};

const PUZZLES_SUPPORTED: AlgPuzzle[] = ['2x2', '3x3', '4x4', '5x5'];

export default function AlgsPanel({ onSelect, onOrderChange, disabled = false }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [puzzle, setPuzzle] = useState<AlgPuzzle>('3x3');
  const sets = ALG_CATALOG[puzzle] ?? [];
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
    if (!setSlug) return;
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

  const handlePuzzle = (p: AlgPuzzle) => {
    setPuzzle(p);
    const targetOrder = PUZZLE_TO_ORDER[p];
    if (targetOrder && onOrderChange) onOrderChange(targetOrder);
  };

  if (disabled) {
    return (
      <div className="sim-algs">
        <div className="sim-algs-msg">{t('该魔方暂无公式集', 'No algs for this puzzle yet')}</div>
      </div>
    );
  }

  return (
    <div className="sim-algs">
      <div className="sim-algs-tabs">
        {PUZZLES_SUPPORTED.map((p) => (
          <button
            key={p}
            className={p === puzzle ? 'active' : ''}
            onClick={() => handlePuzzle(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="sim-algs-sets">
        <select
          value={setSlug}
          onChange={(e) => setSetSlug(e.target.value)}
        >
          {sets.map((s) => (
            <option key={s.slug} value={s.slug}>
              {(i18n.language.startsWith('zh') ? s.zh : s.en)}
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
