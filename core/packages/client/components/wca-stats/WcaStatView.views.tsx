'use client';

// Self-contained sub-view components for the WCA stat renderer.
// Extracted verbatim from WcaStatView.tsx — each takes explicit props, no shared
// closure state with the orchestrator. Composition among them (PanelsView →
// Aox/SectionsView, MetricPanelsView → SourcePanelsView → PanelsView) is internal.
// Two guard-forced, behavior-preserving adaptations vs the original inline code:
//   1. the four `isZh ? '<literal>' : '<literal>'` text ternaries → tr({zh,en})
//      (parent derives the isZh prop from the same global i18n.language);
//   2. the metric-pill toggle <div> gained role="button"/tabIndex/onKeyDown (it
//      can't be a real <button> — it wraps the nested option dropdown — and this
//      is the iOS-tap / a11y fix the static-onclick guard asks for).
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart3, Play, Pause, ChevronRight, ChevronDown } from 'lucide-react';
import BoolToggle from '@/components/BoolToggle';
import { countryToIso2 } from '@/lib/country-flags';
import { Flag } from '@/components/Flag';
import { EVENT_NAME_TO_ID } from '@/lib/event-constants';
import DistributionChart, { type DistDataset } from '@/components/wca-stats/DistributionChart';
import WrHistoryChart from '@/components/wca-stats/WrHistoryChart';
import { tr } from '@/i18n/tr';
import type { StatHeader, StatSection, StatPanel, SourcePanel, MetricPanel, MetricGroup } from './WcaStatView.types';
import {
  renderCell, shouldHideCountryCol, parseTimeValue, extractSolvesCell,
  extractTextFromMdLink, dedupRows, getAllPanelsFromMetric,
} from './WcaStatView.cells';

// 超过 PAGE_SIZE 行只先渲染前 N 行 + “显示更多/全部”按钮，避免大表（最多 5202 行）
// 一次性渲染全部 cell（markdown + flag + 本地化）卡死主线程。小分区不受影响。
const PAGE_SIZE = 300;

export function StatsTable({ header, rows, searchTerm, isZh }: {
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
    <div className="wca-stats-table-wrapper sticky-scroll">
      <table className="wca-stats-table sticky-thead">
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
            {tr({ zh: `显示更多（还有 ${remaining} 行）`, en: `Show more (${remaining} left)` })}
          </button>
          <button type="button" className="wca-stats-more-btn" onClick={() => setVisible(filtered.length)}>
            {tr({ zh: '全部显示', en: 'Show all'
            })}
          </button>
        </div>
      )}
    </div>
  );
}

export function WrByCountryYearView({ header, years, cumulative, searchTerm, isZh }: {
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
          title={playing ? tr({ zh: '暂停', en: 'Pause'
                  }) : tr({ zh: '播放', en: 'Play' })}
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
          {tr({ zh: `截至 ${year} 年`, en: `As of ${year}` })}
        </span>
      </div>
      <StatsTable header={header} rows={rowsAtYear} searchTerm={searchTerm} isZh={isZh} />
    </div>
  );
}

export function SectionsView({ header, sections, searchTerm, isZh, selectedEvent }: {
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
              {metric === 'Single' ? tr({ zh: '单次', en: 'Single' }) : metric === 'Average' ? tr({ zh: '平均', en: 'Average' }) : metric}
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

export function AoxRankingSection({ header, rows, isZh }: {
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
      <div className="wca-stats-table-wrapper sticky-scroll">
        <table className="wca-stats-table sticky-thead">
          <thead>
            <tr>
              {hasSolves && (
                <th style={{ textAlign: 'center', cursor: 'pointer', width: 34 }}
                  title={tr({ zh: '全选/取消', en: 'Select all'
                })}
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
                    {/* allow-checkbox: 逐行多选(挑成绩对比),非布尔开关,保留原生 checkbox */}
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

export function PanelsView({ panels, searchTerm, isZh, selectedEvent, activePanel, onSetActivePanel, belowTabs }: {
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
              {m === 'Single' ? tr({ zh: '单次', en: 'Single' }) : m === 'Average' ? tr({ zh: '平均', en: 'Average' }) : m}
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
            {(isZh ? p.labelZh : p.labelEn)}
          </button>
        ))}
        {showDedup && (
          <BoolToggle
            className="wca-stats-dedup-toggle"
            value={dedup}
            onChange={setDedup}
            label={tr({ zh: '日期去重', en: 'Dedup' })}
          />
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

export function AoxSectionsView({ header, sections, isZh, selectedEvent }: {
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

export function SourcePanelsView({ sourcePanels, searchTerm, isZh, selectedEvent, activePanel, onSetActivePanel, sourceBool }: {
  sourcePanels: SourcePanel[];
  searchTerm: string;
  isZh: boolean;
  selectedEvent?: string;
  activePanel: number;
  onSetActivePanel: (idx: number, panels: StatPanel[]) => void;
  sourceBool?: { labelEn: string; labelZh: string };
}) {
  const [activeSource, setActiveSource] = useState(0);
  const source = sourcePanels[activeSource];
  // NOTE: sourceBool 且恰为 2 个源时——渲染布尔开关（off=源[0], on=源[1]）替代 tab bar。
  const asBool = !!sourceBool && sourcePanels.length === 2;

  return (
    <>
      <div className="wca-stats-tab-bar">
        {asBool ? (
          <BoolToggle
            value={activeSource === 1}
            onChange={on => setActiveSource(on ? 1 : 0)}
            label={(isZh ? sourceBool!.labelZh : sourceBool!.labelEn)}
          />
        ) : sourcePanels.map((sp, i) => (
          <button
            key={sp.id}
            className={`wca-stats-tab ${i === activeSource ? 'active' : ''}`}
            onClick={() => setActiveSource(i)}
          >
            {(isZh ? sp.labelZh : sp.labelEn)}
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

export function MetricPanelsView({ metricPanels, metricGroups, searchTerm, isZh, selectedEvent, hideSelector, activeMetric, onSetActiveMetric, onSetActivePanel, activePanel, belowTabs }: {
  metricPanels: MetricPanel[];
  metricGroups?: MetricGroup[];
  searchTerm: string;
  isZh: boolean;
  selectedEvent?: string;
  hideSelector?: boolean;  // 宿主页把指标选择器提到外层(/wca/results 顶层下拉)时,隐藏内置那份避免重复
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
      LABEL_OVERRIDE[mp.labelEn] ?? ((isZh ? mp.labelZh : mp.labelEn));

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
      {!hideSelector && (allMetricItems.length < 4 ? (
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
        <div
          ref={pillRef}
          className="wca-stats-metric-pill"
          role="button"
          tabIndex={0}
          onClick={() => setPillOpen(o => !o)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPillOpen(o => !o); } }}
        >
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
      ))}

      {metric && metric.sourcePanels ? (
        <SourcePanelsView sourcePanels={metric.sourcePanels} searchTerm={searchTerm} isZh={isZh} selectedEvent={selectedEvent}
          activePanel={activePanel} onSetActivePanel={onSetActivePanel} sourceBool={metric.sourceBool} />
      ) : metric && metric.panels ? (
        <PanelsView panels={metric.panels} searchTerm={searchTerm} isZh={isZh} selectedEvent={selectedEvent}
          activePanel={activePanel} onSetActivePanel={(idx) => onSetActivePanel(idx, metric.panels!)}
          belowTabs={belowTabs} />
      ) : null}
    </div>
  );
}
