'use client';

import { Pin, PinOff } from 'lucide-react';
import { tr } from '@/i18n/tr';
import './country-pins.css';

export function CountryPinButton({ name, pinned, onToggle }: {
  name: string;
  pinned: boolean;
  onToggle: () => void;
}) {
  const label = pinned
    ? tr({ zh: `取消置顶 ${name}`, en: `Unpin ${name}` })
    : tr({ zh: `置顶 ${name}`, en: `Pin ${name}` });
  const Icon = pinned ? PinOff : Pin;
  return (
    <button type="button" className="country-pin-button" aria-label={label} title={label}
      aria-pressed={pinned}
      onMouseDown={event => event.preventDefault()}
      onClick={event => { event.stopPropagation(); onToggle(); }}
    ><Icon size={15} aria-hidden /></button>
  );
}
