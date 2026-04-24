/**
 * @module HomePage
 * Trainer 首页 — PLL / OLL / ZBLL / ZBLS 公式集卡片网格。
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import pllMap from '@cuberoot/shared/data/pll.json';
import ollMap from '@cuberoot/shared/data/oll.json';
import zbllMap from '@cuberoot/shared/data/zbll.json';
import zblsMap from '@cuberoot/shared/data/zbls.json';

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
  {
    id: 'zbll',
    name: 'ZBLL',
    icon: '⚡',
    count: Object.keys(zbllMap).length,
  },
  {
    id: 'zbls',
    name: 'ZBLS',
    icon: '🔗',
    count: Object.keys(zblsMap).length,
  },
];

export function HomePage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  return (
    <div className="home-page">
      <header className="home-header">
        <h1>🧊 CubeRoot Trainer</h1>
        <p className="subtitle">{isZh ? '公式训练器' : 'Algorithm Trainer'}</p>
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
