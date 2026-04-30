/**
 * 复盘列表页——1:1 对齐原版 recon/recon.js（718 行）
 * NOTE: 列结构、格式化、工具栏、交互完全忠于原版
 */
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useReconStore } from '../../stores/recon_store';
import type { SortKey } from '../../stores/recon_store';
import type { ReconSolve } from '@cuberoot/shared';
import {
  flagClass,
  formatResult, formatTime, formatAvg, formatAoXR, formatRound, localizeRound,
  wcaPersonUrl, wcaCompUrl,
} from '../../utils/recon_utils';
import { displayCuberName } from '../../utils/name_utils';
import { compNameZh, loadFlagData, flagDataVersion } from '../../utils/country_flags';
import { stripWcaPrefix } from '../../utils/comp_localize';
import LangToggle from '../../components/LangToggle';
import { RecordBadge } from '../../components/RecordBadge';
import WcaAuth from '../../components/WcaAuth';
import { EventSelect } from '../../components/EventSelect';
import { ListSelect, type ListSelectItem } from '../../components/ListSelect';
import { RecordSelect } from '../../components/RecordSelect';
import { EventIcon } from '../../components/EventIcon';
import { ColFilter } from '../../components/ColFilter/ColFilter';
import { isWcaEvent, eventDisplayName } from '../../utils/wca_events';
import { Plus } from 'lucide-react';
import '../../recon.css';

// ── 列配置——原版顺序 ──

interface Column {
  key: SortKey | '';
  labelKey: string;
  className?: string;
  sortable: boolean;
}

// NOTE: 完全对齐原版列顺序：Single→Solver→Date→Comp→Rnd#→Avg→AoXR→Result→STM→TPS→Event→Method→#
// 使用 labelKey 引用 i18n key；无翻译的列用空字符串
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
  const { t } = useTranslation();
  const parse = (v: string): number | null => {
    if (!v.trim()) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };
  return (
    <div className="recon-range-filter">
      <input
        type="number"
        step="0.01"
        placeholder={t('common.min')}
        value={min ?? ''}
        onChange={(e) => onChange(parse(e.target.value), max)}
      />
      <span className="recon-range-sep">~</span>
      <input
        type="number"
        step="0.01"
        placeholder={t('common.max')}
        value={max ?? ''}
        onChange={(e) => onChange(min, parse(e.target.value))}
      />
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

// ── 主组件 ──

export default function ReconListPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const {
    loading, error, filters,
    sortKey, sortDir,
    displayCount,
    loadAll, setFilter, setSort,
    getFilteredSolves, getAvailableEvents, getAvailableMethods, getAvailableSolvers,
    getAvailableComps, getAvailableRecords, getAvailableRounds, getAvailableAoTypes,
  } = useReconStore();

  // NOTE: 页面加载时获取数据
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // NOTE: 异步加载 compNameZh 映射
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); });
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

  const compItems = useMemo<ListSelectItem[]>(() => comps.map(c => ({
    value: c.name,
    label: c.name === '__NO_COMP__' ? '(空)' : stripWcaPrefix(isZh ? (compNameZh(c.name) || c.name) : c.name),
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

  const displayed = filtered.slice(0, displayCount);
  const hasMore = filtered.length > displayCount;

  // ── 无限滚动（callback ref 确保条件渲染时 observer 正确绑定） ──

  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    // NOTE: 清理旧 observer
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

  // NOTE: basename="/app" 已由 Router 处理，此处只需相对路径
  const getDetailUrl = useCallback((id: number) => `/recon/${id}`, []);

  const handleRowClick = useCallback((e: React.MouseEvent, solve: ReconSolve) => {
    // NOTE: <a> 标签让浏览器原生处理
    if ((e.target as HTMLElement).closest('a')) return;
    const url = getDetailUrl(solve.id);
    if (e.ctrlKey || e.metaKey) {
      window.open(url, '_blank');
    } else {
      navigate(url);
    }
  }, [navigate, getDetailUrl]);

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
      window.open(getDetailUrl(solve.id), '_blank');
    }
  }, [getDetailUrl]);

  // ── 表头排序 ──

  const handleSort = useCallback((col: Column) => {
    if (col.sortable && col.key) {
      setSort(col.key as SortKey);
    }
  }, [setSort]);

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
    // NOTE: 不允许两个都取消（原版逻辑）
  }, [showWca, showNonWca, setFilter]);

  const handleToggleWca = useCallback(() => {
    // NOTE: 不允许两个都取消
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
        // NOTE: Single 列——优先 value 字段（含 DNF/(5.09) 括号格式），缺失时回退到 rawTime 格式化
        return (
          <>
            {solve.value || formatTime(solve.rawTime)}
            {solve.regionalSingleRecord && (
              <> <RecordBadge record={solve.regionalSingleRecord} variant="inline" iso2={solve.personCountry} /></>
            )}
          </>
        );
      case 'person': {
        // NOTE: CSS 国旗 + 选手名（中英文切换），有 WCA ID 时为链接
        const fc = flagClass(solve.personCountry);
        const name = displayCuberName(solve.person || '', isZh);
        if (solve.personId) {
          return (
            <>
              {fc && <span className={fc} />}{' '}
              <a
                href={wcaPersonUrl(solve.personId)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {name}
              </a>
            </>
          );
        }
        return <>{fc && <span className={fc} />} {name}</>;
      }
      case 'date':
        // NOTE: 截取 YYYY-MM-DD 部分
        return solve.date ? solve.date.slice(0, 10) : '';
      case 'comp': {
        // NOTE: CSS 国旗 + 比赛名（中文模式查 compNameZh 映射），有 compWcaId 时为链接
        const fc = flagClass(solve.country);
        const rawName = solve.comp || '';
        const displayName = stripWcaPrefix(isZh ? (compNameZh(rawName) || rawName) : rawName);
        if (solve.compWcaId) {
          return (
            <>
              {fc && <span className={fc} />}{' '}
              <a
                href={wcaCompUrl(solve.compWcaId)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {displayName}
              </a>
            </>
          );
        }
        return <>{fc && <span className={fc} />} {displayName}</>;
      }
      case 'round':
        return formatRound(solve.round, solve.solveNum);
      case 'average': {
        const dim = !roundFirstIds.has(solve.id) ? ' recon-cell-dim' : '';
        return (
          <span className={`recon-cell${dim}`}>
            {formatAvg(solve.average)}
            {solve.regionalAverageRecord && (
              <> <RecordBadge record={solve.regionalAverageRecord} variant="inline" iso2={solve.personCountry} /></>
            )}
          </span>
        );
      }
      case 'aoType': {
        const dim = !roundFirstIds.has(solve.id) ? ' recon-cell-dim' : '';
        return (
          <span className={`recon-cell${dim}`}>
            {formatAoXR(solve.aoType)}
            {solve.regionalAoxrRecord && (
              <> <RecordBadge record={solve.regionalAoxrRecord} variant="inline" iso2={solve.personCountry} /></>
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
        // NOTE: ID 列渲染为链接（原版行为）
        return (
          <a
            href={getDetailUrl(solve.id)}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              navigate(getDetailUrl(solve.id));
            }}
          >
            {solve.id}
          </a>
        );
      default:
        return '';
    }
  }, [getDetailUrl, navigate, isZh, roundFirstIds]);

  return (
    <div className="recon-page">
      {/* NOTE: 标题行 — h1 + 语言切换（行业标准：header 右对齐） */}
      <div className="recon-page-header">
        <div>
          <h1>{t('recon.title')}</h1>
          <p className="recon-subtitle">{t('recon.subtitle')}</p>
        </div>
        <LangToggle />
      </div>

      {/* 工具栏：仅留 WCA toggle + 计数 + 添加 + 登录；filter 全在表头 popover */}
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
        <div className="recon-actions">
          <span className="recon-stats-count">
            {t('recon.count', { count: filtered.length })}
          </span>
          <Link to="/recon/submit" className="recon-add-btn" title={t('recon.add')} aria-label={t('recon.add')}>
            <Plus size={18} />
          </Link>
          <WcaAuth />
        </div>
      </div>

      {/* 加载状态 */}
      {loading && <div className="recon-loading">{t('common.loading')}</div>}
      {error && <div className="recon-error">⚠️ {error}</div>}

      {/* 表格 */}
      {!loading && !error && (
        <>
          <div className="recon-table-wrap">
            <table className="recon-table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key || col.labelKey}
                      className={`${col.className || ''} ${
                        col.sortable && col.key === sortKey
                          ? `sort-${sortDir}`
                          : ''
                      }`}
                      onClick={() => handleSort(col)}
                    >
                      <span className="col-label">{getColumnLabel(col)}</span>
                      {renderColFilter(col)}
                    </th>
                  ))}
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
                      const tipText = col.key === 'person' ? (solve.person || '') : col.key === 'comp' ? (solve.comp || '') : '';
                      return (
                        <td
                          key={col.key || col.labelKey}
                          className={col.className || ''}
                          {...(needsTip ? { 'data-tip': tipText } : {})}
                          onMouseOver={needsTip ? (e) => {
                            // NOTE: 原版 Tooltip 溢出检测——scrollWidth > clientWidth 时才显示
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

          {/* 空状态 */}
          {filtered.length === 0 && (
            <div className="recon-empty">
              <div className="recon-empty-icon">📭</div>
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
          {/* NOTE: sentinel 元素——仅 hasMore 时存在，确保 Observer 重触发 */}
          {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
        </>
      )}
    </div>
  );
}

