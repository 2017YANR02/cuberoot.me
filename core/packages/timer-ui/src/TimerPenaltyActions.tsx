import type { NetPenalty } from '@cuberoot/shared/timer';

export interface TimerPenaltyActionsProps {
  value: NetPenalty;
  language: 'en' | 'zh';
  disabled?: boolean;
  onChange(value: NetPenalty): void;
}

const COPY = { en: 'Penalty', zh: '罚时' } as const;

/** Hosts own result updates; the action order, labels and selection UI are shared. */
export function TimerPenaltyActions({ value, language, disabled = false, onChange }: TimerPenaltyActionsProps) {
  return (
    <div className="timer-penalty-actions" role="group" aria-label={COPY[language]} data-no-timer>
      {(['ok', '+2', 'dnf'] as const).map((penalty) => (
        <button
          key={penalty}
          type="button"
          aria-pressed={value === penalty}
          disabled={disabled}
          onClick={() => onChange(penalty)}
        >{penalty.toUpperCase()}</button>
      ))}
    </div>
  );
}
