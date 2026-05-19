// NOTE: WCA 统计数据页 — 通用渲染器
// 支持 4 种 JSON 输出模式：rows / sections / panels / metricPanels
// 路由：/wca/:statId
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import { hasAbout } from '../wca_about/registry';
import { getLangQuery } from '../../i18n';
import WcaEventSelector from '../../components/WcaEventSelector';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import { EVENT_NAME_TO_ID, ALL_EVENT_IDS } from './event_constants';
import { countryToIso2, loadFlagData, flagDataVersion, extractWcaId, extractCompId, personFlagIso2, compFlagIso2, compNameZh } from '../../utils/country_flags';
import { stripWcaPrefix } from '../../utils/comp_localize';
import { Flag } from '../../utils/flag';
import DistributionChart from './DistributionChart';
import type { DistDataset } from './DistributionChart';
import WrHistoryChart from './WrHistoryChart';
import { translateCellText, translatePersonLink, stripChineseParens } from './wca_translations';
import { rewriteWcaCompUrl, prefetchComp } from '../../utils/comp_link';
import { EventIcon } from '../../components/EventIcon/EventIcon';
import { isWcaEvent, eventDisplayName } from '../../utils/wca_events';
import LangToggle from '../../components/LangToggle';
import Top10HistoryPage from './Top10HistoryPage';
import './wca_stats.css';
import '../wca_about/wca_about.css';

// NOTE: JSON schema 与 stats-build 输出一致
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

// NOTE: 数据源面板（wr_newcomer 的第二层：1st-solve / 1st-comp）
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
  panels?: StatPanel[];          // 2 级结构（直接 ranking/history）
  sourcePanels?: SourcePanel[];  // 3 级结构（source → ranking/history）
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
  // NOTE: 时间轴数据——world_records_by_country 专用
  years?: number[];
  cumulative?: Record<string, number[]>;
}

// NOTE: 工具函数——从 MetricPanel 中统一提取所有 StatPanel（兼容 2 级和 3 级结构）
function getAllPanelsFromMetric(mp: MetricPanel): StatPanel[] {
  if (mp.panels) return mp.panels;
  if (mp.sourcePanels) return mp.sourcePanels.flatMap(sp => sp.panels);
  return [];
}

// NOTE: 懒加载阈值——超过此数量的 solves 用折叠方式展示
const LAZY_THRESHOLD = 12;

// NOTE: 按每 10 个分组渲染 solves
// ≤12 个单行展示（ao5/ao12 等），>12 个按 10 个一行分组
function renderSolves(items: string[]): React.ReactNode {
  if (items.length <= LAZY_THRESHOLD) {
    // NOTE: ≤12 个——全部放一行
    return (
      <div className="solve-list">
        <div className="solve-row">
          {items.map((s, i) => <span key={i}>{s}</span>)}
        </div>
      </div>
    );
  }
  // NOTE: >12 个——按 10 个一行分组
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

// NOTE: 解析 Markdown 链接 [text](url)、加粗 **text**、HTML <br /> 为 React 元素
// 同时处理 _type: 'solves' 结构化对象（AverageOfX Details 列）
function renderCell(value: unknown, columnKey?: string, isZh?: boolean): React.ReactNode {
  // NOTE: 类型判别器——AverageOfX 的 Details 列输出结构化对象
  if (value && typeof value === 'object' && (value as Record<string, unknown>)._type === 'solves') {
    const cell = value as { _type: 'solves'; csv: string };
    const items = cell.csv.split(',');
    if (items.length <= LAZY_THRESHOLD) {
      return renderSolves(items);
    }
    // NOTE: >12 个成绩——折叠展示（对标 Legacy <details data-solves>）
    return (
      <details className="solve-details">
        <summary>{items.length} solves</summary>
        {renderSolves(items)}
      </details>
    );
  }

  // NOTE: 数组格式 details（wr_current 等输出字符串数组，解决多盲含空格的拆分问题）
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

  // NOTE: details 列普通字符串——空格分隔（旧格式兼容）
  if (columnKey === 'details' && typeof value === 'string' && value.trim()) {
    const items = value.trim().split(/\s+/);
    if (items.length > 1) return renderSolves(items);
  }

  // NOTE: 项目列只显示 cubing-icon —— 不带文字
  if (columnKey === 'event' && !str.includes('[') && isWcaEvent(str.trim())) {
    return <EventIcon event={str.trim()} className="wca-stats-event-icon" title={eventDisplayName(str.trim(), !!isZh)} />;
  }

  // NOTE: 中英文模式均尝试翻译（中文：项目名/类型，英文：event 列去 Cube 后缀）
  if (columnKey && !str.includes('[')) {
    const translated = translateCellText(str.trim(), columnKey, isZh);
    if (translated) return <>{translated}</>;
  }

  // NOTE: 处理 Markdown 加粗 **text**
  const boldMatch = /^\*\*(.+)\*\*$/.exec(str);
  if (boldMatch) {
    return <strong>{boldMatch[1]}</strong>;
  }

  // NOTE: 先按 <br /> 或 <br> 分割，再处理每段中的 Markdown 链接
  const brParts = str.split(/<br\s*\/?>/i);
  const hasBr = brParts.length > 1;

  const renderSegment = (segment: string, segIdx: number): React.ReactNode => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(segment)) !== null) {
      if (match.index > lastIndex) {
        parts.push(segment.slice(lastIndex, match.index));
      }
      // NOTE: 检测 WCA person/competition 链接，在 <a> 前注入国旗
      const url = match[2];
      const wcaId = extractWcaId(url);
      const compId = extractCompId(url);
      const iso2 = wcaId ? personFlagIso2(wcaId) : compId ? compFlagIso2(compId) : '';
      if (iso2) {
        // NOTE: TW 走 country-flag-ct（img 专用尺寸），其他走 country-flag（span 通过 line-height 对齐文字）
        parts.push(<Flag key={`flag-${segIdx}-${match.index}`} iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />);
        parts.push(' ');
      }
      // NOTE: 选手名——中文模式提取中文名，否则统一去掉括号
      let displayText = match[1];
      if (columnKey === 'person' || columnKey === 'name') {
        if (isZh) {
          const zhName = translatePersonLink(displayText);
          displayText = zhName || stripChineseParens(displayText);
        } else {
          displayText = stripChineseParens(displayText);
        }
      }
      // NOTE: 比赛名——中文模式查 compNamesZh 映射表（对标 Recon displayCompName）；显示前剥 "WCA "
      if (compId) {
        if (isZh) {
          const zhComp = compNameZh(displayText);
          if (zhComp) displayText = zhComp;
        }
        displayText = stripWcaPrefix(displayText);
      }
      const internalHref = compId ? rewriteWcaCompUrl(url) : null;
      const prefetch = compId ? () => prefetchComp(compId) : undefined;
      parts.push(
        internalHref
          ? <Link key={`${segIdx}-${match.index}`} to={internalHref} onMouseEnter={prefetch} onFocus={prefetch} onTouchStart={prefetch}>{displayText}</Link>
          : <a key={`${segIdx}-${match.index}`} href={url} target="_blank" rel="noopener noreferrer">{displayText}</a>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < segment.length) {
      parts.push(segment.slice(lastIndex));
    }
    return parts.length === 1 ? parts[0] : <React.Fragment key={segIdx}>{parts}</React.Fragment>;
  };

  if (!hasBr) return renderSegment(str, 0);

  // NOTE: <br /> 渲染为真正换行（对标 Legacy 表格中的多行数据）
  const result: React.ReactNode[] = [];
  brParts.forEach((part, i) => {
    if (i > 0) result.push(<br key={`br-${i}`} />);
    result.push(renderSegment(part, i));
  });
  return <>{result}</>;
}

// NOTE: 国家列隐藏规则——只有当 header 里已有带国旗的 person/name 列时才隐藏 country（冗余）；
// 否则（如 world_records_by_country 这类 country 为主维度的 stat）必须保留
function shouldHideCountryCol(colKey: string, header: StatHeader[]): boolean {
  if (colKey !== 'country' && colKey !== 'country_id') return false;
  return header.some(h => h.key === 'person' || h.key === 'name');
}

// NOTE: 通用表格组件——在多处复用
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
          {filtered.map((row, i) => (
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
    </div>
  );
}

// NOTE: world_records_by_country 专用年份 slider 视图
// 根据 cumulative[country][yearIdx] 动态生成"截至该年"的降序表
function WrByCountryYearView({ header, years, cumulative, searchTerm, isZh }: {
  header: StatHeader[];
  years: number[];
  cumulative: Record<string, number[]>;
  searchTerm: string;
  isZh: boolean;
}) {
  const maxYear = years[years.length - 1] ?? new Date().getFullYear();
  // slider 左端固定从 2002 起（WCA 2003 复办前几乎无数据；cumulative 仍含 1982 早年 WR）
  const minYear = 2002;
  const [year, setYear] = useState<number>(maxYear);
  const [playing, setPlaying] = useState(false);

  // NOTE: 播放动画——每 500ms 自增一年，到顶后停止
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
      <div className="wr-year-controls" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            if (playing) { setPlaying(false); return; }
            // 到头了按播放 → 从最左重新开始
            if (year >= maxYear) setYear(minYear);
            setPlaying(true);
          }}
          className="wr-year-play-btn"
          style={{ padding: '4px 10px', cursor: 'pointer' }}
          title={playing ? (isZh ? '暂停' : 'Pause') : (isZh ? '播放' : 'Play')}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={minYear}
          max={maxYear}
          step={1}
          value={year}
          onChange={e => { setPlaying(false); setYear(Number(e.target.value)); }}
          style={{ flex: 1, minWidth: 200 }}
        />
        <span style={{ minWidth: 140, fontVariantNumeric: 'tabular-nums' }}>
          {isZh ? `截至 ${year} 年` : `As of ${year}`}
        </span>
      </div>
      <StatsTable header={header} rows={rowsAtYear} searchTerm={searchTerm} isZh={isZh} />
    </div>
  );
}

// NOTE: Sections 渲染——按项目分节展示（每节可折叠）
// selectedEvent 可选：有值时只显示匹配的 section（项目选择器过滤）
function SectionsView({ header, sections, searchTerm, isZh, selectedEvent }: {
  header: StatHeader[];
  sections: StatSection[];
  searchTerm: string;
  isZh: boolean;
  selectedEvent?: string;
}) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  // NOTE: 指标过滤——检测 sections 是否含 " - Single"/" - Average" 后缀
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const toggleSection = useCallback((title: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }, []);

  // NOTE: 检测可用指标后缀（如 Single, Average）
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

  // NOTE: 只有检测到 >= 2 种指标后缀时才显示切换器
  const showMetricFilter = availableMetrics.size >= 2;

  // NOTE: 默认选中第一个指标
  useEffect(() => {
    if (showMetricFilter && !selectedMetric) {
      setSelectedMetric(Array.from(availableMetrics)[0]);
    }
  }, [showMetricFilter, availableMetrics, selectedMetric]);

  // NOTE: 按 selectedEvent 过滤 sections（无 selectedEvent 时显示全部）
  // 支持纯项目名和含指标后缀（如 "Rubik's Cube - Single"）的 title
  const visibleSections = useMemo(() => {
    let result = sections;
    // 按项目过滤
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
    // 按指标过滤
    if (selectedMetric) {
      result = result.filter(s => s.title.endsWith(` - ${selectedMetric}`));
    }
    return result;
  }, [sections, selectedEvent, selectedMetric]);

  // NOTE: 当项目选择器选中后只剩一个 section 时，标题冗余（对标 Legacy 删除 h3）
  const hideTitle = visibleSections.length === 1;

  return (
    <div className="wca-stats-sections">
      {/* NOTE: 指标药丸切换器（仅含 " - Single"/" - Average" 后缀时显示） */}
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
                <span className={`wca-stats-chevron ${isCollapsed ? '' : 'open'}`}>▶</span>
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

// NOTE: 成绩解析——将格式化的秒数字符串转为数值（供分布图用）
// 支持 "3.84", "1:23.45", DNF 返回 NaN
function parseTimeValue(s: string): number {
  if (!s || s === 'DNF' || s === 'DNS') return NaN;
  const m = s.match(/^(\d+):(\d+\.\d+)$/);
  if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
  const v = parseFloat(s);
  return isNaN(v) ? NaN : v;
}

// NOTE: 从行中提取 _type:'solves' 单元格
function extractSolvesCell(row: unknown[]): { _type: 'solves'; csv: string } | null {
  for (const cell of row) {
    if (cell && typeof cell === 'object' && (cell as Record<string, unknown>)._type === 'solves') {
      return cell as { _type: 'solves'; csv: string };
    }
  }
  return null;
}

// NOTE: 从 Markdown 链接中提取纯文本
function extractTextFromMdLink(s: string): string {
  const m = String(s).match(/^\[([^\]]+)\]\([^)]+\)$/);
  return m ? m[1] : String(s);
}

// NOTE: AoX Ranking Section——加 checkbox + 分布图
// 对标 Legacy distribution_chart.js 的 initStatsDistChart 行为
function AoxRankingSection({ header, rows, isZh }: {
  header: StatHeader[];
  rows: unknown[][];
  isZh: boolean;
}) {
  const [checkedRows, setCheckedRows] = useState<Set<number>>(() => new Set([0]));

  // NOTE: 提取每行的 name 和 times
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

  // NOTE: 构建分布图数据集——仅含勾选行
  const datasets: DistDataset[] = useMemo(() => {
    return Array.from(checkedRows)
      .filter(i => i < rowData.length && rowData[i].times.length >= 5)
      .map(i => ({ name: rowData[i].name, times: rowData[i].times }));
  }, [checkedRows, rowData]);

  const toggleRow = useCallback((idx: number) => {
    setCheckedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        // NOTE: 至少保留一个选中
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
        // 全选 → 只保留第一个
        return new Set([0]);
      }
      // 部分选中 → 全选
      return new Set(rows.map((_, i) => i));
    });
  }, [rows]);

  // NOTE: 检测是否有 solves 数据（只在 AoX ranking 表中才有）
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
                  onClick={toggleAll}>📊</th>
              )}
              {header.map(h => (
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
      {/* NOTE: 分布图——在表格下方 */}
      {datasets.length > 0 && (
        <DistributionChart datasets={datasets} isZh={isZh} />
      )}
    </>
  );
}

// NOTE: Dedup 过滤——与 Legacy stats_ui.ts initHideDays0 对应
// 规则 1: Days 列 == '0' 的行
// 规则 2: 相邻行（表格降序排列）Start Comp 相同时，标记下方行（更旧的记录）
function dedupRows(rows: unknown[][], header: StatHeader[]): unknown[][] {
  // 找 Days 和 Start Comp 列索引
  let daysIdx = -1, startCompIdx = -1;
  header.forEach((h, i) => {
    if (h.key === 'days') daysIdx = i;
    if (h.key === 'start_comp') startCompIdx = i;
  });
  if (daysIdx === -1 && startCompIdx === -1) return rows;

  const result: unknown[][] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // 规则 1: Days == '0'
    if (daysIdx >= 0 && String(row[daysIdx] ?? '').trim() === '0') continue;
    // 规则 2: 与上方行 Start Comp 相同（表降序：i 更大 = 更旧），跳过更旧的
    if (startCompIdx >= 0 && i > 0) {
      const prev = String(rows[i - 1]?.[startCompIdx] ?? '').trim();
      const cur = String(row[startCompIdx] ?? '').trim();
      if (cur && cur === prev) continue;
    }
    result.push(row);
  }
  return result;
}

// NOTE: Panels 渲染——Tab 切换（如 Ranking / History）
// 增强：检测 AoX 面板，自动集成分布图（ranking）和折线图（history）
function PanelsView({ panels, searchTerm, isZh, selectedEvent, activePanel, onSetActivePanel, belowTabs }: {
  panels: StatPanel[];
  searchTerm: string;
  isZh: boolean;
  selectedEvent?: string;
  activePanel: number;
  onSetActivePanel: (idx: number) => void;
  belowTabs?: React.ReactNode;
}) {
  // NOTE: Dedup 开关——默认 ON（与 Legacy 一致）
  const [dedup, setDedup] = useState(true);
  const panel = panels[activePanel] ?? panels[0];
  if (!panel) return null;

  // NOTE: 检测是否为 AoX 数据——ranking panel 含 _type:'solves' 的 Details 列
  const isAoxData = useMemo(() => {
    const rankingPanel = panels.find(p => p.id === 'ranking');
    if (!rankingPanel) return false;
    return rankingPanel.sections.some(s =>
      s.rows.some(row => row.some(cell =>
        cell && typeof cell === 'object' && (cell as Record<string, unknown>)._type === 'solves'
      ))
    );
  }, [panels]);

  // NOTE: 是否显示 dedup toggle——仅 AoX 的 history 面板
  const showDedup = isAoxData && panel.id === 'history';

  // NOTE: 对 history sections 应用 dedup 过滤
  const dedupedSections = useMemo(() => {
    if (!showDedup || !dedup) return panel.sections;
    return panel.sections.map(s => ({
      ...s,
      rows: dedupRows(s.rows, panel.header),
    }));
  }, [panel, showDedup, dedup]);

  // NOTE: 为 history 面板收集当前可见 section 的 rows（供折线图用）
  const historyChartData = useMemo(() => {
    if (panel.id !== 'history') return null;
    const sections = dedup ? dedupedSections : panel.sections;
    // 过滤出当前 selectedEvent 的 section rows
    const visibleSections = selectedEvent
      ? sections.filter(s => {
          let eventId = EVENT_NAME_TO_ID[s.title];
          if (!eventId && s.title.includes(' - ')) {
            const eventName = s.title.substring(0, s.title.lastIndexOf(' - '));
            eventId = EVENT_NAME_TO_ID[eventName];
          }
          return eventId === selectedEvent;
        })
      : sections;
    const allRows = visibleSections.flatMap(s => s.rows);
    return allRows.length > 0 ? allRows : null;
  }, [panel, isAoxData, selectedEvent, dedup, dedupedSections]);

  // NOTE: 当前面板实际使用的 sections（dedup 后的或原始的）
  const activeSections = showDedup && dedup ? dedupedSections : panel.sections;

  return (
    <>
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
        {/* NOTE: Dedup toggle——与 Legacy iOS 药丸风格一致 */}
        {showDedup && (
          <label className="wca-stats-dedup-toggle">
            <span>{isZh ? '日期去重' : 'Dedup'}</span>
            <input type="checkbox" checked={dedup} onChange={() => setDedup(!dedup)} />
            <span className="wca-stats-toggle-pill" />
          </label>
        )}
      </div>
      {belowTabs}
      {/* NOTE: History 面板——折线图在 sections 之上 */}
      {historyChartData && (
        <WrHistoryChart rows={historyChartData} header={panel.header} isZh={isZh} />
      )}
      {/* NOTE: Ranking 面板——用 AoxRankingSection 替代普通 SectionsView */}
      {isAoxData && panel.id === 'ranking' ? (
        <AoxSectionsView
          header={panel.header}
          sections={panel.sections}
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

// NOTE: AoX 专用 SectionsView——每个 section 用 AoxRankingSection（含 checkbox + 分布图）
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

// NOTE: SourcePanels 渲染——三级嵌套（如 wr_newcomer：metric → source → tab）
// 对标 Legacy stats_ui.ts switchSource() + source-panel 切换
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

  // NOTE: 用 Fragment 替代 div，让 tab-bar 可以和上层按钮流在同一行
  return (
    <>
      {/* NOTE: Source 选择按钮（如 "1st Solve" / "1st Comp"） */}
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
      {/* NOTE: 当前 source 的 Ranking/History Panels */}
      {source && (
        <PanelsView panels={source.panels} searchTerm={searchTerm} isZh={isZh} selectedEvent={selectedEvent}
          activePanel={activePanel} onSetActivePanel={(idx) => onSetActivePanel(idx, source.panels)} />
      )}
    </>
  );
}

// NOTE: MetricPanels 渲染——多级面板（指标选择 + Ranking/History Tab）
// selectedEvent 可选：有值时计算每个 metric 是否有该项目的数据，无数据的 metric 灰掉
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

  // NOTE: 点击外部关闭下拉
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

  // NOTE: 计算每个 metricPanel 是否有当前项目的数据（对标 Legacy handleMetricPage L417-430）
  const metricHasData = useMemo(() => {
    const map = new Map<number, boolean>();
    metricPanels.forEach((mp, idx) => {
      if (!selectedEvent) {
        map.set(idx, true);
        return;
      }
      // NOTE: 遍历 metric 下所有 panels 的 sections（兼容 2 级和 3 级结构）
      const allPanels = getAllPanelsFromMetric(mp);
      const hasEvent = allPanels.some(panel =>
        panel.sections.some(sec => EVENT_NAME_TO_ID[sec.title] === selectedEvent)
      );
      map.set(idx, hasEvent);
    });
    return map;
  }, [metricPanels, selectedEvent]);

  // NOTE: 当前 metric 变为无数据时自动回退（对标 Legacy L460-467）
  // 回退优先级：single > average > 第一个有数据的
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
  // NOTE: override 优先；无 override 时走正常中英文逻辑
  const currentLabel = METRIC_LABEL_OVERRIDE[_labelEn] ?? (isZh ? metric?.labelZh : _labelEn) ?? _labelEn;

  // NOTE: 获取所有可选指标列表（metricGroups 模式或直接列表）
  const allMetricItems: Array<{ idx: number; label: string; disabled: boolean }> = useMemo(() => {
    // NOTE: 只有明确列在 LABEL_OVERRIDE 里的 key 才跳过翻译（如 Ao3→Mo3）
    // Ao5/Ao12 等 average_of 系列也在此强制用英文；其他统计（Single/Average...）正常走 isZh
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
      {/* NOTE: 指标 < 4 个用扁平 tab 按钮；≥ 4 个才折叠成下拉药丸 */}
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
          <span className={`wca-stats-metric-pill-arrow${pillOpen ? ' open' : ''}`}>▼</span>
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

      {/* NOTE: 选中指标的渲染——支持 2 级（panels）和 3 级（sourcePanels）结构 */}
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

// NOTE: hash 辅助——读写 #event=333&type=ranking&metric=single
function parseHash(): Record<string, string> {
  const h = window.location.hash.slice(1);
  return Object.fromEntries(h.split('&').filter(Boolean).map(s => s.split('=')));
}
function setHashParam(key: string, value: string) {
  const p = parseHash();
  p[key] = value;
  const str = Object.entries(p).map(([k, v]) => `${k}=${v}`).join('&');
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${str}`);
}
function clearHashParam(key: string) {
  const p = parseHash();
  delete p[key];
  const str = Object.entries(p).map(([k, v]) => `${k}=${v}`).join('&');
  const suffix = str ? `#${str}` : window.location.search;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${str ? '#' + str : ''}`);
  void suffix; // suppress lint
}

export default function WcaStatsPage() {
  const { statId } = useParams<{ statId: string }>();
  const { i18n } = useTranslation();
  const [data, setData] = useState<StatData | null>(null);
  useDocumentTitle(data?.titleZh ?? 'WCA 统计', data?.title ?? 'WCA Stats');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  // NOTE: activePanel(ranking/history) 和 activeMetric(single/average) 提升到此处以便 hash 同步
  const [activePanel, setActivePanel] = useState(0);
  const [activeMetric, setActiveMetric] = useState(0);

  const isZh = i18n.language === 'zh';

  // NOTE: 切换语言——已统一到 LangToggle 组件

  // NOTE: 异步加载国旗映射数据（person_countries.json + comp_countries.json）
  // flagVer 变化时触发 re-render，使国旗 span 获得正确的 className
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: 从 /stats/<statId>.json 加载数据，切换时重置所有子状态
  useEffect(() => {
    if (!statId) return;
    setLoading(true);
    setError(null);
    setSearchTerm('');
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
        // NOTE: 数据加载完成后从 hash 恢复状态
        const h = parseHash();
        if (h.type) {
          // 找 panel index by id
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

  // NOTE: selectedEvent 变化时写入 hash
  const handleSelectEvent = useCallback((ev: string) => {
    setSelectedEvent(ev);
    if (ev) setHashParam('event', ev); else clearHashParam('event');
  }, []);

  // NOTE: activePanel 变化时写入 hash（只在数据加载完成后）
  const handleSetActivePanel = useCallback((idx: number, panels: StatPanel[]) => {
    setActivePanel(idx);
    const id = panels[idx]?.id;
    if (id) setHashParam('type', id);
  }, []);

  // NOTE: activeMetric 变化时写入 hash
  const handleSetActiveMetric = useCallback((idx: number, metricPanels: MetricPanel[]) => {
    setActiveMetric(idx);
    const id = metricPanels[idx]?.id;
    if (id) setHashParam('metric', id);
  }, []);

  // NOTE: 判断当前数据使用哪种渲染模式
  const renderMode = useMemo(() => {
    if (!data) return 'empty';
    if (data.metricPanels && data.metricPanels.length > 0) return 'metricPanels';
    if (data.panels && data.panels.length > 0) return 'panels';
    if (data.sections && data.sections.length > 0) return 'sections';
    if (data.rows && data.rows.length > 0) return 'rows';
    return 'empty';
  }, [data]);

  // NOTE: 计算有数据的项目集合（对标 Legacy setupSelector L204-218）
  const availableEvents = useMemo((): Set<string> => {
    if (!data) return new Set();
    const ids = new Set<string>();
    // NOTE: 从所有可能的层级提取 section title → event ID
    // 支持两种 title 格式：纯项目名（"Rubik's Cube"）和含指标后缀（"Rubik's Cube - Single"）
    const extractFromSections = (sections: StatSection[]) => {
      sections.forEach(s => {
        let eventId = EVENT_NAME_TO_ID[s.title];
        // NOTE: 模糊匹配——如 "Rubik's Cube - Single" 截取 " - " 前的项目名
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
        // NOTE: 兼容 2 级和 3 级结构
        const allPanels = getAllPanelsFromMetric(mp);
        allPanels.forEach(p => extractFromSections(p.sections));
      });
    }
    return ids;
  }, [data]);

  // NOTE: 默认选中第一个有数据的项目（优先用 hash #event=xxx）
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

  // NOTE: 是否需要显示项目选择器（rows 模式不需要，或只有 0-1 个项目也不需要）
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
        <div className="wca-stats-header-nav">
          <LangToggle />
        </div>
        <h1>
          {isZh ? data.titleZh : data.title}
          {statId && hasAbout(statId) && (
            <Link
              to={`/wca/about/${statId}${getLangQuery()}`}
              className="wca-stats-title-help"
              title={isZh ? '查看算法说明' : 'Algorithm explanation'}
              aria-label={isZh ? '查看算法说明' : 'Algorithm explanation'}
            >
              <HelpCircle size={20} strokeWidth={1.75} />
            </Link>
          )}
        </h1>
        {data.note && (
          <p className="wca-stats-note">{isZh ? (data.noteZh ?? data.note) : data.note}</p>
        )}
      </div>

      {/* NOTE: 项目选择器——在三种模式下显示（rows 模式除外） */}
      {showEventSelector && (
        <WcaEventSelector
          availableEvents={availableEvents}
          selectedEvent={selectedEvent}
          onSelect={handleSelectEvent}
          isZh={isZh}
        />
      )}



      {/* NOTE: 根据渲染模式选择对应组件 */}
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
            type Metric = 'single' | 'average' | 'bao5' | 'wao5' | 'mo5' | 'bpa' | 'wpa'
              | 'median' | 'best_counting' | 'worst_counting' | 'worst';
            const METRIC_KEY: Record<string, Metric> = {
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
              ? '此统计项当前为空 —— 可能是下一次 stats-build 会补全，或该口径下无人达成。'
              : 'This stat is currently empty — either no one meets the criteria, or it has yet to be computed.'}
          </div>
        </div>
      )}
    </div>
  );
}
