// NOTE: WCA 统计数据页 — 通用渲染器
// 支持 4 种 JSON 输出模式：rows / sections / panels / metricPanels
// 路由：/app/wca-stats/:statId
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

interface MetricPanel {
  id: string;
  labelEn: string;
  labelZh: string;
  panels: StatPanel[];
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

// NOTE: 解析 Markdown 链接 [text](url) 为 React 元素
function renderCell(value: unknown): React.ReactNode {
  const str = String(value);
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.slice(lastIndex, match.index));
    }
    parts.push(
      <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer">
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < str.length) {
    parts.push(str.slice(lastIndex));
  }

  // NOTE: 处理 Markdown 加粗 **text**
  if (parts.length === 1 && typeof parts[0] === 'string') {
    const boldMatch = /^\*\*(.+)\*\*$/.exec(parts[0]);
    if (boldMatch) {
      return <strong>{boldMatch[1]}</strong>;
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
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
function SectionsView({ header, sections, searchTerm, isZh }: {
  header: StatHeader[];
  sections: StatSection[];
  searchTerm: string;
  isZh: boolean;
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

  return (
    <div className="wca-stats-sections">
      {sections.map(section => {
        const sectionTitle = isZh ? (section.titleZh || section.title) : section.title;
        const isCollapsed = collapsedSections.has(section.title);
        return (
          <div key={section.title} className="wca-stats-section">
            <h3
              className="wca-stats-section-title"
              onClick={() => toggleSection(section.title)}
            >
              <span className={`wca-stats-chevron ${isCollapsed ? '' : 'open'}`}>▶</span>
              {sectionTitle}
              <span className="wca-stats-section-count">{section.rows.length}</span>
            </h3>
            {!isCollapsed && (
              <StatsTable header={header} rows={section.rows} searchTerm={searchTerm} isZh={isZh} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// NOTE: Panels 渲染——Tab 切换（如 Ranking / History）
function PanelsView({ panels, searchTerm, isZh }: {
  panels: StatPanel[];
  searchTerm: string;
  isZh: boolean;
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
      />
    </div>
  );
}

// NOTE: MetricPanels 渲染——多级面板（指标选择 + Ranking/History Tab）
function MetricPanelsView({ metricPanels, metricGroups, searchTerm, isZh }: {
  metricPanels: MetricPanel[];
  metricGroups?: MetricGroup[];
  searchTerm: string;
  isZh: boolean;
}) {
  const [activeMetric, setActiveMetric] = useState(0);
  const metric = metricPanels[activeMetric];

  return (
    <div className="wca-stats-metric-panels">
      {/* NOTE: 指标选择器——下拉菜单或分组按钮 */}
      {metricGroups ? (
        <div className="wca-stats-metric-groups">
          {metricGroups.map(group => (
            <div key={group.label} className="wca-stats-metric-group">
              <span className="wca-stats-metric-group-label">
                {isZh ? group.labelZh : group.label}
              </span>
              <div className="wca-stats-metric-group-items">
                {group.items.map(itemId => {
                  const idx = metricPanels.findIndex(mp => mp.id === itemId);
                  if (idx === -1) return null;
                  const mp = metricPanels[idx];
                  return (
                    <button
                      key={itemId}
                      className={`wca-stats-metric-btn ${idx === activeMetric ? 'active' : ''}`}
                      onClick={() => setActiveMetric(idx)}
                    >
                      {isZh ? mp.labelZh : mp.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="wca-stats-tab-bar">
          {metricPanels.map((mp, i) => (
            <button
              key={mp.id}
              className={`wca-stats-tab ${i === activeMetric ? 'active' : ''}`}
              onClick={() => setActiveMetric(i)}
            >
              {isZh ? mp.labelZh : mp.labelEn}
            </button>
          ))}
        </div>
      )}

      {/* NOTE: 选中指标的 Ranking/History Panels */}
      {metric && (
        <PanelsView panels={metric.panels} searchTerm={searchTerm} isZh={isZh} />
      )}
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

  const isZh = i18n.language === 'zh';

  // NOTE: 从 /stats/data/<statId>.json 加载数据
  useEffect(() => {
    if (!statId) return;
    setLoading(true);
    setError(null);
    setSearchTerm('');

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
        />
      )}

      {renderMode === 'panels' && data.panels && (
        <PanelsView panels={data.panels} searchTerm={searchTerm} isZh={isZh} />
      )}

      {renderMode === 'metricPanels' && data.metricPanels && (
        <MetricPanelsView
          metricPanels={data.metricPanels}
          metricGroups={data.metricGroups}
          searchTerm={searchTerm}
          isZh={isZh}
        />
      )}
    </div>
  );
}
