import './compact-select.css';

import { EventIcon } from '@cuberoot/event-icon/event';
import {
  DEFAULT_SCRAMBLE_222_TYPE,
  type Scramble222Mode,
  type Scramble222Type,
} from '@cuberoot/shared/timer';

export interface TimerScramble222Labels {
  modeAriaLabel: string;
  modeLabel: string;
  optimal: string;
  type: string;
  typeAriaLabel: string;
  typeOptions: Readonly<Record<Scramble222Type, string>>;
  wca11Move: string;
}

export interface TimerScramble222ConfigProps {
  active222: boolean;
  disabled?: boolean;
  labels: TimerScramble222Labels;
  mode: Scramble222Mode;
  onModeChange: (mode: Scramble222Mode) => void;
  onTypeChange: (type: Scramble222Type) => void;
  /** The puzzle icon and style label are useful outside the timer topbar. */
  showLabel?: boolean;
  /** Random/real timer sources opt into the specialist-state selector. */
  showSpecialTypes?: boolean;
  /** Real WCA specialist filters still honor raw-11 vs optimal. */
  showModeWithSpecialType?: boolean;
  type: Scramble222Type;
  /** Random offers all 11 types; real WCA offers the 10 state-testable types. */
  typeOptions: readonly Scramble222Type[];
}

/**
 * Controlled 2x2 type/style UI shared verbatim by Web, Android, and iOS.
 * Hosts provide translated labels and persistence; catalog semantics come from
 * `@cuberoot/shared/timer`.
 */
export function TimerScramble222Config({
  active222,
  disabled = false,
  labels,
  mode,
  onModeChange,
  onTypeChange,
  showLabel = true,
  showSpecialTypes = false,
  showModeWithSpecialType = false,
  type,
  typeOptions,
}: TimerScramble222ConfigProps) {
  if (!active222) return null;
  const activeType = typeOptions.includes(type) ? type : DEFAULT_SCRAMBLE_222_TYPE;

  return (
    <>
      {showSpecialTypes && (
        <span className="timer-222-type-group">
          <span className="timer-222-type-label">{labels.type}</span>
          <select
            aria-label={labels.typeAriaLabel}
            className="timer-222-type-select"
            disabled={disabled}
            onChange={(event) => onTypeChange(event.target.value as Scramble222Type)}
            value={activeType}
          >
            {typeOptions.map((option) => (
              <option key={option} value={option}>{labels.typeOptions[option]}</option>
            ))}
          </select>
        </span>
      )}
      {(!showSpecialTypes || activeType === DEFAULT_SCRAMBLE_222_TYPE || showModeWithSpecialType) && (
        <div className="timer-222-mode-row">
          {showLabel && (
            <span className="timer-222-mode-label">
              <EventIcon ariaLabel="222" className="timer-222-mode-icon" event="222" />
              {labels.modeLabel}
            </span>
          )}
          <select
            disabled={disabled}
            value={String(mode === 'optimal')}
            onChange={event => { const optimal = event.currentTarget.value === 'true'; onModeChange(optimal ? 'optimal' : 'wca'); }}
            aria-label={labels.modeAriaLabel}
            className="native-select"
          >
            <option value="true">{labels.optimal}</option>
            <option value="false">{labels.wca11Move}</option>
          </select>
        </div>
      )}
    </>
  );
}
