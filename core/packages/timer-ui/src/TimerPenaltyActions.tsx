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
    <div className="timer-penalty-actions" role={toggleOnly ? 'group' : 'radiogroup'} aria-label={COPY[language]} data-no-timer>
      {(toggleOnly ? PENALTIES.slice(1) : PENALTIES).map((penalty, index) => (
        <button
          key={penalty}
          type="button"
          role={toggleOnly ? undefined : 'radio'}
          aria-checked={toggleOnly ? undefined : value === penalty}
          aria-pressed={toggleOnly ? value === penalty : undefined}
          tabIndex={toggleOnly || value === penalty ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(toggleOnly && value === penalty ? 'ok' : penalty)}
          onKeyDown={(event) => {
            if (toggleOnly) return;
            const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1
              : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
            if (!direction) return;
            event.preventDefault();
            event.stopPropagation();
            const next = (index + direction + PENALTIES.length) % PENALTIES.length;
            onChange(PENALTIES[next]);
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
          }}
        >{penalty.toUpperCase()}</button>
      ))}
    </div>
  );
}
