/**
 * /algdb/:puzzle — list every alg set for one puzzle (2x2 / 3x3 / 4x4 / 5x5).
 *
 * Loads each set's case count lazily so the page renders before all imports finish.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { ALGDB_CATALOG, ALGDB_PUZZLES, loadAlgdb, type AlgdbPuzzle } from '@cuberoot/shared';
import './algdb.css';

/** Old single-segment 3x3 set slugs we used to live at /algdb/<slug>. Redirect to /algdb/3x3/<slug>. */
const LEGACY_3X3_SLUGS = new Set(['f2l', 'adv-f2l', 'oll', 'pll']);

const PUZZLE_TITLE: Record<AlgdbPuzzle, { en: string; zh: string }> = {
  '2x2': { en: '2x2 Algorithms', zh: '二阶公式' },
  '3x3': { en: '3x3 Algorithms', zh: '三阶公式' },
  '4x4': { en: '4x4 Algorithms', zh: '四阶公式' },
  '5x5': { en: '5x5 Algorithms', zh: '五阶公式' },
};

function isPuzzle(s: string): s is AlgdbPuzzle {
  return (ALGDB_PUZZLES as readonly string[]).includes(s);
}

export default function AlgDbPuzzlePage() {
  const { puzzle = '' } = useParams<{ puzzle: string }>();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [counts, setCounts] = useState<Record<string, number>>({});

  const valid = isPuzzle(puzzle);
  const sets = useMemo(() => (valid ? ALGDB_CATALOG[puzzle] : []), [puzzle, valid]);
  const legacyRedirect = !valid && LEGACY_3X3_SLUGS.has(puzzle) ? `/algdb/3x3/${puzzle}` : null;

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    Promise.all(sets.map(s =>
      loadAlgdb(puzzle, s.slug).then(d => [s.slug, d.cases.length] as const).catch(() => [s.slug, -1] as const)
    )).then(pairs => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const [k, n] of pairs) next[k] = n;
      setCounts(next);
    });
    return () => { cancelled = true; };
  }, [puzzle, valid, sets]);

  if (legacyRedirect) {
    return <Navigate to={legacyRedirect} replace />;
  }

  if (!valid) {
    return (
      <div className="algdb-root">
        <div className="algdb-empty">{isZh ? '未知魔方阶' : 'Unknown puzzle'}: {puzzle}</div>
      </div>
    );
  }

  return (
    <div className="algdb-root">
      <div className="algdb-cat-header">
        <Link to="/algdb" className="algdb-back">
          <ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}
        </Link>
        <h1 className="algdb-cat-title">{isZh ? PUZZLE_TITLE[puzzle].zh : PUZZLE_TITLE[puzzle].en}</h1>
        <span className="algdb-cat-count">{sets.length} {isZh ? '套' : 'sets'}</span>
      </div>

      <div className="algdb-bento">
        {sets.map(s => {
          const n = counts[s.slug];
          return (
            <Link key={s.slug} to={`/algdb/${puzzle}/${s.slug}`} className="algdb-bento-card">
              <div className="algdb-bento-title">{isZh ? s.zh : s.en}</div>
              <div className="algdb-bento-count">
                {n == null ? '…' : n < 0 ? '!' : `${n} ${isZh ? '个' : 'cases'}`}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
