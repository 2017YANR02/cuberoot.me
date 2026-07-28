'use client';

/**
 * /alg/[puzzle] — list every alg set for one puzzle (2x2 / 3x3 / 4x4 / 5x5 etc.).
 * Ported from packages/client-vite/src/pages/alg/AlgPuzzlePage.tsx.
 *
 * Loads each set's case count lazily so the page renders before all imports finish.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Eye, Blocks, ScanSearch, Box, X, type LucideIcon } from 'lucide-react';
import { ALG_CATALOG, ALG_PUZZLES, loadAlg, type AlgCase, type AlgPuzzle } from '@cuberoot/shared';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { eventDisplayName } from '@/lib/wca-events';
import { CaseThumb } from '@/components/CaseThumb';
import AlgCard from '@/components/AlgCard';
import BoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import { MIX_MIN_SETS, mixHref, mixTitle } from '@/lib/alg-mix';
import { useSavedMixes } from '@/lib/alg-mix-saved';
import AlgAdminValidate from '@/components/AlgAdminValidate';
import { FaceletsCube } from '@/components/FaceletsCube';
import { TOTAL_CASES as LSLL_TOTAL, categoryCardFacelets } from '@/lib/lsll/model';
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
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [firstCases, setFirstCases] = useState<Record<string, AlgCase | null>>({});

  // 合练:开着的时候卡片从「点了进去」变成「点了勾选」,选够两套底部出条开始
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [mixName, setMixName] = useState('');
  const savedMixes = useSavedMixes(s => s.list);
  const hydrateMixes = useSavedMixes(s => s.hydrate);
  const saveMix = useSavedMixes(s => s.saveMix);
  const removeMix = useSavedMixes(s => s.remove);
  useEffect(() => { hydrateMixes(); }, [hydrateMixes]);
  const togglePick = (slug: string) =>
    setPicked(prev => (prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]));
  const pickedCount = picked.reduce((n, slug) => n + Math.max(0, counts[slug] ?? 0), 0);
  const canMix = picked.length >= MIX_MIN_SETS;

  const valid = isPuzzle(puzzle);
  const sets = useMemo(() => (valid ? ALG_CATALOG[puzzle] : []), [puzzle, valid]);
  const legacyRedirect = !valid && LEGACY_3X3_SLUGS.has(puzzle) ? `/alg/3x3/${puzzle}` : null;

  useEffect(() => {
    if (legacyRedirect) router.replace(legacyRedirect);
  }, [legacyRedirect, router]);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    // 换魔方阶要先清空:slug 在不同阶之间会重名(2x2 与 megaminx 都有 eo/co/cp/ep),
    // 留着上一阶的条目会让新页面读到别人的封面和数量。
    setCounts({});
    setFirstCases({});
    // 一套一落地,不等最慢的那一套 —— 一张卡片的封面不该被另一套的请求挡着。
    for (const s of sets) {
      loadAlg(puzzle, s.slug)
        .then(d => ({ count: d.cases.length, first: d.cases[0] ?? null as AlgCase | null }))
        .catch(() => ({ count: -1, first: null as AlgCase | null }))
        .then(({ count, first }) => {
          if (cancelled) return;
          setCounts(prev => ({ ...prev, [s.slug]: count }));
          setFirstCases(prev => ({ ...prev, [s.slug]: first }));
        });
    }
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
        {/* 合练:多套混成一场练(PLL + ZBLL 一起过)。开着时卡片改成勾选。 */}
        <BoolToggle
          value={picking}
          onChange={v => { setPicking(v); if (!v) setPicked([]); }}
          label={tr({ zh: '合练', en: 'Mix' })}
        />
        {/* 这一层就是「这个魔方的所有公式集」,校验粒度跟着它 —— 一次扫完本页列出的每套 */}
        <AlgAdminValidate
          scope={{ kind: 'puzzle', puzzle }}
          label={tr({ zh: '校验本页公式集', en: 'Validate these sets' })}
        />
      </div>

      <div className="alg-bento">
        {sets.map(s => {
          const n = counts[s.slug];
          const first = firstCases[s.slug];
          const firstAlg = first?.algs.flat()[0]?.alg ?? first?.standard ?? '';
          return (
            /* LSLL 不在 catalog 里(不是一套公式而是整层枚举),但归属上紧跟 ZBLL,所以就地插在它后面 */
            <Fragment key={s.slug}>
              <AlgCard
                href={picking ? undefined : `/alg/${puzzle}/${s.slug}`}
                onClick={picking ? () => togglePick(s.slug) : undefined}
                className={picking && picked.includes(s.slug) ? 'is-picked' : undefined}
                thumb={first && (
                  /* 每阶最多二十来张、全在首屏附近,本地渲染实测 19 张 26ms —— 图与数量同帧出现,
                     不再各自等一次跨域请求。渲染器本来就静态 import 进了 bundle,不额外增体积。
                     长 case 网格不能照抄这条,那边走 loading="lazy",见 AlgCategoryView。 */
                  <CaseThumb puzzle={puzzle} set={s.slug} sticker={first.sticker} alg={firstAlg} setup={first.setup} size={96} local />
                )}
                title={tr(s)}
                count={n == null ? '…' : n < 0 ? '!' : n}
              />
              {s.slug === 'zbll' && puzzle === '3x3' && !picking && (
                <AlgCard
                  href="/alg/lsll"
                  prefetch={false}
                  thumb={<FaceletsCube fd={categoryCardFacelets('ap')} size={96} alt="LSLL" />}
                  title="LSLL"
                  count={LSLL_TOTAL.toLocaleString()}
                />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* 存下来的合练组合:一行一条,点进去直接开练。纯本地快捷方式,进度不在这里。 */}
      {!picking && savedMixes.filter(m => m.puzzle === puzzle).length > 0 && (
        <div className="alg-mix-saved">
          <span className="alg-train-modules-label">{tr({ zh: '我的合集', en: 'My mixes' })}</span>
          {savedMixes.filter(m => m.puzzle === puzzle).map(m => (
            <span key={m.id} className="alg-mix-saved-item">
              <Link href={mixHref(puzzle, m.sets, 'run')} className="alg-mix-saved-link" prefetch={false}>
                {m.name}
                <span>{m.sets.length}</span>
              </Link>
              <ClearButton
                onClick={() => removeMix(m.id)}
                ariaLabel={tr({ zh: `删除合集 ${m.name}`, en: `Delete mix ${m.name}` })}
              />
            </span>
          ))}
        </div>
      )}

      {/* 选够两套才出现的操作条:直接开练,或先起个名存成合集 */}
      {picking && picked.length > 0 && (
        <div className="alg-mix-bar" role="region" aria-label={tr({ zh: '合练', en: 'Mix' })}>
          <span className="alg-mix-bar-sets">
            {picked.map(slug => (
              <span key={slug} className="alg-mix-bar-chip">
                {tr(sets.find(x => x.slug === slug) ?? { zh: slug, en: slug })}
                <button
                  type="button"
                  className="alg-mix-bar-x"
                  onClick={() => togglePick(slug)}
                  aria-label={tr({ zh: `不选 ${slug}`, en: `Unpick ${slug}` })}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </span>
          <span className="alg-mix-bar-count">
            {pickedCount > 0 ? pickedCount : '…'} {tr({ zh: '个 case', en: 'cases' })}
          </span>
          {canMix && (
            <>
              <input
                className="alg-mix-bar-name"
                value={mixName}
                onChange={e => setMixName(e.target.value)}
                placeholder={mixTitle(puzzle, picked)}
                aria-label={tr({ zh: '合集名', en: 'Mix name' })}
                maxLength={40}
              />
              <button
                type="button"
                className="alg-mix-bar-save"
                onClick={() => { saveMix(puzzle, picked, mixName); setMixName(''); }}
              >
                {tr({ zh: '存为合集', en: 'Save mix' })}
              </button>
              <Link href={mixHref(puzzle, picked, 'run')} className="alg-mix-bar-go" prefetch={false}>
                {tr({ zh: '开始合练', en: 'Start mix' })}
              </Link>
            </>
          )}
          {!canMix && (
            <span className="alg-mix-bar-hint">{tr({ zh: '再选一套就能一起练', en: 'Pick one more set to drill them together' })}</span>
          )}
        </div>
      )}

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
