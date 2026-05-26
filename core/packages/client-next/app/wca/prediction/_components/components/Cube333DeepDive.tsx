/**
 * Cube333DeepDive — 18-chapter English longform deep-dive on 3x3 speedcubing.
 *
 * Each chapter is dynamically imported only when the user opens its <details>.
 * Without this, top-level imports load all 18 × ~100 KB chapters synchronously,
 * which freezes the main thread on the multi-event prediction page.
 */
import { useState, useCallback } from 'react';
import { Longform } from './Longform';

type Loader = () => Promise<string>;

const CHAPTERS: { title: string; load: Loader }[] = [
  { title: '1. WR Chronicle (2003-2026)',                      load: () => import('../data/longform/history_detail').then((m) => m.HISTORY_DETAIL_EN) },
  { title: '2. Extended Cultural History',                     load: () => import('../data/longform/history_extended').then((m) => m.HISTORY_EXTENDED_EN) },
  { title: '3. WCA Competitions 2003-2026',                    load: () => import('../data/longform/competitions_detail').then((m) => m.COMPETITIONS_DETAIL_EN) },
  { title: '4. Mathematics of the Cube',                       load: () => import('../data/longform/math_detail').then((m) => m.MATH_DETAIL_EN) },
  { title: '5. Solver Software & Algorithms',                  load: () => import('../data/longform/solver_software').then((m) => m.SOLVER_SOFTWARE_EN) },
  { title: '6. CFOP Anatomy',                                  load: () => import('../data/longform/cfop_detail').then((m) => m.CFOP_DETAIL_EN) },
  { title: '7. Full Algorithm Catalog (PLL/OLL/F2L/ZBLL)',     load: () => import('../data/longform/algorithms_catalog').then((m) => m.ALGORITHMS_CATALOG_EN) },
  { title: '8. Cube Mechanical Engineering',                   load: () => import('../data/longform/engineering').then((m) => m.ENGINEERING_EN) },
  { title: '9. Biomechanics + Training Methodology',           load: () => import('../data/longform/biomech_training').then((m) => m.BIOMECH_TRAINING_EN) },
  { title: '10. Psychology + Sport Science',                   load: () => import('../data/longform/psychology').then((m) => m.PSYCHOLOGY_EN) },
  { title: '11. Statistical Forecasting Mathematics',          load: () => import('../data/longform/stats_forecast').then((m) => m.STATS_FORECAST_EN) },
  { title: '12. AI/ML Research on Cube',                       load: () => import('../data/longform/ai_ml').then((m) => m.AI_ML_EN) },
  { title: '13. FMC + Related WCA Events',                     load: () => import('../data/longform/fmc_events').then((m) => m.FMC_EVENTS_EN) },
  { title: '14. Related Twisty Puzzles',                       load: () => import('../data/longform/related_puzzles').then((m) => m.RELATED_PUZZLES_EN) },
];

function LazyChapter({ title, load }: { title: string; load: Loader }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onToggle = useCallback(
    async (e: React.SyntheticEvent<HTMLDetailsElement>) => {
      if (e.currentTarget.open && !text && !loading) {
        setLoading(true);
        try {
          const s = await load();
          setText(s);
        } finally {
          setLoading(false);
        }
      }
    },
    [text, loading, load],
  );

  return (
    <details className="pred-333-chapter" onToggle={onToggle}>
      <summary className="pred-333-chapter-summary">{title}</summary>
      {loading && <p style={{ color: 'var(--muted-foreground)', fontSize: '13px' }}>Loading…</p>}
      {text && <Longform text={text} />}
    </details>
  );
}

export default function Cube333DeepDive() {
  return (
    <div className="pred-333-deepdive">
      <h3>Deep Dive: 3x3 Speedcubing (English longform, 14 chapters)</h3>
      <p style={{ color: 'var(--muted-foreground)', fontSize: '13px', lineHeight: 1.55 }}>
        Each chapter loads on demand when expanded. Topics cover history, mathematics, hardware, methods,
        algorithms, biomechanics, training, statistical forecasting, AI/ML research, related puzzles, and
        extended cultural history of the cube. For a navigable, sidebar-TOC version, see{' '}
        <a href="/wca/prediction/333" style={{ color: 'var(--accent)' }}>/wca/prediction/333</a>.
      </p>
      {CHAPTERS.map((c) => (
        <LazyChapter key={c.title} title={c.title} load={c.load} />
      ))}
    </div>
  );
}
