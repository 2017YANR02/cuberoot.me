'use client';

// Trainer hub for one event — /trainer/<event> (333 / 222 / 333bf / ...).
// 选项目走 URL(选别的 event 直接 push /trainer/<id>),不再藏在组件 state 里.
// Ported from packages/client-vite/src/pages/trainer/TrainerLandingPage.tsx.
import { useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Flag, Eye, Blocks } from 'lucide-react';
import { ALG_CATALOG, ALG_PUZZLES, loadAlg, type AlgCase, type AlgPuzzle } from '@cuberoot/shared';
import { CaseThumb } from '@/components/CaseThumb';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import WcaEventSelector from '@/components/WcaEventSelector';
import { Bld3Hub } from '../3bld/_components/Bld3Hub';
import { PUZZLE_EVENT, segToEvent } from '../_events';
import '../trainer.css';
import { tr } from '@/i18n/tr';

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

// '3bld' is a discipline (not an alg-set puzzle) but lives in the same WCA-event
// selector; selecting it (333bf) swaps the alg-set grid for the 3BLD module hub inline.
type PuzzleSel = AlgPuzzle | '3bld';

const EVENT_PUZZLE: Record<string, PuzzleSel> = {
  '222': '2x2', '333': '3x3', '444': '4x4', '555': '5x5',
  'sq1': 'sq1', 'minx': 'megaminx', 'pyram': 'pyraminx', 'skewb': 'skewb', '333bf': '3bld',
};
const SELECTOR_EVENTS = new Set<string>([
  ...ALG_PUZZLES.filter(p => TRAINABLE_SETS[p].length > 0).map(p => PUZZLE_EVENT[p]),
  '333bf',
]);

export default function TrainerHubClient() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  useDocumentTitle('训练器', 'Trainer');
  const router = useRouter();
  const params = useParams<{ puzzle: string }>();
  const seg = (Array.isArray(params?.puzzle) ? params.puzzle[0] : params?.puzzle) ?? '333';

  // 当前 event(规范化:3x3->333 等)+ 对应 puzzle(选择器 / 公式集网格用)
  const event = segToEvent(seg);
  const puzzle: PuzzleSel = EVENT_PUZZLE[event] ?? '3x3';
  const isBld = puzzle === '3bld';
  // Roux trainer is 3x3-only; on the 333 hub it renders as its own section below the alg grid.
  const is333 = event === '333';
  const [firstCases, setFirstCases] = useState<Record<string, AlgCase | null>>({});

  const trainableSets = isBld ? [] : ALG_CATALOG[puzzle].filter(s => TRAINABLE_SETS[puzzle].includes(s.slug));
  const recognizeSets = isBld ? [] : ALG_CATALOG[puzzle].filter(s => RECOGNIZE_SETS[puzzle].includes(s.slug));

  useEffect(() => {
    if (isBld) { setFirstCases({}); return; }
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
        <WcaEventSelector
          availableEvents={SELECTOR_EVENTS}
          onlyAvailable
          selectedEvent={event}
          onSelect={(id) => router.push(`${lang === 'zh' ? '/zh' : ''}/trainer/${id}`)}
          isZh={isZh}
        />
      </div>

      {isBld && <Bld3Hub embedded />}

      {!isBld && trainableSets.length === 0 && (
        <div className="trainer-landing-empty">{tr({ zh: '此项目暂无可训练公式集', en: 'No trainable sets for this puzzle'
        })}</div>
      )}

      {!isBld && trainableSets.length > 0 && (
        <>
          <h2 className="trainer-section-title">
            <Flag size={16} /> {tr({ zh: '公式训练', en: 'Alg Training'
            })}
          </h2>
          <div className="trainer-set-grid">
            {trainableSets.map(s => {
              const first = firstCases[s.slug];
              const firstAlg = first?.algs.flat()[0]?.alg ?? first?.standard ?? '';
              return (
                <Link
                  key={s.slug}
                  href={`/${lang}/trainer/${event}/${s.slug}`}
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
                  <div className="trainer-set-card-title">{tr(s)}</div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {is333 && (
        <>
          <h2 className="trainer-section-title">
            <Blocks size={16} /> {tr({ zh: '桥式', en: 'Roux'
            })}
          </h2>
          <div className="trainer-set-grid">
            <Link href={`/${lang}/trainer/roux`} className="trainer-set-card">
              <div className="trainer-set-card-thumb trainer-roux-thumb">
                <Blocks size={44} strokeWidth={1.5} />
              </div>
              <div className="trainer-set-card-title">{tr({ zh: '桥式训练器', en: 'Roux Trainer'
            })}</div>
            </Link>
          </div>
        </>
      )}

      {!isBld && recognizeSets.length > 0 && (
        <>
          <h2 className="trainer-section-title">
            <Eye size={16} /> {tr({ zh: '识别训练', en: 'Recognition Training'
            })}
          </h2>
          <div className="trainer-set-grid">
            {recognizeSets.map(s => {
              const first = firstCases[s.slug];
              const firstAlg = first?.algs.flat()[0]?.alg ?? first?.standard ?? '';
              return (
                <Link
                  key={s.slug}
                  href={`/${lang}/recognize/${s.slug}`}
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
                  <div className="trainer-set-card-title">{tr(s)}</div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
