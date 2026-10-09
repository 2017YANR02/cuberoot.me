import type { TimerSettingCopy } from '@cuberoot/shared/timer';
import './reset-defaults-button.css';

export interface ResetDefaultsButtonProps {
  onReset(): void;
  title?: string;
  className?: string;
  disabled?: boolean;
  localize(copy: TimerSettingCopy): string;
}

export function ResetDefaultsButton({ onReset, title, className, disabled, localize: tr }: ResetDefaultsButtonProps) {
  return <button type="button" className={className ? `reset-defaults-btn ${className}` : 'reset-defaults-btn'}
    onClick={onReset} title={title} disabled={disabled}>
    {tr({ zh: '恢复默认', en: 'Reset defaults' })}
  </button>;
}

export const TIMER_RESET_SETTING_FIELD_IDS = ['settings.advanced.reset-defaults'] as const;

export function TimerResetSettings({ onReset, confirmReset, disabled, localize: tr }: {
  onReset(): void;
  confirmReset(message: string): boolean;
  disabled?: boolean;
  localize(copy: TimerSettingCopy): string;
}) {
  return <div className="settings-reset-row" data-setting-id={TIMER_RESET_SETTING_FIELD_IDS[0]}>
    <ResetDefaultsButton disabled={disabled} localize={tr}
      title={tr({ zh: '恢复全部计时器设置，不会删除成绩', en: 'Reset all timer settings without deleting solves' })}
      onReset={() => {
        if (confirmReset(tr({ zh: '把所有设置恢复为默认值？', en: 'Reset all settings to defaults?' }))) onReset();
      }} />
  </div>;
}
