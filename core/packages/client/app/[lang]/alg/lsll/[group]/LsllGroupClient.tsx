'use client';

/**
 * /alg/lsll/[group] — 大类内浏览。
 *
 * 一步(`?cls=2`,默认):枚举全部 case(客户端组合数学生成,无后端),翻棱数筛选 + 分页。
 * 两步(`?cls=3`):走 LsllRouteBrowser,浏览 (ZBLS case, ZBLL case) 路线。
 *
 * 「图 / 公式」开关同全站(AlgViewModeToggle),只对一步模式有意义。本页没有公式库,
 * 公式**现算**:setupForCase 出打乱(cubing.js 两阶段解取逆),再取一次逆就是一条有效解法 ——
 * 与训练器现算打乱同一条路子(lib/lsll/trainer-set),不新造数据源。一页 48 个,逐个串行算,
 * 算好一个贴一个;算过的进模块级缓存,翻回来不重算。
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQueryState, parseAsInteger, parseAsStringEnum } from 'nuqs';
import Link from '@/components/AppLink';
import { ArrowLeft } from 'lucide-react';
import { tr, T } from '@/i18n/tr';
import { FaceletsCube } from '@/components/FaceletsCube';
import AlgViewModeToggle, { useAlgViewMode } from '@/components/AlgViewModeToggle';
import PillToggle from '@/components/PillToggle/PillToggle';
import {
  categoryBySlug, enumerateCategory, unpackState, classify, caseFacelets, keyToString, displayState,
} from '@/lib/lsll/model';
import { class3CountForFamily } from '@/lib/lsll/class3';
import { setupForCase, solutionForSetup } from '@/lib/lsll/setup';
import { lsllScopeParam } from '@/lib/lsll/trainer-set';
import LsllRouteBrowser from './LsllRouteBrowser';
import '../../alg.css';
import '../lsll.css';

const PAGE_SIZE = 48;

/** case key → 解法。跨翻页 / 跨切视图复用(一次两阶段解 ≈ 百毫秒级,别重复付)。 */
const SOLUTION_CACHE = new Map<number, string>();

export default function LsllGroupClient() {
  const params = useParams<{ group: string }>();
  const slug = typeof params?.group === 'string' ? params.group : '';
  const cat = categoryBySlug(slug);

  const [cls, setCls] = useQueryState(
    'cls',
    parseAsStringEnum(['2', '3']).withDefault('2').withOptions({ history: 'push' }),
  );
  const twoLook = cls === '3';
  const [eoBad, setEoBad] = useQueryState('eo', parseAsInteger.withDefault(-1));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [view, changeView] = useAlgViewMode();

  // 全类枚举一次(memo);再按翻棱数过滤。两步模式用不上,别白付这 ~100ms。
  const allKeys = useMemo(() => (cat && !twoLook ? enumerateCategory(cat.slug) : []), [cat, twoLook]);
  const withMeta = useMemo(
    () => allKeys.map((k) => ({ k, eoBad: classify(unpackState(k)).eoBad })),
    [allKeys],
  );
  const eoValues = useMemo(() => {
    const m = new Map<number, number>();
    for (const x of withMeta) m.set(x.eoBad, (m.get(x.eoBad) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [withMeta]);
  const filtered = useMemo(
    () => (eoBad < 0 ? withMeta : withMeta.filter((x) => x.eoBad === eoBad)),
    [withMeta, eoBad],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(Math.max(1, page), pageCount);
  const slice = useMemo(
    () => filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE),
    [filtered, cur],
  );

  /** 本页已算出的解法(`''` = 算失败)。只在公式模式下填。 */
  const [solutions, setSolutions] = useState<Record<number, string>>({});
  useEffect(() => {
    if (view !== 'full' || twoLook) return;
    let cancelled = false;
    // 缓存里已有的先贴上(翻页回来 / 图↔公式来回切,不该再等一遍)
    const seeded: Record<number, string> = {};
    for (const { k } of slice) {
      const hit = SOLUTION_CACHE.get(k);
      if (hit !== undefined) seeded[k] = hit;
    }
    if (Object.keys(seeded).length) setSolutions((prev) => ({ ...prev, ...seeded }));
    void (async () => {
      for (const { k } of slice) {
        if (cancelled) return;
        if (SOLUTION_CACHE.has(k)) continue;
        let sol = '';
        try {
          sol = solutionForSetup(await setupForCase(displayState(unpackState(k))));
        } catch {
          sol = ''; // setup 生成失败(极少见:桥接自检不过)→ 该卡显示「不可用」
        }
        SOLUTION_CACHE.set(k, sol);
        if (cancelled) return;
        setSolutions((prev) => ({ ...prev, [k]: sol }));
      }
    })();
    return () => { cancelled = true; };
  }, [view, slice]);

  const pending = view === 'full' ? slice.filter(({ k }) => solutions[k] === undefined).length : 0;

  if (!cat) {
    return <div className="alg-root"><div className="alg-empty">{tr({ zh: '未知大类', en: 'Unknown family' })}</div></div>;
  }
  // O 类的对子已经归位且朝向正确,最后一槽没事可做 —— 它那 3,916 个局面就是 1LLL 的全部,
  // 所以 LSLL 不列不练(首页也不出这张卡);直链进来就说清楚,并把人送到 1LLL。
  if (cat.pureLL) {
    return (
      <div className="alg-root">
        <div className="alg-cat-header">
          <Link href="/alg/lsll" className="alg-back"><ArrowLeft size={14} /> LSLL</Link>
          <h1 className="alg-cat-title"><span>{cat.letter}</span></h1>
        </div>
        <p className="lsll-intro">
          <T
            zh={<>{cat.letter} 类的对子已经在槽里、朝向也正确,最后一槽没事可做 ——
              剩下的纯粹是顶层,3,916 个局面正是 <Link href="/alg/3x3/1lll">1LLL</Link> 那 3,916 个。
              LSLL 不重复收录它。</>}
            en={<>In family {cat.letter} the pair is already in the slot and correctly oriented, so
              the last slot needs nothing — only a last layer is left, and its 3,916 cases are
              exactly the 3,916 of <Link href="/alg/3x3/1lll">1LLL</Link>. LSLL does not list them
              a second time.</>}
          />
        </p>
      </div>
    );
  }

  const showAlgs = view === 'full';

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href={`/alg/lsll${twoLook ? '?cls=3' : ''}`} className="alg-back">
          <ArrowLeft size={14} /> LSLL
        </Link>
        <h1 className="alg-cat-title">
          <span>{cat.letter} <span className="alg-cat-count">
            {(twoLook ? class3CountForFamily(cat.slug) : cat.count).toLocaleString()}{' '}
            {tr({ zh: twoLook ? '条路线' : '个', en: twoLook ? 'routes' : 'cases' })}
          </span></span>
        </h1>
        <PillToggle
          className="alg-view-toggle"
          value={twoLook}
          onChange={(v) => setCls(v ? '3' : '2')}
          offLabel={tr({ zh: '一步', en: 'One-look' })}
          onLabel={tr({ zh: '两步', en: 'Two-look' })}
          ariaLabel={tr({ zh: '一步 / 两步', en: 'One-look / two-look' })}
        />
        {!twoLook && <AlgViewModeToggle value={view} onChange={changeView} className="alg-view-toggle" />}
        {/* 练这一大类:全站同一个训练器,当前的翻棱筛选一并带过去。样式共用 `.alg-train-cta` */}
        {!twoLook && (
          <Link
            href={`/alg/3x3/lsll/run?scope=${lsllScopeParam(cat.slug, eoBad)}`}
            className="alg-train-cta"
            prefetch={false}
          >
            {tr({ zh: '训练', en: 'Train' })}
          </Link>
        )}
      </div>

      {twoLook && <LsllRouteBrowser family={cat.slug} />}

      {!twoLook && (
      <>
      <div className="lsll-chips">
        <span className="lsll-chips-label">{tr({ zh: '顶层翻棱', en: 'Bad edges' })}</span>
        <button
          type="button"
          className={`lsll-chip${eoBad < 0 ? ' active' : ''}`}
          onClick={() => { setEoBad(-1); setPage(1); }}
        >
          {tr({ zh: '全部', en: 'All' })}
        </button>
        {eoValues.map(([v, n]) => (
          <button
            key={v}
            type="button"
            className={`lsll-chip${eoBad === v ? ' active' : ''}`}
            onClick={() => { setEoBad(v); setPage(1); }}
          >
            {v} ({n.toLocaleString()})
          </button>
        ))}
      </div>

      {showAlgs && (
        <p className="lsll-alg-note">
          {pending > 0
            ? tr({ zh: `解法生成中 ${slice.length - pending} / ${slice.length}`, en: `Solving ${slice.length - pending} / ${slice.length}` })
            : tr({ zh: '机器两阶段解:能解开,但没优化步数和指法。', en: 'Machine two-phase solutions: valid, but not move- or fingertrick-optimised.' })}
        </p>
      )}

      <div className={`lsll-case-grid${showAlgs ? ' is-algs' : ''}`}>
        {slice.map(({ k }, i) => {
          const ks = keyToString(k);
          const sol = solutions[k];
          return (
            <Link
              key={k}
              href={`/alg/lsll/case?k=${ks}`}
              className={`lsll-case-card${showAlgs ? ' is-algs' : ''}`}
              prefetch={false}
            >
              <FaceletsCube fd={caseFacelets(displayState(unpackState(k)))} size={88} alt={`#${ks}`} />
              <span className="lsll-case-body">
                <span className="lsll-case-label">#{(cur - 1) * PAGE_SIZE + i + 1}</span>
                {showAlgs && (
                  <span className="lsll-case-alg">
                    {sol === undefined
                      ? tr({ zh: '生成中…', en: 'Solving…' })
                      : sol || tr({ zh: '(不可用)', en: '(unavailable)' })}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="lsll-pager">
        <button type="button" className="lsll-pager-btn" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>
          {tr({ zh: '上一页', en: 'Prev' })}
        </button>
        <span>{cur} / {pageCount.toLocaleString()}</span>
        <button type="button" className="lsll-pager-btn" disabled={cur >= pageCount} onClick={() => setPage(cur + 1)}>
          {tr({ zh: '下一页', en: 'Next' })}
        </button>
        <span>{filtered.length.toLocaleString()} {tr({ zh: '个匹配', en: 'matched' })}</span>
      </div>
      </>
      )}
    </div>
  );
}
