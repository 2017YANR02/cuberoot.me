'use client';

/**
 * /scramble/pattern — gallery of famous pretty patterns for every WCA event.
 *
 * 1:1 port of packages/client-vite/src/pages/patterns/PatternsPage.tsx to Next 16
 * client component. Reuses shared client components/hooks (WcaEventSelector,
 * VisualCube, PuzzleSVG, TwistySection, LangToggle, ThemeToggle, useDocumentTitle)
 * and the clock SVG helper from sibling /scramble/gen.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, X, Copy, Check } from 'lucide-react';
import { Alg } from 'cubing/alg';
import WcaEventSelector from '@/components/WcaEventSelector';
import { VisualCube } from '@/components/VisualCube';
import { PuzzleSVG, type PuzzleKind } from '@/components/PuzzleSVG';
import TwistySection from '@/components/TwistySection';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { renderClockScrambleSvg, DEFAULT_CLOCK_COLORS } from '../gen/_svg/clock_svg';
import {
  PATTERNS, CATEGORY_LABEL, PUZZLE_SIZES, PUZZLE_LABEL,
  PUZZLE_TO_EVENT, EVENT_TO_PUZZLE,
  patternPuzzle, twistyPuzzleId,
  type Category, type Pattern, type PuzzleSize,
} from './_data/patterns_data';
import './patterns.css';
import { useT } from "@/hooks/useT";

const ALL: 'all' = 'all';
type Filter = typeof ALL | Category;

function inverseOf(algStr: string): string {
  try { return new Alg(algStr).invert().toString(); } catch { return algStr; }
}

/** Puzzle → PuzzleSVG kind. Returns null for NxN (use VisualCube) or clock (no preview). */
function puzzleSvgKind(size: PuzzleSize): PuzzleKind | null {
  if (size === 'pyraminx') return 'pyraminx';
  if (size === 'megaminx') return 'megaminx';
  if (size === 'skewb') return 'skewb';
  if (size === 'sq1') return 'sq1';
  return null;
}

/** NxN dimension if applicable, else null. */
function nxnSize(size: PuzzleSize): number | null {
  if (size === '2x2x2') return 2;
  if (size === '3x3x3') return 3;
  if (size === '4x4x4') return 4;
  if (size === '5x5x5') return 5;
  if (size === '6x6x6') return 6;
  if (size === '7x7x7') return 7;
  return null;
}

function PatternThumb({ pattern, size = 120 }: { pattern: Pattern; size?: number }) {
  const puzzle = patternPuzzle(pattern);
  const n = nxnSize(puzzle);
  if (n !== null) {
    return (
      <VisualCube
        algorithm={inverseOf(pattern.alg)}
        view="iso"
        size={size}
        puzzleSize={n}
        alt={pattern.name.en}
      />
    );
  }
  const kind = puzzleSvgKind(puzzle);
  if (kind) {
    return <PuzzleSVG kind={kind} case={pattern.alg} size={size} />;
  }
  if (puzzle === 'clock') {
    // Clock notation is a scramble (forward), no inversion needed.
    let svg = '';
    try { svg = renderClockScrambleSvg(pattern.alg, DEFAULT_CLOCK_COLORS); } catch { svg = ''; }
    return svg
      ? <div className="pat-card-clock" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
      : <div className="pat-card-noprev" aria-label={pattern.name.en}><Sparkles size={36} /><div className="pat-card-noprev-label">Clock</div></div>;
  }
  return (
    <div className="pat-card-noprev" aria-label={pattern.name.en}>
      <Sparkles size={36} />
      <div className="pat-card-noprev-label">{PUZZLE_LABEL[puzzle]}</div>
    </div>
  );
}

export default function PatternsPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const pick = (o: { en: string; zh: string; }) => (lang === 'zh' ? o.zh : o.en);
  useDocumentTitle('图案', 'Patterns');
  const t = useT();

  const [puzzle, setPuzzle] = useState<PuzzleSize>('3x3x3');
  const [filter, setFilter] = useState<Filter>(ALL);
  const [openId, setOpenId] = useState<string | null>(null);

  const puzzlePatterns = useMemo(
    () => PATTERNS.filter((p) => patternPuzzle(p) === puzzle),
    [puzzle],
  );

  const visiblePatterns = useMemo(
    () => filter === ALL ? puzzlePatterns : puzzlePatterns.filter((p) => p.category === filter),
    [filter, puzzlePatterns],
  );

  const categories: Category[] = useMemo(() => {
    const seen = new Set<Category>();
    for (const p of puzzlePatterns) seen.add(p.category);
    const order: Category[] = ['symmetry', 'cube-in-cube', 'dots', 'stripes', 'crosses', 'twists', 'other'];
    return order.filter((c) => seen.has(c));
  }, [puzzlePatterns]);

  // Reset category filter when switching to a puzzle size that lacks the current category.
  useEffect(() => {
    if (filter !== ALL && !categories.includes(filter)) setFilter(ALL);
  }, [filter, categories]);

  // Available event IDs = whatever puzzles actually have patterns.
  const availableEvents = useMemo(() => {
    const set = new Set<string>();
    for (const sz of PUZZLE_SIZES) {
      if (PATTERNS.some((p) => patternPuzzle(p) === sz)) {
        set.add(PUZZLE_TO_EVENT[sz]);
      }
    }
    return set;
  }, []);

  const openPattern: Pattern | null = openId
    ? PATTERNS.find((p) => p.id === openId) ?? null
    : null;

  return (
    <div className="pat-page">
      <header className="pat-header">
        <div className="pat-title">
          <Sparkles size={20} className="pat-title-icon" />
          <h1>{t('图案集', 'Cube Patterns')}</h1>
        </div>
      </header>

      <main className="pat-main">
        <div className="pat-puzzle-row">
          <WcaEventSelector
            availableEvents={availableEvents}
            onlyAvailable
            isZh={lang === 'zh'}
            selectedEvent={PUZZLE_TO_EVENT[puzzle]}
            onSelect={(id) => {
              const next = EVENT_TO_PUZZLE[id];
              if (next) setPuzzle(next);
            }}
          />
        </div>

        <nav className="pat-filters" role="tablist">
          <button
            type="button"
            role="tab"
            className={`pat-filter${filter === ALL ? ' is-active' : ''}`}
            onClick={() => setFilter(ALL)}
          >
            {t('全部', 'All')}
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              className={`pat-filter${filter === c ? ' is-active' : ''}`}
              onClick={() => setFilter(c)}
            >
              {pick(CATEGORY_LABEL[c])}
            </button>
          ))}
        </nav>

        {visiblePatterns.length === 0 ? (
          <div className="pat-empty">{t('暂无图案', 'No patterns yet')}</div>
        ) : (
          <ul className="pat-grid">
            {visiblePatterns.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="pat-card"
                  onClick={() => setOpenId(p.id)}
                >
                  <div className="pat-card-preview">
                    <PatternThumb pattern={p} />
                  </div>
                  <div className="pat-card-name">{pick(p.name)}</div>
                  <div className="pat-card-meta">{pick(CATEGORY_LABEL[p.category])}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {openPattern && (
        <PatternModal
          pattern={openPattern}
          pick={pick}
          t={t}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function PatternModal({
  pattern, pick, t, onClose,
}: {
  pattern: Pattern;
  pick: (o: { en: string; zh: string; }) => string;
  t: (zh: string, en: string) => string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pattern.alg);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* swallow */ }
  };

  const moveCount = pattern.alg.split(/\s+/).filter(Boolean).length;
  const puzzleId = twistyPuzzleId(patternPuzzle(pattern));
  const displayName = pick(pattern.name);

  return (
    <div className="pat-modal-overlay" onClick={onClose} role="dialog">
      <div className="pat-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pat-modal-close" onClick={onClose} aria-label="close">
          <X size={18} />
        </button>
        <h2 className="pat-modal-title">{displayName}</h2>
        <div className="pat-modal-meta">
          <span className="pat-modal-cat">{pick(CATEGORY_LABEL[pattern.category])}</span>
          <span className="pat-modal-count">{moveCount} {t('步', 'moves')}</span>
        </div>
        <div className="pat-modal-twisty">
          {/* setupAlg empty → starts solved; alg plays the pattern animation. */}
          <TwistySection puzzle={puzzleId} scramble="" alg={pattern.alg} />
        </div>
        <div className="pat-modal-alg-row">
          <code className="pat-modal-alg">{pattern.alg}</code>
          <button type="button" className="pat-modal-copy" onClick={copy} aria-label="copy">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? t('已复制', 'Copied') : t('复制', 'Copy')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
