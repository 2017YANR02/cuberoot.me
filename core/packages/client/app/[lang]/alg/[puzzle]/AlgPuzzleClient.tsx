'use client';

/**
 * /alg/[puzzle] — list every alg set for one puzzle (2x2 / 3x3 / 4x4 / 5x5 etc.).
 * Ported from packages/client-vite/src/pages/alg/AlgPuzzlePage.tsx.
 *
 * /alg 没有自己的落地页了:原来那一排项目卡片换成页首下拉(AlgPuzzleSelect),
 * /alg 在 next.config 直接 redirect 到默认魔方 /alg/3x3 —— 所以「公式库」入口
 * 落在的就是本页。
 *
 * Loads each set's case count lazily so the page renders before all imports finish.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { GraduationCap, X } from 'lucide-react';
import { ALG_CATALOG, ALG_PUZZLES, loadAlg, type AlgCase, type AlgPuzzle } from '@cuberoot/shared';
import AlgPuzzleSelect from '../_components/AlgPuzzleSelect';
import BackHome from '@/components/BackHome';
import { CaseThumb } from '@/components/CaseThumb';
import AlgCard from '@/components/AlgCard';
import BoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import { MIX_MIN_SETS, mixHref, mixTitle } from '@/lib/alg-mix';
import { useSavedMixes } from '@/lib/alg-mix-saved';
import AlgAdminValidate from '@/components/AlgAdminValidate';
import { useIsMobile } from '@/hooks/useIsMobile';
import { FaceletsCube } from '@/components/FaceletsCube';
import { TOTAL_CASES as LSLL_TOTAL, categoryCardFacelets } from '@/lib/lsll/model';
import '../alg.css';
import { tr } from '@/i18n/tr';

/** Old single-segment 3x3 set slugs we used to live at /alg/<slug>. Redirect to /alg/3x3/<slug>. */
const LEGACY_3X3_SLUGS = new Set(['f2l', 'adv-f2l', 'oll', 'pll']);

/**
 * 整套方法的训练器 —— 不对应任何一套公式,所以留在这层。
 *
 * 各套的观察训练(`/recognize/oll` 等)以前也堆在这一排,已经搬到各自的公式集页首
 * (`/alg/3x3/oll` 的「观察」),那里才看得出这一次练的是哪套。
 */
const TRAINER_MODULES: Record<string, { href: string; zh: string; en: string }[]> = {
  // 三盲不在这排 —— 它在 /alg 落地页自成一个项目(整套编码体系,不是 3x3 的一套公式)。
  '3x3': [
    { href: '/alg/roux', zh: '桥式训练', en: 'Roux Trainer' },
  ],
  'skewb': [
    { href: '/alg/skewb-trainer', zh: 'Skewb 技巧训练', en: 'Skewb Skills' },
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
  // 窄屏这排卡片是四列(alg.css 的 480 断点),96px 的图会撑破格子 —— 图跟着降档。
  const narrow = useIsMobile(480);
  const thumbSize = narrow ? 60 : 96;
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
      <BackHome />
      <div className="alg-cat-header alg-cat-header--puzzle">
        <h1 className="alg-cat-title">{tr({ zh: '公式库', en: 'Algorithm DB' })}</h1>
        {/* 项目切换:原落地页那一排卡片压成一个下拉,每项仍是真链接 */}
        <AlgPuzzleSelect current={puzzle} isZh={isZh} />
        {/* 合练:多套混成一场练(PLL + ZBLL 一起过)。开着时卡片改成勾选。 */}
        <BoolToggle
          value={picking}
          onChange={v => { setPicking(v); if (!v) setPicked([]); }}
          label={tr({ zh: '合练', en: 'Mix' })}
        />
        <Link href="/alg/progress" className="alg-index-progress-link" prefetch={false}>
          <GraduationCap size={16} aria-hidden="true" />
          {tr({ zh: '学习进度', en: 'Progress' })}
        </Link>
        {/* 这一层就是「这个魔方的所有公式集」,校验粒度跟着它 —— 一次扫完本页列出的每套 */}
        <AlgAdminValidate
          scope={{ kind: 'puzzle', puzzle }}
          label={tr({ zh: '校验本页公式集', en: 'Validate these sets' })}
        />
        {/* 全站唯一一处「一次扫完所有 (puzzle, set)」的入口 —— 原在 /alg 落地页,
            落地页取消后跟着搬到这里(admin 才看得见) */}
        <AlgAdminValidate
          scope={{ kind: 'all' }}
          label={tr({ zh: '校验全库', en: 'Validate all' })}
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
                  <CaseThumb puzzle={puzzle} set={s.slug} sticker={first.sticker} alg={firstAlg} setup={first.setup} size={thumbSize} local />
                )}
                title={tr(s)}
                count={n == null ? '…' : n < 0 ? '!' : n}
              />
              {s.slug === 'zbll' && puzzle === '3x3' && !picking && (
                <AlgCard
                  href="/alg/lsll"
                  prefetch={false}
                  thumb={<FaceletsCube fd={categoryCardFacelets('ap')} size={thumbSize} alt="LSLL" />}
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
          {TRAINER_MODULES[puzzle].map(m => (
            <Link key={m.href} href={m.href} className="alg-train-module" prefetch={false}>
              {tr({ zh: m.zh, en: m.en })}
            </Link>
          ))}
        </div>
      )}

      {/* 出处行原在 /alg 落地页页尾,落地页取消后跟到每个魔方页 */}
      <p className="alg-index-credit">
        {tr({ zh: '部分数据来源: ', en: 'Some data from: ' })}
        <a href="https://speedcubedb.com" target="_blank" rel="noopener noreferrer">
          speedcubedb.com
        </a>
        {puzzle === '2x2' && (
          <>
            {', '}
            <a
              href="https://docs.google.com/spreadsheets/d/1OFXakCV85Mp2zsQBXMxiMX9a506JeAcLnUXZr8FgXAY/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Best 2x2 Algs (Google Sheets)
            </a>
          </>
        )}
      </p>
    </div>
  );
}
