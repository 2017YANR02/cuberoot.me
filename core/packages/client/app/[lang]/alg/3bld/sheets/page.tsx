'use client';

// 公式表名录 —— BLDDB 导航栏 Tools → Sheets 的本站版。
//
// 库里每条公式都记了「谁在用」,这一页把那批人反过来列:他们公开的公式表链接、WCA ID、
// 三盲 / 四盲单次。查一个 case 时看到某人用的写法顺眼,就从这儿翻他整张表。
//
// 数据是 sourceToUrl.json + sourceToResult.json(加起来 24KB,随 fork 同步下来的),
// 不是我们自己维护的名单 —— 要加自己的表得去上游 nbwzx/blddb 提。

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { ExternalLink } from 'lucide-react';
import Link from '@/components/AppLink';
import { SearchInput } from '@/components/SearchInput';
import { Spinner } from '@/components/Spinner/Spinner';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { SortArrow } from '@/components/SortArrow';
import { tr } from '@/i18n/tr';
import { loadSourceToResult, loadSourceToUrl, type SourceToResult, type SourceToUrl } from '../_lib/blddb';
import '@/components/sticky-table.css';
import '../3bld.css';

/** 表里那几种链接键 —— 上游按 case 类型分,再加两个通用兜底。 */
const LINK_KEYS = ['bld', '3bld', 'bigbld', 'corner', 'edge', 'parity', 'ltct', 'twists', 'flips'] as const;

const LINK_LABEL: Record<(typeof LINK_KEYS)[number], { zh: string; en: string }> = {
  bld: { zh: '盲拧', en: 'BLD' },
  '3bld': { zh: '三盲', en: '3BLD' },
  bigbld: { zh: '高盲', en: 'Big BLD' },
  corner: { zh: '角块', en: 'Corner' },
  edge: { zh: '棱块', en: 'Edge' },
  parity: { zh: '奇偶', en: 'Parity' },
  ltct: { zh: '奇偶带翻', en: 'LTCT' },
  twists: { zh: '翻角', en: 'Twists' },
  flips: { zh: '翻棱', en: 'Flips' },
};

const SORT_KEYS = ['name', '3bld', '4bld'] as const;
type SortKey = (typeof SORT_KEYS)[number];

interface Row {
  name: string;
  wcaId?: string;
  best3: number | null;
  best4: number | null;
  links: { key: string; url: string }[];
}

/** 百分秒 → 读得出来的成绩。 */
function formatCentis(v: number): string {
  const total = Math.round(v) / 100;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return m > 0 ? `${m}:${s.toFixed(2).padStart(5, '0')}` : s.toFixed(2);
}

export default function BlddbSheetsPage(): JSX.Element {
  const [sourceUrl, setSourceUrl] = useState<SourceToUrl | null>(null);
  const [sourceResult, setSourceResult] = useState<SourceToResult | null>(null);
  const [failed, setFailed] = useState(false);

  const [q, setQ] = useQueryState('q', { defaultValue: '' });
  const [sort, setSort] = useQueryState('sort', parseAsStringEnum<SortKey>([...SORT_KEYS]).withDefault('3bld'));
  const [desc, setDesc] = useQueryState('desc', { defaultValue: '' });

  useEffect(() => {
    let alive = true;
    Promise.all([loadSourceToUrl(), loadSourceToResult()])
      .then(([u, r]) => { if (alive) { setSourceUrl(u); setSourceResult(r); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const rows = useMemo((): Row[] => {
    if (!sourceUrl) return [];
    return Object.entries(sourceUrl).map(([name, urls]) => {
      const res = sourceResult?.[name];
      return {
        name,
        wcaId: res?.wca_id,
        best3: res?.['3bld'] ?? null,
        best4: res?.['4bld'] ?? null,
        links: LINK_KEYS.filter((k) => urls[k]).map((k) => ({ key: k, url: urls[k] })),
      };
    });
  }, [sourceUrl, sourceResult]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle === ''
      ? rows
      : rows.filter((r) => r.name.toLowerCase().includes(needle) || (r.wcaId ?? '').toLowerCase().includes(needle));
    const dir = desc === '1' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return dir * a.name.localeCompare(b.name);
      const key = sort === '3bld' ? 'best3' : 'best4';
      const x = a[key];
      const y = b[key];
      // 没成绩的一律排最后,不管升序降序 —— 否则升序时整屏都是空行。
      if (x === null && y === null) return a.name.localeCompare(b.name);
      if (x === null) return 1;
      if (y === null) return -1;
      return dir * (x - y);
    });
  }, [rows, q, sort, desc]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) void setDesc(desc === '1' ? null : '1');
    else { void setSort(key); void setDesc(null); }
  };

  const header = (key: SortKey, label: { zh: string; en: string }) => (
    <th>
      <button type="button" className="bld-sh-sort" onClick={() => toggleSort(key)}>
        {tr(label)}
        <SortArrow active={sort === key} dir={desc === '1' ? 'desc' : 'asc'} />
      </button>
    </th>
  );

  return (
    <div className="bld-trainer-root">
      <div className="bld-topbar">
        <h1>
          <EventIcon event="333bf" /> {tr({ zh: '盲拧公式表名录', en: 'BLD Algorithm Sheets' })}
        </h1>
        <Link href="/alg/3bld/lookup" className="bld-hub-secondary" prefetch={false}>
          {tr({ zh: '公式查询', en: 'Lookup' })}
        </Link>
        <span className="bld-spacer" />
        <Link href="/blddb" className="bld-hub-secondary" prefetch={false}>
          {tr({ zh: 'BLDDB 完整库', en: 'Full BLDDB' })}
        </Link>
      </div>

      <p className="bld-input-summary">
        {tr({
          zh: '公式查询里每个 case 都列了「谁在用」,这一页把那些人的公开公式表汇总起来,可按三盲 / 四盲成绩排。名单由上游 BLDDB 维护,要加自己的表去它的仓库提。',
          en: 'The lookup lists who uses each algorithm; this page collects those people’s public sheets, sortable by 3BLD or 4BLD single. The list is maintained upstream at BLDDB — submit your own sheet there.',
        })}
      </p>

      <div className="bld-comm-toolbar">
        <SearchInput
          value={q}
          onChange={(v) => void setQ(v)}
          className="bld-comm-search-wrap"
          inputClassName="bld-comm-search"
          placeholder={tr({ zh: '搜名字或 WCA ID', en: 'Search name or WCA ID' })}
          ariaLabel={tr({ zh: '搜索', en: 'Search' })}
        />
        <span className="bld-db-count">
          {tr({ zh: `${shown.length} 份公式表`, en: `${shown.length} sheets` })}
        </span>
      </div>

      {failed && (
        <p className="bld-db-empty">{tr({ zh: '名录没拉下来,刷新再试。', en: 'Could not load the list — try reloading.' })}</p>
      )}
      {!failed && rows.length === 0 && (
        <div className="bld-db-empty"><Spinner size={18} label={tr({ zh: '加载中', en: 'Loading' })} /></div>
      )}

      {shown.length > 0 && (
        <div className="sticky-scroll bld-sh-scroll">
          <table className="sticky-thead bld-sh-table">
            <thead>
              <tr>
                {header('name', { zh: '名字', en: 'Name' })}
                <th>WCA ID</th>
                {header('3bld', { zh: '三盲', en: '3BLD' })}
                {header('4bld', { zh: '四盲', en: '4BLD' })}
                <th>{tr({ zh: '公式表', en: 'Sheets' })}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="bld-sh-mono">
                    {r.wcaId ? (
                      <Link href={`/wca/persons/${r.wcaId}`} prefetch={false}>{r.wcaId}</Link>
                    ) : null}
                  </td>
                  <td className="bld-sh-mono">{r.best3 === null ? '' : formatCentis(r.best3)}</td>
                  <td className="bld-sh-mono">{r.best4 === null ? '' : formatCentis(r.best4)}</td>
                  <td>
                    <div className="bld-sh-links">
                      {r.links.map(({ key, url }) => (
                        <a key={key} href={url} target="_blank" rel="noopener noreferrer">
                          {tr(LINK_LABEL[key as keyof typeof LINK_LABEL] ?? { zh: key, en: key })}
                          <ExternalLink size={11} />
                        </a>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
