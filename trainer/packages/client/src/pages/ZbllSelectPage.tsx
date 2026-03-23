/**
 * ZBLL 选择页 — 左侧面板 + 右侧 OLL/COLL/ZBLL 网格
 * 完整复刻自上游 SelectView.vue
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useZbllSelectedStore } from '../stores/zbllSelectedStore';
import { useZbllSessionStore } from '../stores/zbllSessionStore';
import { useZbllSettingsStore } from '../stores/zbllSettingsStore';
import { useEffect, useState } from 'react';
import { allZbllKeys, zbllOllGroups, getOllImg, getCollImg, getZbllImg, inverseScramble, areSetsEqual } from '../utils/zbllHelpers';
import { useZbllPresetStore, STARRED_NAME } from '../stores/zbllPresetStore';
import { useZbllNotesStore } from '../stores/zbllNotesStore';
import zbllMap from '@cuberoot/shared/data/zbll.json';
import type { ZbllEntry } from '../utils/zbllHelpers';
import '../zbll.css';

// ===== 组件：ZbllNote =====
function ZbllNote({ zbllKey }: { zbllKey: string }) {
  const { t } = useTranslation();
  const { notes, setNote } = useZbllNotesStore();
  const [isEditing, setIsEditing] = useState(false);
  const note = notes[zbllKey] || '';

  if (isEditing) {
    return (
      <input
        className="zbll-note-input"
        maxLength={200}
        value={note}
        autoFocus
        placeholder='e.g. "odd regrip", "two sunes"'
        onChange={(e) => setNote(zbllKey, e.target.value.trim())}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') setIsEditing(false);
          e.stopPropagation();
        }}
      />
    );
  }

  return (
    <div className="zbll-note-display">
      <span className={note ? '' : 'zbll-note-placeholder'}>
        {note || t('zbll.result.addNote')}
      </span>
      <button className="zbll-note-edit-btn" onClick={() => setIsEditing(true)} title={t('zbll.result.addNote')}>
        ✏️
      </button>
    </div>
  );
}

// ===== 组件：SetupAndAlgs =====
function SetupAndAlgs({ zbllKey, maxAmount }: { zbllKey: string; maxAmount: number }) {
  const { t } = useTranslation();
  const entry = (zbllMap as Record<string, ZbllEntry>)[zbllKey];
  if (!entry || !entry.algs.length) return null;
  const setup = inverseScramble(entry.algs[0]);
  const algs = entry.algs.slice(0, maxAmount);

  return (
    <div>
      <div>{t('zbll.result.setup')} <strong>{setup}</strong></div>
      <div className="mt-1">{t('zbll.result.algs')}</div>
      <ul className="zbll-alg-list">
        {algs.map((alg, i) => (
          <li key={alg} className={i === 0 ? 'zbll-alg-bold' : ''}>
            · {alg}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ===== 组件：ZbllCaseInfo（弹窗底部悬停详情） =====
function ZbllCaseInfo({ zbllKey }: { zbllKey: string }) {
  const { settings } = useZbllSettingsStore();
  const altView = settings.pictureView === 'top' ? '3D' : 'top';
  return (
    <div className="zbll-case-info">
      <hr />
      <div className="zbll-case-info-row">
        <div className="zbll-case-info-left">
          <h5>{zbllKey.replace('s', '/')}</h5>
          <img className="zbll-card-img" src={getZbllImg(zbllKey, altView)} alt={zbllKey} />
        </div>
        <div className="zbll-case-info-right">
          <ZbllNote zbllKey={zbllKey} />
          <SetupAndAlgs zbllKey={zbllKey} maxAmount={8} />
        </div>
      </div>
    </div>
  );
}

// ===== 组件：ZbllCaseCard（单个 ZBLL 选择卡片） =====
function ZbllCaseCard({ zbllKey }: { zbllKey: string }) {
  const { isSelected, addZbll, removeZbll } = useZbllSelectedStore();
  const { settings } = useZbllSettingsStore();
  const selected = isSelected(zbllKey);

  const onClick = () => {
    if (selected) removeZbll(zbllKey);
    else addZbll(zbllKey);
  };

  return (
    <div className={`zbll-case-card ${selected ? 'zbll-all-selected' : 'zbll-none-selected'}`}>
      <div className="zbll-case-card-header">
        {zbllKey.split(' ')[2].replace('s', '/')}
      </div>
      <div className="zbll-case-card-body" onClick={onClick}>
        <img className="zbll-card-img" src={getZbllImg(zbllKey, settings.pictureView)} alt={zbllKey} />
      </div>
    </div>
  );
}

// ===== 组件：ZbllsModal（COLL 详情弹窗） =====
function ZbllsModal({ oll, coll, onClose }: { oll: string; coll: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { numInCollSelected, addColl, removeColl } = useZbllSelectedStore();
  const zbllKeys = allZbllKeys.filter((k) => k.startsWith(`${oll} ${coll}`));
  const zbllNames = zbllKeys.map((k) => k.split(' ')[2]);
  const [inspectingKey, setInspectingKey] = useState<string | null>(null);

  const count = numInCollSelected(oll, coll);
  const total = zbllKeys.length;

  const allBtnClicked = () => {
    removeColl(oll, coll);
    addColl(oll, coll);
  };

  // 按 Escape 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="zbll-modal-overlay" onClick={onClose}>
      <div className="zbll-modal" onClick={(e) => e.stopPropagation()}>
        <div className="zbll-modal-header">
          <h5>{oll} • {coll} ({count}/{total})</h5>
          <button className="zbll-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="zbll-modal-body">
          <div className="zbll-modal-grid">
            {zbllNames.map((zbll) => {
              const key = `${oll} ${coll} ${zbll}`;
              return (
                <div key={zbll} className="zbll-modal-cell" onMouseEnter={() => setInspectingKey(key)}>
                  <ZbllCaseCard zbllKey={key} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="zbll-modal-footer">
          <button className="zbll-btn zbll-btn-secondary" onClick={allBtnClicked}>{t('zbll.select.all')}</button>
          <button className="zbll-btn zbll-btn-secondary" onClick={() => removeColl(oll, coll)}>{t('zbll.select.none')}</button>
          <button className="zbll-btn zbll-btn-primary" onClick={onClose}>{t('zbll.select.done')}</button>
        </div>
        {inspectingKey && <ZbllCaseInfo zbllKey={inspectingKey} />}
      </div>
    </div>
  );
}

// ===== 组件：CollCard =====
function CollCard({ oll, coll }: { oll: string; coll: string }) {
  const { numInCollSelected, addColl, removeColl } = useZbllSelectedStore();
  const { settings } = useZbllSettingsStore();
  const [modalOpen, setModalOpen] = useState(false);

  const count = numInCollSelected(oll, coll);
  const total = allZbllKeys.filter((k) => k.startsWith(`${oll} ${coll}`)).length;

  const bgClass = count === 0 ? 'zbll-none-selected' : count === total ? 'zbll-all-selected' : 'zbll-some-selected';

  const onImgClick = () => {
    if (count === 0) addColl(oll, coll);
    else removeColl(oll, coll);
  };

  return (
    <>
      <div className={`zbll-coll-card ${bgClass}`}>
        <div className="zbll-coll-card-header" onClick={() => setModalOpen(true)}>
          <strong>{coll}</strong> <span>({count}/{total})</span>
        </div>
        <div className="zbll-coll-card-body" onClick={onImgClick}>
          <img className="zbll-card-img" src={getCollImg(oll, coll, settings.pictureView)} alt={coll} />
        </div>
      </div>
      {modalOpen && <ZbllsModal oll={oll} coll={coll} onClose={() => setModalOpen(false)} />}
    </>
  );
}

// ===== 组件：OllCard =====
function OllCard({ oll }: { oll: string }) {
  const { numInOllSelected } = useZbllSelectedStore();
  const { addOll, removeOll } = useZbllSelectedStore();
  const [collapsed, setCollapsed] = useState(true);

  const total = allZbllKeys.filter((k) => k.startsWith(oll)).length;
  const count = numInOllSelected(oll);

  const bgClass = count === 0 ? 'zbll-none-selected' : count === total ? 'zbll-all-selected' : 'zbll-some-selected';

  const colls = allZbllKeys
    .filter((k) => k.startsWith(oll))
    .map((k) => k.split(' ')[1])
    .filter((c, i, arr) => arr.indexOf(c) === i);

  const onImgClick = () => {
    if (count === 0) addOll(oll);
    else removeOll(oll);
  };

  return (
    <div className="zbll-oll-column">
      <div className={`zbll-oll-card ${bgClass}`}>
        <div className="zbll-oll-card-header" onClick={() => setCollapsed(!collapsed)}>
          <div>
            <strong>{oll}</strong> ({count}/{total})
          </div>
          <span className={`zbll-caret ${collapsed ? '' : 'zbll-caret-up'}`}>▼</span>
        </div>
        <div className="zbll-oll-card-body" onClick={onImgClick}>
          <img className="zbll-card-img" src={getOllImg(oll)} alt={oll} />
        </div>
      </div>
      {!collapsed && (
        <div className="zbll-colls-container">
          {colls.map((coll) => (
            <CollCard key={`${oll}-${coll}`} oll={oll} coll={coll} />
          ))}
        </div>
      )}
    </div>
  );
}

// ===== 组件：Presets =====
function Presets() {
  const { t } = useTranslation();
  const presets = useZbllPresetStore();
  const selected = useZbllSelectedStore();
  const [name, setName] = useState('');

  const isEditing = presets.map.hasOwnProperty(name);
  const currentSet = new Set(selected.keys);
  const isSame = areSetsEqual(presets.getCases(name), currentSet);

  const save = () => presets.setPreset(name, selected.keys);
  const apply = (presetName: string) => {
    selected.applyFromPreset(presets.getCases(presetName));
    setName(presetName);
  };

  const showList = Object.keys(presets.map).length > 1 || presets.getCases(STARRED_NAME).size > 0;

  return (
    <div>
      <div className="zbll-preset-input-group">
        <span className="zbll-preset-label">{isEditing ? t('zbll.presets.edit') : t('zbll.presets.new')}</span>
        <input
          type="text"
          className="zbll-preset-input"
          value={name}
          onChange={(e) => setName(e.target.value.trim())}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder={t('zbll.presets.placeholder')}
          maxLength={20}
        />
        <button className="zbll-btn zbll-btn-primary" onClick={save} disabled={!name || isSame}>
          {t('zbll.presets.save')}
        </button>
      </div>
      {showList && Object.keys(presets.map).map((pName) => {
        const cases = presets.getCases(pName);
        const isCurrentPreset = areSetsEqual(cases, currentSet);
        return (
          <div key={pName} className="zbll-preset-row">
            <span className={`zbll-preset-name ${isCurrentPreset ? 'zbll-preset-active' : ''}`}>
              {pName} ({cases.size})
            </span>
            <button className="zbll-preset-apply-btn" disabled={isCurrentPreset} onClick={() => apply(pName)} title="Apply">
              ⬇
            </button>
            {pName !== STARRED_NAME && (
              <button className="zbll-preset-delete-btn" onClick={() => presets.deletePreset(pName)} title="Delete">
                🗑
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===== 组件：SideAccordion（手风琴） =====
function SideAccordion() {
  const { t } = useTranslation();
  const { settings, updateSetting } = useZbllSettingsStore();
  const [openSection, setOpenSection] = useState<string | null>(settings.showHowTo ? 'howto' : 'presets');

  const toggle = (section: string) => setOpenSection(openSection === section ? null : section);

  return (
    <div className="zbll-accordion">
      {settings.showHowTo && (
        <div className="zbll-accordion-item">
          <div className="zbll-accordion-header" onClick={() => toggle('howto')}>
            {t('zbll.howto.title')} {openSection === 'howto' ? '▲' : '▼'}
          </div>
          {openSection === 'howto' && (
            <div className="zbll-accordion-body">
              <ul className="zbll-howto-list">
                <li>{t('zbll.howto.step1')}</li>
                <li>{t('zbll.howto.step2')}</li>
                <li>{t('zbll.howto.step3')}</li>
                <li>{t('zbll.howto.step4')}</li>
              </ul>
              <button className="zbll-link-btn" onClick={() => updateSetting('showHowTo', false)}>
                {t('zbll.howto.dismiss')}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="zbll-accordion-item">
        <div className="zbll-accordion-header" onClick={() => toggle('presets')}>
          {t('zbll.presets.title')} {openSection === 'presets' ? '▲' : '▼'}
        </div>
        {openSection === 'presets' && (
          <div className="zbll-accordion-body">
            <Presets />
          </div>
        )}
      </div>
      <div className="zbll-accordion-item">
        <div className="zbll-accordion-header" onClick={() => toggle('hotkeys')}>
          {t('zbll.hotkeys.title')} {openSection === 'hotkeys' ? '▲' : '▼'}
        </div>
        {openSection === 'hotkeys' && (
          <div className="zbll-accordion-body">
            <ul className="zbll-hotkey-list">
              <li><kbd>Alt</kbd>+<kbd>T</kbd> {t('zbll.hotkeys.toggleView')}</li>
              <li><kbd>Delete</kbd> / <kbd>Alt</kbd>+<kbd>Z</kbd> {t('zbll.hotkeys.deleteResult')}</li>
              <li><kbd>Shift</kbd>+<kbd>Delete</kbd> / <kbd>Alt</kbd>+<kbd>D</kbd> {t('zbll.hotkeys.clearSession')}</li>
              <li><kbd>Alt</kbd>+<kbd>S</kbd> {t('zbll.hotkeys.selectDeselect')}</li>
              <li><kbd>Alt</kbd>+<kbd>R</kbd> {t('zbll.hotkeys.startRecap')}</li>
              <li><kbd>Alt</kbd>+<kbd>A</kbd> {t('zbll.hotkeys.addToStarred')}</li>
              <li><kbd>←</kbd>/<kbd>→</kbd>/<kbd>Home</kbd>/<kbd>End</kbd> {t('zbll.hotkeys.navigate')}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 主页面 =====
export function ZbllSelectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selected = useZbllSelectedStore();
  const session = useZbllSessionStore();
  const disabled = selected.totalSelected() === 0;

  // Alt+T 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 't' && e.altKey) {
        e.preventDefault();
        navigate('/train/zbll');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  // 同步选中 keys 到 session store
  useEffect(() => {
    session.setSelectedKeys(selected.keys, selected.commonScrambleLength());
  }, [selected.keys]);

  const startPractice = () => {
    session.data.recapMode = false;
    navigate('/train/zbll');
  };

  const startRecap = () => {
    session.startRecap();
    navigate('/train/zbll');
  };

  return (
    <div className="zbll-select-page">
      <div className="zbll-select-layout">
        <div className="zbll-side-panel">
          <div className="zbll-side-card">
            <button className="zbll-btn zbll-btn-primary zbll-btn-full" disabled={disabled} onClick={startPractice}>
              {t('zbll.select.practice')}
            </button>
            <button className="zbll-btn zbll-btn-outline zbll-btn-full" disabled={disabled} onClick={startRecap}>
              {t('zbll.select.recap')}
            </button>
            <SideAccordion />
          </div>
        </div>
        <div className="zbll-grid-area">
          <div className="zbll-oll-grid">
            {zbllOllGroups.map((oll) => (
              <OllCard key={oll} oll={oll} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
