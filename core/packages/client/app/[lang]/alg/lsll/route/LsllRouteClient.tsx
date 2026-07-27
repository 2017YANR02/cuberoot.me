'use client';

/**
 * /alg/lsll/route?z=<φ base36>&l=<ZBLL key base36> — 单条两步路线。
 *
 * 路线 = 有序对(ZBLS case, ZBLL case)。两半都规范(与公式表无关),所以本页只讲这两张图
 * 和它们在站内公式库里的位置;不合成"整条解法",因为那要先钦定一条 ZBLS 公式,
 * 而那正是三类不能拿 mid-AUF 再商一次的原因(/math/lsll §3)。
 */
import { useMemo } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import Link from '@/components/AppLink';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr, T } from '@/i18n/tr';
import { FaceletsCube } from '@/components/FaceletsCube';
import { categoryBySlug, keyFromString, keyToString } from '@/lib/lsll/model';
import {
  allZbllCases, zblsCaseByCode, zblsCardFacelets, zbllCardFacelets,
  zblsLibRefs, zbllLibRefs, zbllFullLabel,
} from '@/lib/lsll/class3';
import '../../alg.css';
import '../lsll.css';

export default function LsllRouteClient() {
  const [zRaw] = useQueryState('z', parseAsString.withDefault(''));
  const [lRaw] = useQueryState('l', parseAsString.withDefault(''));

  const zbls = zRaw ? zblsCaseByCode(zRaw) : undefined;
  const zbllKey = useMemo(() => {
    const k = keyFromString(lRaw);
    return k !== null && allZbllCases().includes(k) ? k : null;
  }, [lRaw]);

  const cat = zbls ? categoryBySlug(zbls.family) : undefined;
  useDocumentTitle(
    cat ? `LSLL ${cat.letter} 两步路线` : 'LSLL 两步路线',
    cat ? `LSLL ${cat.letter} two-look route` : 'LSLL two-look route',
  );

  if (!zbls || zbllKey === null || !cat) {
    return (
      <div className="alg-root">
        <div className="alg-empty">
          <T zh="无效的路线编号" en="Invalid route id" />
          {' — '}
          <Link href="/alg/lsll?cls=3">LSLL</Link>
        </div>
      </div>
    );
  }

  const zblsRefs = zblsLibRefs(zbls.id) ?? [];
  const zbllRefs = zbllLibRefs(keyToString(zbllKey)) ?? [];

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href={`/alg/lsll/${cat.slug}?cls=3&z=${zbls.code}`} className="alg-back">
          <ArrowLeft size={14} /> {cat.letter}
        </Link>
        <h1 className="alg-cat-title">
          <span>{tr({ zh: '两步路线', en: 'Two-look route' })}</span>
        </h1>
      </div>

      <div className="lsll-route-panels">
        <section className="lsll-route-panel">
          <div className="lsll-train-label">{tr({ zh: '第一眼:ZBLS', en: 'First look: ZBLS' })}</div>
          <FaceletsCube fd={zblsCardFacelets(zbls.id)} size={150} alt="ZBLS" />
          <div className="lsll-route-panel-name">
            {zblsRefs[0] ? `${zblsRefs[0].subgroup} ${zblsRefs[0].name}` : tr({ zh: '槽已解、棱已正', en: 'Slot in, edges oriented' })}
          </div>
          <div className="lsll-note">
            {tr({ zh: `顶层翻棱 ${zbls.eoBad}`, en: `${zbls.eoBad} bad edges` })}
          </div>
          {zblsRefs.map((r) => (
            <Link key={r.slug || r.name} href={`/alg/3x3/zbls/${r.slug}`} prefetch={false} className="lsll-zbls-ref">
              <span className="lsll-zbls-name">ZBLS {r.name}</span>
              <span className="lsll-zbls-count">
                {tr({ zh: `${r.algCount} 条公式`, en: `${r.algCount} alg${r.algCount === 1 ? '' : 's'}` })}
              </span>
            </Link>
          ))}
        </section>

        <ArrowRight className="lsll-route-sep" size={22} aria-hidden="true" />

        <section className="lsll-route-panel">
          <div className="lsll-train-label">{tr({ zh: '第二眼:ZBLL', en: 'Second look: ZBLL' })}</div>
          <FaceletsCube fd={zbllCardFacelets(zbllKey)} size={150} view="plan" alt="ZBLL" />
          <div className="lsll-route-panel-name">
            {zbllFullLabel(zbllRefs[0]) ?? tr({ zh: '已解(跳过)', en: 'Solved (skip)' })}
          </div>
          {zbllRefs.map((r) => (
            <Link key={r.slug || r.name} href={`/alg/3x3/${r.set}/${r.slug}`} prefetch={false} className="lsll-zbls-ref">
              <span className="lsll-zbls-name">{zbllFullLabel(r)}</span>
              <span className="lsll-zbls-count">
                {tr({ zh: `${r.algCount} 条公式`, en: `${r.algCount} alg${r.algCount === 1 ? '' : 's'}` })}
              </span>
            </Link>
          ))}
        </section>
      </div>

      <section className="lsll-section">
        <p className="lsll-note">
          <T
            zh={<>149,188 条路线里的一条(302 × 494)。两半各自规范,所以这个数与你用哪本公式表无关 ——
              但<strong>整条</strong>解法不规范:换一条 ZBLS 公式,同一个局面会落到不同的 ZBLL case 上,
              所以本页不给「合起来那条公式」。<Link href="/math/lsll">看清楚为什么 →</Link></>}
            en={<>One of the 149,188 routes (302 × 494). Both halves are canonical, so that count does not
              depend on your algorithm table — but the <em>combined</em> solution is not: swap the ZBLS alg
              and the same position lands on a different ZBLL case, which is why no concatenated algorithm
              is shown here. <Link href="/math/lsll">See exactly why →</Link></>}
          />
        </p>
      </section>
    </div>
  );
}
