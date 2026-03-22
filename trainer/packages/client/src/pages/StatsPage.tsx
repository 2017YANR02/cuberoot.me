import { useParams, useNavigate } from 'react-router-dom';
import { useStatsStore } from '../stores/statsStore';
import pllData from '../../../shared/data/pll.json';

function getAlgSet(id: string) {
  if (id === '3x3-pll') return pllData;
  return null;
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2);
}

export function StatsPage() {
  const { algSetId } = useParams<{ algSetId: string }>();
  const navigate = useNavigate();
  const algSet = getAlgSet(algSetId ?? '');
  const { getStats, getAo5, getAo12, clearStats } = useStatsStore();

  if (!algSet) {
    return <div className="error-page">公式集未找到</div>;
  }

  return (
    <div className="stats-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(`/select/${algSetId}`)}>
          ← 返回
        </button>
        <h1>{algSet.name} 统计</h1>
        <button
          className="clear-btn"
          onClick={() => {
            if (confirm('确定清除所有统计数据？')) {
              clearStats(algSetId!);
            }
          }}
        >
          清除数据
        </button>
      </header>

      <table className="stats-table">
        <thead>
          <tr>
            <th>Case</th>
            <th>次数</th>
            <th>最近</th>
            <th>Ao5</th>
            <th>Ao12</th>
            <th>最佳</th>
          </tr>
        </thead>
        <tbody>
          {algSet.cases.map((c) => {
            const stats = getStats(algSetId!, c.id);
            const ao5 = getAo5(algSetId!, c.id);
            const ao12 = getAo12(algSetId!, c.id);
            const best = stats ? Math.min(...stats.times) : null;

            return (
              <tr key={c.id} className={stats ? '' : 'no-data'}>
                <td className="case-name">{c.name}</td>
                <td>{stats?.count ?? '—'}</td>
                <td>{stats ? formatTime(stats.lastTime) : '—'}</td>
                <td>{ao5 ? formatTime(ao5) : '—'}</td>
                <td>{ao12 ? formatTime(ao12) : '—'}</td>
                <td>{best ? formatTime(best) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
