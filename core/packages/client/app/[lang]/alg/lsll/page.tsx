'use client';

/**
 * /alg/lsll — LSLL(Last Slot and Last Layer)公式集首页。
 * 42 个大类(命名沿用 zbls 公式集字母);求解 / MCC 管道回填前,浏览与定位先行可用。
 *
 * 一步 / 两步开关(`?cls=`):
 *  - 一步(二类)= 583,284 个**局面**,商掉首尾 AUF —— 一条公式直接解完。
 *  - 两步(三类)= 151,164 条**路线** = 306 个 ZBLS case × 494 个 ZBLL case。
 * 三类不是二类的商(mid-AUF 不作用在局面上),推导见 /math/lsll §3、lib/lsll/class3.ts。
 */
import { useMemo, useState } from 'react';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import Link from '@/components/AppLink';
import { ArrowLeft, Dumbbell } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr, T } from '@/i18n/tr';
import { ClearButton } from '@/components/ClearButton';
import { FaceletsCube } from '@/components/FaceletsCube';
import AlgCard from '@/components/AlgCard';
import PillToggle from '@/components/PillToggle/PillToggle';
import {
  CATEGORIES, TOTAL_CASES, categoryCardFacelets, locateFromScramble, decodeKey,
  type CategoryKind, type LocateResult,
} from '@/lib/lsll/model';
import { TOTAL_CASES_CLASS3, class3CountForFamily, phiOfState } from '@/lib/lsll/class3';
import { compareAlgGroupLabel } from '@/lib/alg_group_order';
import '../alg.css';
import './lsll.css';

const KIND_LABELS: Record<CategoryKind, { zh: string; en: string }> = {
  TT: { zh: '角棱都在顶层', en: 'Corner & edge on top' },
  CS: { zh: '角在槽,棱在顶层', en: 'Corner in slot' },
  ES: { zh: '棱在槽,角在顶层', en: 'Edge in slot' },
  SS: { zh: '角棱都在槽内', en: 'Pair in slot' },
};
const KIND_ORDER: CategoryKind[] = ['TT', 'CS', 'ES', 'SS'];

export default function LsllHubPage() {
  useDocumentTitle('LSLL 公式集', 'LSLL Algorithms');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LocateResult | null>(null);
  const [cls, setCls] = useQueryState(
    'cls',
    parseAsStringEnum(['2', '3']).withDefault('2').withOptions({ history: 'push' }),
  );
  const twoLook = cls === '3';
  const suffix = twoLook ? '?cls=3' : '';

  const groups = useMemo(() => {
    const m = new Map<CategoryKind, typeof CATEGORIES>();
    for (const kind of KIND_ORDER) {
      m.set(kind, CATEGORIES.filter((c) => c.kind === kind)
        .sort((a, b) => compareAlgGroupLabel(a.letter, b.letter)));
    }
    return m;
  }, []);

  const locate = () => setResult(locateFromScramble(query));

  // 两步模式下顺带报出这条打乱的 ZBLS case(= 第一眼要认的那张图,与公式表无关)。
  const hitPhi = useMemo(() => {
    if (!result?.ok) return null;
    const st = decodeKey(result.key);
    return st ? phiOfState(st).toString(36) : null;
  }, [result]);

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href="/alg/3x3" className="alg-back">
          <ArrowLeft size={14} /> {tr({ zh: '返回', en: 'Back' })}
        </Link>
        <h1 className="alg-cat-title">
          <span>LSLL <span className="alg-cat-count">
            {(twoLook ? TOTAL_CASES_CLASS3 : TOTAL_CASES).toLocaleString()}{' '}
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
        {/* 训练走全站同一个训练器(与 /alg/3x3/zbll/run 同一个页面);不带范围 = 已收录公式那批 */}
        <Link href="/alg/3x3/lsll/run" className="lsll-train-btn" prefetch={false}>
          <Dumbbell size={15} /> {tr({ zh: '训练', en: 'Train' })}
        </Link>
      </div>

      <p className="lsll-intro">
        {twoLook ? (
          <T
            zh={<>两步解最后一槽 + 顶层:先认一个 <Link href="/alg/3x3/zbls">ZBLS</Link> case
              做进槽并翻正顶层棱,再认一个 <Link href="/alg/3x3/zbll">ZBLL</Link> case 收尾。
              路线数 = 306 × 494 = 151,164,与用哪本公式表无关
              (<Link href="/math/lsll">为什么不能拿 AUF 再商一次 →</Link>)。</>}
            en={<>Two looks for the last slot and last layer: recognise a{' '}
              <Link href="/alg/3x3/zbls">ZBLS</Link> case to insert the pair and orient the LL edges,
              then a <Link href="/alg/3x3/zbll">ZBLL</Link> case to finish. Routes = 306 × 494 =
              151,164, whichever algorithm table you use
              (<Link href="/math/lsll">why a third AUF quotient does not work →</Link>).</>}
          />
        ) : (
          <T
            zh={<>最后一槽 + 顶层一步解(Last Slot and Last Layer)。不计首尾 AUF,数量
              <Link href="/math/lsll">看推导 →</Link>,按槽对构型分 42 个大类,大类命名沿用
              ZBLS 公式集。最优解与 MCC 推荐公式由后台管道逐步回填。</>}
            en={<>Solve the last slot and last layer in one look. Ignoring pre/post AUF; for the count{' '}
              <Link href="/math/lsll">see the derivation →</Link>. Organised into 42 families by pair
              configuration, named after the ZBLS set. Optimal and MCC-ranked algorithms are being
              backfilled by the offline pipeline.</>}
          />
        )}
      </p>

      <div className="lsll-locate">
        <span className="lsll-locate-field">
          <input
            className="lsll-locate-input"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setResult(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) locate(); }}
            placeholder={tr({ zh: '粘贴打乱定位 case,如 R U R\' U\'', en: "Paste a scramble, e.g. R U R' U'" })}
            spellCheck={false}
          />
          {query && <ClearButton onClick={() => { setQuery(''); setResult(null); }} />}
        </span>
        <button type="button" className="lsll-locate-btn" disabled={!query.trim()} onClick={locate}>
          {tr({ zh: '定位', en: 'Locate' })}
        </button>
      </div>
      {result && !result.ok && (
        <div className="lsll-locate-error">
          {result.reason === 'bad-token' && <T zh={<>无法解析:{result.detail}(只支持 U R F D L B 面转)</>} en={<>Cannot parse: {result.detail} (face turns U R F D L B only)</>} />}
          {result.reason === 'not-lsll' && <T zh={<>不是 LSLL 状态,以下块未还原:{result.detail}(需十字 + 前三槽完成,FR 为最后槽)</>} en={<>Not an LSLL state — broken pieces: {result.detail} (cross + first three slots must be solved, FR is the last slot)</>} />}
          {result.reason === 'empty' && <T zh="请输入打乱" en="Enter a scramble" />}
        </div>
      )}
      {result?.ok && (
        <div className="lsll-locate-hit">
          <span>{tr({ zh: '命中大类', en: 'Family' })} {result.category.letter}</span>
          {twoLook && hitPhi && (
            <Link href={`/alg/lsll/${result.category.slug}?cls=3&z=${hitPhi}`} prefetch={false}>
              {tr({ zh: '这条路线的 ZBLS case →', en: 'Its ZBLS case →' })}
            </Link>
          )}
          <Link href={`/alg/lsll/case?k=${result.keyStr}`} prefetch={false}>
            {tr({ zh: '打开 case', en: 'Open case' })} #{result.keyStr}
          </Link>
        </div>
      )}

      {KIND_ORDER.map((kind) => (
        <section key={kind}>
          <h2 className="lsll-kind-title">
            {tr(KIND_LABELS[kind])}
            <span className="lsll-kind-count">{groups.get(kind)!.length} {tr({ zh: '类', en: 'families' })}</span>
          </h2>
          <div className="alg-bento">
            {groups.get(kind)!.map((cat) => (
              <AlgCard
                key={cat.slug}
                href={`/alg/lsll/${cat.slug}${suffix}`}
                prefetch={false}
                thumb={<FaceletsCube fd={categoryCardFacelets(cat.slug)} size={96} alt={cat.letter} />}
                title={cat.letter}
                count={(twoLook ? class3CountForFamily(cat.slug) : cat.count).toLocaleString()}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
