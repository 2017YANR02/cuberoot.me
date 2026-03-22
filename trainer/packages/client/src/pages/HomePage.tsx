import { Link } from 'react-router-dom';
import pllData from '../../../shared/data/pll.json';

// NOTE: 目前只有 PLL，后续会加 OLL/ZBLL 等
const algSets = [pllData];

export function HomePage() {
  return (
    <div className="home-page">
      <header className="home-header">
        <h1>🧊 CubeRoot Trainer</h1>
        <p className="subtitle">公式训练器 · Algorithm Trainer</p>
      </header>

      <div className="alg-set-grid">
        {algSets.map((set) => (
          <Link
            key={set.id}
            to={`/select/${set.id}`}
            className="alg-set-card"
          >
            <div className="card-icon">🎯</div>
            <h2>{set.name}</h2>
            <p>{set.cases.length} cases</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
