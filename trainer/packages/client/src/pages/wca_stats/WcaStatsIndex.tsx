// NOTE: WCA 统计索引页——从 /stats/data/index.json 加载分类卡片网格
// 路由：/wca-stats
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLangQuery } from '../../i18n';
import LangToggle from '../../components/LangToggle';
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
      <div className="wca-stats-header-nav wca-stats-index-header">
        <h1>{isZh ? 'WCA 统计数据' : 'WCA Statistics'}</h1>
        <LangToggle />
      </div>

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

    </div>
  );
}
