'use client';

import { useTranslation } from 'react-i18next';
import PuzzlePicker from '../PuzzlePicker/PuzzlePicker';
import { eventDisplayName, isWcaEvent } from '@/lib/wca-events';
import { tr } from '@/i18n/tr';

interface EventSelectProps {
  events: string[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
  allLabel?: string;
}

/** Compatibility entry for existing event filters; menu behavior lives in PuzzlePicker. */
export function EventSelect({ events, value, onChange, className, allLabel }: EventSelectProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  return (
    <div className={className}>
      <PuzzlePicker
        isZh={isZh}
        selectedEvent={value}
        onSelect={onChange}
        placeholderLabel={allLabel}
        dataNoTimer
        groups={[{
          id: 'events', label: tr({ zh: '项目', en: 'Events' }),
          items: [
            ...(allLabel !== undefined ? [{ id: '', label: allLabel }] : []),
            ...events.map(id => ({ id, label: eventDisplayName(id, isZh), iconClass: isWcaEvent(id) ? `event-${id}` : undefined })),
          ],
        }]}
      />
    </div>
  );
}
