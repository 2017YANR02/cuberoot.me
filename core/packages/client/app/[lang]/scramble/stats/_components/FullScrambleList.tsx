'use client';

// 难度页「查看全部」：点开后列出该 (方法,阶段,子集,步数) 的**全部** WCA 真题,
// 带比赛名搜索 + 日期范围筛选 + 分页加载。复用示例行的视觉(色点 + 2D 打乱图 + 比赛链)。
import { useEffect, useRef, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import Link from '@/components/AppLink';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import { ClearButton } from '@/components/ClearButton';
import { compSourceLine } from '@/lib/comp-schedule';
import { localizeCompName } from '@/lib/comp-localize';
import { compFlagIso2 } from '@/lib/country-flags';
import { COLOR_HEX, type ColorLetter } from '@/components/SubsetColorPicker/SubsetColorPicker';
import { tr } from '@/i18n/tr';
import {
  fetchByDifficulty, BY_DIFFICULTY_PAGE_SIZE,
  type ByDifficultyRow,
} from '@/lib/scramble-by-difficulty';

const COLS_ORDER: ColorLetter[] = ['B', 'G', 'O', 'R', 'W', 'Y'];

// 当前子集底色里取 argmin 的那个颜色(画底色色点);子集为空或无值 → null。
function bottomColor(cols: number[], subsetKey: string): ColorLetter | null {
  const inSubset = new Set(subsetKey.split('') as ColorLetter[]);
  let best: ColorLetter | null = null;
  let bestV = Infinity;
  for (let i = 0; i < COLS_ORDER.length; i++) {
    const c = COLS_ORDER[i];
    const v = cols[i];
    if (inSubset.has(c) && v != null && v < bestV) { bestV = v; best = c; }
  }
  return best;
}

interface FullScrambleListProps {
  apiEvent?: string;     // undefined = 合并池(全 3x3-family)
  variant: string;
  stage: string;
  colors: string;        // 子集 key
  bin: number;
  lang: 'zh' | 'en';
  isZh: boolean;
  exView: 'orig' | 'opt';
}

export default function FullScrambleList({
  apiEvent, variant, stage, colors, bin, lang, isZh, exView,
}: FullScrambleListProps) {
  const [open, setOpen] = useState(false);
  // 筛选进 URL(replace,不堆历史);键加 f 前缀避免与页面其它参数撞名。
  const [q, setQ] = useQueryState('fq', parseAsString.withDefault(''));
  const [from, setFrom] = useQueryState('ffrom', parseAsString.withDefault(''));
  const [to, setTo] = useQueryState('fto', parseAsString.withDefault(''));

  const [rows, setRows] = useState<ByDifficultyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const reqId = useRef(0);

  // 关键输入或筛选变化 → 回到第 1 页重拉(q 防抖 300ms)。
  useEffect(() => {
    if (!open) return;
    const myReq = ++reqId.current;
    setLoading(true);
    setFailed(false);
    const t = setTimeout(() => {
      void fetchByDifficulty({
        variant, stage, colors, bin, event: apiEvent,
        q: q || undefined, from: from || undefined, to: to || undefined,
        page: 1, pageSize: BY_DIFFICULTY_PAGE_SIZE,
      }).then((res) => {
        if (myReq !== reqId.current) return;
        if (!res) { setFailed(true); setRows([]); setTotal(0); }
        else { setRows(res.scrambles); setTotal(res.total); setPage(1); }
        setLoading(false);
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, variant, stage, colors, bin, apiEvent, q, from, to]);

  const loadMore = () => {
    const next = page + 1;
    const myReq = ++reqId.current;
    setLoading(true);
    void fetchByDifficulty({
      variant, stage, colors, bin, event: apiEvent,
      q: q || undefined, from: from || undefined, to: to || undefined,
      page: next, pageSize: BY_DIFFICULTY_PAGE_SIZE,
    }).then((res) => {
      if (myReq !== reqId.current) return;
      if (res) { setRows((r) => [...r, ...res.scrambles]); setTotal(res.total); setPage(next); }
      setLoading(false);
    });
  };

  if (!open) {
    return (
      <button type="button" className="scramble-stats-fulllist-open" onClick={() => setOpen(true)}>
        {tr({ zh: '查看全部', en: 'View all' })}
      </button>
    );
  }

  const hasMore = rows.length < total;
  return (
    <div className="scramble-stats-fulllist">
      <div className="scramble-stats-fulllist-bar">
        <span className="scramble-stats-fulllist-count">
          {tr({ zh: '共 {n} 条', en: '{n} total' }).replace('{n}', total.toLocaleString())}
        </span>
        <div className="scramble-stats-fulllist-search">
          <input
            type="text"
            value={q}
            onChange={(e) => void setQ(e.target.value)}
            placeholder={tr({ zh: '搜索比赛名', en: 'Search competition' })}
            className="scramble-stats-fulllist-input"
            aria-label={tr({ zh: '搜索比赛名', en: 'Search competition' })}
          />
          {q && <ClearButton onClick={() => void setQ('')} isZh={isZh} variant="inline" />}
        </div>
        <label className="scramble-stats-fulllist-date">
          <span>{tr({ zh: '从', en: 'From' })}</span>
          <input type="date" value={from} onChange={(e) => void setFrom(e.target.value)} />
        </label>
        <label className="scramble-stats-fulllist-date">
          <span>{tr({ zh: '到', en: 'To' })}</span>
          <input type="date" value={to} onChange={(e) => void setTo(e.target.value)} />
        </label>
        <button type="button" className="scramble-stats-fulllist-close" onClick={() => setOpen(false)}>
          {tr({ zh: '收起', en: 'Collapse' })}
        </button>
      </div>

      {failed && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '加载失败', en: 'Load failed' })}</div>
      )}
      {!failed && rows.length === 0 && !loading && (
        <div className="scramble-stats-examples-hint">{tr({ zh: '无匹配真题', en: 'No matching scrambles' })}</div>
      )}

      {rows.length > 0 && (
        <ul className="scramble-stats-examples-list">
          {rows.map((row, i) => {
            const disp = ((exView === 'opt' && row.o) ? row.o : row.scramble).trim();
            const color = bottomColor(row.cols, colors);
            const iso2 = compFlagIso2(row.ci);
            const href = `/${lang}/scramble/analyzer?${new URLSearchParams({ scramble: disp.replace(/ /g, '_') })}`;
            return (
              <li key={`${row.ci}-${row.r}-${row.g}-${row.n}-${row.x}-${i}`}>
                {color && (
                  <span
                    className="scramble-stats-examples-chip"
                    style={{ background: COLOR_HEX[color] ?? '#888' }}
                    title={tr({ zh: '朝下的底色', en: 'Bottom color' })}
                  />
                )}
                <Link className="scramble-stats-examples-cube" href={href} prefetch={false} aria-label={tr({ zh: '打乱图', en: 'Scramble image' })}>
                  <ScramblePreview2D event="333" scramble={disp} size={26} />
                </Link>
                <div className="scramble-stats-examples-body">
                  <Link className="scramble-stats-examples-scramble" href={href} prefetch={false}>{disp}</Link>
                  <Link
                    className="scramble-stats-examples-comp"
                    href={`/${lang}/scramble/gen?comp=${encodeURIComponent(row.ci)}`}
                    prefetch={false}
                    title={row.cn}
                  >
                    {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                    <span className="scramble-stats-examples-comp-name">{localizeCompName(row.ci, row.cn, isZh)}</span>
                    <span className="scramble-stats-examples-comp-meta">
                      <EventIcon event={row.e} className="scramble-stats-examples-evt" title={row.e} />
                      <span>{compSourceLine(row.r, row.g, row.n, isZh, !!row.x)}</span>
                      {row.cd && <span>{row.cd}</span>}
                    </span>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {loading && <div className="scramble-stats-examples-hint">{tr({ zh: '加载中…', en: 'Loading…' })}</div>}
      {!loading && hasMore && (
        <button type="button" className="scramble-stats-fulllist-more" onClick={loadMore}>
          {tr({ zh: '加载更多', en: 'Load more' })}
        </button>
      )}
    </div>
  );
}
