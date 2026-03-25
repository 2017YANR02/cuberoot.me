// NOTE: WCA 统计数据页 — 通用渲染器
// 支持 4 种 JSON 输出模式：rows / sections / panels / metricPanels
// 路由：/app/wca-stats/:statId
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WcaEventSelector from './WcaEventSelector';
import { EVENT_NAME_TO_ID, ALL_EVENT_IDS } from './event_constants';
import './wca_stats.css';

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
}

// NOTE: 工具函数——从 MetricPanel 中统一提取所有 StatPanel（兼容 2 级和 3 级结构）
function getAllPanelsFromMetric(mp: MetricPanel): StatPanel[] {
  if (mp.panels) return mp.panels;
  if (mp.sourcePanels) return mp.sourcePanels.flatMap(sp => sp.panels);
  return [];
}

// NOTE: 解析 Markdown 链接 [text](url)、加粗 **text**、HTML <br /> 为 React 元素
function renderCell(value: unknown): React.ReactNode {
  const str = String(value);

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
      parts.push(
        <a key={`${segIdx}-${match.index}`} href={match[2]} target="_blank" rel="noopener noreferrer">
          {match[1]}
        </a>
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
            {header.map(h => (
              <th key={h.key} style={{ textAlign: h.align }}>
                {isZh ? h.labelZh : h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ textAlign: header[j]?.align }}>
                  {renderCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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

  const toggleSection = useCallback((title: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }, []);

  // NOTE: 按 selectedEvent 过滤 sections（无 selectedEvent 时显示全部）
  const visibleSections = useMemo(() => {
    if (!selectedEvent) return sections;
    return sections.filter(s => EVENT_NAME_TO_ID[s.title] === selectedEvent);
  }, [sections, selectedEvent]);

  // NOTE: 当项目选择器选中后只剩一个 section 时，标题冗余（对标 Legacy 删除 h3）
  const hideTitle = !!selectedEvent && visibleSections.length === 1;

  return (
    <div className="wca-stats-sections">
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

// NOTE: Panels 渲染——Tab 切换（如 Ranking / History）
// selectedEvent 可选：透传到 SectionsView 进行过滤
function PanelsView({ panels, searchTerm, isZh, selectedEvent }: {
  panels: StatPanel[];
  searchTerm: string;
  isZh: boolean;
  selectedEvent?: string;
}) {
  const [activePanel, setActivePanel] = useState(0);
  const panel = panels[activePanel];
  if (!panel) return null;

  return (
    <div className="wca-stats-panels">
      <div className="wca-stats-tab-bar">
        {panels.map((p, i) => (
          <button
            key={p.id}
            className={`wca-stats-tab ${i === activePanel ? 'active' : ''}`}
            onClick={() => setActivePanel(i)}
          >
            {isZh ? p.labelZh : p.labelEn}
          </button>
        ))}
      </div>
      <SectionsView
        header={panel.header}
        sections={panel.sections}
        searchTerm={searchTerm}
        isZh={isZh}
        selectedEvent={selectedEvent}
      />
    </div>
  );
}

// NOTE: SourcePanels 渲染——三级嵌套（如 wr_newcomer：metric → source → tab）
// 对标 Legacy stats_ui.ts switchSource() + source-panel 切换
function SourcePanelsView({ sourcePanels, searchTerm, isZh, selectedEvent }: {
  sourcePanels: SourcePanel[];
  searchTerm: string;
  isZh: boolean;
  selectedEvent?: string;
}) {
  const [activeSource, setActiveSource] = useState(0);
  const source = sourcePanels[activeSource];

  return (
    <div className="wca-stats-source-panels">
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
        <PanelsView panels={source.panels} searchTerm={searchTerm} isZh={isZh} selectedEvent={selectedEvent} />
      )}
    </div>
  );
}

// NOTE: MetricPanels 渲染——多级面板（指标选择 + Ranking/History Tab）
// selectedEvent 可选：有值时计算每个 metric 是否有该项目的数据，无数据的 metric 灰掉
function MetricPanelsView({ metricPanels, metricGroups, searchTerm, isZh, selectedEvent }: {
  metricPanels: MetricPanel[];
  metricGroups?: MetricGroup[];
  searchTerm: string;
  isZh: boolean;
  selectedEvent?: string;
}) {
  const [activeMetric, setActiveMetric] = useState(0);

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
      // 优先找 single
      const singleIdx = metricPanels.findIndex((mp, i) => mp.id === 'single' && metricHasData.get(i));
      if (singleIdx !== -1) { setActiveMetric(singleIdx); return; }
      // 其次找 average
      const avgIdx = metricPanels.findIndex((mp, i) => mp.id === 'average' && metricHasData.get(i));
      if (avgIdx !== -1) { setActiveMetric(avgIdx); return; }
      // 兜底第一个有数据的
      const firstValid = metricPanels.findIndex((_, i) => metricHasData.get(i));
      if (firstValid !== -1) setActiveMetric(firstValid);
    }
  }, [metricHasData, activeMetric, metricPanels]);

  const metric = metricPanels[activeMetric];

  return (
    <div className="wca-stats-metric-panels">
      {/* NOTE: 指标选择器——扁平药丸按钮，一行显示（对标 Legacy .segmented-btns） */}
      {metricGroups ? (
        <div className="wca-stats-tab-bar">
          {metricGroups.flatMap(group => group.items).map(itemId => {
            const idx = metricPanels.findIndex(mp => mp.id === itemId);
            if (idx === -1) return null;
            const mp = metricPanels[idx];
            const disabled = metricHasData.get(idx) === false;
            return (
              <button
                key={itemId}
                className={`wca-stats-tab ${idx === activeMetric ? 'active' : ''}${disabled ? ' disabled' : ''}`}
                onClick={disabled ? undefined : () => setActiveMetric(idx)}
              >
                {isZh ? mp.labelZh : mp.labelEn}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="wca-stats-tab-bar">
          {metricPanels.map((mp, i) => {
            const disabled = metricHasData.get(i) === false;
            return (
              <button
                key={mp.id}
                className={`wca-stats-tab ${i === activeMetric ? 'active' : ''}${disabled ? ' disabled' : ''}`}
                onClick={disabled ? undefined : () => setActiveMetric(i)}
              >
                {isZh ? mp.labelZh : mp.labelEn}
              </button>
            );
          })}
        </div>
      )}

      {/* NOTE: 选中指标的渲染——支持 2 级（panels）和 3 级（sourcePanels）结构 */}
      {metric && metric.sourcePanels ? (
        <SourcePanelsView sourcePanels={metric.sourcePanels} searchTerm={searchTerm} isZh={isZh} selectedEvent={selectedEvent} />
      ) : metric && metric.panels ? (
        <PanelsView panels={metric.panels} searchTerm={searchTerm} isZh={isZh} selectedEvent={selectedEvent} />
      ) : null}
    </div>
  );
}

export default function WcaStatsPage() {
  const { statId } = useParams<{ statId: string }>();
  const { i18n } = useTranslation();
  const [data, setData] = useState<StatData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');

  const isZh = i18n.language === 'zh';

  // NOTE: 从 /stats/data/<statId>.json 加载数据
  useEffect(() => {
    if (!statId) return;
    setLoading(true);
    setError(null);
    setSearchTerm('');
    setSelectedEvent(''); // NOTE: 切换统计时重置选中项目

    fetch(`/stats/data/${statId}.json`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: StatData) => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [statId]);

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
    const extractFromSections = (sections: StatSection[]) => {
      sections.forEach(s => {
        const eventId = EVENT_NAME_TO_ID[s.title];
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

  // NOTE: 默认选中第一个有数据的项目
  useEffect(() => {
    if (availableEvents.size > 0 && !selectedEvent) {
      // NOTE: 按标准顺序找第一个有数据的项目
      const first = ALL_EVENT_IDS.find((id: string) => availableEvents.has(id));
      if (first) setSelectedEvent(first);
    }
  }, [availableEvents, selectedEvent]);

  // NOTE: 是否需要显示项目选择器（rows 模式不需要，或只有 0-1 个项目也不需要）
  const showEventSelector = renderMode !== 'rows' && renderMode !== 'empty' && availableEvents.size >= 2;

  // NOTE: 计算总行数（用于显示搜索计数）
  const totalRows = useMemo(() => {
    if (!data) return 0;
    switch (renderMode) {
      case 'rows': return data.rows?.length ?? 0;
      case 'sections': return data.sections?.reduce((s, sec) => s + sec.rows.length, 0) ?? 0;
      // NOTE: panels 和 metricPanels 的行数计算较复杂，暂不显示
      default: return 0;
    }
  }, [data, renderMode]);

  if (loading) {
    return (
      <div className="wca-stats-page">
        <div className="wca-stats-loading">加载中...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="wca-stats-page">
        <div className="wca-stats-error">
          <h2>加载失败</h2>
          <p>{error || '未知错误'}</p>
          <Link to="/wca-stats">← 返回统计列表</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wca-stats-page">
      <div className="wca-stats-header">
        <Link to="/wca-stats" className="wca-stats-back">← {isZh ? '返回' : 'Back'}</Link>
        <h1>{isZh ? data.titleZh : data.title}</h1>
        {data.note && (
          <p className="wca-stats-note">{isZh ? (data.noteZh ?? data.note) : data.note}</p>
        )}
      </div>

      {/* NOTE: 项目选择器——在三种模式下显示（rows 模式除外） */}
      {showEventSelector && (
        <WcaEventSelector
          availableEvents={availableEvents}
          selectedEvent={selectedEvent}
          onSelect={setSelectedEvent}
          isZh={isZh}
        />
      )}

      {/* NOTE: rows 和 sections 模式显示搜索栏 */}
      {(renderMode === 'rows' || renderMode === 'sections') && (
        <div className="wca-stats-toolbar">
          <input
            type="text"
            className="wca-stats-search"
            placeholder={isZh ? '搜索...' : 'Search...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {totalRows > 0 && (
            <span className="wca-stats-count">{totalRows}</span>
          )}
        </div>
      )}

      {/* NOTE: 根据渲染模式选择对应组件 */}
      {renderMode === 'rows' && data.rows && (
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
        />
      )}

      {renderMode === 'metricPanels' && data.metricPanels && (
        <MetricPanelsView
          metricPanels={data.metricPanels}
          metricGroups={data.metricGroups}
          searchTerm={searchTerm}
          isZh={isZh}
          selectedEvent={showEventSelector ? selectedEvent : undefined}
        />
      )}
    </div>
  );
}
