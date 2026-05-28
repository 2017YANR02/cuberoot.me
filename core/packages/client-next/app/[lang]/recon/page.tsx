'use client';

/**
 * /recon — list page.
 *
 * TODO (deferred from full client port):
 *   - Per-column popover filters (ColFilter / ListSelect / EventSelect / RecordSelect)
 *   - WcaAuth login button + admin actions
 *   - localizeCompName (uses raw comp name)
 *   - Recon submit link is preserved but submit page itself is a TODO stub.
 *
 * Ported: fetch + table + sortable headers + infinite scroll + flag column
 * decorations + EventIcon in event col + WCA/non-WCA toggle.
 */
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Plus, HelpCircle, TriangleAlert } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import {
  formatTime, formatAvg, formatAoXR, formatRound, wcaPersonUrl,
} from '@/lib/recon-utils';
import { displayCuberName } from '@/lib/cuber-name-display';
import { Flag } from '@/components/Flag';
import { EventIcon } from '@/components/EventIcon';
import { isWcaEvent, eventDisplayName } from '@/lib/wca-events';
import { loadFlagData, flagDataVersion, personFlagIso2 } from '@/lib/country-flags';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { listRecons } from '@/lib/recon-api';
import './recon.css';

type SortKey =
  | 'id' | 'rawTime' | 'person' | 'reconer' | 'event' | 'method'
  | 'comp' | 'date' | 'stm' | 'tps' | 'average' | 'round' | 'aoType';
type SortDir = 'asc' | 'desc';

interface Column {
  key: SortKey | '';
  label: string;
  className?: string;
  sortable: boolean;
}

const PAGE_SIZE = 100;

export default function ReconListPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('复盘', 'Reconstructions');

  const [allSolves, setAllSolves] = useState<ReconSolve[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  // 两个 toggle 都激活 = 全部; 只激活一个 = 筛对应类型; 都关被禁止
  const [showWca, setShowWca] = useState(true);
  const [showNonWca, setShowNonWca] = useState(true);
  // Force a rerender when person-country index finishes loading so the cells
  // pick up reconer iso2. flagDataVersion() bumps on each successful load.
  const [, setFlagVer] = useState(0);

  useEffect(() => {
    listRecons()
      .then(rows => { setAllSolves(rows); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    void loadFlagData().then(() => setFlagVer(flagDataVersion()));
  }, []);

  const handleToggleWca = useCallback(() => {
    if (showWca && !showNonWca) return;  // 不允许两个都关
    setShowWca((v) => !v);
  }, [showWca, showNonWca]);

  const handleToggleNonWca = useCallback(() => {
    if (!showWca && showNonWca) return;
    setShowNonWca((v) => !v);
  }, [showWca, showNonWca]);

  const COLUMNS: Column[] = useMemo(() => [
    { key: 'rawTime', label: t('recon.col.single'), className: 'col-dsingle', sortable: true },
    { key: 'person', label: t('recon.solver'), className: 'col-solver', sortable: true },
    { key: 'date', label: t('recon.date'), className: 'col-date', sortable: true },
    { key: 'comp', label: t('recon.competition'), className: 'col-comp', sortable: true },
    { key: 'round', label: t('recon.col.round'), className: 'col-round', sortable: true },
    { key: 'average', label: t('recon.col.average'), className: 'col-avg', sortable: true },
    { key: 'aoType', label: t('recon.col.aoxr'), className: 'col-aoxr', sortable: true },
    { key: 'stm', label: t('recon.col.stm'), className: 'col-stm mono', sortable: true },
    { key: 'tps', label: t('recon.col.tps'), className: 'col-tps mono', sortable: true },
    { key: 'event', label: t('recon.event'), className: 'col-event', sortable: true },
    { key: 'method', label: t('recon.method'), className: 'col-method', sortable: true },
    { key: 'reconer', label: t('recon.reconstructor'), className: 'col-reconer', sortable: true },
    { key: 'id', label: t('recon.col.id'), className: 'col-idx', sortable: true },
  ], [t]);

  const filtered = useMemo(() => {
    if (showWca && showNonWca) return allSolves;
    return allSolves.filter((s) => {
      const wca = isWcaEvent(s.event);
      return wca ? showWca : showNonWca;
    });
  }, [allSolves, showWca, showNonWca]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const displayed = sorted.slice(0, displayCount);
  const hasMore = sorted.length > displayCount;

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
          setDisplayCount(n => n + PAGE_SIZE);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  const getDetailUrl = (id: number) => `/recon/${id}`;

  const handleRowClick = (e: React.MouseEvent, solve: ReconSolve) => {
    if ((e.target as HTMLElement).closest('a')) return;
    const url = getDetailUrl(solve.id);
    if (e.ctrlKey || e.metaKey) window.open(url, '_blank');
    else router.push(url);
  };

  const handleSort = (col: Column) => {
    if (!col.sortable || !col.key) return;
    if (sortKey === col.key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col.key as SortKey);
      setSortDir('desc');
    }
  };

  const renderCell = (col: Column, solve: ReconSolve) => {
    switch (col.key) {
      case 'rawTime':
        return solve.value || formatTime(solve.rawTime);
      case 'person': {
        const flag = solve.personCountry ? <Flag iso2={solve.personCountry} className="recon-inline-flag" /> : null;
        const name = displayCuberName(solve.person || '', isZh);
        if (solve.personId) {
          return (
            <>
              {flag}{' '}
              <a href={wcaPersonUrl(solve.personId)} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}>
                {name}
              </a>
            </>
          );
        }
        return <>{flag} {name}</>;
      }
      case 'reconer': {
        if (!solve.reconer) return '';
        const name = displayCuberName(solve.reconer, isZh);
        const iso2 = solve.reconerId ? personFlagIso2(solve.reconerId) : '';
        const flag = iso2 ? <Flag iso2={iso2} className="recon-inline-flag" /> : null;
        if (solve.reconerId) {
          return (
            <>
              {flag}{' '}
              <a href={wcaPersonUrl(solve.reconerId)} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}>
                {name}
              </a>
            </>
          );
        }
        return <>{flag}{name}</>;
      }
      case 'date':
        return solve.date ? solve.date.slice(0, 10) : '';
      case 'comp': {
        const flag = solve.country ? <Flag iso2={solve.country} className="recon-inline-flag" /> : null;
        return <>{flag} {solve.comp || ''}</>;
      }
      case 'round':
        return formatRound(solve.round, solve.solveNum);
      case 'average':
        return formatAvg(solve.average);
      case 'aoType':
        return formatAoXR(solve.aoType);
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
          <Link href={getDetailUrl(solve.id)} onClick={(e) => e.stopPropagation()}>
            {solve.id}
          </Link>
        );
      default:
        return '';
    }
  };

  return (
    <div className="recon-page">
      <div className="recon-page-header">
        <div>
          <h1>
            {t('recon.title')}
            <Link
              href="/recon-about"
              className="recon-title-help"
              title={isZh ? '这页是干啥的?' : 'What is this page?'}
              aria-label={isZh ? '查看说明' : 'About this page'}
            >
              <HelpCircle size={18} strokeWidth={1.75} />
            </Link>
          </h1>
          <p className="recon-subtitle">{t('recon.subtitle')}</p>
        </div>
      </div>

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
            {t('recon.count', { count: sorted.length })}
          </span>
          <Link href="/recon/submit" className="recon-add-btn" title={t('recon.add')} aria-label={t('recon.add')}>
            <Plus size={18} />
          </Link>
        </div>
      </div>

      {loading && <div className="recon-loading">{t('common.loading')}</div>}
      {error && <div className="recon-error"><TriangleAlert size={16} /> {error}</div>}

      {!loading && !error && (
        <>
          <div className="recon-table-wrap">
            <table className="recon-table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key || col.label}
                      className={`${col.className || ''} ${
                        col.sortable && col.key === sortKey ? `sort-${sortDir}` : ''
                      }`}
                      onClick={() => handleSort(col)}
                    >
                      <span className="col-label">{col.label}</span>
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
                  >
                    {COLUMNS.map((col) => (
                      <td key={col.key || col.label} className={col.className || ''}>
                        {renderCell(col, solve)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sorted.length === 0 && (
            <div className="recon-empty">
              <div>{t('recon.noResults')}</div>
            </div>
          )}

          <div className="recon-pagination">
            {hasMore ? (
              <span className="recon-showing">
                {t('recon.showing', { shown: displayed.length, total: sorted.length })}
              </span>
            ) : (
              <span className="recon-showing">
                {t('recon.total', { count: sorted.length })}
              </span>
            )}
          </div>
          {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
        </>
      )}
    </div>
  );
}
