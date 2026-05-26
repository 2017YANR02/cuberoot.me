'use client';

// Ported from packages/client/src/components/EventSelect/EventSelect.tsx.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EventIcon } from '../EventIcon/EventIcon';
import { eventDisplayName, isWcaEvent } from '@/lib/wca-events';
import './event_select.css';

interface EventSelectProps {
  events: string[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
  allLabel?: string;
}

export function EventSelect({ events, value, onChange, className, allLabel }: EventSelectProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={ref} className={`event-select ${className ?? ''}`.trim()}>
      <button
        type="button"
        className="event-select-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="event-select-current">
          {value ? (
            <>
              {isWcaEvent(value) && <EventIcon event={value} />}
              <span className="event-select-label">{eventDisplayName(value, isZh)}</span>
            </>
          ) : (
            <span className={allLabel ? 'event-select-label' : 'event-select-empty'}>
              {allLabel ?? '-'}
            </span>
          )}
        </span>
        <ChevronDown size={14} className="event-select-chevron" />
      </button>
      {open && (
        <div className="event-select-popup">
          {allLabel !== undefined && (
            <button
              type="button"
              className={`event-select-item${value === '' ? ' event-select-item--active' : ''}`}
              onClick={() => select('')}
            >
              <span className="event-select-label">{allLabel}</span>
            </button>
          )}
          {events.map((ev) => (
            <button
              key={ev}
              type="button"
              className={`event-select-item${value === ev ? ' event-select-item--active' : ''}`}
              onClick={() => select(ev)}
            >
              {isWcaEvent(ev) && <EventIcon event={ev} />}
              <span className="event-select-label">{eventDisplayName(ev, isZh)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
