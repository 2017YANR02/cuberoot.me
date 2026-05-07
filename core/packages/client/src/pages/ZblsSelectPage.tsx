/**
 * ZBLS 选择页
 * 完整复刻上游 index.html + home-screen.js
 * 布局: 左侧 F2L 组列表（可折叠） + 右侧面板（按钮 + 预设）
 */
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useZblsSelectedStore } from '../stores/zbls_selected_store';
import { useZblsPresetStore } from '../stores/zbls_preset_store';
import { useZblsSessionStore } from '../stores/zbls_session_store';
import {
  F2L_GROUP_NUMS,
  ZBLS_BY_GROUP,
  zblsData,
  areSetsEqual,
} from '../utils/zbls_helpers';
import { VisualCube } from '../components/VisualCube';
import '../zbls.css';

// 用第一条 scramble 作为 case 状态预览(直接 forward 应用,不需要 invert)。
// 早期版本退到 alg 反推 + view="f2l",后果是 LL 一律 gray,8 个 LL EO 状态看起来一模一样。
// ZBLS 的判定全在 LL EO 上,必须用 mask="vh" 露出 LL 棱块色,case 之间才能区分。
const setupForZbls = (key: string): string => zblsData[key]?.scrambles[0] || '';

// ===== 单个 Case 卡片 =====
function ZblsCaseCard({
  caseKey,
  isSelected,
  onToggle,
}: {
  caseKey: string;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`zbls-case-card ${isSelected ? 'zbls-case-selected' : ''}`}
      onClick={onToggle}
    >
      <VisualCube
        algorithm=""
        setup={setupForZbls(caseKey)}
        view="iso"
        mask="vh"
        size={88}
        alt={`F2L ${caseKey}`}
      />
    </div>
  );
}

// ===== F2L 组 =====
function F2lGroupCard({
  groupNum,
  isExpanded,
  onToggleExpand,
}: {
  groupNum: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const selected = useZblsSelectedStore();
  const groupKeys = ZBLS_BY_GROUP[groupNum] || [];
  const numSelected = selected.numInGroupSelected(groupNum);
  const total = groupKeys.length;

  // 标题背景色：全选=绿 | 部分=金 | 无=默认
  const headerClass =
    numSelected === 0
      ? 'zbls-none-selected'
      : numSelected === total
        ? 'zbls-all-selected'
        : 'zbls-some-selected';

  // 点击标题图标：切换整组选中
  const toggleGroupSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (numSelected === total) {
      selected.removeF2lGroup(groupNum);
    } else {
      selected.addF2lGroup(groupNum);
    }
  };

  return (
    <div className="zbls-group-card">
      <div
        className={`zbls-group-header ${headerClass}`}
        onClick={onToggleExpand}
      >
        <span className="zbls-group-title" onClick={toggleGroupSelection}>
          <strong>F2L {groupNum}</strong>
        </span>
        <span className="zbls-group-count">
          ({numSelected}/{total})
          <span className={`zbls-caret ${isExpanded ? 'zbls-caret-up' : ''}`}>
            ▼
          </span>
        </span>
      </div>
      {isExpanded && (
        <div className="zbls-group-grid">
          {groupKeys.map((caseKey) => (
            <ZblsCaseCard
              key={caseKey}
              caseKey={caseKey}
              isSelected={selected.isSelected(caseKey)}
              onToggle={() => {
                if (selected.isSelected(caseKey)) {
                  selected.removeCase(caseKey);
                } else {
                  selected.addCase(caseKey);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ===== 预设面板 =====
function PresetPanel() {
  const { t } = useTranslation();
  const selected = useZblsSelectedStore();
  const presets = useZblsPresetStore();
  const [newName, setNewName] = useState('');

  const presetNames = Object.keys(presets.map);

  const handleSave = () => {
    const name = newName.trim();
    if (!name) return;
    presets.setPreset(name, selected.keys);
    setNewName('');
  };

  const handleApply = (name: string) => {
    const cases = presets.getCases(name);
    selected.applyFromPreset(cases);
  };

  const handleDelete = (name: string) => {
    presets.deletePreset(name);
  };

  // 判断当前选中状态是否与某个预设完全匹配
  const activePreset = presetNames.find((name) =>
    areSetsEqual(new Set(selected.keys), presets.getCases(name))
  );

  return (
    <div className="zbls-side-card">
      <strong>{t('zbls.presets.title')}</strong>
      <div className="zbls-preset-input-group">
        <input
          className="zbls-preset-input"
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('zbls.presets.placeholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
        />
        <button className="zbls-btn zbls-btn-primary" onClick={handleSave}>
          {t('zbls.presets.save')}
        </button>
      </div>
      {presetNames.map((name) => (
        <div key={name} className="zbls-preset-row">
          <span
            className={`zbls-preset-name ${
              activePreset === name ? 'zbls-preset-active' : ''
            }`}
          >
            {name} ({presets.getCases(name).size})
          </span>
          <button
            className="zbls-preset-apply-btn"
            onClick={() => handleApply(name)}
          >
            {t('zbls.presets.apply')}
          </button>
          <button
            className="zbls-preset-delete-btn"
            onClick={() => handleDelete(name)}
          >
            {t('zbls.presets.delete')}
          </button>
        </div>
      ))}
    </div>
  );
}

// ===== 主页面 =====
export function ZblsSelectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selected = useZblsSelectedStore();
  const session = useZblsSessionStore();

  // NOTE: 折叠状态——默认全部折叠（与上游一致）
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const toggleExpand = useCallback((groupNum: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupNum)) {
        next.delete(groupNum);
      } else {
        next.add(groupNum);
      }
      return next;
    });
  }, []);

  const expandAll = () => setExpandedGroups(new Set(F2L_GROUP_NUMS));
  const collapseAll = () => setExpandedGroups(new Set());

  // 开始训练
  const startTraining = (recap: boolean) => {
    if (selected.totalSelected() === 0) return;
    if (recap) {
      session.startRecap();
    }
    session.setSelectedKeys(selected.keys);
    navigate('/train/zbls');
  };

  // NOTE: 统计总 case 数用于显示
  const totalCases = useMemo(
    () => F2L_GROUP_NUMS.reduce((s, g) => s + (ZBLS_BY_GROUP[g]?.length || 0), 0),
    []
  );

  return (
    <div className="zbls-select-page">
      {/* 顶部导航 */}
      <div className="zbls-top-bar">
        <h2>
          ZBLS Trainer ({selected.totalSelected()}/{totalCases})
        </h2>
      </div>

      <div className="zbls-select-layout">
        {/* 左侧：F2L 组列表 */}
        <div className="zbls-groups-area">
          {F2L_GROUP_NUMS.map((groupNum) => (
            <F2lGroupCard
              key={groupNum}
              groupNum={groupNum}
              isExpanded={expandedGroups.has(groupNum)}
              onToggleExpand={() => toggleExpand(groupNum)}
            />
          ))}
        </div>

        {/* 右侧：操作面板 */}
        <div className="zbls-side-panel">
          {/* 训练按钮 */}
          <div className="zbls-side-card">
            <button
              className="zbls-btn zbls-btn-primary zbls-btn-full"
              disabled={selected.totalSelected() === 0}
              onClick={() => startTraining(false)}
            >
              ▶ {t('zbls.select.practice')} ({selected.totalSelected()})
            </button>
            <button
              className="zbls-btn zbls-btn-outline zbls-btn-full"
              disabled={selected.totalSelected() === 0}
              onClick={() => startTraining(true)}
            >
              🔄 {t('zbls.select.recap')}
            </button>
          </div>

          {/* 全选/取消 */}
          <div className="zbls-side-card">
            <button
              className="zbls-btn zbls-btn-secondary zbls-btn-full"
              onClick={() => selected.selectAll()}
            >
              {t('zbls.select.all')}
            </button>
            <button
              className="zbls-btn zbls-btn-secondary zbls-btn-full"
              onClick={() => selected.deselectAll()}
            >
              {t('zbls.select.none')}
            </button>
            <hr />
            <button
              className="zbls-btn zbls-btn-secondary zbls-btn-full"
              onClick={expandAll}
            >
              {t('zbls.select.expandAll')}
            </button>
            <button
              className="zbls-btn zbls-btn-secondary zbls-btn-full"
              onClick={collapseAll}
            >
              {t('zbls.select.collapseAll')}
            </button>
          </div>

          {/* 预设 */}
          <PresetPanel />
        </div>
      </div>
    </div>
  );
}
