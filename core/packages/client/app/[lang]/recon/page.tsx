'use client';

/**
 * /recon — list page. Full port of packages/client-vite/src/pages/recon/ReconListPage.tsx
 * (per-column filters, record badges, WCA auth, comp localize/links).
 */
import {
  cloneElement, useEffect, useMemo, useState, useRef, useCallback, useContext,
} from 'react';
import Link from '@/components/AppLink';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { Plus, HelpCircle, TriangleAlert, LayoutGrid, List, Video } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { useReconStore, type SortKey, type SortDir } from '@/lib/recon-store';
import { getBiliCover } from '@/lib/recon-api';
import {
  formatResult, formatTime, formatAvg, formatAoXR, formatRound, localizeRound,
} from '@/lib/recon-utils';
import { compLinkProps } from '@/lib/comp-link';
import { displayCuberName } from '@/lib/cuber-name-display';
import { loadFlagData, flagDataVersion, personFlagIso2 } from '@/lib/country-flags';
import { Flag } from '@/components/Flag';
import { localizeCompName } from '@/lib/comp-localize';
import { reconPathSeg } from '@/lib/recon-seo';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { RecordBadge } from '@/components/RecordBadge';
import WcaAuth from '@/components/WcaAuth';
import { EventSelect } from '@/components/EventSelect';
import { ListSelect, type ListSelectItem } from '@/components/ListSelect';
import { RecordSelect } from '@/components/RecordSelect';
import { EventIcon } from '@/components/EventIcon';
import { ColFilter, ColFilterCloseContext } from '@/components/ColFilter/ColFilter';
import { isWcaEvent, eventDisplayName, toWcaEventId } from '@/lib/wca-events';
import { ScramblePreview2D, eventHasScramblePreview } from '@/components/ScramblePreview2D';
import './recon.css';
import { tr } from '@/i18n/tr';

// ── 视图模式 ──
type ViewMode = 'list' | 'grid';
const VIEW_MODES: ViewMode[] = ['list', 'grid'];

// ── 卡片视图排序选项 (key:dir 编码) ──
const GRID_SORTS: { key: SortKey; dir: SortDir; zh: string; en: string }[] = [
  { key: 'id', dir: 'desc', zh: '最新收录', en: 'Latest added' },
  { key: 'date', dir: 'desc', zh: '比赛最新', en: 'Newest comp' },
  { key: 'rawTime', dir: 'asc', zh: '单次最快', en: 'Fastest single' },
  { key: 'stm', dir: 'asc', zh: '步数最少', en: 'Fewest moves' },
  { key: 'tps', dir: 'desc', zh: 'TPS 最高', en: 'Highest TPS' },
  { key: 'average', dir: 'asc', zh: '平均最快', en: 'Fastest average' },
];

// ── 列配置——原版顺序 ──

interface Column {
  key: SortKey | '';
  labelKey: string;
  className?: string;
  sortable: boolean;
}

// NOTE: 列顺序：Single→Solver→Date→Comp→Rnd#→Avg→AoXR→Result→STM→TPS→Event→Method→Reconer→#
const COLUMNS: Column[] = [
  { key: 'rawTime', labelKey: '', className: 'col-dsingle', sortable: true },
  { key: 'person', labelKey: 'recon.solver', className: 'col-solver', sortable: true },
  { key: 'date', labelKey: 'recon.date', className: 'col-date', sortable: true },
  { key: 'comp', labelKey: 'recon.competition', className: 'col-comp', sortable: true },
  { key: 'round', labelKey: '', className: 'col-round', sortable: true },
  { key: 'average', labelKey: '', className: 'col-avg', sortable: true },
  { key: 'aoType', labelKey: '', className: 'col-aoxr', sortable: true },
  { key: 'result', labelKey: '', className: 'col-single mono', sortable: true },
  { key: 'stm', labelKey: '', className: 'col-stm mono', sortable: true },
  { key: 'tps', labelKey: '', className: 'col-tps mono', sortable: true },
  { key: 'event', labelKey: 'recon.event', className: 'col-event', sortable: true },
  { key: 'method', labelKey: 'recon.method', className: 'col-method', sortable: true },
  { key: 'reconer', labelKey: 'recon.reconstructor', className: 'col-reconer', sortable: true },
  { key: 'id', labelKey: '', className: 'col-idx', sortable: true },
];

// NOTE: 需要 i18n 的列标签——按 col.key 映射到 recon.col.* i18n key
const COL_I18N_KEY: Record<string, string> = {
  rawTime: 'recon.col.single', round: 'recon.col.round', average: 'recon.col.average', aoType: 'recon.col.aoxr',
  result: 'recon.col.result', stm: 'recon.col.stm', tps: 'recon.col.tps', id: 'recon.col.id',
};

// ── 数值区间过滤器（用于 单次/成绩 列 popover）──

interface RangeFilterProps {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}

function RangeFilter({ min, max, onChange }: RangeFilterProps) {
  // 单输入框 + 智能解析:
  //   `12.71`  → 精确 (min=max=12.71)
  //   `12~13`  → 范围
  //   `12~`    → ≥ 12
  //   `~13`    → ≤ 13
  //   空       → 无过滤
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const placeholder = tr({ zh: '12.71 或 12~13', en: '12.71 or 12~13' });
  const closePopover = useContext(ColFilterCloseContext);
  const display = (() => {
    if (min == null && max == null) return '';
    if (min != null && max != null && min === max) return String(min);
    return `${min ?? ''}~${max ?? ''}`;
  })();
  const [text, setText] = useState(display);
  const inputRef = useRef<HTMLInputElement>(null);
  // min/max 从外部变(清除按钮),同步回 text
  useEffect(() => { setText(display); }, [display]);

  const commit = (v: string) => {
    const s = v.trim();
    if (!s) { onChange(null, null); return; }
    const parseNum = (x: string): number | null => {
      const tx = x.trim();
      if (!tx) return null;
      const n = parseFloat(tx);
      return isNaN(n) ? null : n;
    };
    if (s.includes('~')) {
      const [lo, hi] = s.split('~');
      onChange(parseNum(lo), parseNum(hi));
    } else {
      const n = parseNum(s);
      onChange(n, n);
    }
  };

  const insertTilde = () => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + '~' + text.slice(end);
    setText(next);
    // 下一帧把光标放在 ~ 之后,保持 input focus 不让软键盘消失
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 1, start + 1);
    });
  };

  return (
    <div className="recon-range-filter">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
            closePopover?.();
          }
        }}
      />
      {/* 数字键盘没 ~,提供按钮入口;onMouseDown preventDefault 防止 input 失焦关 popover */}
      <button
        type="button"
        className="recon-range-tilde-btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={insertTilde}
        aria-label="insert tilde"
      >~</button>
    </div>
  );
}

interface DateRangeFilterProps {
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
}

function DateRangeFilter({ min, max, onChange }: DateRangeFilterProps) {
  return (
    <div className="recon-range-filter">
      <input type="date" value={min} onChange={(e) => onChange(e.target.value, max)} />
      <span className="recon-range-sep">~</span>
      <input type="date" value={max} onChange={(e) => onChange(min, e.target.value)} />
    </div>
  );
}

// ── 卡片视图：视频封面选取 ──
// videoUrl 多行。按语言挑能出封面的视频：中文优先 B 站、英文优先 YouTube；
// 首选平台没有就退而用另一平台（覆盖「只有一个链接直接用」）；两者皆无 → null（回退打乱图）。
// b23.tv 短链不含 BV id、无法取封面，视作无 B 站封面。
function pickReconCover(videoUrl: string | undefined, isZh: boolean): { kind: 'yt' | 'bili'; id: string } | null {
  if (!videoUrl) return null;
  let yt = '';
  let bili = '';
  for (const u of videoUrl.split('\n').map(s => s.trim()).filter(Boolean)) {
    if (!yt && /youtu\.?be/i.test(u)) {
      const m = u.match(/(?:v=|youtu\.be\/|\/(?:embed|shorts|live|v)\/)([A-Za-z0-9_-]{6,})/);
      if (m) yt = m[1];
    }
    if (!bili) {
      const m = u.match(/(BV[A-Za-z0-9]+)/);
      if (m) bili = m[1];
    }
  }
  const order: ('yt' | 'bili')[] = isZh ? ['bili', 'yt'] : ['yt', 'bili'];
  for (const k of order) {
    if (k === 'yt' && yt) return { kind: 'yt', id: yt };
    if (k === 'bili' && bili) return { kind: 'bili', id: bili };
  }
  return null;
}

// B 站封面需走后端代理（无直链 URL 规律）；模块级缓存按 bvid 去重，避免同一卡重挂载重复拉取。
const biliCoverCache = new Map<string, Promise<string | null>>();
function loadBiliCover(bvid: string): Promise<string | null> {
  let p = biliCoverCache.get(bvid);
  if (!p) {
    p = getBiliCover(bvid).then(r => r.pic || null).catch(() => null);
    biliCoverCache.set(bvid, p);
  }
  return p;
}

// ── 卡片缩略图：有视频→封面图（YouTube 直链 / B 站异步取），否则打乱图，再否则项目图标 ──
function ReconCardMedia({ solve, isZh }: { solve: ReconSolve; isZh: boolean }) {
  const cover = useMemo(() => pickReconCover(solve.videoUrl, isZh), [solve.videoUrl, isZh]);
  const ytSrc = cover?.kind === 'yt' ? `https://img.youtube.com/vi/${cover.id}/mqdefault.jpg` : null;
  const [biliSrc, setBiliSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setBiliSrc(null);
    if (cover?.kind !== 'bili') return;
    let alive = true;
    void loadBiliCover(cover.id).then(pic => {
      if (!alive) return;
      if (pic) setBiliSrc(pic); else setFailed(true);
    });
    return () => { alive = false; };
  }, [cover]);

  const imgSrc = failed ? null : (ytSrc ?? biliSrc);

  if (imgSrc) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="recon-card-cover"
          src={imgSrc}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </>
    );
  }

  // 无封面：打乱图（自包含 SVG）→ 项目图标兜底
  const previewEvent = toWcaEventId(solve.event);
  const scramble = solve.optimalScramble || solve.wcaScramble || '';
  const hasVideo = !!solve.videoUrl && solve.videoUrl.trim() !== '';
  return (
    <>
      {scramble && eventHasScramblePreview(previewEvent) ? (
        <ScramblePreview2D event={previewEvent} scramble={scramble} size={52} />
      ) : (
        <div className="recon-card-media-empty">
          {isWcaEvent(solve.event)
            ? <EventIcon event={solve.event} title={eventDisplayName(solve.event, isZh)} />
            : <span>{solve.event}</span>}
        </div>
      )}
      {hasVideo && <span className="recon-card-video"><Video size={13} /></span>}
    </>
  );
}

// ── 卡片视图：单张复盘卡 ──
// 整张卡是一个 <a>（AppLink，支持中键新开），故内部所有名字/比赛只渲染纯文本，禁套 <a>。

function ReconCard({ solve, isZh, href }: { solve: ReconSolve; isZh: boolean; href: string }) {
  const cubers = [
    { name: solve.person || '', country: solve.personCountry },
    ...(solve.coPersons ?? []).map(c => ({ name: c.name, country: c.country })),
  ].filter(c => c.name);
  const single = solve.value || formatTime(solve.rawTime);
  const compName = localizeCompName(solve.compWcaId ?? '', solve.comp || '', isZh);

  return (
    <Link href={href} className="recon-card">
      <div className="recon-card-media">
        <ReconCardMedia solve={solve} isZh={isZh} />
        {solve.official && <span className="recon-card-tag">WCA</span>}
      </div>
      <div className="recon-card-body">
        <div className="recon-card-top">
          <span className="recon-card-result mono">{single}</span>
          {solve.regionalSingleRecord && (
            <RecordBadge record={solve.regionalSingleRecord} variant="inline" iso2={solve.personCountry} />
          )}
        </div>
        <div className="recon-card-solver">
          {cubers.map((c, i) => (
            <span key={i}>
              {i > 0 ? <span className="recon-cuber-sep"> &amp; </span> : null}
              {c.country ? <><Flag iso2={c.country} className="recon-inline-flag" />{' '}</> : null}
              {displayCuberName(c.name, isZh)}
            </span>
          ))}
        </div>
        <div className="recon-card-meta">
          {isWcaEvent(solve.event)
            ? <EventIcon event={solve.event} title={eventDisplayName(solve.event, isZh)} />
            : <span className="recon-card-event-txt">{solve.event}</span>}
          {solve.method ? <span className="recon-card-method">{solve.method}</span> : null}
          {solve.average != null && (
            <span className="recon-card-avg mono">
              {formatAvg(solve.average)}
              {solve.regionalAverageRecord && (
                <RecordBadge record={solve.regionalAverageRecord} variant="inline" iso2={solve.personCountry} />
              )}
            </span>
          )}
          {typeof solve.stm === 'number' ? <span className="recon-card-stm">{solve.stm} STM</span> : null}
        </div>
        <div className="recon-card-foot">
          {solve.country ? <Flag iso2={solve.country} className="recon-inline-flag" /> : null}
          <span className="recon-card-comp">{compName || tr({ zh: '非官方', en: 'Unofficial' })}</span>
          {solve.date ? <span className="recon-card-date">{solve.date.slice(0, 10)}</span> : null}
        </div>
      </div>
    </Link>
  );
}

// ── 主组件 ──

export default function ReconListPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('复盘', 'Reconstructions');

  // ── 列表 / 卡片视图切换（进 URL，后退可返回）──
  // 默认卡片视图：裸 /recon 即 grid（clearOnDefault 自动省掉 ?view=grid），选列表才挂 ?view=list。
  const [viewMode, setViewMode] = useQueryState(
    'view',
    parseAsStringEnum<ViewMode>(VIEW_MODES).withDefault('grid').withOptions({ history: 'push' }),
  );
  const {
    loading, error, filters,
    sortKey, sortDir,
    displayCount,
    loadAll, setFilter, setSort, resetSort,
    getFilteredSolves, getAvailableEvents, getAvailableMethods, getAvailableSolvers,
    getAvailableReconers,
    getAvailableComps, getAvailableRecords, getAvailableRounds, getAvailableAoTypes,
  } = useReconStore();

  // NOTE: 页面加载时获取数据
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // NOTE: 异步加载 person-country 索引,完成后 bump version 触发重渲染拿 reconer iso2
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    void loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => getFilteredSolves(), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useReconStore.getState().allSolves,
    filters, sortKey, sortDir,
  ]);

  // NOTE: 同一轮里 avg / aoxr 在每把都重复——按 (person, comp, event, round) 分组，
  //       只有 solveNum 最小的那把保留正常显示，其他变淡。
  const roundFirstIds = useMemo(() => {
    const minByRound = new Map<string, { id: number; n: number }>();
    for (const s of filtered) {
      const key = `${s.person ?? ''}|${s.comp ?? ''}|${s.event ?? ''}|${s.round ?? ''}`;
      const n = s.solveNum ?? Number.POSITIVE_INFINITY;
      const cur = minByRound.get(key);
      if (!cur || n < cur.n) minByRound.set(key, { id: s.id, n });
    }
    return new Set(Array.from(minByRound.values()).map(v => v.id));
  }, [filtered]);

  // NOTE: 依赖 allSolves 而非 store action 函数（action 引用稳定，永远不会触发重算）
  const events = useMemo(() => getAvailableEvents(), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useReconStore.getState().allSolves,
  ]);
  const methods = useMemo(() => getAvailableMethods(), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useReconStore.getState().allSolves,
  ]);
  const solvers = useMemo(() => getAvailableSolvers(), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useReconStore.getState().allSolves,
  ]);
  const reconers = useMemo(() => getAvailableReconers(), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useReconStore.getState().allSolves,
  ]);
  const comps = useMemo(() => getAvailableComps(), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useReconStore.getState().allSolves,
  ]);
  const records = useMemo(() => getAvailableRecords(), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useReconStore.getState().allSolves,
  ]);
  const rounds = useMemo(() => getAvailableRounds(), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useReconStore.getState().allSolves,
  ]);
  const aoTypes = useMemo(() => getAvailableAoTypes(), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useReconStore.getState().allSolves,
  ]);

  // ── ListSelect items: caller 端预格式化 (label / hint / searchTerms) ──
  const solverItems = useMemo<ListSelectItem[]>(() => solvers.map(s => ({
    value: s.name,
    label: s.name === '__NO_PERSON__' ? '(空)' : displayCuberName(s.name, isZh),
    hint: `(${s.count})`,
    country: s.country,
    // NOTE: 中文模式下也能用英文名 / WCA ID 命中
    searchTerms: s.name === '__NO_PERSON__' ? '空' : `${s.name} ${s.wcaId}`.trim(),
  })), [solvers, isZh]);

  const reconerItems = useMemo<ListSelectItem[]>(() => reconers.map(r => ({
    value: r.name,
    label: r.name === '__NO_RECONER__' ? '(空)' : displayCuberName(r.name, isZh),
    hint: `(${r.count})`,
    searchTerms: r.name === '__NO_RECONER__' ? '空' : `${r.name} ${r.wcaId}`.trim(),
  })), [reconers, isZh]);

  const compItems = useMemo<ListSelectItem[]>(() => comps.map(c => ({
    value: c.name,
    label: c.name === '__NO_COMP__' ? '(空)' : localizeCompName('', c.name, isZh),
    hint: `(${c.count})`,
    country: c.country,
    searchTerms: c.name === '__NO_COMP__' ? '空' : c.name,
  })), [comps, isZh]);

  const methodItems = useMemo<ListSelectItem[]>(() => methods.map(m => ({
    value: m.name,
    label: m.name === '__NO_METHOD__' ? '(空)' : m.name,
    hint: `(${m.count})`,
  })), [methods]);

  const roundItems = useMemo<ListSelectItem[]>(() => rounds.map(r => ({
    value: r.name,
    label: localizeRound(r.name, t),
    hint: `(${r.count})`,
  })), [rounds, t]);

  const aoTypeItems = useMemo<ListSelectItem[]>(() => aoTypes.map(a => ({
    value: a.name,
    label: a.name,
    hint: `(${a.count})`,
  })), [aoTypes]);

  // ── 卡片视图排序下拉（无表头时的排序入口）──
  const sortItems = useMemo<ListSelectItem[]>(() => GRID_SORTS.map(s => ({
    value: `${s.key}:${s.dir}`,
    label: tr({ zh: s.zh, en: s.en }),
  })), []);
  const sortValue = `${sortKey}:${sortDir}`;
  const handleSortChange = useCallback((v: string) => {
    const [key, dir] = v.split(':') as [SortKey, SortDir];
    setSort(key, dir);
  }, [setSort]);

  const displayed = filtered.slice(0, displayCount);
  const hasMore = filtered.length > displayCount;

  // ── 无限滚动（callback ref 确保条件渲染时 observer 正确绑定） ──

  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // NOTE: 直接从 store 读取最新状态，避免闭包陈旧
          useReconStore.getState().loadMore();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  // ── 行点击（支持 Ctrl/Meta + 中键） ──

  // Keyword-rich slugged path (`/recon/<id>-<slug>`); falls back to bare id when
  // no slug is derivable. AppLink adds the lang prefix for <Link>; the imperative
  // router.push / window.open paths below keep the existing (unprefixed) behavior.
  const getDetailUrl = useCallback((solve: ReconSolve) => `/recon/${reconPathSeg(solve)}`, []);

  const handleRowClick = useCallback((e: React.MouseEvent, solve: ReconSolve) => {
    if ((e.target as HTMLElement).closest('a')) return;
    const url = getDetailUrl(solve);
    if (e.ctrlKey || e.metaKey) {
      window.open(url, '_blank');
    } else {
      router.push(url);
    }
  }, [router, getDetailUrl]);

  // NOTE: 中键点击 → 新标签打开
  const handleRowMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 && !(e.target as HTMLElement).closest('a')) {
      e.preventDefault();
    }
  }, []);

  const handleRowMouseUp = useCallback((e: React.MouseEvent, solve: ReconSolve) => {
    if (e.button === 1) {
      if ((e.target as HTMLElement).closest('a')) return;
      e.preventDefault();
      window.open(getDetailUrl(solve), '_blank');
    }
  }, [getDetailUrl]);

  // ── 表头排序 ──

  const handleSort = useCallback((col: Column) => {
    if (col.sortable && col.key) {
      setSort(col.key as SortKey);
    }
  }, [setSort]);

  // ── 受控 popup ── 哪一列的统一菜单是打开的(同时只能开一个)
  const [openColKey, setOpenColKey] = useState<string | null>(null);

  // ── 表头列过滤器（漏斗 popover）──
  const renderColFilter = (col: Column) => {
    switch (col.key) {
      case 'comp': {
        const active = !!filters.comp;
        return (
          <ColFilter active={active} onClear={() => setFilter('comp', '')} align="left">
            <ListSelect
              items={compItems}
              value={filters.comp}
              onChange={(v) => setFilter('comp', v)}
              allLabel={t('recon.allComps')}
              searchable
            />
          </ColFilter>
        );
      }
      case 'person': {
        const active = !!filters.solver;
        return (
          <ColFilter active={active} onClear={() => setFilter('solver', '')} align="left">
            <ListSelect
              items={solverItems}
              value={filters.solver}
              onChange={(v) => setFilter('solver', v)}
              allLabel={t('recon.allSolvers')}
              searchable
            />
          </ColFilter>
        );
      }
      case 'reconer': {
        const active = !!filters.reconer;
        return (
          <ColFilter active={active} onClear={() => setFilter('reconer', '')} align="left">
            <ListSelect
              items={reconerItems}
              value={filters.reconer}
              onChange={(v) => setFilter('reconer', v)}
              allLabel={t('recon.allReconers')}
              searchable
            />
          </ColFilter>
        );
      }
      case 'event': {
        const active = !!filters.event;
        return (
          <ColFilter active={active} onClear={() => setFilter('event', '')}>
            <EventSelect
              events={events}
              value={filters.event}
              onChange={(v) => setFilter('event', v)}
              allLabel={t('recon.allEvents')}
            />
          </ColFilter>
        );
      }
      case 'method': {
        const active = !!filters.method;
        return (
          <ColFilter active={active} onClear={() => setFilter('method', '')}>
            <ListSelect
              items={methodItems}
              value={filters.method}
              onChange={(v) => setFilter('method', v)}
              allLabel={t('recon.allMethods')}
            />
          </ColFilter>
        );
      }
      case 'rawTime': {
        // NOTE: 单次列：range + record 两组合并入一个 popover
        const active = filters.rawTimeMin != null || filters.rawTimeMax != null || !!filters.record;
        const onClear = () => {
          setFilter('rawTimeMin', null);
          setFilter('rawTimeMax', null);
          setFilter('record', '');
        };
        return (
          <ColFilter active={active} onClear={onClear} align="left">
            <RangeFilter
              min={filters.rawTimeMin}
              max={filters.rawTimeMax}
              onChange={(mn, mx) => { setFilter('rawTimeMin', mn); setFilter('rawTimeMax', mx); }}
            />
            <RecordSelect
              records={records}
              value={filters.record}
              onChange={(v) => setFilter('record', v)}
              placeholder={t('recon.allRecords')}
            />
          </ColFilter>
        );
      }
      case 'result': {
        // NOTE: 成绩列与单次同源；只暴露 range
        const active = filters.rawTimeMin != null || filters.rawTimeMax != null;
        const onClear = () => { setFilter('rawTimeMin', null); setFilter('rawTimeMax', null); };
        return (
          <ColFilter active={active} onClear={onClear}>
            <RangeFilter
              min={filters.rawTimeMin}
              max={filters.rawTimeMax}
              onChange={(mn, mx) => { setFilter('rawTimeMin', mn); setFilter('rawTimeMax', mx); }}
            />
          </ColFilter>
        );
      }
      case 'date': {
        const active = !!filters.dateMin || !!filters.dateMax;
        const onClear = () => { setFilter('dateMin', ''); setFilter('dateMax', ''); };
        return (
          <ColFilter active={active} onClear={onClear} align="left">
            <DateRangeFilter
              min={filters.dateMin}
              max={filters.dateMax}
              onChange={(mn, mx) => { setFilter('dateMin', mn); setFilter('dateMax', mx); }}
            />
          </ColFilter>
        );
      }
      case 'round': {
        const active = !!filters.round;
        return (
          <ColFilter active={active} onClear={() => setFilter('round', '')}>
            <ListSelect
              items={roundItems}
              value={filters.round}
              onChange={(v) => setFilter('round', v)}
              allLabel={t('recon.allRounds') ?? '全部'}
            />
          </ColFilter>
        );
      }
      case 'average': {
        const active = filters.averageMin != null || filters.averageMax != null;
        const onClear = () => { setFilter('averageMin', null); setFilter('averageMax', null); };
        return (
          <ColFilter active={active} onClear={onClear}>
            <RangeFilter
              min={filters.averageMin}
              max={filters.averageMax}
              onChange={(mn, mx) => { setFilter('averageMin', mn); setFilter('averageMax', mx); }}
            />
          </ColFilter>
        );
      }
      case 'aoType': {
        const active = !!filters.aoType;
        return (
          <ColFilter active={active} onClear={() => setFilter('aoType', '')}>
            <ListSelect
              items={aoTypeItems}
              value={filters.aoType}
              onChange={(v) => setFilter('aoType', v)}
              allLabel={t('recon.allAoTypes') ?? '全部'}
            />
          </ColFilter>
        );
      }
      case 'stm': {
        const active = filters.stmMin != null || filters.stmMax != null;
        const onClear = () => { setFilter('stmMin', null); setFilter('stmMax', null); };
        return (
          <ColFilter active={active} onClear={onClear}>
            <RangeFilter
              min={filters.stmMin}
              max={filters.stmMax}
              onChange={(mn, mx) => { setFilter('stmMin', mn); setFilter('stmMax', mx); }}
            />
          </ColFilter>
        );
      }
      case 'tps': {
        const active = filters.tpsMin != null || filters.tpsMax != null;
        const onClear = () => { setFilter('tpsMin', null); setFilter('tpsMax', null); };
        return (
          <ColFilter active={active} onClear={onClear}>
            <RangeFilter
              min={filters.tpsMin}
              max={filters.tpsMax}
              onChange={(mn, mx) => { setFilter('tpsMin', mn); setFilter('tpsMax', mx); }}
            />
          </ColFilter>
        );
      }
      case 'id': {
        const active = filters.idMin != null || filters.idMax != null;
        const onClear = () => { setFilter('idMin', null); setFilter('idMax', null); };
        return (
          <ColFilter active={active} onClear={onClear}>
            <RangeFilter
              min={filters.idMin}
              max={filters.idMax}
              onChange={(mn, mx) => { setFilter('idMin', mn); setFilter('idMax', mx); }}
            />
          </ColFilter>
        );
      }
      default:
        return null;
    }
  };

  // ── WCA / non-WCA toggle 状态 ──
  // NOTE: 原版逻辑——两个按钮都激活=显示全部；只激活一个=筛选对应类型
  const [showWca, setShowWca] = useState(true);
  const [showNonWca, setShowNonWca] = useState(true);

  // NOTE: 同步 toggle 状态到 store filter
  useEffect(() => {
    if (showWca && showNonWca) {
      setFilter('official', '');
    } else if (showWca) {
      setFilter('official', '1');
    } else if (showNonWca) {
      setFilter('official', '0');
    }
  }, [showWca, showNonWca, setFilter]);

  const handleToggleWca = useCallback(() => {
    if (showWca && !showNonWca) return;
    setShowWca(!showWca);
  }, [showWca, showNonWca]);

  const handleToggleNonWca = useCallback(() => {
    if (!showWca && showNonWca) return;
    setShowNonWca(!showNonWca);
  }, [showWca, showNonWca]);

  // ── 列标签（需要响应语言切换） ──

  const getColumnLabel = useCallback((col: Column) => {
    if (col.labelKey) return t(col.labelKey);
    const i18nKey = COL_I18N_KEY[col.key];
    return i18nKey ? t(i18nKey) : col.key;
  }, [t]);

  // ── 渲染单元格内容 ──

  const renderCell = useCallback((col: Column, solve: ReconSolve) => {
    switch (col.key) {
      case 'rawTime':
        // NOTE: Single 列——优先 value 字段（含 DNF/(5.09) 括号格式），缺失时回退 rawTime 格式化
        return (
          <span className="record-num-cell">
            {solve.value || formatTime(solve.rawTime)}
            {solve.regionalSingleRecord && (
              <RecordBadge record={solve.regionalSingleRecord} variant="inline" iso2={solve.personCountry} />
            )}
          </span>
        );
      case 'person': {
        // NOTE: 主选手(成绩归属)+ 共同完成者,与详情页一致用 & 串联
        const cubers = [
          { name: solve.person || '', id: solve.personId, country: solve.personCountry },
          ...(solve.coPersons ?? []),
        ].filter(c => c.name);
        if (cubers.length === 0) return '';
        return (
          <>
            {cubers.map((c, i) => (
              <span key={i}>
                {i > 0 ? <span className="recon-cuber-sep"> &amp; </span> : null}
                {c.country ? <><Flag iso2={c.country} className="recon-inline-flag" />{' '}</> : null}
                {c.id ? (
                  <Link href={`/recon/person/${c.id}`} onClick={(e) => e.stopPropagation()}>
                    {displayCuberName(c.name, isZh)}
                  </Link>
                ) : displayCuberName(c.name, isZh)}
              </span>
            ))}
          </>
        );
      }
      case 'reconer': {
        // NOTE: 复盘者 country 通过 reconerId 反查 person_countries.json
        if (!solve.reconer) return '';
        const name = displayCuberName(solve.reconer, isZh);
        const iso2 = solve.reconerId ? personFlagIso2(solve.reconerId) : '';
        const flag = iso2 ? <Flag iso2={iso2} className="recon-inline-flag" /> : null;
        if (solve.reconerId) {
          return (
            <>
              {flag}
              <Link
                href={`/recon/person/${solve.reconerId}`}
                onClick={(e) => e.stopPropagation()}
              >
                {name}
              </Link>
            </>
          );
        }
        return <>{flag}{name}</>;
      }
      case 'date':
        return solve.date ? solve.date.slice(0, 10) : '';
      case 'comp': {
        const flag = solve.country ? <Flag iso2={solve.country} className="recon-inline-flag" /> : null;
        const rawName = solve.comp || '';
        const displayName = localizeCompName(solve.compWcaId ?? '', rawName, isZh);
        if (solve.compWcaId) {
          return (
            <>
              {flag}{' '}
              <Link
                {...compLinkProps(solve.compWcaId)}
                onClick={(e) => e.stopPropagation()}
              >
                {displayName}
              </Link>
            </>
          );
        }
        return <>{flag} {displayName}</>;
      }
      case 'round':
        return formatRound(solve.round, solve.solveNum);
      case 'average': {
        const dim = !roundFirstIds.has(solve.id) ? ' recon-cell-dim' : '';
        return (
          <span className={`record-num-cell${dim}`}>
            {formatAvg(solve.average)}
            {solve.regionalAverageRecord && (
              <RecordBadge record={solve.regionalAverageRecord} variant="inline" iso2={solve.personCountry} />
            )}
          </span>
        );
      }
      case 'aoType': {
        const dim = !roundFirstIds.has(solve.id) ? ' recon-cell-dim' : '';
        return (
          <span className={`record-num-cell${dim}`}>
            {formatAoXR(solve.aoType)}
            {solve.regionalAoxrRecord && (
              <RecordBadge record={solve.regionalAoxrRecord} variant="inline" iso2={solve.personCountry} />
            )}
          </span>
        );
      }
      case 'result':
        return formatResult(solve.rawTime);
      case 'stm':
        return solve.stm || '';
      case 'tps':
        return solve.tps && typeof solve.tps === 'number' ? solve.tps.toFixed(2) : '';
      case 'event':
        if (!solve.event) return '';
        return isWcaEvent(solve.event)
          ? <EventIcon event={solve.event} title={eventDisplayName(solve.event, isZh)} />
          : solve.event;
      case 'method':
        return solve.method || '';
      case 'id':
        return (
          <Link href={getDetailUrl(solve)} onClick={(e) => e.stopPropagation()}>
            {solve.id}
          </Link>
        );
      default:
        return '';
    }
  }, [getDetailUrl, isZh, roundFirstIds]);

  return (
    <div className="recon-page">
      <div className="recon-page-header">
        <div>
          <h1>
            {t('recon.title')}
            <Link
              href="/recon-about"
              className="recon-title-help"
              title={tr({ zh: '这页是干啥的?', en: 'What is this page?'
            })}
              aria-label={tr({ zh: '查看说明', en: 'About this page'
            })}
            >
              <HelpCircle size={18} strokeWidth={1.75} />
            </Link>
          </h1>
          <p className="recon-subtitle">{t('recon.subtitle')}</p>
        </div>
      </div>

      {/* 工具栏：WCA toggle + 计数 + 添加 + 登录；filter 全在表头 popover */}
      <div className="recon-toolbar">
        <div className="recon-type-toggle">
          <button
            className={`toggle-btn${showWca ? ' active' : ''}`}
            onClick={handleToggleWca}
          >
            WCA
          </button>
          <button
            className={`toggle-btn${showNonWca ? ' active' : ''}`}
            onClick={handleToggleNonWca}
          >
            non-WCA
          </button>
        </div>
        <div className="recon-view-toggle">
          <button
            className={`toggle-btn${viewMode === 'list' ? ' active' : ''}`}
            onClick={() => setViewMode('list')}
            aria-label={tr({ zh: '列表视图', en: 'List view' })}
            aria-pressed={viewMode === 'list'}
            title={tr({ zh: '列表视图', en: 'List view' })}
          >
            <List size={16} />
          </button>
          <button
            className={`toggle-btn${viewMode === 'grid' ? ' active' : ''}`}
            onClick={() => setViewMode('grid')}
            aria-label={tr({ zh: '卡片视图', en: 'Gallery view' })}
            aria-pressed={viewMode === 'grid'}
            title={tr({ zh: '卡片视图', en: 'Gallery view' })}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
        <div className="recon-actions">
          <span className="recon-stats-count">
            {t('recon.count', { count: filtered.length })}
          </span>
          <Link href="/recon/submit" className="recon-add-btn" title={t('recon.add')} aria-label={t('recon.add')}>
            <Plus size={18} />
          </Link>
          <WcaAuth />
        </div>
      </div>

      {loading && <div className="recon-loading">{t('common.loading')}</div>}
      {error && <div className="recon-error"><TriangleAlert size={16} /> {error}</div>}

      {!loading && !error && (
        <>
          {/* 卡片视图：表头没了，提供一条紧凑筛选 + 排序栏（与表头共用同一份 store filter） */}
          {viewMode === 'grid' && (
            <div className="recon-grid-filters">
              <EventSelect
                events={events}
                value={filters.event}
                onChange={(v) => setFilter('event', v)}
                allLabel={t('recon.allEvents')}
              />
              <ListSelect
                items={solverItems}
                value={filters.solver}
                onChange={(v) => setFilter('solver', v)}
                allLabel={t('recon.allSolvers')}
                searchable
              />
              <ListSelect
                items={methodItems}
                value={filters.method}
                onChange={(v) => setFilter('method', v)}
                allLabel={t('recon.allMethods')}
              />
              <RecordSelect
                records={records}
                value={filters.record}
                onChange={(v) => setFilter('record', v)}
                placeholder={t('recon.allRecords')}
              />
              <ListSelect
                items={sortItems}
                value={sortValue}
                onChange={handleSortChange}
                allLabel={tr({ zh: '排序', en: 'Sort' })}
                clearable={false}
              />
            </div>
          )}

          {viewMode === 'list' && (
          <div className="recon-table-wrap">
            <table className="recon-table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => {
                    const filterEl = renderColFilter(col);
                    // 统一菜单: th 任意位置点击都打开此列的 popup;
                    // ColFilter 受控,内部状态由 openColKey 决定;sort 按钮也合到 popup 里
                    const ctrlFilterEl = filterEl ? cloneElement(filterEl, {
                      open: openColKey === col.key,
                      onOpenChange: (o: boolean) => setOpenColKey(o ? (col.key ?? null) : null),
                      sortable: col.sortable,
                      sortDir: col.sortable && col.key === sortKey ? sortDir : undefined,
                      onSort: col.sortable && col.key
                        ? (dir: 'asc' | 'desc') => setSort(col.key as SortKey, dir)
                        : undefined,
                      onSortReset: col.sortable ? resetSort : undefined,
                    }) : null;
                    const onThClick = () => {
                      // 有 filter → 整列点击开 popup;无 filter 但 sortable → 老的 click-cycle 排序
                      if (ctrlFilterEl) setOpenColKey(col.key ?? null);
                      else if (col.sortable) handleSort(col);
                    };
                    return (
                      <th
                        key={col.key || col.labelKey}
                        className={`${col.className || ''} ${
                          col.sortable && col.key === sortKey
                            ? `sort-${sortDir}`
                            : ''
                        }`}
                        onClick={onThClick}
                      >
                        <span className="col-label">{getColumnLabel(col)}</span>
                        {ctrlFilterEl}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayed.map((solve) => (
                  <tr
                    key={solve.id}
                    className={solve.personId ? 'community-row' : ''}
                    onClick={(e) => handleRowClick(e, solve)}
                    onMouseDown={handleRowMouseDown}
                    onMouseUp={(e) => handleRowMouseUp(e, solve)}
                  >
                    {COLUMNS.map((col) => {
                      // NOTE: col-solver 和 col-comp 需要溢出 tooltip
                      const needsTip = col.className?.includes('col-solver') || col.className?.includes('col-comp');
                      const tipText = col.key === 'person'
                        ? [solve.person, ...(solve.coPersons?.map(c => c.name) ?? [])].filter(Boolean).join(' & ')
                        : col.key === 'comp' ? (solve.comp || '') : '';
                      return (
                        <td
                          key={col.key || col.labelKey}
                          className={col.className || ''}
                          {...(needsTip ? { 'data-tip': tipText } : {})}
                          onMouseOver={needsTip ? (e) => {
                            // NOTE: 溢出检测——scrollWidth > clientWidth 时才显示
                            const td = e.currentTarget;
                            if (td.scrollWidth > td.clientWidth) {
                              td.setAttribute('data-tip-show', '');
                            } else {
                              td.removeAttribute('data-tip-show');
                            }
                          } : undefined}
                          onMouseLeave={needsTip ? (e) => {
                            e.currentTarget.removeAttribute('data-tip-show');
                          } : undefined}
                        >
                          {renderCell(col, solve)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {viewMode === 'grid' && (
            <div className="recon-grid">
              {displayed.map((solve) => (
                <ReconCard
                  key={solve.id}
                  solve={solve}
                  isZh={isZh}
                  href={getDetailUrl(solve)}
                />
              ))}
            </div>
          )}

          {/* 空状态 */}
          {filtered.length === 0 && (
            <div className="recon-empty">
              <div>{t('recon.noResults')}</div>
            </div>
          )}

          {/* 无限滚动 sentinel + 分页信息 */}
          <div className="recon-pagination">
            {hasMore ? (
              <span className="recon-showing">
                {t('recon.showing', { shown: displayed.length, total: filtered.length })}
              </span>
            ) : (
              <span className="recon-showing">
                {t('recon.total', { count: filtered.length })}
              </span>
            )}
          </div>
          {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
        </>
      )}
    </div>
  );
}
