'use client';

import BoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import WcaEventSelector from '@/components/WcaEventSelector';
import { tr } from '@/i18n/tr';
import { ALL_EVENT_IDS, CANCELLED_EVENT_IDS } from '@/lib/event-constants';
import './WcaEventMultiSelector.css';

const EVENT_CATEGORIES = [
  { key: 'speed', zh: '速拧', en: 'Speed', events: ['333', '222', '444', '555', '666', '777', '333oh', 'clock', 'minx', 'pyram', 'skewb', 'sq1'] },
  { key: 'cubic', zh: '正阶', en: 'Cubic', events: ['333', '222', '444', '555', '666', '777', '333oh'] },
  { key: 'sub25', zh: '二至五阶', en: '2-5', events: ['222', '333', '444', '555'] },
  { key: 'quiet', zh: '安静', en: 'Quiet', events: ['333bf', '333fm', '444bf', '555bf', '333mbf'] },
  { key: 'blind', zh: '盲拧', en: 'Blind', events: ['333bf', '444bf', '555bf', '333mbf'] },
  { key: 'shape', zh: '异形', en: 'Other', events: ['clock', 'minx', 'pyram', 'skewb', 'sq1'] },
] as const;

interface WcaEventMultiSelectorProps {
  availableEvents: ReadonlySet<string>;
  selectedEvents: ReadonlySet<string>;
  onChange: (events: Set<string>) => void;
  isZh: boolean;
}

export default function WcaEventMultiSelector({
  availableEvents,
  selectedEvents,
  onChange,
  isZh,
}: WcaEventMultiSelectorProps) {
  const activeEvents = ALL_EVENT_IDS.filter(
    (eventId) => availableEvents.has(eventId) && !CANCELLED_EVENT_IDS.has(eventId),
  );
  const cancelledEvents = ALL_EVENT_IDS.filter(
    (eventId) => availableEvents.has(eventId) && CANCELLED_EVENT_IDS.has(eventId),
  );
  const includeCancelled = cancelledEvents.some((eventId) => selectedEvents.has(eventId));
  const renderedEvents = new Set([
    ...activeEvents,
    ...(includeCancelled ? cancelledEvents : []),
  ]);

  const changeGroup = (events: readonly string[]) => {
    const available = events.filter((eventId) => availableEvents.has(eventId));
    if (available.length === 0) return;
    const next = new Set(selectedEvents);
    const allSelected = available.every((eventId) => next.has(eventId));
    for (const eventId of available) {
      if (allSelected) next.delete(eventId);
      else next.add(eventId);
    }
    onChange(next);
  };

  const toggleEvent = (eventId: string) => {
    const next = new Set(selectedEvents);
    if (next.has(eventId)) next.delete(eventId);
    else next.add(eventId);
    onChange(next);
  };

  const toggleCancelled = (enabled: boolean) => {
    const next = new Set(selectedEvents);
    for (const eventId of cancelledEvents) {
      if (enabled) next.add(eventId);
      else next.delete(eventId);
    }
    onChange(next);
  };

  return (
    <div className="wca-event-multi-selector">
      <div className="wca-event-multi-toolbar">
        <ClearButton variant="standalone" onClick={() => onChange(new Set())} isZh={isZh} />
        <button
          type="button"
          className="wca-event-category-btn"
          onClick={() => onChange(new Set(activeEvents))}
        >
          {tr({ zh: '全选', en: 'All' })}
        </button>
        {EVENT_CATEGORIES.map((category) => {
          const available = category.events.filter((eventId) => availableEvents.has(eventId));
          const active = available.length > 0
            && available.every((eventId) => selectedEvents.has(eventId));
          return (
            <button
              key={category.key}
              type="button"
              disabled={available.length === 0}
              onClick={() => changeGroup(category.events)}
              className={`wca-event-category-btn${active ? ' is-active' : ''}`}
            >
              {tr(category)}
            </button>
          );
        })}
        {cancelledEvents.length > 0 && (
          <BoolToggle
            value={includeCancelled}
            onChange={toggleCancelled}
            label={tr({ zh: '废止项', en: 'Cancelled' })}
          />
        )}
      </div>
      <WcaEventSelector
        availableEvents={renderedEvents}
        selectedEvents={selectedEvents}
        onToggle={toggleEvent}
        isZh={isZh}
        onlyAvailable
      />
    </div>
  );
}
