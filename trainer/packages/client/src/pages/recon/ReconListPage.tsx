/**
 * 复盘列表页——迁移自 recon/recon.js（718 行）
 * NOTE: 包含数据加载、表格、筛选、排序、分页功能
 */
import { useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useReconStore } from '../../stores/recon_store';
import type { SortKey } from '../../stores/recon_store';
import type { ReconSolve } from '@cuberoot/shared';
import { formatTime, countryFlag, getEventDisplayName, t } from '../../utils/recon_utils';
import '../../recon.css';

// ── 纪录徽章 ──

/** 生成纪录 badge 的 className */
function recordClass(record: string | undefined): string {
  if (!record) return '';
  const lc = record.toLowerCase();
  if (lc.startsWith('cancelled')) return 'record-badge record-cancelled';
  if (lc === 'wr') return 'record-badge record-wr';
  if (lc === 'cr') return 'record-badge record-cr';
  if (lc === 'nr') return 'record-badge record-nr';
  if (lc === 'pr') return 'record-badge record-pr';
  return 'record-badge';
}

// ── 列配置 ──

interface Column {
  key: SortKey | '';
  label: string;
  className?: string;
  /** 是否可排序 */
  sortable: boolean;
}

const COLUMNS: Column[] = [
  { key: 'id', label: '#', className: 'col-idx', sortable: true },
  { key: '', label: '🏴', className: 'col-official', sortable: false },
  { key: 'person', label: 'Solver', className: 'col-solver', sortable: true },
  { key: 'rawTime', label: 'Time', className: 'col-single', sortable: true },
  { key: 'event', label: 'Event', sortable: true },
  { key: 'method', label: 'Method', sortable: true },
  { key: 'comp', label: 'Competition', className: 'col-comp', sortable: true },
  { key: 'date', label: 'Date', sortable: true },
  { key: 'stm', label: 'STM', sortable: true },
  { key: 'tps', label: 'TPS', sortable: true },
];

// ── 组件 ──

export default function ReconListPage() {
  const navigate = useNavigate();
  const {
    loading, error, filters,
    sortKey, sortDir,
    displayCount,
    loadAll, setFilter, setSort, loadMore,
    getFilteredSolves, getAvailableEvents, getAvailableMethods,
  } = useReconStore();

  // NOTE: 页面加载时获取数据
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => getFilteredSolves(), [
    // NOTE: 需要在 store 变化时重新计算
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useReconStore.getState().allSolves,
    filters, sortKey, sortDir,
  ]);

  const events = useMemo(() => getAvailableEvents(), [getAvailableEvents]);
  const methods = useMemo(() => getAvailableMethods(), [getAvailableMethods]);

  const displayed = filtered.slice(0, displayCount);
  const hasMore = filtered.length > displayCount;

  // NOTE: 点击行跳转详情
  const handleRowClick = (solve: ReconSolve) => {
    navigate(`/recon/${solve.id}`);
  };

  // NOTE: 表头点击排序
  const handleSort = (col: Column) => {
    if (col.sortable && col.key) {
      setSort(col.key as SortKey);
    }
  };

  return (
    <div className="recon-page">
      <h1>🔍 {t('复盘数据库', 'Reconstruction Database')}</h1>

      {/* 工具栏 */}
      <div className="recon-toolbar">
        <input
          className="recon-search"
          type="text"
          placeholder={t('搜索选手、比赛、ID...', 'Search solver, competition, ID...')}
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
        />
        <div className="recon-filters">
          <select
            value={filters.event}
            onChange={(e) => setFilter('event', e.target.value)}
          >
            <option value="">{t('全部项目', 'All Events')}</option>
            {events.map(ev => (
              <option key={ev} value={ev}>{getEventDisplayName(ev)}</option>
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
            value={filters.official}
            onChange={(e) => setFilter('official', e.target.value)}
          >
            <option value="">{t('全部', 'All')}</option>
            <option value="1">WCA</option>
            <option value="0">Non-WCA</option>
          </select>
        </div>
        <span className="recon-stats-count">
          {filtered.length} {t('条记录', 'records')}
        </span>
        <Link to="/recon/submit" className="recon-add-btn">
          + {t('添加', 'Add')}
        </Link>
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
                    className={solve.official ? '' : 'community-row'}
                    onClick={() => handleRowClick(solve)}
                  >
                    <td className="col-idx">{solve.id}</td>
                    <td className="col-official">
                      {solve.official ? '🏆' : ''}
                    </td>
                    <td className="col-solver">
                      {solve.personCountry && countryFlag(solve.personCountry)}{' '}
                      {solve.person}
                    </td>
                    <td className="col-single">
                      {formatTime(solve.rawTime)}
                      {solve.regionalSingleRecord && (
                        <span className={recordClass(solve.regionalSingleRecord)}>
                          {solve.regionalSingleRecord}
                        </span>
                      )}
                    </td>
                    <td>{getEventDisplayName(solve.event)}</td>
                    <td>{solve.method || ''}</td>
                    <td className="col-comp">
                      {solve.country && countryFlag(solve.country)}{' '}
                      {solve.comp || ''}
                    </td>
                    <td>{solve.date || ''}</td>
                    <td>{solve.stm ?? ''}</td>
                    <td>{solve.tps ?? ''}</td>
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

          {/* 分页 */}
          {hasMore && (
            <div className="recon-pagination">
              <button className="recon-btn" onClick={loadMore}>
                {t('加载更多', 'Load More')}
              </button>
              <span className="recon-showing">
                {t(
                  `显示 ${displayed.length} / ${filtered.length}`,
                  `Showing ${displayed.length} / ${filtered.length}`,
                )}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
