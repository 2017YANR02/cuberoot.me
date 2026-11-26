'use client';

import { TIMER_ROOM_TOOLBAR_COPY } from '@cuberoot/shared/timer/net-battle';
import type { TimerSettingCopy, TimerSmartCubeSettings, TimerSoundSettings as Sound, TimerTimingSettings } from '@cuberoot/shared/timer';
import BoolToggle from './BoolToggle';
import { TimerRoomDialog } from './TimerRoomDialog';
import { TimerSmartCubeLiveViewSetting } from './TimerSmartCubeSettingsFields';
import { TimerSoundSettings } from './TimerSoundSettings';
import { TimerSettingsSection, TimerTimingSettingsSections } from './TimerTimingSettingsSections';
import './timer-settings-panel.css';

type Settings = TimerTimingSettings & Sound & Pick<TimerSmartCubeSettings, 'liveCubeView'>;

export interface TimerNetBattleSettingsProps {
  language: 'en' | 'zh';
  value: Settings;
  onChange(patch: Partial<Settings>): void;
  voiceAvailable: boolean;
  onWarmup(): void;
  onPreview(): void;
  fixedHoldMs?: number;
  onClose(): void;
}

export function TimerNetBattleSettings({ language, value, onChange, voiceAvailable, onWarmup, onPreview, fixedHoldMs, onClose }: TimerNetBattleSettingsProps) {
  const localize = (copy: TimerSettingCopy) => copy[language];
  return <TimerRoomDialog title={TIMER_ROOM_TOOLBAR_COPY[language].timerSettings} language={language} className="settings-modal" onClose={onClose}>
    <TimerTimingSettingsSections basicOnly value={value} localize={localize} onChange={onChange} fixedHoldMs={fixedHoldMs}
      renderBooleanControl={({ label, value, onChange, disabled }) => (
        <BoolToggle label="" ariaLabel={label} value={value} disabled={disabled} onChange={onChange} />
      )} />
    <TimerSettingsSection>
      <TimerSoundSettings value={value} localize={localize} onChange={onChange}
        voiceAvailable={voiceAvailable} onWarmup={onWarmup} onPreview={onPreview} />
      <TimerSmartCubeLiveViewSetting value={value.liveCubeView} localize={localize}
        onChange={liveCubeView => onChange({ liveCubeView })} />
    </TimerSettingsSection>
  </TimerRoomDialog>;
}
