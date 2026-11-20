'use client';
import { useEffect, useState } from 'react';
import { TIMER_SYNC_SEED_COPY, timerSyncSeedCurrentCopy, type TimerSyncSeedSettings as SeedSettings } from '@cuberoot/shared/timer/sync-seed';
import { timerSettingFieldContract } from '@cuberoot/shared/timer';
import { ClearButton } from './ClearButton';
export function TimerSyncSeedSettings({ value, language, disabled = false, onReset }: {
  value: SeedSettings; language: 'en' | 'zh'; disabled?: boolean;
  onReset(seed: string | null): void;
}) {
  const tr = <T,>(text: { en: T; zh: T }) => text[language];
  const [draft, setDraft] = useState(value.syncSeed ?? '');
  useEffect(() => setDraft(value.syncSeed ?? ''), [value.syncSeed]);
  const canApply = !disabled && !!draft && draft !== value.syncSeed;
  const apply = () => { if (canApply) onReset(draft); };
  return <>
    <div className="settings-row" data-setting-id="settings.advanced.sync-seed">
      <span className="settings-row-label">{tr(timerSettingFieldContract('settings.advanced.sync-seed').copy)}</span>
      <span className="settings-row-control timer-sync-seed-controls">
        <input className="settings-row-control-input" aria-label={tr(timerSettingFieldContract('settings.advanced.sync-seed').copy)} disabled={disabled} value={draft} placeholder={tr(TIMER_SYNC_SEED_COPY.placeholder)} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }} />
        {draft && !disabled && <ClearButton variant="standalone" ariaLabel={tr(TIMER_SYNC_SEED_COPY.clearInput)} onClick={() => setDraft('')} />}
        <button type="button" className="hint-btn" disabled={!canApply} onClick={apply}>{tr(TIMER_SYNC_SEED_COPY.apply)}</button>
        <button type="button" className="hint-btn" disabled={disabled || !value.syncSeed} onClick={() => onReset(null)}>{tr(TIMER_SYNC_SEED_COPY.disable)}</button>
      </span>
    </div>
    <div className="settings-row" data-setting-id="settings.advanced.sync-seed-counter">
      <span className="settings-row-label">{tr(timerSettingFieldContract('settings.advanced.sync-seed-counter').copy)}</span>
      <span className="settings-row-control"><span className="hint">{tr(timerSyncSeedCurrentCopy(value))}</span>
        <button type="button" className="hint-btn" disabled={disabled || !value.syncSeed} onClick={() => onReset(value.syncSeed)}>{tr(TIMER_SYNC_SEED_COPY.resetCounter)}</button>
      </span>
    </div>
    <p className="hint">{tr(TIMER_SYNC_SEED_COPY.description)}</p>
  </>;
}
export const TIMER_SYNC_SEED_SETTING_FIELD_IDS = ['settings.advanced.sync-seed', 'settings.advanced.sync-seed-counter'] as const;
