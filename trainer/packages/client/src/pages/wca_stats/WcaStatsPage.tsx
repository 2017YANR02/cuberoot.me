// NOTE: WCA 统计数据页 — 通用表格组件
// 从 /stats/data/<statId>.json 加载数据并渲染可搜索表格
// 路由：/app/wca-stats/:statId
import { useState, useEffect, useMemo } from 'react';
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

interface StatData {
  id: string;
  title: string;
  titleZh: string;
  note?: string;
  noteZh?: string;
  header: StatHeader[];
  rows: unknown[][];
}

// NOTE: 解析 Markdown 链接 [text](url) 为 React 元素
function renderCell(value: unknown): React.ReactNode {
  const str = String(value);
  // 匹配 [text](url) 格式
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(str)) !== null) {
    // 链接前的文本
    if (match.index > lastIndex) {
      parts.push(str.slice(lastIndex, match.index));
    }
    // 链接本身
    parts.push(
      <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer">
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  // 剩余文本
  if (lastIndex < str.length) {
    parts.push(str.slice(lastIndex));
  }

  // 处理 Markdown 加粗 **text**
  if (parts.length === 1 && typeof parts[0] === 'string') {
    const boldMatch = /^\*\*(.+)\*\*$/.exec(parts[0]);
    if (boldMatch) {
      return <strong>{boldMatch[1]}</strong>;
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
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
  // Vite dev server 通过 proxy 或 public 目录提供文件
  useEffect(() => {
    if (!statId) return;
    setLoading(true);
    setError(null);

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

  // NOTE: 搜索过滤
  const filteredRows = useMemo(() => {
    if (!data || !searchTerm) return data?.rows ?? [];
    const term = searchTerm.toLowerCase();
    return data.rows.filter(row =>
      row.some(cell => String(cell).toLowerCase().includes(term))
    );
  }, [data, searchTerm]);

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
        <Link to="/wca-stats" className="wca-stats-back">← 返回</Link>
        <h1>{isZh ? data.titleZh : data.title}</h1>
        {data.note && (
          <p className="wca-stats-note">{isZh ? (data.noteZh ?? data.note) : data.note}</p>
        )}
      </div>

      <div className="wca-stats-toolbar">
        <input
          type="text"
          className="wca-stats-search"
          placeholder={isZh ? '搜索...' : 'Search...'}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <span className="wca-stats-count">
          {filteredRows.length} / {data.rows.length}
        </span>
      </div>

      <div className="wca-stats-table-wrapper">
        <table className="wca-stats-table">
          <thead>
            <tr>
              {data.header.map(h => (
                <th key={h.key} style={{ textAlign: h.align }}>
                  {isZh ? h.labelZh : h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} style={{ textAlign: data.header[j]?.align }}>
                    {renderCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
