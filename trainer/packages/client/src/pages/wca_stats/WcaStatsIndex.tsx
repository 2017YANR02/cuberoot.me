// NOTE: WCA 统计索引页——从 /stats/data/index.json 加载分类卡片网格
// 路由：/app/wca-stats
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { syncLangToUrl, getLangQuery } from '../../i18n';
import './wca_stats.css';

interface StatEntry {
  id: string;
  titleEn: string;
  titleZh: string;
}

interface Category {
  nameEn: string;
  nameZh: string;
  icon: string;
  gradient: string;
  stats: StatEntry[];
}

interface IndexData {
  categories: Category[];
}

export default function WcaStatsIndex() {
  const { i18n } = useTranslation();
  const [data, setData] = useState<IndexData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isZh = i18n.language === 'zh';

  // NOTE: 切换语言——同步 i18n 实例 + URL + localStorage
  const toggleLang = () => {
    const next = isZh ? 'en' : 'zh';
    i18n.changeLanguage(next);
    syncLangToUrl(next);
  };

  useEffect(() => {
    fetch('/stats/data/index.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: IndexData) => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="wca-stats-index">
        <div className="wca-stats-loading">{isZh ? '加载中...' : 'Loading...'}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="wca-stats-index">
        <div className="wca-stats-error">
          <h2>{isZh ? '加载失败' : 'Failed to load'}</h2>
          <p>{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const langQuery = getLangQuery();

  return (
    <div className="wca-stats-index">
      <h1>{isZh ? 'WCA 统计数据' : 'WCA Statistics'}</h1>

      {data.categories.map(cat => (
        <div key={cat.nameEn} className="wca-stats-category">
          <div className="wca-stats-category-header">
            <span className="wca-stats-category-icon">{cat.icon}</span>
            <span className="wca-stats-category-name">
              {isZh ? cat.nameZh : cat.nameEn}
            </span>

          </div>
          <div className="wca-stats-card-grid">
            {cat.stats.map(stat => (
              <Link
                key={stat.id}
                to={`/wca-stats/${stat.id}${langQuery}`}
                className="wca-stats-card"
              >
                {isZh ? stat.titleZh : stat.titleEn}
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* NOTE: 语言切换按钮——固定右下角（对标 Legacy i18n.js toggle） */}
      <button className="wca-stats-lang-toggle" onClick={toggleLang}>
        🌐 {isZh ? 'EN' : '中文'}
      </button>
    </div>
  );
}
