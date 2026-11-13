'use client';

import GridSelector from './GridSelector';

const SLOTS = ['BL', 'BR', 'FL', 'FR'] as const;
type Slot = typeof SLOTS[number];

export default function F2lSlotSelector({ selected, onSelect, compact = false, onCycle, disabledSlots = [], disabledTitle, ariaLabel, className = '' }: {
  selected: readonly string[];
  onSelect?: (slot: Slot) => void;
  /** Small four-cell selector; keep slot names accessible without visible letters. */
  compact?: boolean;
  onCycle?: () => void;
  disabledSlots?: readonly string[];
  disabledTitle?: string;
  ariaLabel: string;
  className?: string;
}) {
  return <GridSelector items={SLOTS} columns={2} className={`f2l-slot-selector${compact ? ' is-compact' : ''} ${className}`} ariaLabel={ariaLabel} onActivate={onCycle}
    renderItem={(slot, cellClass) => onCycle ? <span key={slot} className={cellClass}
      aria-hidden="true" aria-current={selected.includes(slot)} /> : <button key={slot} type="button" className={`f2l-slot-button ${cellClass}`}
      aria-label={slot} aria-pressed={selected.includes(slot)} disabled={disabledSlots.includes(slot)}
      title={disabledSlots.includes(slot) ? disabledTitle : undefined}
      onClick={() => onSelect?.(slot)}>{compact ? null : slot}</button>}
  />;
}
