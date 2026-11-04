'use client';

import './f2l-slot-selector.css';

const SLOTS = ['BL', 'BR', 'FL', 'FR'] as const;
type Slot = typeof SLOTS[number];

export default function F2lSlotSelector({ selected, onSelect, disabledSlots = [], disabledTitle, ariaLabel, className = '' }: {
  selected: readonly string[];
  onSelect: (slot: Slot) => void;
  disabledSlots?: readonly string[];
  disabledTitle?: string;
  ariaLabel: string;
  className?: string;
}) {
  return <div className={`f2l-slot-selector ${className}`} role="group" aria-label={ariaLabel}>
    {SLOTS.map(slot => <button key={slot} type="button"
      aria-pressed={selected.includes(slot)} disabled={disabledSlots.includes(slot)}
      title={disabledSlots.includes(slot) ? disabledTitle : undefined}
      onClick={() => onSelect(slot)}>{slot}</button>)}
  </div>;
}
