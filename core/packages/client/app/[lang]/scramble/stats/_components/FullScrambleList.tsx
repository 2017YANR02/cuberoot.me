'use client';

// 难度页「查看全部」：列出该 (方法,阶段,子集,步数) 的**全部** WCA 真题,
// 带比赛名搜索 + 日期范围筛选 + 分页加载。复用示例行的视觉(色点 + 2D 打乱图 + 比赛链)。
// 受控:由 ExamplesPanel 决定挂载(挂载即「已展开」、替换示例预览),折叠走 onClose;
// total 经 onTotal 回传给面板标题(避免在筛选栏里再立一个计数)。
import { useEffect, useRef, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import Link from '@/components/AppLink';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { Flag } from '@/components/Flag';
import { ClearButton } from '@/components/ClearButton';
import { SearchInput } from '@/components/SearchInput';
import { Calendar } from 'lucide-react';
import { compSourceLine } from '@/lib/comp-schedule';
import { localizeCompName } from '@/lib/comp-localize';
import { compFlagIso2, compNamesByZhSubstring, loadFlagData } from '@/lib/country-flags';
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

// ISO 日期字段:始终以 yyyy-mm-dd 文案显示(跟列表里的比赛日期一致),点开仍是原生日历。
// 原生 <input type=date> 的显示格式跟浏览器/系统区域走、不认 lang 属性,所以把它透明铺在上层
// 只借用日历(showPicker),底下盖一层我们自己的 ISO 文字。
function IsoDateField({ value, onChange, min, max, ariaLabel, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  ariaLabel: string;
  placeholder: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className="scramble-stats-isodate">
      <span className={`scramble-stats-isodate-text${value ? '' : ' is-placeholder'}`}>
        <Calendar size={12} aria-hidden="true" />
        {value || placeholder}
      </span>
      <input
        ref={ref}
        type="date"
        className="scramble-stats-isodate-native"
        value={value}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onClick={() => { try { ref.current?.showPicker?.(); } catch { /* ignore */ } }}
      />
    </span>
  );
}

// 筛选栏(搜索比赛名 + 日期范围 + 查看全部/收起)。与下方 FullScrambleList 共享同一组 nuqs
// URL 键(fq/ffrom/fto),因此可渲染进示例面板标题行、跟国家筛选并成一行,列表在下方读同一状态。
export function FullScrambleFilterBar({ expanded, onExpandedChange, isZh }: {
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  isZh: boolean;
}) {
  const [q, setQ] = useQueryState('fq', parseAsString.withDefault(''));
  const [from, setFrom] = useQueryState('ffrom', parseAsString.withDefault(''));
  const [to, setTo] = useQueryState('fto', parseAsString.withDefault(''));
  const hasDate = !!(from || to);
  // 收起态下一搜索 / 选日期就自动展开(静态预览没法按筛选过滤)。
  useEffect(() => {
    if (!expanded && (q || from || to)) onExpandedChange(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, from, to]);
  // 收起:回到预览态并清空筛选(否则带着筛选退回静态预览会对不上)。
  const collapse = () => { onExpandedChange(false); void setQ(''); void setFrom(''); void setTo(''); };
  return (
    <div className="scramble-stats-fulllist-bar">
      <SearchInput
        value={q}
        onChange={(v) => void setQ(v)}
        placeholder={tr({ zh: '搜索比赛名', en: 'Search competition' })}
        className="scramble-stats-fulllist-search"
        inputClassName="scramble-stats-fulllist-input"
      />
      {/* 日期范围:ISO 显示(yyyy-mm-dd,跟列表里的比赛日期一致),两框收紧成一段。 */}
      <div className="scramble-stats-fulllist-daterange">
        <IsoDateField
          value={from}
          max={to || undefined}
          onChange={(v) => void setFrom(v)}
          ariaLabel={tr({ zh: '起始日期', en: 'From date' })}
          placeholder={tr({ zh: '起始', en: 'From' })}
        />
        <span className="scramble-stats-fulllist-dash" aria-hidden="true">~</span>
        <IsoDateField
          value={to}
          min={from || undefined}
          onChange={(v) => void setTo(v)}
          ariaLabel={tr({ zh: '结束日期', en: 'To date' })}
          placeholder={tr({ zh: '结束', en: 'To' })}
        />
        {hasDate && (
          <ClearButton
            onClick={() => { void setFrom(''); void setTo(''); }}
            isZh={isZh}
            variant="standalone"
            ariaLabel={tr({ zh: '清除日期', en: 'Clear dates' })}
          />
        )}
      </div>
      <button
        type="button"
        className="scramble-stats-fulllist-close"
        onClick={() => (expanded ? collapse() : onExpandedChange(true))}
      >
        {expanded ? tr({ zh: '收起', en: 'Collapse' }) : tr({ zh: '展开', en: 'Expand' })}
      </button>
    </div>
  );
}

interface FullScrambleListProps {
  apiEvent?: string;     // undefined = 合并池(全 3x3-family)
  variant: string;
  stage: string;
  colors: string;        // 子集 key
  bin: number;
  country?: string;      // WCA country_id(点国家条某段传入;undefined = 不按国筛)
  lang: 'zh' | 'en';
  isZh: boolean;
  exView: 'orig' | 'opt';
  expanded: boolean;                      // 是否已「查看全部」(展开列表);收起态只显示筛选栏
  onExpandedChange: (v: boolean) => void;
  onTotal?: (n: number) => void;
}

export default function FullScrambleList({
  apiEvent, variant, stage, colors, bin, country, lang, isZh, exView, expanded, onExpandedChange, onTotal,
}: FullScrambleListProps) {
  // 筛选进 URL(replace,不堆历史);键加 f 前缀避免与页面其它参数撞名。
  const [q, setQ] = useQueryState('fq', parseAsString.withDefault(''));
  const [from, setFrom] = useQueryState('ffrom', parseAsString.withDefault(''));
  const [to, setTo] = useQueryState('fto', parseAsString.withDefault(''));


  const [rows, setRows] = useState<ByDifficultyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // comp_names_zh 加载后 bump,触发中文名搜索重新解析(首帧 map 可能还没到)。
  const [flagVer, setFlagVer] = useState(0);
  useEffect(() => { void loadFlagData().then(setFlagVer); }, []);
  // 搜索词含中文时:DB 只存官方拉丁名,故把中文子串解析成官方名列表走 names 精确筛;
  // 纯拉丁词照旧走 q 子串。中文词解析不到任何比赛 → 直接空结果(不发请求,避免退化成全量)。
  const cjkQuery = /[㐀-鿿豈-﫿]/.test(q);
  const resolvedNames = cjkQuery ? compNamesByZhSubstring(q) : null;
  const searchFilter = cjkQuery
    ? { names: resolvedNames ?? [], noMatch: (resolvedNames?.length ?? 0) === 0 }
    : { q: q || undefined, noMatch: false };
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const reqId = useRef(0);

  // 关键输入或筛选变化 → 回到第 1 页重拉(q 防抖 300ms)。仅展开后才查(收起态只显示筛选栏 + 预览)。
  useEffect(() => {
    if (!expanded) return;
    const myReq = ++reqId.current;
    // 中文搜索解析不到比赛 → 立即空结果,不打后端。
    if (searchFilter.noMatch) {
      setLoading(false); setFailed(false); setRows([]); setTotal(0); setPage(1); onTotal?.(0);
      return;
    }
    setLoading(true);
    setFailed(false);
    const t = setTimeout(() => {
      void fetchByDifficulty({
        variant, stage, colors, bin, event: apiEvent, country: country || undefined,
        q: searchFilter.q, names: searchFilter.names, from: from || undefined, to: to || undefined,
        page: 1, pageSize: BY_DIFFICULTY_PAGE_SIZE,
      }).then((res) => {
        if (myReq !== reqId.current) return;
        if (!res) { setFailed(true); setRows([]); setTotal(0); onTotal?.(0); }
        else { setRows(res.scrambles); setTotal(res.total); setPage(1); onTotal?.(res.total); }
        setLoading(false);
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, variant, stage, colors, bin, apiEvent, country, q, flagVer, from, to]);

  const loadMore = () => {
    const next = page + 1;
    const myReq = ++reqId.current;
    setLoading(true);
    void fetchByDifficulty({
      variant, stage, colors, bin, event: apiEvent, country: country || undefined,
      q: searchFilter.q, names: searchFilter.names, from: from || undefined, to: to || undefined,
      page: next, pageSize: BY_DIFFICULTY_PAGE_SIZE,
    }).then((res) => {
      if (myReq !== reqId.current) return;
      if (res) { setRows((r) => [...r, ...res.scrambles]); setTotal(res.total); setPage(next); onTotal?.(res.total); }
      setLoading(false);
    });
  };

  const hasMore = rows.length < total;
  // 收起:回到预览态并清空筛选(否则带着筛选退回静态预览会对不上)。
  const collapse = () => { onExpandedChange(false); void setQ(''); void setFrom(''); void setTo(''); };
  // 筛选栏已上移到示例面板标题行(FullScrambleFilterBar);列表只在展开时渲染全量结果。
  if (!expanded) return null;
  return (
    <div className="scramble-stats-fulllist">
      <>
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
      {rows.length > 0 && (
        <div className="scramble-stats-fulllist-foot">
          {!loading && hasMore && (
            <button type="button" className="scramble-stats-fulllist-more" onClick={loadMore}>
              {tr({ zh: '加载更多', en: 'Load more' })}
            </button>
          )}
          <button type="button" className="scramble-stats-fulllist-close" onClick={collapse}>
            {tr({ zh: '收起', en: 'Collapse' })}
          </button>
        </div>
      )}
      </>
    </div>
  );
}
