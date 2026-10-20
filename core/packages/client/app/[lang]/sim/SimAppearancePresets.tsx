'use client';

import { useEffect, useId, useState } from 'react';
import { ClearButton } from '@/components/ClearButton';
import { persistItem } from '@/lib/safe-storage';
import { useT } from '@/hooks/useT';
import type { SimSettings } from './SettingDrawer';
import {
  APPEARANCE_PRESETS_KEY, MAX_APPEARANCE_PRESETS, pickAppearance, readAppearancePresets,
  type AppearancePreset, type SimAppearance,
} from './appearance-presets';

/** Page-owned control, shared by the animation and current-state image workspaces. */
export default function SimAppearancePresets({ settings, onChange }: {
  settings: SimSettings; onChange: (settings: SimSettings) => void;
}) {
  const t = useT();
  const id = useId();
  const [presets, setPresets] = useState<AppearancePreset[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [beforeApply, setBeforeApply] = useState<SimAppearance | null>(null);
  const [deleted, setDeleted] = useState<AppearancePreset | null>(null);

  useEffect(() => {
    const read = () => {
      try { setPresets(readAppearancePresets(localStorage.getItem(APPEARANCE_PRESETS_KEY))); }
      catch { setPresets([]); }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_PRESETS_KEY || event.key === null) read();
    };
    read();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const save = (next: AppearancePreset[]) => {
    if (!persistItem(APPEARANCE_PRESETS_KEY, JSON.stringify(next))) {
      setMessage(t('无法保存预设，请检查浏览器存储空间。', 'Could not save presets. Check browser storage space.'));
      return false;
    }
    setPresets(next);
    return true;
  };
  const current = presets.find(p => p.name === selected);
  const trimmed = name.trim();

  return <details className="sim-appearance-presets">
    <summary>{t('外观预设', 'Appearance presets')}</summary>
    <div className="sim-preset-row sim-player-tools">
      <select aria-label={t('已保存预设', 'Saved presets')} id={`${id}-saved`} className="sim-puzzle-select sim-preset-select" value={current?.name ?? ''}
        onChange={event => { setSelected(event.target.value); setMessage(''); }}>
        <option value="">{t('选择预设', 'Choose a preset')}</option>
        {presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
      </select>
      <button type="button" disabled={!current} onClick={() => {
        if (!current) return;
        setBeforeApply({ ghostFaceColors: undefined, mirrorColor: undefined, mirrorColorMode: undefined, ...pickAppearance(settings) });
        onChange({ ...settings, ...current.appearance });
        setMessage(t('已应用外观预设', 'Appearance preset applied'));
      }}>{t('应用', 'Apply')}</button>
      {beforeApply && <button type="button" onClick={() => {
        onChange({ ...settings, ...beforeApply });
        setBeforeApply(null);
        setMessage(t('已撤销外观更改', 'Appearance change undone'));
      }}>{t('撤销应用', 'Undo apply')}</button>}
      <button type="button" disabled={!current} onClick={() => {
        if (current && save(presets.filter(p => p.name !== current.name))) {
          setDeleted(current); setSelected('');
          setMessage(t('已删除预设', 'Preset deleted'));
        }
      }}>{t('删除', 'Delete')}</button>
      {deleted && <button type="button" disabled={presets.length >= MAX_APPEARANCE_PRESETS || presets.some(p => p.name === deleted.name)} onClick={() => {
        if (save([...presets, deleted])) {
          setSelected(deleted.name); setDeleted(null); setMessage(t('已恢复预设', 'Preset restored'));
        }
      }}>{t('撤销删除', 'Undo delete')}</button>}
    </div>
    <div className="sim-preset-row sim-player-tools">
    <div className="sim-preset-name">
      <input aria-label={t('新预设名称', 'New preset name')} id={`${id}-name`} placeholder={t('新预设名称', 'New preset name')} maxLength={40} value={name} onChange={event => setName(event.target.value)} />
      {name && <ClearButton onClick={() => setName('')} ariaLabel={t('清除预设名称', 'Clear preset name')} preserveFocus />}
    </div>
      <button type="button" disabled={!trimmed || presets.length >= MAX_APPEARANCE_PRESETS} onClick={() => {
        if (presets.some(p => p.name === trimmed)) {
          setMessage(t('已有同名预设，请使用另一个名称。', 'A preset with this name already exists. Choose another name.'));
          return;
        }
        if (save([...presets, { name: trimmed, appearance: pickAppearance(settings) }])) {
          setSelected(trimmed); setName(''); setMessage(t('已保存当前外观', 'Current appearance saved'));
        }
      }}>{t('保存', 'Save')}</button>
    </div>
    {presets.length >= MAX_APPEARANCE_PRESETS && <p>{t('最多保存 20 个预设。', 'You can save up to 20 presets.')}</p>}
    <p role="status">{message}</p>
  </details>;
}
