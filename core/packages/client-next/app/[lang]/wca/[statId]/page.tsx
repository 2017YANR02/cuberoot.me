'use client';

// Catch-all WCA stat renderer. Ported from packages/client/src/pages/wca_stats/WcaStatsPage.tsx.
// Supports 4 render modes: rows / sections / panels / metricPanels.
// NOTE: deferred — hasAbout 链接 (wca_about/registry) 暂未迁移,about 链接不显示。
//   Top10HistoryPage 嵌入(wr_metric ranking 面板 bar chart race)已迁移。
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { BarChart3, Play, Pause, ChevronRight, ChevronDown } from 'lucide-react';
import WcaEventSelector from '@/components/WcaEventSelector';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { EVENT_NAME_TO_ID, ALL_EVENT_IDS } from '@/lib/event-constants';
import {
  countryToIso2, loadFlagData, flagDataVersion,
  extractWcaId, extractCompId, personFlagIso2, compFlagIso2,
} from '@/lib/country-flags';
import { localizeCompName } from '@/lib/comp-localize';
import { Flag } from '@/components/Flag';
import DistributionChart, { type DistDataset } from '@/components/wca-stats/DistributionChart';
import WrHistoryChart from '@/components/wca-stats/WrHistoryChart';
import { translateCellText, translatePersonLink, stripChineseParens } from '@/lib/wca-translations';
import { rewriteWcaCompUrl, prefetchComp } from '@/lib/comp-link';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { isWcaEvent, eventDisplayName } from '@/lib/wca-events';
import Top10HistoryPage from '@/components/wca-stats/Top10HistoryPage';
import type { Metric as Top10Metric } from '@/lib/top10-axis';
import '../_wca_stats.css';

interface StatHeader {
  key: string;
  label: string;
  labelZh: string;
  align: 'left' | 'right' | 'center';
}

interface StatSection {
  title: string;
  titleZh?: string;
  rows: unknown[][];
}

interface StatPanel {
  id: string;
  labelEn: string;
  labelZh: string;
  header: StatHeader[];
  sections: StatSection[];
}

interface SourcePanel {
  id: string;
  labelEn: string;
  labelZh: string;
  panels: StatPanel[];
}

interface MetricPanel {
  id: string;
  labelEn: string;
  labelZh: string;
  panels?: StatPanel[];
  sourcePanels?: SourcePanel[];
}

interface MetricGroup {
  label: string;
  labelZh: string;
  items: string[];
}

interface StatData {
  id: string;
  title: string;
  titleZh: string;
  note?: string;
  noteZh?: string;
  header: StatHeader[];
  rows?: unknown[][];
  sections?: StatSection[];
  panels?: StatPanel[];
  metricPanels?: MetricPanel[];
  metricGroups?: MetricGroup[];
  years?: number[];
  cumulative?: Record<string, number[]>;
}

function getAllPanelsFromMetric(mp: MetricPanel): StatPanel[] {
  if (mp.panels) return mp.panels;
  if (mp.sourcePanels) return mp.sourcePanels.flatMap(sp => sp.panels);
  return [];
}

const LAZY_THRESHOLD = 12;

function renderSolves(items: string[]): React.ReactNode {
  if (items.length <= LAZY_THRESHOLD) {
    return (
      <div className="solve-list">
        <div className="solve-row">
          {items.map((s, i) => <span key={i}>{s}</span>)}
        </div>
      </div>
    );
  }
  const rows: string[][] = [];
  for (let i = 0; i < items.length; i += 10) {
    rows.push(items.slice(i, i + 10));
  }
  return (
    <div className="solve-list">
      {rows.map((row, ri) => (
        <div key={ri} className="solve-row">
          {row.map((s, si) => <span key={si}>{s}</span>)}
        </div>
      ))}
    </div>
  );
}

// 行内 *斜体* markdown（如 name_parts_count 的 "India *(28.81 %)*"）。
// 只处理单星号；**粗体** 由 renderCell 整串匹配，[链接]() 由 renderSegment 处理。
function renderInline(text: string, keyBase: string): React.ReactNode {
  if (!text.includes('*')) return text;
  const re = /\*([^*]+)\*/g;
  const parts: React.ReactNode[] = [];
  let last = 0, i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<em key={`${keyBase}-em-${i++}`}>{m[1]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  if (parts.length === 0) return text;
  return parts.length === 1 ? parts[0] : <React.Fragment key={keyBase}>{parts}</React.Fragment>;
}

function renderCell(value: unknown, columnKey?: string, isZh?: boolean): React.ReactNode {
  if (value && typeof value === 'object' && (value as Record<string, unknown>)._type === 'solves') {
    const cell = value as { _type: 'solves'; csv: string };
    const items = cell.csv.split(',');
    if (items.length <= LAZY_THRESHOLD) {
      return renderSolves(items);
    }
    return (
      <details className="solve-details">
        <summary>{items.length} solves</summary>
        {renderSolves(items)}
      </details>
    );
  }

  if (Array.isArray(value)) {
    const items = value.map(String);
    if (items.length <= LAZY_THRESHOLD) {
      return renderSolves(items);
    }
    return (
      <details className="solve-details">
        <summary>{items.length} solves</summary>
        {renderSolves(items)}
      </details>
    );
  }

  const str = String(value);

  if (columnKey === 'details' && typeof value === 'string' && value.trim()) {
    const items = value.trim().split(/\s+/);
    if (items.length > 1) return renderSolves(items);
  }

  if (columnKey === 'event' && !str.includes('[') && isWcaEvent(str.trim())) {
    return <EventIcon event={str.trim()} className="wca-stats-event-icon" title={eventDisplayName(str.trim(), !!isZh)} />;
  }

  if (columnKey && !str.includes('[')) {
    const translated = translateCellText(str.trim(), columnKey, isZh);
    if (translated) return <>{translated}</>;
  }

  const boldMatch = /^\*\*(.+)\*\*$/.exec(str);
  if (boldMatch) {
    return <strong>{boldMatch[1]}</strong>;
  }

  const brParts = str.split(/<br\s*\/?>/i);
  const hasBr = brParts.length > 1;

  const renderSegment = (segment: string, segIdx: number): React.ReactNode => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(segment)) !== null) {
      if (match.index > lastIndex) {
        parts.push(renderInline(segment.slice(lastIndex, match.index), `${segIdx}-${lastIndex}`));
      }
      const url = match[2];
      const wcaId = extractWcaId(url);
      const compId = extractCompId(url);
      const iso2 = wcaId ? personFlagIso2(wcaId) : compId ? compFlagIso2(compId) : '';
      if (iso2) {
        parts.push(<Flag key={`flag-${segIdx}-${match.index}`} iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />);
        parts.push(' ');
      }
      let displayText = match[1];
      if (columnKey === 'person' || columnKey === 'name') {
        if (isZh) {
          const zhName = translatePersonLink(displayText);
          displayText = zhName || stripChineseParens(displayText);
        } else {
          displayText = stripChineseParens(displayText);
        }
      }
      if (compId) {
        displayText = localizeCompName(compId, displayText, !!isZh);
      }
      const internalHref = compId ? rewriteWcaCompUrl(url) : null;
      const prefetch = compId ? () => prefetchComp(compId) : undefined;
      parts.push(
        internalHref
          ? <Link key={`${segIdx}-${match.index}`} href={internalHref} onMouseEnter={prefetch} onFocus={prefetch} onTouchStart={prefetch}>{displayText}</Link>
          : <a key={`${segIdx}-${match.index}`} href={url} target="_blank" rel="noopener noreferrer">{displayText}</a>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < segment.length) {
      parts.push(renderInline(segment.slice(lastIndex), `${segIdx}-end`));
    }
    return parts.length === 1 ? parts[0] : <React.Fragment key={segIdx}>{parts}</React.Fragment>;
  };

  if (!hasBr) return renderSegment(str, 0);

  const result: React.ReactNode[] = [];
  brParts.forEach((part, i) => {
    if (i > 0) result.push(<br key={`br-${i}`} />);
    result.push(renderSegment(part, i));
  });
  return <>{result}</>;
}

function shouldHideCountryCol(colKey: string, header: StatHeader[]): boolean {
  if (colKey !== 'country' && colKey !== 'country_id') return false;
  return header.some(h => h.key === 'person' || h.key === 'name');
}

// 超过 PAGE_SIZE 行只先渲染前 N 行 + “显示更多/全部”按钮，避免大表（最多 5202 行）
// 一次性渲染全部 cell（markdown + flag + 本地化）卡死主线程。小分区不受影响。
const PAGE_SIZE = 300;

function StatsTable({ header, rows, searchTerm, isZh }: {
  header: StatHeader[];
  rows: unknown[][];
  searchTerm: string;
  isZh: boolean;
}) {
  const filtered = useMemo(() => {
    if (!searchTerm) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(row =>
      row.some(cell => String(cell).toLowerCase().includes(term))
    );
  }, [rows, searchTerm]);

  const [visible, setVisible] = useState(PAGE_SIZE);
  useEffect(() => { setVisible(PAGE_SIZE); }, [rows, searchTerm]);
  const shown = filtered.length > visible ? filtered.slice(0, visible) : filtered;
  const remaining = filtered.length - shown.length;

  return (
    <div className="wca-stats-table-wrapper">
      <table className="wca-stats-table">
        <thead>
          <tr>
            {header.map(h => shouldHideCountryCol(h.key, header) ? null : (
              <th key={h.key} style={{ textAlign: h.align }}>
                {isZh ? h.labelZh : h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => {
                const colKey = header[j]?.key ?? '';
                if (shouldHideCountryCol(colKey, header)) return null;
                const isCountryCol = colKey === 'country';
                const flagIso2 = isCountryCol ? countryToIso2(String(cell)) : '';
                return (
                  <td key={j} style={{ textAlign: header[j]?.align }}>
                    {flagIso2 && <Flag iso2={flagIso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                    {renderCell(cell, colKey, isZh)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {remaining > 0 && (
        <div className="wca-stats-more">
          <button type="button" className="wca-stats-more-btn" onClick={() => setVisible(v => v + PAGE_SIZE * 3)}>
            {isZh ? `显示更多（还有 ${remaining} 行）` : `Show more (${remaining} left)`}
          </button>
          <button type="button" className="wca-stats-more-btn" onClick={() => setVisible(filtered.length)}>
            {isZh ? '全部显示' : 'Show all'}
          </button>
        </div>
      )}
    </div>
  );
}

function WrByCountryYearView({ header, years, cumulative, searchTerm, isZh }: {
  header: StatHeader[];
  years: number[];
  cumulative: Record<string, number[]>;
  searchTerm: string;
  isZh: boolean;
}) {
  const maxYear = years[years.length - 1] ?? new Date().getFullYear();
  const minYear = 2002;
  const [year, setYear] = useState<number>(maxYear);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const tid = window.setInterval(() => {
      setYear(y => {
        if (y >= maxYear) { setPlaying(false); return maxYear; }
        return y + 1;
      });
    }, 500);
    return () => window.clearInterval(tid);
  }, [playing, maxYear]);

  const rowsAtYear = useMemo(() => {
    const idx = years.indexOf(year);
    if (idx < 0) return [] as unknown[][];
    return Object.entries(cumulative)
      .map(([name, arr]) => [String(arr[idx] ?? 0), name] as unknown[])
      .filter(r => Number(r[0]) > 0)
      .sort((a, b) => {
        const d = Number(b[0]) - Number(a[0]);
        return d !== 0 ? d : String(a[1]).localeCompare(String(b[1]));
      });
  }, [year, years, cumulative]);

  return (
    <div className="wr-year-view">
      <div className="wr-year-controls">
        <button
          type="button"
          onClick={() => {
            if (playing) { setPlaying(false); return; }
            if (year >= maxYear) setYear(minYear);
            setPlaying(true);
          }}
          className="wr-year-play-btn"
          title={playing ? (isZh ? '暂停' : 'Pause') : (isZh ? '播放' : 'Play')}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={16} strokeWidth={2} /> : <Play size={16} strokeWidth={2} />}
        </button>
        <input
          type="range"
          className="wr-year-slider"
          min={minYear}
          max={maxYear}
          step={1}
          value={year}
          onChange={e => { setPlaying(false); setYear(Number(e.target.value)); }}
        />
        <span className="wr-year-label">
          {isZh ? `截至 ${year} 年` : `As of ${year}`}
        </span>
      </div>
      <StatsTable header={header} rows={rowsAtYear} searchTerm={searchTerm} isZh={isZh} />
    </div>
  );
}

function SectionsView({ header, sections, searchTerm, isZh, selectedEvent }: {
  header: StatHeader[];
  sections: StatSection[];
  searchTerm: string;
  isZh: boolean;
  selectedEvent?: string;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const toggleSection = useCallback((title: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }, []);

  const availableMetrics = useMemo(() => {
    const metrics = new Set<string>();
    sections.forEach(s => {
      if (s.title.includes(' - ')) {
        const suffix = s.title.substring(s.title.lastIndexOf(' - ') + 3);
        metrics.add(suffix);
      }
    });
    return metrics;
  }, [sections]);

  const showMetricFilter = availableMetrics.size >= 2;

  useEffect(() => {
    if (showMetricFilter && !selectedMetric) {
      setSelectedMetric(Array.from(availableMetrics)[0]);
    }
  }, [showMetricFilter, availableMetrics, selectedMetric]);

  const visibleSections = useMemo(() => {
    let result = sections;
    if (selectedEvent) {
      result = result.filter(s => {
        let eventId = EVENT_NAME_TO_ID[s.title];
        if (!eventId && s.title.includes(' - ')) {
          const eventName = s.title.substring(0, s.title.lastIndexOf(' - '));
          eventId = EVENT_NAME_TO_ID[eventName];
        }
        return eventId === selectedEvent;
      });
    }
    if (selectedMetric) {
      result = result.filter(s => s.title.endsWith(` - ${selectedMetric}`));
    }
    return result;
  }, [sections, selectedEvent, selectedMetric]);

  const hideTitle = visibleSections.length === 1;

  return (
    <div className="wca-stats-sections">
      {showMetricFilter && (
        <div className="wca-stats-tab-bar">
          {Array.from(availableMetrics).map(metric => (
            <button
              key={metric}
              className={`wca-stats-tab ${selectedMetric === metric ? 'active' : ''}`}
              onClick={() => setSelectedMetric(selectedMetric === metric ? null : metric)}
            >
              {isZh ? (metric === 'Single' ? '单次' : metric === 'Average' ? '平均' : metric) : metric}
            </button>
          ))}
        </div>
      )}
      {visibleSections.map(section => {
        const sectionTitle = isZh ? (section.titleZh || section.title) : section.title;
        const isCollapsed = collapsedSections.has(section.title);
        return (
          <div key={section.title} className="wca-stats-section">
            {!hideTitle && (
              <h3
                className="wca-stats-section-title"
                onClick={() => toggleSection(section.title)}
              >
                <ChevronRight size={14} strokeWidth={2} className={`wca-stats-chevron ${isCollapsed ? '' : 'open'}`} />
                {sectionTitle}
                <span className="wca-stats-section-count">{section.rows.length}</span>
              </h3>
            )}
            {(!isCollapsed || hideTitle) && (
              <StatsTable header={header} rows={section.rows} searchTerm={searchTerm} isZh={isZh} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function parseTimeValue(s: string): number {
  if (!s || s === 'DNF' || s === 'DNS') return NaN;
  const m = s.match(/^(\d+):(\d+\.\d+)$/);
  if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
  const v = parseFloat(s);
  return isNaN(v) ? NaN : v;
}

function extractSolvesCell(row: unknown[]): { _type: 'solves'; csv: string } | null {
  for (const cell of row) {
    if (cell && typeof cell === 'object' && (cell as Record<string, unknown>)._type === 'solves') {
      return cell as { _type: 'solves'; csv: string };
    }
  }
  return null;
}

function extractTextFromMdLink(s: string): string {
  const m = String(s).match(/^\[([^\]]+)\]\([^)]+\)$/);
  return m ? m[1] : String(s);
}

function AoxRankingSection({ header, rows, isZh }: {
  header: StatHeader[];
  rows: unknown[][];
  isZh: boolean;
}) {
  const [checkedRows, setCheckedRows] = useState<Set<number>>(() => new Set([0]));

  const rowData = useMemo(() => {
    const personIdx = header.findIndex(h => h.key === 'person');
    return rows.map(row => {
      const solvesCell = extractSolvesCell(row);
      const times = solvesCell
        ? solvesCell.csv.split(',').map(parseTimeValue).filter(v => !isNaN(v) && v > 0)
        : [];
      const name = personIdx >= 0 ? extractTextFromMdLink(String(row[personIdx])) : `Row`;
      return { name, times };
    });
  }, [rows, header]);

  const datasets: DistDataset[] = useMemo(() => {
    return Array.from(checkedRows)
      .filter(i => i < rowData.length && rowData[i].times.length >= 5)
      .map(i => ({ name: rowData[i].name, times: rowData[i].times }));
  }, [checkedRows, rowData]);

  const toggleRow = useCallback((idx: number) => {
    setCheckedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        if (next.size <= 1) return prev;
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setCheckedRows(prev => {
      if (prev.size === rows.length) {
        return new Set([0]);
      }
      return new Set(rows.map((_, i) => i));
    });
  }, [rows]);

  const hasSolves = rowData.some(rd => rd.times.length > 0);

  return (
    <>
      <div className="wca-stats-table-wrapper">
        <table className="wca-stats-table">
          <thead>
            <tr>
              {hasSolves && (
                <th style={{ textAlign: 'center', cursor: 'pointer', width: 34 }}
                  title={isZh ? '全选/取消' : 'Select all'}
                  onClick={toggleAll}>
                  <BarChart3 size={14} strokeWidth={1.75} style={{ verticalAlign: 'middle' }} />
                </th>
              )}
              {header.map(h => shouldHideCountryCol(h.key, header) ? null : (
                <th key={h.key} style={{ textAlign: h.align }}>
                  {isZh ? h.labelZh : h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {hasSolves && (
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox"
                      checked={checkedRows.has(i)}
                      onChange={() => toggleRow(i)}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                  </td>
                )}
                {row.map((cell, j) => {
                  const colKey = header[j]?.key ?? '';
                  if (shouldHideCountryCol(colKey, header)) return null;
                  const isCountryCol = colKey === 'country';
                  const flagIso2 = isCountryCol ? countryToIso2(String(cell)) : '';
                  return (
                    <td key={j} style={{ textAlign: header[j]?.align }}>
                      {flagIso2 && <Flag iso2={flagIso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
                      {renderCell(cell, colKey, isZh)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {datasets.length > 0 && (
        <DistributionChart datasets={datasets} isZh={isZh} />
      )}
    </>
  );
}

function dedupRows(rows: unknown[][], header: StatHeader[]): unknown[][] {
  let daysIdx = -1, startCompIdx = -1;
  header.forEach((h, i) => {
    if (h.key === 'days') daysIdx = i;
    if (h.key === 'start_comp') startCompIdx = i;
  });
  if (daysIdx === -1 && startCompIdx === -1) return rows;

  const result: unknown[][] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (daysIdx >= 0 && String(row[daysIdx] ?? '').trim() === '0') continue;
    if (startCompIdx >= 0 && i > 0) {
      const prev = String(rows[i - 1]?.[startCompIdx] ?? '').trim();
      const cur = String(row[startCompIdx] ?? '').trim();
      if (cur && cur === prev) continue;
    }
    result.push(row);
  }
  return result;
}

function PanelsView({ panels, searchTerm, isZh, selectedEvent, activePanel, onSetActivePanel, belowTabs }: {
  panels: StatPanel[];
  searchTerm: string;
  isZh: boolean;
  selectedEvent?: string;
  activePanel: number;
  onSetActivePanel: (idx: number) => void;
  belowTabs?: React.ReactNode;
}) {
  const [dedup, setDedup] = useState(true);
  const [metric, setMetric] = useState<string | null>(null);
  const panel = panels[activePanel] ?? panels[0];

  const isAoxData = useMemo(() => {
    const rankingPanel = panels.find(p => p.id === 'ranking');
    if (!rankingPanel) return false;
    return rankingPanel.sections.some(s =>
      s.rows.some(row => row.some(cell =>
        cell && typeof cell === 'object' && (cell as Record<string, unknown>)._type === 'solves'
      ))
    );
  }, [panels]);

  const showDedup = isAoxData && panel?.id === 'history';

  const metrics = useMemo(() => {
    const set = new Set<string>();
    panel?.sections.forEach(s => {
      const i = s.title.lastIndexOf(' - ');
      if (i >= 0) set.add(s.title.substring(i + 3));
    });
    return Array.from(set);
  }, [panel]);
  const activeMetric = metric && metrics.includes(metric) ? metric : metrics[0] ?? null;

  const dedupedSections = useMemo(() => {
    if (!panel) return [];
    if (!showDedup || !dedup) return panel.sections;
    return panel.sections.map(s => ({ ...s, rows: dedupRows(s.rows, panel.header) }));
  }, [panel, showDedup, dedup]);

  const baseSections = showDedup && dedup ? dedupedSections : panel?.sections ?? [];
  const activeSections = metrics.length >= 2 && activeMetric
    ? baseSections.filter(s => s.title.endsWith(` - ${activeMetric}`))
    : baseSections;

  const historyChartData = useMemo(() => {
    if (!panel || panel.id !== 'history') return null;
    const visible = selectedEvent
      ? activeSections.filter(s => {
          let eventId = EVENT_NAME_TO_ID[s.title];
          if (!eventId && s.title.includes(' - ')) {
            const eventName = s.title.substring(0, s.title.lastIndexOf(' - '));
            eventId = EVENT_NAME_TO_ID[eventName];
          }
          return eventId === selectedEvent;
        })
      : activeSections;
    const allRows = visible.flatMap(s => s.rows);
    return allRows.length > 0 ? allRows : null;
  }, [panel, selectedEvent, activeSections]);

  if (!panel) return null;

  return (
    <>
      {metrics.length >= 2 && (
        <div className="wca-stats-tab-bar">
          {metrics.map(m => (
            <button
              key={m}
              className={`wca-stats-tab ${m === activeMetric ? 'active' : ''}`}
              onClick={() => setMetric(m)}
            >
              {isZh ? (m === 'Single' ? '单次' : m === 'Average' ? '平均' : m) : m}
            </button>
          ))}
        </div>
      )}
      <div className="wca-stats-tab-bar">
        {panels.map((p, i) => (
          <button
            key={p.id}
            className={`wca-stats-tab wca-stats-panel-tab ${i === activePanel ? 'active' : ''}`}
            onClick={() => onSetActivePanel(i)}
          >
            {isZh ? p.labelZh : p.labelEn}
          </button>
        ))}
        {showDedup && (
          <label className="wca-stats-dedup-toggle">
            <span>{isZh ? '日期去重' : 'Dedup'}</span>
            <input type="checkbox" checked={dedup} onChange={() => setDedup(!dedup)} />
            <span className="wca-stats-toggle-pill" />
          </label>
        )}
      </div>
      {belowTabs}
      {historyChartData && (
        <WrHistoryChart rows={historyChartData} header={panel.header} isZh={isZh} />
      )}
      {isAoxData && panel.id === 'ranking' ? (
        <AoxSectionsView
          header={panel.header}
          sections={activeSections}
          isZh={isZh}
          selectedEvent={selectedEvent}
        />
      ) : (
        <SectionsView
          header={panel.header}
          sections={activeSections}
          searchTerm={searchTerm}
          isZh={isZh}
          selectedEvent={selectedEvent}
        />
      )}
    </>
  );
}

function AoxSectionsView({ header, sections, isZh, selectedEvent }: {
  header: StatHeader[];
  sections: StatSection[];
  isZh: boolean;
  selectedEvent?: string;
}) {
  const visibleSections = useMemo(() => {
    if (!selectedEvent) return sections;
    return sections.filter(s => {
      let eventId = EVENT_NAME_TO_ID[s.title];
      if (!eventId && s.title.includes(' - ')) {
        const eventName = s.title.substring(0, s.title.lastIndexOf(' - '));
        eventId = EVENT_NAME_TO_ID[eventName];
      }
      return eventId === selectedEvent;
    });
  }, [sections, selectedEvent]);

  const hideTitle = !!selectedEvent && visibleSections.length === 1;

  return (
    <div className="wca-stats-sections">
      {visibleSections.map(section => {
        const sectionTitle = isZh ? (section.titleZh || section.title) : section.title;
        return (
          <div key={section.title} className="wca-stats-section">
            {!hideTitle && (
              <h3 className="wca-stats-section-title">
                {sectionTitle}
                <span className="wca-stats-section-count">{section.rows.length}</span>
              </h3>
            )}
            <AoxRankingSection header={header} rows={section.rows} isZh={isZh} />
          </div>
        );
      })}
    </div>
  );
}

function SourcePanelsView({ sourcePanels, searchTerm, isZh, selectedEvent, activePanel, onSetActivePanel }: {
  sourcePanels: SourcePanel[];
  searchTerm: string;
  isZh: boolean;
  selectedEvent?: string;
  activePanel: number;
  onSetActivePanel: (idx: number, panels: StatPanel[]) => void;
}) {
  const [activeSource, setActiveSource] = useState(0);
  const source = sourcePanels[activeSource];

  return (
    <>
      <div className="wca-stats-tab-bar">
        {sourcePanels.map((sp, i) => (
          <button
            key={sp.id}
            className={`wca-stats-tab ${i === activeSource ? 'active' : ''}`}
            onClick={() => setActiveSource(i)}
          >
            {isZh ? sp.labelZh : sp.labelEn}
          </button>
        ))}
      </div>
      {source && (
        <PanelsView panels={source.panels} searchTerm={searchTerm} isZh={isZh} selectedEvent={selectedEvent}
          activePanel={activePanel} onSetActivePanel={(idx) => onSetActivePanel(idx, source.panels)} />
      )}
    </>
  );
}

function MetricPanelsView({ metricPanels, metricGroups, searchTerm, isZh, selectedEvent, activeMetric, onSetActiveMetric, onSetActivePanel, activePanel, belowTabs }: {
  metricPanels: MetricPanel[];
  metricGroups?: MetricGroup[];
  searchTerm: string;
  isZh: boolean;
  selectedEvent?: string;
  activeMetric: number;
  onSetActiveMetric: (idx: number) => void;
  onSetActivePanel: (idx: number, panels: StatPanel[]) => void;
  activePanel: number;
  belowTabs?: React.ReactNode;
}) {
  const [pillOpen, setPillOpen] = useState(false);
  const pillRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pillOpen) return;
    const handler = (e: MouseEvent) => {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        setPillOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pillOpen]);

  const metricHasData = useMemo(() => {
    const map = new Map<number, boolean>();
    metricPanels.forEach((mp, idx) => {
      if (!selectedEvent) {
        map.set(idx, true);
        return;
      }
      const allPanels = getAllPanelsFromMetric(mp);
      const hasEvent = allPanels.some(panel =>
        panel.sections.some(sec => EVENT_NAME_TO_ID[sec.title] === selectedEvent)
      );
      map.set(idx, hasEvent);
    });
    return map;
  }, [metricPanels, selectedEvent]);

  useEffect(() => {
    if (metricHasData.get(activeMetric) === false) {
      const singleIdx = metricPanels.findIndex((mp, i) => mp.id === 'single' && metricHasData.get(i));
      if (singleIdx !== -1) { onSetActiveMetric(singleIdx); return; }
      const avgIdx = metricPanels.findIndex((mp, i) => mp.id === 'average' && metricHasData.get(i));
      if (avgIdx !== -1) { onSetActiveMetric(avgIdx); return; }
      const firstValid = metricPanels.findIndex((_, i) => metricHasData.get(i));
      if (firstValid !== -1) onSetActiveMetric(firstValid);
    }
  }, [metricHasData, activeMetric, metricPanels, onSetActiveMetric]);

  const metric = metricPanels[activeMetric];
  const METRIC_LABEL_OVERRIDE: Record<string, string> = { 'Ao3': 'Mo3' };
  const _labelEn = metric?.labelEn ?? '';
  const currentLabel = METRIC_LABEL_OVERRIDE[_labelEn] ?? (isZh ? metric?.labelZh : _labelEn) ?? _labelEn;

  const allMetricItems: Array<{ idx: number; label: string; disabled: boolean }> = useMemo(() => {
    const LABEL_OVERRIDE: Record<string, string> = {
      'Ao3': 'Mo3', 'Ao5': 'Ao5', 'Ao12': 'Ao12',
      'Ao25': 'Ao25', 'Ao50': 'Ao50', 'Ao100': 'Ao100', 'Ao1000': 'Ao1000',
    };
    const resolveLabel = (mp: MetricPanel) =>
      LABEL_OVERRIDE[mp.labelEn] ?? (isZh ? mp.labelZh : mp.labelEn);

    if (metricGroups) {
      return metricGroups.flatMap(g => g.items).map(itemId => {
        const idx = metricPanels.findIndex(mp => mp.id === itemId);
        if (idx === -1) return null;
        const mp = metricPanels[idx];
        return { idx, label: resolveLabel(mp), disabled: metricHasData.get(idx) === false };
      }).filter(Boolean) as Array<{ idx: number; label: string; disabled: boolean }>;
    }
    return metricPanels.map((mp, i) => ({
      idx: i,
      label: resolveLabel(mp),
      disabled: metricHasData.get(i) === false,
    }));
  }, [metricGroups, metricPanels, metricHasData, isZh]);

  return (
    <div className="wca-stats-metric-panels">
      {allMetricItems.length < 4 ? (
        <div className="wca-stats-tab-bar">
          {allMetricItems.map(({ idx, label, disabled }) => (
            <button
              key={idx}
              className={`wca-stats-tab${idx === activeMetric ? ' active' : ''}${disabled ? ' disabled' : ''}`}
              onClick={disabled ? undefined : () => onSetActiveMetric(idx)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div ref={pillRef} className="wca-stats-metric-pill" onClick={() => setPillOpen(o => !o)}>
          <span>{currentLabel}</span>
          <ChevronDown size={14} strokeWidth={2} className={`wca-stats-metric-pill-arrow${pillOpen ? ' open' : ''}`} />
          {pillOpen && (
            <div className="wca-stats-metric-dropdown" onClick={e => e.stopPropagation()}>
              {allMetricItems.map(({ idx, label, disabled }) => (
                <button
                  key={idx}
                  className={`wca-stats-metric-option${idx === activeMetric ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                  onClick={() => {
                    if (!disabled) { onSetActiveMetric(idx); setPillOpen(false); }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {metric && metric.sourcePanels ? (
        <SourcePanelsView sourcePanels={metric.sourcePanels} searchTerm={searchTerm} isZh={isZh} selectedEvent={selectedEvent}
          activePanel={activePanel} onSetActivePanel={onSetActivePanel} />
      ) : metric && metric.panels ? (
        <PanelsView panels={metric.panels} searchTerm={searchTerm} isZh={isZh} selectedEvent={selectedEvent}
          activePanel={activePanel} onSetActivePanel={(idx) => onSetActivePanel(idx, metric.panels!)}
          belowTabs={belowTabs} />
      ) : null}
    </div>
  );
}

function parseHash(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const h = window.location.hash.slice(1);
  return Object.fromEntries(h.split('&').filter(Boolean).map(s => s.split('=')));
}
function setHashParam(key: string, value: string) {
  if (typeof window === 'undefined') return;
  const p = parseHash();
  p[key] = value;
  const str = Object.entries(p).map(([k, v]) => `${k}=${v}`).join('&');
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${str}`);
}
function clearHashParam(key: string) {
  if (typeof window === 'undefined') return;
  const p = parseHash();
  delete p[key];
  const str = Object.entries(p).map(([k, v]) => `${k}=${v}`).join('&');
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${str ? '#' + str : ''}`);
}

export default function WcaStatsPage() {
  const params = useParams();
  const statIdRaw = params?.statId;
  const statId = Array.isArray(statIdRaw) ? statIdRaw[0] : (statIdRaw ?? '');
  const { i18n } = useTranslation();
  const [data, setData] = useState<StatData | null>(null);
  useDocumentTitle(data?.titleZh ?? 'WCA 统计', data?.title ?? 'WCA Stats');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [activePanel, setActivePanel] = useState(0);
  const [activeMetric, setActiveMetric] = useState(0);

  const isZh = i18n.language === 'zh';

  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!statId) return;
    setLoading(true);
    setError(null);
    setSelectedEvent('');
    setActivePanel(0);
    setActiveMetric(0);

    fetch(`/stats/${statId}.json`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: StatData) => {
        setData(json);
        setLoading(false);
        const h = parseHash();
        if (h.type) {
          const panels = json.panels ?? json.metricPanels?.[0]?.panels ?? [];
          const idx = panels.findIndex((p: StatPanel) => p.id === h.type);
          if (idx !== -1) setActivePanel(idx);
        }
        if (h.metric && json.metricPanels) {
          const idx = json.metricPanels.findIndex((mp: MetricPanel) => mp.id === h.metric);
          if (idx !== -1) setActiveMetric(idx);
        }
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [statId]);

  const handleSelectEvent = useCallback((ev: string) => {
    setSelectedEvent(ev);
    if (ev) setHashParam('event', ev); else clearHashParam('event');
  }, []);

  const handleSetActivePanel = useCallback((idx: number, panels: StatPanel[]) => {
    setActivePanel(idx);
    const id = panels[idx]?.id;
    if (id) setHashParam('type', id);
  }, []);

  const handleSetActiveMetric = useCallback((idx: number, metricPanels: MetricPanel[]) => {
    setActiveMetric(idx);
    const id = metricPanels[idx]?.id;
    if (id) setHashParam('metric', id);
  }, []);

  const renderMode = useMemo(() => {
    if (!data) return 'empty';
    if (data.metricPanels && data.metricPanels.length > 0) return 'metricPanels';
    if (data.panels && data.panels.length > 0) return 'panels';
    if (data.sections && data.sections.length > 0) return 'sections';
    if (data.rows && data.rows.length > 0) return 'rows';
    return 'empty';
  }, [data]);

  const availableEvents = useMemo((): Set<string> => {
    if (!data) return new Set();
    const ids = new Set<string>();
    const extractFromSections = (sections: StatSection[]) => {
      sections.forEach(s => {
        let eventId = EVENT_NAME_TO_ID[s.title];
        if (!eventId && s.title.includes(' - ')) {
          const eventName = s.title.substring(0, s.title.lastIndexOf(' - '));
          eventId = EVENT_NAME_TO_ID[eventName];
        }
        if (eventId) ids.add(eventId);
      });
    };
    if (data.sections) extractFromSections(data.sections);
    if (data.panels) data.panels.forEach(p => extractFromSections(p.sections));
    if (data.metricPanels) {
      data.metricPanels.forEach(mp => {
        const allPanels = getAllPanelsFromMetric(mp);
        allPanels.forEach(p => extractFromSections(p.sections));
      });
    }
    return ids;
  }, [data]);

  useEffect(() => {
    if (availableEvents.size > 0 && !selectedEvent) {
      const hashEvent = parseHash().event;
      const initial = (hashEvent && availableEvents.has(hashEvent))
        ? hashEvent
        : ALL_EVENT_IDS.find((id: string) => availableEvents.has(id));
      if (initial) {
        setSelectedEvent(initial);
        setHashParam('event', initial);
      }
    }
  }, [availableEvents, selectedEvent]);

  const showEventSelector = renderMode !== 'rows' && renderMode !== 'empty' && availableEvents.size >= 2;

  if (loading) {
    return (
      <div className="wca-stats-page">
        <div className="wca-stats-loading">{isZh ? '加载中...' : 'Loading...'}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="wca-stats-page">
        <div className="wca-stats-error">
          <h2>{isZh ? '加载失败' : 'Failed to load'}</h2>
          <p>{error || (isZh ? '未知错误' : 'Unknown error')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wca-stats-page">
      <div className="wca-stats-header">
        <h1>{isZh ? data.titleZh : data.title}</h1>
        {data.note && (
          <p className="wca-stats-note">{isZh ? (data.noteZh ?? data.note) : data.note}</p>
        )}
      </div>

      {showEventSelector && (
        <WcaEventSelector
          availableEvents={availableEvents}
          selectedEvent={selectedEvent}
          onSelect={handleSelectEvent}
          isZh={isZh}
        />
      )}

      {renderMode === 'rows' && data.rows && data.years && data.cumulative && (
        <WrByCountryYearView
          header={data.header}
          years={data.years}
          cumulative={data.cumulative}
          searchTerm={searchTerm}
          isZh={isZh}
        />
      )}
      {renderMode === 'rows' && data.rows && !(data.years && data.cumulative) && (
        <StatsTable header={data.header} rows={data.rows} searchTerm={searchTerm} isZh={isZh} />
      )}

      {renderMode === 'sections' && data.sections && (
        <SectionsView
          header={data.header}
          sections={data.sections}
          searchTerm={searchTerm}
          isZh={isZh}
          selectedEvent={showEventSelector ? selectedEvent : undefined}
        />
      )}

      {renderMode === 'panels' && data.panels && (
        <PanelsView
          panels={data.panels}
          searchTerm={searchTerm}
          isZh={isZh}
          selectedEvent={showEventSelector ? selectedEvent : undefined}
          activePanel={activePanel}
          onSetActivePanel={(idx) => handleSetActivePanel(idx, data.panels!)}
        />
      )}

      {renderMode === 'metricPanels' && data.metricPanels && (
        <MetricPanelsView
          metricPanels={data.metricPanels}
          metricGroups={data.metricGroups}
          searchTerm={searchTerm}
          isZh={isZh}
          selectedEvent={showEventSelector ? selectedEvent : undefined}
          activeMetric={activeMetric}
          onSetActiveMetric={(idx) => handleSetActiveMetric(idx, data.metricPanels!)}
          onSetActivePanel={(idx, panels) => handleSetActivePanel(idx, panels)}
          activePanel={activePanel}
          belowTabs={(() => {
            // NOTE: wr_metric ranking 面板专属——bar chart race 渲染在 排名/历史 tabs 下方、表格上方
            if (statId !== 'wr_metric' || activePanel !== 0) return null;
            const METRIC_KEY: Record<string, Top10Metric> = {
              single: 'single', average: 'average',
              bao5: 'bao5', wao5: 'wao5', mo5: 'mo5',
              bpa: 'bpa', wpa: 'wpa',
              median: 'median', bestc: 'best_counting', worstc: 'worst_counting',
              worst: 'worst',
            };
            const mp = data.metricPanels?.[activeMetric];
            const m = mp ? METRIC_KEY[mp.id] : undefined;
            if (!m) return null;
            return (
              <Top10HistoryPage
                controlledEventId={selectedEvent || '333'}
                controlledMetric={m}
                controlledMetricLabelZh={mp?.labelZh}
                controlledMetricLabelEn={mp?.labelEn}
              />
            );
          })()}
        />
      )}

      {renderMode === 'empty' && (
        <div className="wca-stats-empty-state">
          <div className="wca-stats-empty-title">
            {isZh ? '暂无数据' : 'No data yet'}
          </div>
          <div className="wca-stats-empty-hint">
            {isZh
              ? '此统计项当前为空 —— 可能是下一次 stats-build 会补全,或该口径下无人达成。'
              : 'This stat is currently empty — either no one meets the criteria, or it has yet to be computed.'}
          </div>
        </div>
      )}
    </div>
  );
}
