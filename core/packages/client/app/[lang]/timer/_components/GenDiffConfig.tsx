'use client';

import { TimerRandomDifficultyConfig } from '@cuberoot/timer-ui';
import type { GenDiffSettings } from '../_lib/scramble/trainer-source';

interface Props {
  disabled?: boolean;
  isZh: boolean;
  settings: GenDiffSettings;
  updateSettings: (patch: Partial<GenDiffSettings>) => void;
  /** 「难度」开关的落点(计时器顶栏)。同 WcaSourceConfig 的 toggleSlot,不传就留在本组件顶行。 */
  toggleSlot?: HTMLElement | null;
}

export default function GenDiffConfig({ disabled, isZh, settings, updateSettings, toggleSlot }: Props) {
  return (
    <TimerRandomDifficultyConfig
      disabled={disabled}
      language={isZh ? 'zh' : 'en'}
      onChange={updateSettings}
      settings={settings}
      toggleSlot={toggleSlot}
    />
  );
}
