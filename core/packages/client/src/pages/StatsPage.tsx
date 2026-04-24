/**
 * StatsPage — 适配原版 pll.json 格式
 *
 * 从 sessionStore 的识别结果中统计每个 case 的表现
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../stores/sessionStore';
import { resultTimeMs, type RecognitionResult } from '../utils/pllHelpers';
import pllMap from '@cuberoot/shared/data/pll.json';

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2);
}

const allCaseNames = Object.keys(pllMap);

export function StatsPage() {
  const { algSetId } = useParams<{ algSetId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const results = useSessionStore((s) => s.results);

  if (algSetId !== 'pll') {
    return <div className="error-page">{t('caseSelect.notFound')}</div>;
  }

  // 按 case name 分组统计
  const statsByCase = new Map<string, { count: number; correctCount: number; avgMs: number; bestMs: number }>();
  for (const name of allCaseNames) {
    const caseResults = results.filter((r: RecognitionResult) => r.pllCase.name === name);
    const correctResults = caseResults.filter((r: RecognitionResult) => !r.mistake);
    if (caseResults.length === 0) continue;
    const times = correctResults.map(resultTimeMs);
    statsByCase.set(name, {
      count: caseResults.length,
      correctCount: correctResults.length,
      avgMs: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      bestMs: times.length > 0 ? Math.min(...times) : 0,
    });
  }

  return (
    <div className="stats-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(`/select/${algSetId}`)}>
          {t('caseSelect.back')}
        </button>
        <h1>{isZh ? 'PLL 统计' : 'PLL Stats'}</h1>
      </header>

      {statsByCase.size === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
          {isZh
            ? '还没有训练记录，开始训练后这里会显示统计数据。'
            : 'No training records yet. Stats will appear here after you start training.'}
        </p>
      ) : (
        <table className="stats-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>{isZh ? '次数' : 'Count'}</th>
              <th>{isZh ? '正确' : 'Correct'}</th>
              <th>{isZh ? '平均' : 'Avg'}</th>
              <th>{isZh ? '最佳' : 'Best'}</th>
            </tr>
          </thead>
          <tbody>
            {allCaseNames.map((name) => {
              const stats = statsByCase.get(name);
              return (
                <tr key={name} className={stats ? '' : 'no-data'}>
                  <td className="case-name">{name}</td>
                  <td>{stats?.count ?? '—'}</td>
                  <td>{stats ? `${stats.correctCount}/${stats.count}` : '—'}</td>
                  <td>{stats && stats.avgMs > 0 ? formatTime(stats.avgMs) : '—'}</td>
                  <td>{stats && stats.bestMs > 0 ? formatTime(stats.bestMs) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
