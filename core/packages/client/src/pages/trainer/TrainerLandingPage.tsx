/**
 * /trainer landing — pick puzzle (dropdown), then click a set card.
 *
 * Top: puzzle dropdown. Below: bento grid of set cards (one per alg-DB set
 * for that puzzle). Click card → /trainer/:puzzle/:set selection page.
 * Sets that also have a recognize trainer get a small Recognize chip.
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { ALG_CATALOG, ALG_PUZZLES, loadAlg, type AlgCase, type AlgPuzzle } from '@cuberoot/shared';
import { CaseThumb } from '../alg/CaseThumb';
import LangToggle from '../../components/LangToggle';
import './trainer.css';

const PUZZLE_LABEL: Record<AlgPuzzle, string> = {
  '2x2': '2x2', '3x3': '3x3', '4x4': '4x4', '5x5': '5x5',
  'sq1': 'SQ1', 'megaminx': 'Megaminx', 'pyraminx': 'Pyraminx', 'skewb': 'Skewb',
};

// 公式训练 — 默认所有 alg-DB set 都开放,要黑名单某个在这里 filter。
const TRAINABLE_SETS: Record<AlgPuzzle, string[]> = Object.fromEntries(
  ALG_PUZZLES.map(p => [p, ALG_CATALOG[p].map(s => s.slug)])
) as Record<AlgPuzzle, string[]>;

// 识别训练 — 只有对应 set 实现了 TrainingPage 分支才能加进来
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
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const [puzzle, setPuzzle] = useState<AlgPuzzle>('3x3');
  const [firstCases, setFirstCases] = useState<Record<string, AlgCase | null>>({});

  const trainableSets = ALG_CATALOG[puzzle].filter(s => TRAINABLE_SETS[puzzle].includes(s.slug));
  const recognizeSlugs = new Set(RECOGNIZE_SETS[puzzle]);

  // Load first case for each set's thumbnail
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
        <div className="trainer-spacer" />
        <LangToggle variant="inline" />
      </div>

      {trainableSets.length === 0 && (
        <div className="trainer-landing-empty">{isZh ? '此项目暂无可训练公式集' : 'No trainable sets for this puzzle'}</div>
      )}

      {trainableSets.length > 0 && (
        <div className="trainer-set-grid">
          {trainableSets.map(s => {
            const first = firstCases[s.slug];
            const firstAlg = first?.algs.flat()[0]?.alg ?? first?.standard ?? '';
            const hasRecognize = recognizeSlugs.has(s.slug);
            return (
              <Link
                key={s.slug}
                to={`/trainer/${puzzle}/${s.slug}`}
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
                {hasRecognize && (
                  <button
                    type="button"
                    className="trainer-set-card-recognize"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/recognize/${s.slug}`);
                    }}
                    title={isZh ? '识别训练' : 'Recognition'}
                  >
                    <Eye size={12} /> {isZh ? '识别' : 'Recognize'}
                  </button>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
