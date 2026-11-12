'use client';

import GridSelector from './GridSelector';

const SLOTS = ['BL', 'BR', 'FL', 'FR'] as const;
type Slot = typeof SLOTS[number];

export default function F2lSlotSelector({ selected, onSelect, selectOnHover = false, disabledSlots = [], disabledTitle, ariaLabel, className = '' }: {
  selected: readonly string[];
  onSelect: (slot: Slot) => void;
  /** Single-slot previews can switch on mouse hover; multi-select callers keep click behavior. */
  selectOnHover?: boolean;
  disabledSlots?: readonly string[];
  disabledTitle?: string;
  ariaLabel: string;
  className?: string;
}) {
  return <GridSelector items={SLOTS} columns={2} className={`f2l-slot-selector ${className}`} ariaLabel={ariaLabel}
    renderItem={(slot, cellClass) => <button key={slot} type="button" className={`f2l-slot-button ${cellClass}`}
      aria-pressed={selected.includes(slot)} disabled={disabledSlots.includes(slot)}
      title={disabledSlots.includes(slot) ? disabledTitle : undefined}
      onPointerEnter={event => {
        if (selectOnHover && event.pointerType === 'mouse' && !disabledSlots.includes(slot) && !selected.includes(slot)) onSelect(slot);
      }}
      onClick={() => onSelect(slot)}>{slot}</button>}
  />;
}
