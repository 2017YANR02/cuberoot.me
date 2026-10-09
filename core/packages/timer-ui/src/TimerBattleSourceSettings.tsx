import type { ReactNode } from 'react';
import { LOCAL_BATTLE_SCRAMBLE_COPY } from '@cuberoot/shared/timer';
export function TimerBattleSourceSettings({ language, value, onChange, children }: {
  language: 'en' | 'zh'; value: 'wca' | 'random'; onChange(value: 'wca' | 'random'): void; children?: ReactNode;
}) {
  const copy = LOCAL_BATTLE_SCRAMBLE_COPY;
  return <div className="settings-group">
    <label><span>{copy.source[language]}</span><select value={value} onChange={event => onChange(event.target.value as 'wca' | 'random')}>
      <option value="wca">{copy.wca[language]}</option><option value="random">{copy.random[language]}</option>
    </select></label>
    {value === 'wca' && children}
  </div>;
}
