'use client';

/**
 * /alg/[puzzle] — list every alg set for one puzzle (2x2 / 3x3 / 4x4 / 5x5 etc.).
 * Ported from packages/client-vite/src/pages/alg/AlgPuzzlePage.tsx.
 *
 * Loads each set's case count lazily so the page renders before all imports finish.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Eye, Blocks, ScanSearch, Box, type LucideIcon } from 'lucide-react';
import { ALG_CATALOG, ALG_PUZZLES, loadAlg, type AlgCase, type AlgPuzzle } from '@cuberoot/shared';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { CaseThumb } from '@/components/CaseThumb';
import AlgCard from '@/components/AlgCard';
import { FaceletsCube } from '@/components/FaceletsCube';
import { TOTAL_CASES as LSLL_TOTAL, categoryCardFacelets } from '@/lib/lsll/model';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../alg.css';
import { tr } from '@/i18n/tr';

/** Old single-segment 3x3 set slugs we used to live at /alg/<slug>. Redirect to /alg/3x3/<slug>. */
const LEGACY_3X3_SLUGS = new Set(['f2l', 'adv-f2l', 'oll', 'pll']);

/** Method trainers / recognition that aren't a per-set timing drill — surfaced per puzzle. */
const TRAINER_MODULES: Record<string, { href: string; zh: string; en: string; Icon: LucideIcon }[]> = {
  '3x3': [
    { href: '/alg/3bld', zh: '3BLD 盲拧训练', en: '3BLD Trainer', Icon: Eye },
    { href: '/alg/roux', zh: 'Roux 桥式训练', en: 'Roux Trainer', Icon: Blocks },
    { href: '/recognize/pll', zh: 'PLL 识别训练', en: 'PLL Recognition', Icon: ScanSearch },
  ],
  'skewb': [
    { href: '/alg/skewb-trainer', zh: 'Skewb 技巧训练', en: 'Skewb Skills', Icon: Box },
  ],
};

function isPuzzle(s: string): s is AlgPuzzle {
  return (ALG_PUZZLES as readonly string[]).includes(s);
}

export default function AlgPuzzleClient() {
  const params = useParams<{ puzzle: string | string[] }>();
  const puzzle = Array.isArray(params?.puzzle) ? params.puzzle[0] : (params?.puzzle ?? '');
  const router = useRouter();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const algFallback = tr({ zh: '公式库', en: 'Algorithms'
});
  const valid_ = isPuzzle(puzzle);
  const algPuzzleTitle = valid_ ? eventDisplayName(puzzle, isZh) || puzzle : (puzzle || algFallback);
  useDocumentTitle(algPuzzleTitle, algPuzzleTitle);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [firstCases, setFirstCases] = useState<Record<string, AlgCase | null>>({});

  const valid = isPuzzle(puzzle);
  const sets = useMemo(() => (valid ? ALG_CATALOG[puzzle] : []), [puzzle, valid]);
  const legacyRedirect = !valid && LEGACY_3X3_SLUGS.has(puzzle) ? `/alg/3x3/${puzzle}` : null;

  useEffect(() => {
    if (legacyRedirect) router.replace(legacyRedirect);
  }, [legacyRedirect, router]);

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
    return <div className="alg-root"><div className="alg-empty">{tr({ zh: '跳转中…', en: 'Redirecting…'
    })}</div></div>;
  }

  if (!valid) {
    return (
      <div className="alg-root">
        <div className="alg-empty">{tr({ zh: '未知魔方阶', en: 'Unknown puzzle'
        })}: {puzzle}</div>
      </div>
    );
  }

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href="/alg" className="alg-back">
          <ArrowLeft size={14} /> {tr({ zh: '返回', en: 'Back' })}
        </Link>
        <h1 className="alg-cat-title">
          <EventIcon event={puzzle} className="alg-cat-title-icon" />
          <span>{eventDisplayName(puzzle, isZh)} {tr({ zh: '公式', en: 'Algorithms' })}</span>
        </h1>
      </div>

      <div className="alg-bento">
        {sets.map(s => {
          const n = counts[s.slug];
          const first = firstCases[s.slug];
          const firstAlg = first?.algs.flat()[0]?.alg ?? first?.standard ?? '';
          return (
            <AlgCard
              key={s.slug}
              href={`/alg/${puzzle}/${s.slug}`}
              thumb={first && (
                <CaseThumb puzzle={puzzle} set={s.slug} sticker={first.sticker} alg={firstAlg} setup={first.setup} size={96} />
              )}
              title={tr(s)}
              count={n == null ? '…' : n < 0 ? '!' : n}
            />
          );
        })}
        {puzzle === '3x3' && (
          <AlgCard
            href="/alg/lsll"
            prefetch={false}
            thumb={<FaceletsCube fd={categoryCardFacelets('ap')} size={96} alt="LSLL" />}
            title="LSLL"
            count={LSLL_TOTAL.toLocaleString()}
          />
        )}
      </div>

      {TRAINER_MODULES[puzzle] && (
        <div className="alg-train-modules">
          <span className="alg-train-modules-label">{tr({ zh: '训练专区', en: 'Trainers' })}</span>
          {TRAINER_MODULES[puzzle].map(m => (
            <Link key={m.href} href={m.href} className="alg-train-module" prefetch={false}>
              <m.Icon size={15} /> {tr({ zh: m.zh, en: m.en })}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
