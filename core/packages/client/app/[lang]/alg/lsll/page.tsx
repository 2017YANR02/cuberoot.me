'use client';

/**
 * /alg/lsll — LSLL(Last Slot and Last Layer)公式集首页。
 * 583,284 个 case,42 个大类(命名沿用 zbls 公式集字母);
 * 求解 / MCC 管道回填前,浏览与定位先行可用。
 */
import { useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr, T } from '@/i18n/tr';
import { ClearButton } from '@/components/ClearButton';
import { FaceletsCube } from '@/components/FaceletsCube';
import AlgCard from '@/components/AlgCard';
import {
  CATEGORIES, TOTAL_CASES, categoryCardFacelets, locateFromScramble,
  type CategoryKind, type LocateResult,
} from '@/lib/lsll/model';
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

  const groups = useMemo(() => {
    const m = new Map<CategoryKind, typeof CATEGORIES>();
    for (const kind of KIND_ORDER) {
      m.set(kind, CATEGORIES.filter((c) => c.kind === kind).sort((a, b) => a.letter.localeCompare(b.letter)));
    }
    return m;
  }, []);

  const locate = () => setResult(locateFromScramble(query));

  return (
    <div className="alg-root">
      <div className="alg-cat-header">
        <Link href="/alg/3x3" className="alg-back">
          <ArrowLeft size={14} /> {tr({ zh: '返回', en: 'Back' })}
        </Link>
        <h1 className="alg-cat-title">
          <span>LSLL <span className="alg-cat-count">{TOTAL_CASES.toLocaleString()} {tr({ zh: '个', en: 'cases' })}</span></span>
        </h1>
      </div>

      <p className="lsll-intro">
        <T
          zh={<>最后一槽 + 顶层一步解(Last Slot and Last Layer)。不计首尾 AUF,数量
            <Link href="/math/lsll">看推导 →</Link>,按槽对构型分 42 个大类,大类命名沿用
            ZBLS 公式集。最优解与 MCC 推荐公式由后台管道逐步回填。</>}
          en={<>Solve the last slot and last layer in one look. Ignoring pre/post AUF; for the count{' '}
            <Link href="/math/lsll">see the derivation →</Link>. Organised into 42 families by pair
            configuration, named after the ZBLS set. Optimal and MCC-ranked algorithms are being
            backfilled by the offline pipeline.</>}
        />
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
                href={`/alg/lsll/${cat.slug}`}
                prefetch={false}
                thumb={<FaceletsCube fd={categoryCardFacelets(cat.slug)} size={96} alt={cat.letter} />}
                title={cat.letter}
                count={cat.count.toLocaleString()}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
