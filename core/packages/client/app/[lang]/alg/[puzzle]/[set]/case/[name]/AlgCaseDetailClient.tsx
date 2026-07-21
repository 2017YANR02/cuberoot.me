'use client';

/**
 * case 元数据**独立详情页**(/alg/<puzzle>/<set>/case/<name>)—— 取代原来列表页里的弹窗。
 *
 * 数据:浏览器里 `loadAlg(puzzle, set)` 拉整个 set(和列表页同一份 JSON,已被浏览器缓存),
 * 再 `findCaseByHash` 认回是哪张 case;`byNo` 给镜像/逆做详情页之间的链接。
 * 正文完全复用 {@link AlgCaseMetaContent},关联缩略图走 `jump:'link'`(真 <a>,中键可新开)。
 */
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from '@/components/AppLink';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { loadAlg, type AlgCase, type AlgCaseMeta, type AlgFile, type AlgPuzzle } from '@cuberoot/shared';
import AlgCaseMetaContent from '@/components/AlgCaseMetaContent';
import { algCaseHref, algCaseDetailHref, findCaseByHash } from '@/lib/alg_case_link';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr } from '@/i18n/tr';
import '../../../../alg.css';

export default function AlgCaseDetailClient() {
  // Sentinel shell: page.tsx prerenders only /alg/_/_/case/_ and a next.config rewrite
  // routes every real URL to it, so useParams would yield the "_" sentinels — the real
  // puzzle/set/name come from window.location. null until mounted → SSR renders the
  // loading shell (byte-identical for every case), avoiding a hydration mismatch.
  const pathname = usePathname();
  const [route, setRoute] = useState<{ puzzle: string; set: string; name: string } | null>(null);
  useEffect(() => {
    const m = window.location.pathname.match(/\/alg\/([^/]+)\/([^/]+)\/case\/([^/?#]+)/);
    setRoute(m ? {
      puzzle: decodeURIComponent(m[1]),
      set: decodeURIComponent(m[2]),
      name: decodeURIComponent(m[3]),
    } : null);
  }, [pathname]);
  const puzzle = route?.puzzle ?? '';
  const set = route?.set ?? '';
  const name = route?.name ?? '';

  const [data, setData] = useState<AlgFile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    setData(null);
    if (!puzzle || !set) return;
    let live = true;
    loadAlg(puzzle as AlgPuzzle, set)
      .then(d => { if (live) setData(d); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [puzzle, set]);

  const caseObj = useMemo(
    () => (data ? findCaseByHash(data.cases, name, puzzle, set) : null),
    [data, name, puzzle, set],
  );

  /** meta.no → case,给关联(镜像/逆/镜像逆)做详情页之间的链接(表编号,不是 DB id) */
  const byNo = useMemo(() => {
    const map = new Map<number, AlgCase>();
    for (const c of data?.cases ?? []) if (c.meta?.no != null) map.set(c.meta.no, c);
    return map;
  }, [data]);

  const m = caseObj?.meta as AlgCaseMeta | undefined;
  const title = caseObj ? (m?.ollcp ? `${m.ollcp} ${caseObj.name}` : caseObj.name) : 'Case';
  useDocumentTitle(title, title);

  // 「返回」指向 case 所在的列表页(带 #name 高亮那张卡)—— 是有明确目标的导航链接,
  // 不是无意义的 history.back;数据没到就先回 set 根。
  const backHref = caseObj ? algCaseHref(puzzle, set, caseObj) : `/alg/${puzzle}/${set}`;

  return (
    <div className="alg-case-detail">
      <div className="alg-case-detail-head">
        <Link href={backHref} className="alg-case-detail-back" prefetch={false}>
          <ArrowLeft size={16} />
          <span>{tr({ zh: '返回', en: 'Back' })}</span>
        </Link>
        {caseObj && (
          <h1 className="alg-case-detail-title">
            {m?.ollcp}
            <span className="alg-meta-head-sub">{caseObj.name}</span>
            <Link href={backHref} className="alg-meta-head-open" prefetch={false} title={tr({ zh: '在列表中打开', en: 'Open in the list' })}>
              <ExternalLink size={14} />
            </Link>
          </h1>
        )}
      </div>

      {error && <p className="alg-case-detail-msg">{tr({ zh: '加载失败', en: 'Failed to load.' })}</p>}
      {!error && !data && <p className="alg-case-detail-msg">{tr({ zh: '加载中…', en: 'Loading…' })}</p>}
      {data && !m && <p className="alg-case-detail-msg">{tr({ zh: '没找到这个 case 的元数据', en: 'No metadata for this case.' })}</p>}

      {caseObj?.meta && (
        <div className="alg-meta-body alg-case-detail-body">
          <AlgCaseMetaContent
            caseObj={caseObj}
            puzzle={puzzle as AlgPuzzle}
            set={set}
            byNo={byNo}
            jump={{ kind: 'link', href: c => algCaseDetailHref(puzzle, set, c) }}
          />
        </div>
      )}
    </div>
  );
}
