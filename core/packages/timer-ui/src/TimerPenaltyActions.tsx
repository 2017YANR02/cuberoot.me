import type { NetPenalty } from '@cuberoot/shared/timer';

export interface TimerPenaltyActionsProps {
  value: NetPenalty;
  language: 'en' | 'zh';
  disabled?: boolean;
  /** Local battle: no explicit OK action; click the selected penalty to clear it. */
  toggleOnly?: boolean;
  onChange(value: NetPenalty): void;
}

const PENALTIES = ['ok', '+2', 'dnf'] as const;
const COPY = { en: 'Penalty', zh: '罚时' } as const;

/** Hosts own result updates; the action order, labels and selection UI are shared. */
export function TimerPenaltyActions({ value, language, disabled = false, toggleOnly = false, onChange }: TimerPenaltyActionsProps) {
  return (
    <div className="timer-penalty-actions" role="group" aria-label={COPY[language]} data-no-timer>
      {(toggleOnly ? PENALTIES.slice(1) : PENALTIES).map((penalty) => (
        <button
          key={penalty}
          type="button"
          aria-pressed={value === penalty}
          disabled={disabled}
          onClick={() => onChange(toggleOnly && value === penalty ? 'ok' : penalty)}

        >{penalty.toUpperCase()}</button>
      ))}
    </div>
  );
}
