import { useParams, useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../stores/settingsStore';
import pllData from '../../../shared/data/pll.json';

// NOTE: 后续扩展时改成从统一注册表查找
function getAlgSet(id: string) {
  if (id === '3x3-pll') return pllData;
  return null;
}

export function CaseSelectPage() {
  const { algSetId } = useParams<{ algSetId: string }>();
  const navigate = useNavigate();
  const algSet = getAlgSet(algSetId ?? '');
  const { selectedCases, toggleCase, selectAll, deselectAll } = useSettingsStore();

  if (!algSet) {
    return <div className="error-page">公式集未找到</div>;
  }

  const allIds = algSet.cases.map((c) => c.id);
  const selectedCount = selectedCases.filter((id) => allIds.includes(id)).length;

  const handleStartTraining = () => {
    if (selectedCount === 0) return;
    navigate(`/train/${algSetId}`);
  };

  // 按分组排列
  const groups = [...new Set(algSet.cases.map((c) => c.group))];

  return (
    <div className="case-select-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← 返回
        </button>
        <h1>{algSet.name}</h1>
        <span className="count-badge">
          {selectedCount} / {algSet.cases.length}
        </span>
      </header>

      <div className="select-actions">
        <button onClick={() => selectAll(allIds)}>全选</button>
        <button onClick={deselectAll}>取消全选</button>
        <button
          className="start-btn"
          disabled={selectedCount === 0}
          onClick={handleStartTraining}
        >
          开始训练 ({selectedCount})
        </button>
      </div>

      {groups.map((group) => (
        <div key={group} className="case-group">
          <h3 className="group-title">{group}</h3>
          <div className="case-grid">
            {algSet.cases
              .filter((c) => c.group === group)
              .map((c) => (
                <button
                  key={c.id}
                  className={`case-card ${selectedCases.includes(c.id) ? 'selected' : ''}`}
                  onClick={() => toggleCase(c.id)}
                >
                  <span className="case-name">{c.name}</span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
