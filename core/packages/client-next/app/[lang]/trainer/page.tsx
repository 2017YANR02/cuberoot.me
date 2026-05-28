'use client';

// Ported from packages/client/src/pages/trainer/TrainerLandingPage.tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Flag, Eye } from 'lucide-react';
import { ALG_CATALOG, ALG_PUZZLES, loadAlg, type AlgCase, type AlgPuzzle } from '@cuberoot/shared';
import { CaseThumb } from '@/components/CaseThumb';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './trainer.css';

const PUZZLE_LABEL: Record<AlgPuzzle, string> = {
  '2x2': '2x2', '3x3': '3x3', '4x4': '4x4', '5x5': '5x5',
  'sq1': 'SQ1', 'megaminx': 'Megaminx', 'pyraminx': 'Pyraminx', 'skewb': 'Skewb',
};

const TRAINABLE_SETS: Record<AlgPuzzle, string[]> = Object.fromEntries(
  ALG_PUZZLES.map(p => [p, ALG_CATALOG[p].map(s => s.slug)])
) as Record<AlgPuzzle, string[]>;

const RECOGNIZE_SETS: Record<AlgPuzzle, string[]> = {
  '2x2': [],
  '3x3': ['pll'],
  '4x4': [],
  '5x5': [],
  'sq1': [],
  'megaminx': [],
  'pyraminx': [],
  'skewb': [],
};

export default function TrainerLandingPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('训练器', 'Trainer');

  const [puzzle, setPuzzle] = useState<AlgPuzzle>('3x3');
  const [firstCases, setFirstCases] = useState<Record<string, AlgCase | null>>({});

  const trainableSets = ALG_CATALOG[puzzle].filter(s => TRAINABLE_SETS[puzzle].includes(s.slug));
  const recognizeSets = ALG_CATALOG[puzzle].filter(s => RECOGNIZE_SETS[puzzle].includes(s.slug));

  useEffect(() => {
    let cancelled = false;
    setFirstCases({});
    Promise.all(trainableSets.map(s =>
      loadAlg(puzzle, s.slug)
        .then(d => ({ slug: s.slug, first: d.cases[0] ?? null }))
        .catch(() => ({ slug: s.slug, first: null }))
    )).then(rows => {
      if (cancelled) return;
      const next: Record<string, AlgCase | null> = {};
      for (const { slug, first } of rows) next[slug] = first;
      setFirstCases(next);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle]);

  return (
    <div className="trainer-root">
      <div className="trainer-topbar">
        <select
          className="trainer-puzzle-select"
          value={puzzle}
          onChange={(e) => setPuzzle(e.target.value as AlgPuzzle)}
        >
          {ALG_PUZZLES.filter(p => TRAINABLE_SETS[p].length > 0).map(p => (
            <option key={p} value={p}>{PUZZLE_LABEL[p]}</option>
          ))}
        </select>
      </div>

      {trainableSets.length === 0 && (
        <div className="trainer-landing-empty">{isZh ? '此项目暂无可训练公式集' : 'No trainable sets for this puzzle'}</div>
      )}

      {trainableSets.length > 0 && (
        <>
          <h2 className="trainer-section-title">
            <Flag size={16} /> {isZh ? '公式训练' : 'Alg Training'}
          </h2>
          <div className="trainer-set-grid">
            {trainableSets.map(s => {
              const first = firstCases[s.slug];
              const firstAlg = first?.algs.flat()[0]?.alg ?? first?.standard ?? '';
              return (
                <Link
                  key={s.slug}
                  href={`/trainer/${puzzle}/${s.slug}`}
                  className="trainer-set-card"
                >
                  <div className="trainer-set-card-thumb">
                    {first && (
                      <CaseThumb
                        puzzle={puzzle}
                        set={s.slug}
                        sticker={first.sticker}
                        alg={firstAlg}
                        setup={first.setup}
                        size={88}
                      />
                    )}
                  </div>
                  <div className="trainer-set-card-title">{isZh ? s.zh : s.en}</div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {recognizeSets.length > 0 && (
        <>
          <h2 className="trainer-section-title">
            <Eye size={16} /> {isZh ? '识别训练' : 'Recognition Training'}
          </h2>
          <div className="trainer-set-grid">
            {recognizeSets.map(s => {
              const first = firstCases[s.slug];
              const firstAlg = first?.algs.flat()[0]?.alg ?? first?.standard ?? '';
              return (
                <Link
                  key={s.slug}
                  href={`/recognize/${s.slug}`}
                  className="trainer-set-card is-recognize"
                >
                  <div className="trainer-set-card-thumb">
                    {first && (
                      <CaseThumb
                        puzzle={puzzle}
                        set={s.slug}
                        sticker={first.sticker}
                        alg={firstAlg}
                        setup={first.setup}
                        size={88}
                      />
                    )}
                  </div>
                  <div className="trainer-set-card-title">{isZh ? s.zh : s.en}</div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
