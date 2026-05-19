/**
 * /scramble/pattern — gallery of famous pretty patterns for 3×3 / 4×4 / 5×5 / 6×6 / 7×7.
 * Top tabs switch puzzle size; second row filters by category. Click a card to
 * open a modal with TwistyPlayer playback (solved → pattern animation).
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, X, Copy, Check } from 'lucide-react';
import { Alg } from 'cubing/alg';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { VisualCube } from '../../components/VisualCube';
import TwistySection from '../../components/TwistySection';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import {
  PATTERNS, CATEGORY_LABEL, PUZZLE_SIZES, PUZZLE_LABEL, patternPuzzle,
  type Category, type Pattern, type PuzzleSize,
} from './patterns_data';
import './patterns.css';

const ALL: 'all' = 'all';
type Filter = typeof ALL | Category;

function inverseOf(algStr: string): string {
  try { return new Alg(algStr).invert().toString(); } catch { return algStr; }
}

export default function PatternsPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language.startsWith('zh') ? 'zh' : 'en';
  useDocumentTitle('图案', 'Patterns');
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

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
        <select
          className="pat-puzzle-select"
          aria-label={t('阶数', 'Puzzle size')}
          value={puzzle}
          onChange={(e) => setPuzzle(e.target.value as PuzzleSize)}
        >
          {PUZZLE_SIZES.filter((sz) => PATTERNS.some((p) => patternPuzzle(p) === sz)).map((sz) => (
            <option key={sz} value={sz}>{PUZZLE_LABEL[sz]}</option>
          ))}
        </select>
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>

      <main className="pat-main">
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
              {CATEGORY_LABEL[c][lang]}
            </button>
          ))}
        </nav>

        <ul className="pat-grid">
          {visiblePatterns.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="pat-card"
                onClick={() => setOpenId(p.id)}
              >
                <div className="pat-card-preview">
                  <VisualCube
                    algorithm={inverseOf(p.alg)}
                    view="iso"
                    size={120}
                    puzzleSize={Number(patternPuzzle(p)[0])}
                    alt={p.name_en}
                  />
                </div>
                <div className="pat-card-name">{lang === 'zh' ? p.name_zh : p.name_en}</div>
                <div className="pat-card-meta">{CATEGORY_LABEL[p.category][lang]}</div>
              </button>
            </li>
          ))}
        </ul>
      </main>

      {openPattern && (
        <PatternModal
          pattern={openPattern}
          lang={lang}
          t={t}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function PatternModal({
  pattern, lang, t, onClose,
}: {
  pattern: Pattern;
  lang: 'zh' | 'en';
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

  return (
    <div className="pat-modal-overlay" onClick={onClose} role="dialog">
      <div className="pat-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pat-modal-close" onClick={onClose} aria-label="close">
          <X size={18} />
        </button>
        <h2 className="pat-modal-title">{lang === 'zh' ? pattern.name_zh : pattern.name_en}</h2>
        <div className="pat-modal-meta">
          <span className="pat-modal-cat">{CATEGORY_LABEL[pattern.category][lang]}</span>
          <span className="pat-modal-count">{moveCount} {t('步', 'moves')}</span>
        </div>
        <div className="pat-modal-twisty">
          {/* setupAlg empty → starts solved; alg plays the pattern animation. */}
          <TwistySection puzzle={patternPuzzle(pattern)} scramble="" alg={pattern.alg} />
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
