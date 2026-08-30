'use client';

/**
 * /alg/lsll/[group]?cls=3 — 两步路线浏览(三类)。
 *
 * 一条路线 = 有序对(ZBLS case, ZBLL case),两个集合各自规范,与用哪本公式表无关
 * (为什么不能拿 mid-AUF 再商一次:/math/lsll §3)。浏览顺序照两步解法的顺序:
 * 先挑第一眼要认的 ZBLS case(本大类下 2–8 个),再看它后面接的 494 个 ZBLL case。
 *
 * 图全在前端现算(lib/lsll/class3.ts),不走后端;两半各自链到站内公式库
 * (zbls 集 / zbll+pll 集)——单一数据源,这里不复制公式。
 */
import { useMemo } from 'react';
import { useQueryState, parseAsInteger, parseAsString } from 'nuqs';
import Link from '@/components/AppLink';
import { tr, T } from '@/i18n/tr';
import { FaceletsCube } from '@/components/FaceletsCube';
import AlgCard from '@/components/AlgCard';
import { keyToString } from '@/lib/lsll/model';
import {
  ZBLL_CASE_COUNT, allZbllCases, zblsCasesForFamily, zblsCardFacelets, zbllCardFacelets,
  zblsLibRefs, zbllLibRefs, zblsCaseByCode, zbllShortLabel,
} from '@/lib/lsll/class3';

const PAGE_SIZE = 48;

export default function LsllRouteBrowser({ family }: { family: string }) {
  const [z, setZ] = useQueryState('z', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));

  const firstLook = zblsCasesForFamily(family);
  const picked = z ? zblsCaseByCode(z) : undefined;
  const valid = picked && picked.family === family ? picked : undefined;

  const zbll = useMemo(() => (valid ? allZbllCases() : []), [valid]);
  const pageCount = Math.max(1, Math.ceil(zbll.length / PAGE_SIZE));
  const cur = Math.min(Math.max(1, page), pageCount);
  const slice = useMemo(
    () => zbll.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE),
    [zbll, cur],
  );

  const zblsName = (code: string): string => {
    const c = zblsCaseByCode(code);
    const refs = c ? zblsLibRefs(c.id) : null;
    return refs?.[0]?.name ?? tr({ zh: '已解', en: 'Solved' });
  };

  return (
    <>
      <div className="lsll-chips">
        <span className="lsll-chips-label">{tr({ zh: '第一眼:ZBLS', en: 'First look: ZBLS' })}</span>
        <button
          type="button"
          className={`lsll-chip${valid ? '' : ' active'}`}
          onClick={() => { void setZ(null); void setPage(1); }}
        >
          {tr({ zh: '全部', en: 'All' })}
        </button>
        {firstLook.map((c) => (
          <button
            key={c.code}
            type="button"
            className={`lsll-chip${valid?.code === c.code ? ' active' : ''}`}
            onClick={() => { void setZ(c.code); void setPage(1); }}
          >
            {zblsName(c.code)}
          </button>
        ))}
      </div>

      {!valid ? (
        <>
          <p className="lsll-alg-note">
            <T
              zh={<>本大类有 {firstLook.length} 个 ZBLS case,每个后面都接得上全部 {ZBLL_CASE_COUNT} 个
                ZBLL case —— 合计 {(firstLook.length * ZBLL_CASE_COUNT).toLocaleString()} 条路线。挑一个看它的后半段。</>}
              en={<>This family has {firstLook.length} ZBLS cases, and every one of them can be followed by
                any of the {ZBLL_CASE_COUNT} ZBLL cases — {(firstLook.length * ZBLL_CASE_COUNT).toLocaleString()}{' '}
                routes in all. Pick one to see its second look.</>}
            />
          </p>
          <div className="alg-bento">
            {firstLook.map((c) => (
              <AlgCard
                key={c.code}
                href={`/alg/lsll/${family}?cls=3&z=${c.code}`}
                prefetch={false}
                thumb={<FaceletsCube fd={zblsCardFacelets(c.id)} size={96} alt={c.code} />}
                title={zblsName(c.code)}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="lsll-route-head">
            <FaceletsCube fd={zblsCardFacelets(valid.id)} size={92} alt={valid.code} />
            <div>
              <div className="lsll-route-head-name">{zblsName(valid.code)}</div>
              <div className="lsll-note">
                {tr({ zh: `顶层翻棱 ${valid.eoBad}`, en: `${valid.eoBad} bad edges` })}
                {valid.stab > 1 && ` · ${tr({ zh: `pre-AUF ${valid.stab} 重对称`, en: `${valid.stab}-fold pre-AUF symmetry` })}`}
              </div>
              {(zblsLibRefs(valid.id) ?? []).map((r) => (
                <Link key={r.slug || r.name} href={`/alg/3x3/zbls/${r.slug}`} prefetch={false} className="lsll-route-liblink">
                  {tr({ zh: `ZBLS 库:${r.subgroup} ${r.name}(${r.algCount} 条公式)`, en: `ZBLS library: ${r.subgroup} ${r.name} (${r.algCount} algs)` })}
                </Link>
              ))}
            </div>
          </div>

          <p className="lsll-alg-note">
            <T
              zh={<>做完之后剩下的 {ZBLL_CASE_COUNT} 个 ZBLL case —— 每一个都是一条不同的两步路线。</>}
              en={<>The {ZBLL_CASE_COUNT} ZBLL cases you can be left with — each one a distinct two-look route.</>}
            />
          </p>

          <div className="lsll-case-grid">
            {slice.map((k) => {
              const ks = keyToString(k);
              const label = zbllShortLabel(zbllLibRefs(ks)?.[0]);
              return (
                <Link
                  key={k}
                  href={`/alg/lsll/route?z=${valid.code}&l=${ks}`}
                  className="lsll-case-card"
                  prefetch={false}
                >
                  <FaceletsCube fd={zbllCardFacelets(k)} size={80} view="plan" alt={label ?? ks} />
                  <span className="lsll-case-body">
                    <span className="lsll-case-label">{label ?? tr({ zh: '已解', en: 'Solved' })}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="lsll-pager">
            <button type="button" className="lsll-pager-btn" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>
              {tr({ zh: '上一页', en: 'Prev' })}
            </button>
            <span>{cur} / {pageCount}</span>
            <button type="button" className="lsll-pager-btn" disabled={cur >= pageCount} onClick={() => setPage(cur + 1)}>
              {tr({ zh: '下一页', en: 'Next' })}
            </button>
            <span>{zbll.length} {tr({ zh: '条路线', en: 'routes' })}</span>
          </div>
        </>
      )}
    </>
  );
}
