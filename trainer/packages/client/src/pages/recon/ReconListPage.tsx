/**
 * 复盘列表页——1:1 对齐原版 recon/recon.js（718 行）
 * NOTE: 列结构、格式化、工具栏、交互完全忠于原版
 */
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useReconStore } from '../../stores/recon_store';
import type { SortKey } from '../../stores/recon_store';
import type { ReconSolve } from '@cuberoot/shared';
import { useAuthStore } from '../../stores/auth_store';
import {
  countryFlag, displaySolverName, t,
  formatResult, formatAvg, formatAoXR, formatRound,
  formatRecord, wcaPersonUrl, wcaCompUrl,
} from '../../utils/recon_utils';
import '../../recon.css';

// ── 纪录 Badge 组件 ──

/** 渲染纪录 badge（WR/CR/NR/PR/cancelled） */
function RecordBadge({ record }: { record: string | undefined }) {
  const badge = formatRecord(record);
  if (!badge) return null;
  return <span className={badge.className}>{badge.text}</span>;
}

// ── 列配置——原版顺序 ──

interface Column {
  key: SortKey | '';
  label: string;
  className?: string;
  sortable: boolean;
}

// NOTE: 完全对齐原版列顺序：Single→Solver→Date→Comp→Rnd#→Avg→AoXR→Result→STM→TPS→Event→Method→#
const COLUMNS: Column[] = [
  { key: 'rawTime', label: 'Single', className: 'col-dsingle', sortable: true },
  { key: 'person', label: t('选手', 'Solver'), className: 'col-solver', sortable: true },
  { key: 'date', label: t('日期', 'Date'), className: 'col-date', sortable: true },
  { key: 'comp', label: t('比赛', 'Competition'), className: 'col-comp', sortable: true },
  { key: 'round', label: 'Rnd#', className: 'col-round', sortable: true },
  { key: 'average', label: 'Avg', className: 'col-avg', sortable: true },
  { key: 'aoType', label: 'AoXR', className: 'col-aoxr', sortable: true },
  { key: 'result', label: 'Result', className: 'col-single mono', sortable: true },
  { key: 'stm', label: 'STM', className: 'col-stm mono', sortable: true },
  { key: 'tps', label: 'TPS', className: 'col-tps mono', sortable: true },
  { key: 'event', label: t('项目', 'Event'), className: 'col-event', sortable: true },
  { key: 'method', label: t('方法', 'Method'), className: 'col-method', sortable: true },
  { key: 'id', label: '#', className: 'col-idx', sortable: true },
];

// ── 主组件 ──

export default function ReconListPage() {
  const navigate = useNavigate();
  const {
    loading, error, filters,
    sortKey, sortDir,
    displayCount,
    loadAll, setFilter, setSort,
    getFilteredSolves, getAvailableEvents, getAvailableMethods, getAvailableSolvers,
  } = useReconStore();

  // NOTE: 页面加载时获取数据
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => getFilteredSolves(), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useReconStore.getState().allSolves,
    filters, sortKey, sortDir,
  ]);

  const events = useMemo(() => getAvailableEvents(), [getAvailableEvents]);
  const methods = useMemo(() => getAvailableMethods(), [getAvailableMethods]);
  const solvers = useMemo(() => getAvailableSolvers(), [getAvailableSolvers]);

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

  // ── 渲染单元格内容 ──

  const renderCell = useCallback((col: Column, solve: ReconSolve) => {
    switch (col.key) {
      case 'rawTime':
        // NOTE: Single 列——显示 value 字段（含 DNF/(5.09) 括号格式）+ 纪录 badge
        return (
          <>
            {solve.value || ''}
            {solve.regionalSingleRecord && (
              <> <RecordBadge record={solve.regionalSingleRecord} /></>
            )}
          </>
        );
      case 'person': {
        // NOTE: 国旗 + 选手名（中英文切换），有 WCA ID 时为链接
        const flag = solve.personCountry ? countryFlag(solve.personCountry) : '';
        const name = displaySolverName(solve.person || '');
        if (solve.personId) {
          return (
            <>
              {flag}{' '}
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
        return <>{flag} {name}</>;
      }
      case 'date':
        // NOTE: 截取 YYYY-MM-DD 部分
        return solve.date ? solve.date.slice(0, 10) : '';
      case 'comp': {
        // NOTE: 国旗 + 比赛名，有 compWcaId 时为链接
        const flag = solve.country ? countryFlag(solve.country) : '';
        const compName = solve.comp || '';
        if (solve.compWcaId) {
          return (
            <>
              {flag}{' '}
              <a
                href={wcaCompUrl(solve.compWcaId)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {compName}
              </a>
            </>
          );
        }
        return <>{flag} {compName}</>;
      }
      case 'round':
        return formatRound(solve.round, solve.solveNum);
      case 'average':
        return (
          <>
            {formatAvg(solve.average)}
            {solve.regionalAverageRecord && (
              <> <RecordBadge record={solve.regionalAverageRecord} /></>
            )}
          </>
        );
      case 'aoType':
        return (
          <>
            {formatAoXR(solve.aoType)}
            {solve.regionalAoxrRecord && (
              <> <RecordBadge record={solve.regionalAoxrRecord} /></>
            )}
          </>
        );
      case 'result':
        return formatResult(solve.rawTime);
      case 'stm':
        return solve.stm || '';
      case 'tps':
        return solve.tps && typeof solve.tps === 'number' ? solve.tps.toFixed(2) : '';
      case 'event':
        return solve.event || '';
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
  }, [getDetailUrl, navigate]);

  return (
    <div className="recon-page">
      {/* NOTE: 原版标题 + 副标题 */}
      <h1>{t('还原复盘', 'Solve Reconstructions')}</h1>
      <p className="recon-subtitle">
        {t(
          '魔方比赛的还原复盘与分析',
          'Competition solve reconstructions and analysis for top cubers',
        )}
      </p>

      {/* 工具栏 */}
      <div className="recon-toolbar">
        <input
          className="recon-search"
          type="text"
          placeholder={t('搜索选手、比赛、记录...', 'Search solver, competition, record...')}
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
        />
        <div className="recon-filters">
          {/* NOTE: All Solvers 下拉——按频率排序 */}
          <select
            value={filters.solver}
            onChange={(e) => setFilter('solver', e.target.value)}
          >
            <option value="">{t('全部选手', 'All Solvers')}</option>
            {solvers.map(({ name, count }) => (
              <option key={name} value={name}>
                {displaySolverName(name)} ({count})
              </option>
            ))}
          </select>
          <select
            value={filters.method}
            onChange={(e) => setFilter('method', e.target.value)}
          >
            <option value="">{t('全部方法', 'All Methods')}</option>
            {methods.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={filters.event}
            onChange={(e) => setFilter('event', e.target.value)}
          >
            <option value="">{t('全部项目', 'All Events')}</option>
            {events.map(ev => (
              <option key={ev} value={ev}>{ev}</option>
            ))}
          </select>
        </div>
        <span className="recon-stats-count">
          {filtered.length} {t('条复盘', 'recons')}
        </span>
        <Link to="/recon/submit" className="recon-add-btn">
          + {t('添加', 'Add')}
        </Link>
        <WcaLoginButton />
      </div>

      {/* WCA / non-WCA toggle 按钮组 */}
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

      {/* 加载状态 */}
      {loading && <div className="recon-loading">Loading...</div>}
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
                      key={col.label}
                      className={`${col.className || ''} ${
                        col.sortable && col.key === sortKey
                          ? `sort-${sortDir}`
                          : ''
                      }`}
                      onClick={() => handleSort(col)}
                    >
                      {col.label}
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
                    {COLUMNS.map((col) => (
                      <td key={col.label} className={col.className || ''}>
                        {renderCell(col, solve)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 空状态 */}
          {filtered.length === 0 && (
            <div className="recon-empty">
              <div className="recon-empty-icon">📭</div>
              <div>{t('没有找到匹配的复盘记录', 'No reconstructions found')}</div>
            </div>
          )}

          {/* 无限滚动 sentinel + 分页信息 */}
          <div className="recon-pagination">
            {hasMore ? (
              <span className="recon-showing">
                {t(
                  `已显示 ${displayed.length} / ${filtered.length}`,
                  `Showing ${displayed.length} of ${filtered.length}`,
                )}
              </span>
            ) : (
              <span className="recon-showing">
                {t(
                  `共 ${filtered.length} 条`,
                  `${filtered.length} total`,
                )}
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

/** WCA 登录按钮——未登录显示 Login，已登录显示头像+下拉菜单 */
function WcaLoginButton() {
  const user = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);
  const logout = useAuthStore(s => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // NOTE: 点击外部关闭下拉菜单
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  if (!user) {
    return (
      <button className="recon-btn recon-login-btn" onClick={login}>
        🔑 {t('WCA 登录', 'WCA Login')}
      </button>
    );
  }

  return (
    <div className="recon-user-menu" ref={menuRef}>
      <button
        className="recon-user-trigger"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" className="recon-user-avatar" />
        ) : (
          <span className="recon-user-avatar-placeholder">
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="recon-user-name">{user.name}</span>
      </button>
      {menuOpen && (
        <div className="recon-user-dropdown">
          <div className="recon-user-dropdown-id">{user.wcaId}</div>
          <button
            className="recon-user-dropdown-item"
            onClick={() => { logout(); setMenuOpen(false); }}
          >
            {t('退出登录', 'Logout')}
          </button>
        </div>
      )}
    </div>
  );
}
