'use client';
import { useEffect, useState } from 'react';
import type { TimerSyncSeedSettings as SeedSettings } from '@cuberoot/shared/timer/sync-seed';
import { timerSettingFieldContract } from '@cuberoot/shared/timer';
import { ClearButton } from './ClearButton';
export function TimerSyncSeedSettings({ value, language, disabled = false, onReset }: {
  value: SeedSettings; language: 'en' | 'zh'; disabled?: boolean;
  onReset(seed: string | null): void;
}) {
  const tr = <T,>(text: { en: T; zh: T }) => text[language];
  const [draft, setDraft] = useState(value.syncSeed ?? '');
  useEffect(() => setDraft(value.syncSeed ?? ''), [value.syncSeed]);
  const apply = () => { if (!disabled && draft) onReset(draft); };
  return <>
    <div className="settings-row" data-setting-id="settings.advanced.sync-seed">
      <span className="settings-row-label">{tr(timerSettingFieldContract('settings.advanced.sync-seed').copy)}</span>
      <span className="settings-row-control">
        <input className="settings-row-control-input" aria-label={tr({ en: 'Seed', zh: '种子' })} disabled={disabled} value={draft} placeholder={tr({ en: 'any string', zh: '任意字符串' })} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }} />
        {draft && !disabled && <ClearButton variant="standalone" ariaLabel={tr({ en: 'Clear input', zh: '清除输入' })} onClick={() => setDraft('')} />}
        <button type="button" className="hint-btn" disabled={disabled || !draft} onClick={apply}>{tr({ en: 'Apply', zh: '应用' })}</button>
        <button type="button" className="hint-btn" disabled={disabled || !value.syncSeed} onClick={() => onReset(null)}>{tr({ en: 'Clear', zh: '清除' })}</button>
      </span>
    </div>
    <div className="settings-row" data-setting-id="settings.advanced.sync-seed-counter">
      <span className="settings-row-label">{tr(timerSettingFieldContract('settings.advanced.sync-seed-counter').copy)}</span>
      <span className="settings-row-control"><span className="hint">{value.syncSeed === null ? tr({ en: 'off', zh: '未启用' }) : tr({ en: `seed=${value.syncSeed}, scramble #${value.syncSeedCounter}`, zh: `seed=${value.syncSeed}，第 ${value.syncSeedCounter} 个打乱` })}</span>
        <button type="button" className="hint-btn" disabled={disabled || !value.syncSeed} onClick={() => onReset(value.syncSeed)}>{tr({ en: 'Reset counter', zh: '重置计数' })}</button>
      </span>
    </div>
    <p className="hint">{tr({ en: 'The seed controls local scrambles. Difficulty, move-count and cloud optimization settings are suspended. Manual scrambles and official WCA scrambles are unchanged.', zh: '种子用于本地打乱，启用后暂停按难度、按步数与云端最优生成；手动打乱和 WCA 真题保持原来源。' })}</p>
  </>;
}
export const TIMER_SYNC_SEED_SETTING_FIELD_IDS = ['settings.advanced.sync-seed', 'settings.advanced.sync-seed-counter'] as const;
