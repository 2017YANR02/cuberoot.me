import { BookOpen, Keyboard } from 'lucide-react';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import type { OhHand } from '@/lib/alg_oh_hand';
import './alg-tag-label.css';

const TAG_EVENTS: Record<string, string> = { oh: '333oh', ft: '333ft', fmc: '333fm', big: '555' };

/** Tags share the event-menu artwork; unknown IDs remain readable. */
export default function AlgTagLabel({ tag, label, hand = 'left' }: { tag: string; label: string; hand?: OhHand | null }) {
  const event = TAG_EVENTS[tag];
  if (!event && tag !== 'key' && tag !== 'beginner') return <>{label}</>;
  return <span className="alg-tag-label" title={label}>
    <span className="sr-only">{label}</span>
    <span className="alg-tag-symbol" aria-hidden="true">
      {tag === 'oh' ? (
        <span className="alg-tag-oh-icon">
          <EventIcon event={event} />
          {hand && <small className="alg-tag-hand">{hand === 'right' ? 'R' : 'L'}</small>}
        </span>
      ) : event ? <EventIcon event={event} /> : tag === 'key' ? <Keyboard size="1em" /> : <BookOpen size="1em" />}
    </span>
  </span>;
}
