/**
 * /alg/:puzzle — list every alg set for one puzzle (2x2 / 3x3 / 4x4 / 5x5).
 *
 * Loads each set's case count lazily so the page renders before all imports finish.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { ALG_CATALOG, ALG_PUZZLES, loadAlg, type AlgCase, type AlgPuzzle } from '@cuberoot/shared';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { EventIcon } from '../../components/EventIcon';
import { eventDisplayName } from '../../utils/wca_events';
import { CaseThumb } from './CaseThumb';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import './alg.css';

/** Old single-segment 3x3 set slugs we used to live at /alg/<slug>. Redirect to /alg/3x3/<slug>. */
const LEGACY_3X3_SLUGS = new Set(['f2l', 'adv-f2l', 'oll', 'pll']);

function isPuzzle(s: string): s is AlgPuzzle {
  return (ALG_PUZZLES as readonly string[]).includes(s);
}

export default function AlgPuzzlePage() {
  const { puzzle = '' } = useParams<{ puzzle: string }>();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const algFallback = isZh ? '公式库' : 'Algorithms';
  const valid_ = isPuzzle(puzzle);
  const algPuzzleTitle = valid_ ? eventDisplayName(puzzle, isZh) || puzzle : (puzzle || algFallback);
  useDocumentTitle(algPuzzleTitle, algPuzzleTitle);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [firstCases, setFirstCases] = useState<Record<string, AlgCase | null>>({});

  const valid = isPuzzle(puzzle);
  const sets = useMemo(() => (valid ? ALG_CATALOG[puzzle] : []), [puzzle, valid]);
  const legacyRedirect = !valid && LEGACY_3X3_SLUGS.has(puzzle) ? `/alg/3x3/${puzzle}` : null;

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    Promise.all(sets.map(s =>
      loadAlg(puzzle, s.slug)
        .then(d => ({ slug: s.slug, count: d.cases.length, first: d.cases[0] ?? null }))
        .catch(() => ({ slug: s.slug, count: -1, first: null }))
    )).then(rows => {
      if (cancelled) return;
      const nextCounts: Record<string, number> = {};
      const nextFirst: Record<string, AlgCase | null> = {};
      for (const { slug, count, first } of rows) {
        nextCounts[slug] = count;
        nextFirst[slug] = first;
      }
      setCounts(nextCounts);
      setFirstCases(nextFirst);
    });
    return () => { cancelled = true; };
  }, [puzzle, valid, sets]);

  if (legacyRedirect) {
    return <Navigate to={legacyRedirect} replace />;
  }

  if (!valid) {
    return (
      <div className="alg-root">
        <div className="alg-empty">{isZh ? '未知魔方阶' : 'Unknown puzzle'}: {puzzle}</div>
      </div>
    );
  }

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link to="/alg" className="alg-back">
          <ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}
        </Link>
        <h1 className="alg-cat-title">
          <EventIcon event={puzzle} className="alg-cat-title-icon" />
          <span>{eventDisplayName(puzzle, isZh)} {isZh ? '公式' : 'Algorithms'}</span>
        </h1>
        <span className="alg-cat-count">{sets.length} {isZh ? '套' : 'sets'}</span>
        <ThemeToggle className="alg-lang-toggle" />
        <LangToggle variant="inline" />
      </div>

      <div className="alg-bento">
        {sets.map(s => {
          const n = counts[s.slug];
          const first = firstCases[s.slug];
          const firstAlg = first?.algs.flat()[0]?.alg ?? first?.standard ?? '';
          return (
            <Link key={s.slug} to={`/alg/${puzzle}/${s.slug}`} className="alg-bento-card">
              <div className="alg-bento-thumb">
                {first && (
                  <CaseThumb
                    puzzle={puzzle}
                    set={s.slug}
                    sticker={first.sticker}
                    alg={firstAlg}
                    setup={first.setup}
                    size={96}
                  />
                )}
              </div>
              <div className="alg-bento-title">{isZh ? s.zh : s.en}</div>
              <div className="alg-bento-count">
                {n == null ? '…' : n < 0 ? '!' : `${n} ${isZh ? '个' : 'cases'}`}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
