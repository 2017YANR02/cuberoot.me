import { Link } from 'react-router-dom';
import pllMap from '@cuberoot/shared/data/pll.json';
import ollMap from '@cuberoot/shared/data/oll.json';

// NOTE: 从 JSON keys 动态生成 algSet 元数据
const algSets = [
  {
    id: 'pll',
    name: 'PLL',
    icon: '🎯',
    count: Object.keys(pllMap).length,
  },
  {
    id: 'oll',
    name: 'OLL',
    icon: '🟨',
    count: Object.keys(ollMap).length,
  },
];

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
            <div className="card-icon">{set.icon}</div>
            <h2>{set.name}</h2>
            <p>{set.count} cases</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
