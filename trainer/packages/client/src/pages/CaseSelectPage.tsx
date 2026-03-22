/**
 * CaseSelectPage — 支持单个 case 选择/取消 + SVG 缩略图
 *
 * 用 useState 管理选中状态，选中的 case 会在训练页面中使用
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CubeView from '../components/CubeView';
import { scrambleForCase } from '../utils/scrambleGenerator';
import { useSessionStore } from '../stores/sessionStore';
import { allPllKeys, keysToCases, shuffle } from '../utils/pllHelpers';
import pllMap from '@cuberoot/shared/data/pll.json';

// NOTE: PLL 按首字母分组
const PLL_GROUPS: Record<string, string[]> = {
  'A Perms': ['Aa', 'Ab'],
  'G Perms': ['Ga', 'Gb', 'Gc', 'Gd'],
  'J Perms': ['Ja', 'Jb'],
  'N Perms': ['Na', 'Nb'],
  'R Perms': ['Ra', 'Rb'],
  'U Perms': ['Ua', 'Ub'],
  'Other': ['E', 'F', 'H', 'T', 'V', 'Y', 'Z'],
};

const typedPllMap = pllMap as Record<string, Record<string, string>>;
const allCaseNames = Object.keys(typedPllMap);

export function CaseSelectPage() {
  const { algSetId } = useParams<{ algSetId: string }>();
  const navigate = useNavigate();

  // 选中状态（默认全选）
  const [selected, setSelected] = useState<Set<string>>(new Set(allCaseNames));

  if (algSetId !== 'pll') {
    return <div className="error-page">公式集未找到</div>;
  }

  const toggleCase = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(allCaseNames));
  const deselectAll = () => setSelected(new Set());

  const handleStartTraining = () => {
    if (selected.size === 0) return;

    // 只生成选中 case 对应的 key
    const selectedKeys = allPllKeys(typedPllMap).filter((key) => {
      const name = key.split('/')[0];
      return selected.has(name);
    });
    const queue = shuffle(keysToCases(selectedKeys, ['w'], false));

    // 直接设置 store 的 queue 并跳转
    useSessionStore.setState({
      queue,
      results: [],
      mistake: '',
      gameState: 'paused',
    });
    navigate(`/train/${algSetId}`);
  };

  return (
    <div className="case-select-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← 返回
        </button>
        <h1>PLL</h1>
        <span className="count-badge">
          {selected.size} / {allCaseNames.length}
        </span>
      </header>

      <div className="select-actions">
        <button onClick={selectAll}>全选</button>
        <button onClick={deselectAll}>取消全选</button>
        <button
          className="start-btn"
          disabled={selected.size === 0}
          onClick={handleStartTraining}
        >
          ▶ 开始识别训练 ({selected.size})
        </button>
      </div>

      {Object.entries(PLL_GROUPS).map(([groupName, cases]) => (
        <div key={groupName} className="case-group">
          <h3 className="group-title">{groupName}</h3>
          <div className="case-grid">
            {cases.map((caseName) => {
              const thumbCase = {
                name: caseName,
                rotation: '',
                dTurn: '',
                colorShift: 0,
                crossColor: 'w',
              };
              const thumbScramble = scrambleForCase(thumbCase, typedPllMap);
              const isSelected = selected.has(caseName);
              return (
                <div
                  key={caseName}
                  className={`case-card ${isSelected ? 'selected' : ''}`}
                  style={{ flexDirection: 'column', gap: '4px' }}
                  onClick={() => toggleCase(caseName)}
                >
                  <CubeView
                    scramble={thumbScramble}
                    viewType="cube-top"
                    size={60}
                  />
                  <span className="case-name">{caseName}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
