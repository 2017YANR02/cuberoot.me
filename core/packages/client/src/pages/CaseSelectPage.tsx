/**
 * CaseSelectPage — 通用公式集选择页，支持 PLL + OLL
 *
 * PLL: 按首字母分组，使用 scrambleForCase 生成缩略图打乱
 * OLL: 按形状分组，使用公式反转生成缩略图打乱
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CubeView from '../components/CubeView';
import { VisualCube } from '../components/VisualCube';
import { scrambleForCase, inverseScramble } from '../utils/scrambleGenerator';
import { useSessionStore } from '../stores/sessionStore';
import { allPllKeys, keysToCases, shuffle } from '../utils/pllHelpers';
import pllMap from '@cuberoot/shared/data/pll.json';
import ollMap from '@cuberoot/shared/data/oll.json';

// ---- PLL 分组 ----
const PLL_GROUPS: Record<string, string[]> = {
  'A Perms': ['Aa', 'Ab'],
  'G Perms': ['Ga', 'Gb', 'Gc', 'Gd'],
  'J Perms': ['Ja', 'Jb'],
  'N Perms': ['Na', 'Nb'],
  'R Perms': ['Ra', 'Rb'],
  'U Perms': ['Ua', 'Ub'],
  'Other': ['E', 'F', 'H', 'T', 'V', 'Y', 'Z'],
};

// ---- OLL 分组（从 oll.json 的 group 字段动态生成）----
const typedOllMap = ollMap as Record<string, { name: string; alg: string; alg2: string; group: string }>;
const ollGroupOrder = [
  'All Edges Oriented Correctly',
  'T-Shapes', 'Squares', 'C-Shapes', 'W-Shapes',
  'Corners Correct, Edges Flipped',
  'P-Shapes', 'I-Shapes', 'Fish-Shapes',
  'Knight Move Shapes', 'Awkward Shapes',
  'L-Shapes', 'Lightning Bolts',
  'No Edges Flipped Correctly',
];

function getOllGroups(): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const group of ollGroupOrder) groups[group] = [];
  for (const [key, val] of Object.entries(typedOllMap)) {
    if (!groups[val.group]) groups[val.group] = [];
    groups[val.group].push(key);
  }
  return groups;
}

const typedPllMap = pllMap as Record<string, Record<string, string>>;

interface AlgSetConfig {
  name: string;
  groups: Record<string, string[]>;
  allCases: string[];
  getScramble: (caseName: string) => string;
}

const algSetConfigs: Record<string, AlgSetConfig> = {
  pll: {
    name: 'PLL',
    groups: PLL_GROUPS,
    allCases: Object.keys(typedPllMap),
    getScramble: (caseName: string) => {
      const thumbCase = { name: caseName, rotation: '', dTurn: '', colorShift: 0, crossColor: 'w' };
      return scrambleForCase(thumbCase, typedPllMap);
    },
  },
  oll: {
    name: 'OLL',
    groups: getOllGroups(),
    allCases: Object.keys(typedOllMap),
    // NOTE: OLL 缩略图用公式反转作为打乱（和 oll_trainer 相同）
    getScramble: (caseName: string) => {
      const alg = typedOllMap[caseName]?.alg || '';
      return inverseScramble(alg);
    },
  },
};

export function CaseSelectPage() {
  const { algSetId } = useParams<{ algSetId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const config = algSetId ? algSetConfigs[algSetId] : undefined;
  const allCases = config?.allCases ?? [];

  const [selected, setSelected] = useState<Set<string>>(() => new Set(allCases));

  if (!config) {
    return <div className="error-page">{t('caseSelect.notFound')}</div>;
  }

  const toggleCase = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(allCases));
  const deselectAll = () => setSelected(new Set());

  const handleStartTraining = () => {
    if (selected.size === 0) return;

    if (algSetId === 'pll') {
      // PLL: 生成带旋转变化的训练队列
      const selectedKeys = allPllKeys(typedPllMap).filter((key) =>
        selected.has(key.split('/')[0])
      );
      const queue = shuffle(keysToCases(selectedKeys, ['w'], false));
      useSessionStore.setState({ queue, results: [], mistake: '', gameState: 'paused' });
    } else if (algSetId === 'oll') {
      // OLL: 每个选中 case 生成 4 个变体（4 种 y 旋转）
      const queue = shuffle(
        [...selected].flatMap((caseName) =>
          ['', 'y', 'y2', "y'"].map((rot) => ({
            name: caseName,
            rotation: rot,
            dTurn: '',
            colorShift: 0,
            crossColor: 'w',
          }))
        )
      );
      useSessionStore.setState({ queue, results: [], mistake: '', gameState: 'paused' });
    }
    navigate(`/train/${algSetId}`);
  };

  return (
    <div className="case-select-page">
      <header className="page-header">
        <h1>{config.name}</h1>
        <span className="count-badge">{selected.size} / {allCases.length}</span>
      </header>

      <div className="select-actions">
        <button onClick={selectAll}>{t('caseSelect.selectAll')}</button>
        <button onClick={deselectAll}>{t('caseSelect.deselectAll')}</button>
        <button className="start-btn" disabled={selected.size === 0} onClick={handleStartTraining}>
          ▶ {t('caseSelect.startTraining')} ({selected.size})
        </button>
      </div>

      {Object.entries(config.groups).map(([groupName, cases]) => (
        cases.length > 0 && (
          <div key={groupName} className="case-group">
            <h3 className="group-title">{groupName}</h3>
            <div className="case-grid">
              {cases.map((caseName) => {
                const isSelected = selected.has(caseName);
                // OLL 显示短名（"OLL 1" → "1"），PLL 显示全名
                const displayName = caseName.startsWith('OLL ') ? caseName.slice(4) : caseName;
                return (
                  <div
                    key={caseName}
                    className={`case-card ${isSelected ? 'selected' : ''}`}
                    style={{ flexDirection: 'column', gap: '4px' }}
                    onClick={() => toggleCase(caseName)}
                  >
                    {algSetId === 'oll' ? (
                      <VisualCube
                        algorithm={typedOllMap[caseName]?.alg || ''}
                        view="oll"
                        size={60}
                        alt={caseName}
                      />
                    ) : (
                      <CubeView scramble={config.getScramble(caseName)} viewType="cube-top" size={60} />
                    )}
                    <span className="case-name">{displayName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
