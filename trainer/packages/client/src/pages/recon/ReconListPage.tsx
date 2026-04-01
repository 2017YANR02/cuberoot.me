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
import { useAuthStore } from '../../stores/auth_store';
import {
  flagClass, displaySolverName,
  formatResult, formatAvg, formatAoXR, formatRound,
  formatRecord, wcaPersonUrl, wcaCompUrl,
} from '../../utils/recon_utils';
import { compNameZh, loadFlagData, flagDataVersion } from '../../utils/country_flags';
import LangToggle from '../../components/LangToggle';
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

// NOTE: 不需要翻译的列使用固定英文标签
const FIXED_LABELS: Record<string, string> = {
  rawTime: 'Single', round: 'Rnd#', average: 'Avg', aoType: 'AoXR',
  result: 'Result', stm: 'STM', tps: 'TPS', id: '#',
};

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

  // ── 列标签（需要响应语言切换） ──

  const getColumnLabel = useCallback((col: Column) => {
    if (col.labelKey) return t(col.labelKey);
    return FIXED_LABELS[col.key] ?? col.key;
  }, [t]);

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
        // NOTE: CSS 国旗 + 选手名（中英文切换），有 WCA ID 时为链接
        const fc = flagClass(solve.personCountry);
        const name = displaySolverName(solve.person || '', isZh);
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
        const displayName = isZh ? (compNameZh(rawName) || rawName) : rawName;
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
  }, [getDetailUrl, navigate, isZh]);

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

      {/* 工具栏 */}
      <div className="recon-toolbar">
        <input
          className="recon-search"
          type="text"
          placeholder={t('recon.search')}
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
        />
        <div className="recon-filters">
          {/* NOTE: All Solvers 下拉——按频率排序 */}
          <select
            value={filters.solver}
            onChange={(e) => setFilter('solver', e.target.value)}
          >
            <option value="">{t('recon.allSolvers')}</option>
            {solvers.map(({ name, count }) => (
              <option key={name} value={name}>
                {displaySolverName(name, isZh)} ({count})
              </option>
            ))}
          </select>
          <select
            value={filters.method}
            onChange={(e) => setFilter('method', e.target.value)}
          >
            <option value="">{t('recon.allMethods')}</option>
            {methods.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={filters.event}
            onChange={(e) => setFilter('event', e.target.value)}
          >
            <option value="">{t('recon.allEvents')}</option>
            {events.map(ev => (
              <option key={ev} value={ev}>{ev}</option>
            ))}
          </select>
        </div>
        <span className="recon-stats-count">
          {t('recon.count', { count: filtered.length })}
        </span>
        <Link to="/recon/submit" className="recon-add-btn">
          + {t('recon.add')}
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
                      {getColumnLabel(col)}
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

/** WCA 登录按钮——未登录显示 Login，已登录显示头像+下拉菜单 */
function WcaLoginButton() {
  const { t } = useTranslation();
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
        🔑 {t('recon.wcaLogin')}
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
            {t('recon.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
