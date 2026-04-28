/**
 * Static scramble preview backed by `<scramble-display>` from the official
 * cubing/scramble-display package — a thin wrapper around cubing/twisty
 * specialised for non-interactive scramble visualisation.
 *
 * scramble-display accepts WCA-style event names (333, 222, 444..777, minx,
 * pyram, skewb, sq1, clock, fto, kilominx). It internally creates a
 * <twisty-player> with appropriate defaults (2D where supported, 3D otherwise),
 * controlPanel hidden, no animation. Side-effect import registers the custom
 * element via customElements.define.
 */

import { useEffect, useRef, type JSX } from 'react';
import type { EventId } from '../types.ts';
import 'scramble-display';

interface CubingPreviewProps {
  event: EventId;
  scramble: string;
  size?: number;
  className?: string;
}

/** Map our event ids to scramble-display event ids (WCA naming). */
function sdEventForEvent(event: EventId): string | null {
  switch (event) {
    case '222': return '222';
    case '333': return '333';
    case '444': return '444';
    case '555': return '555';
    case '666': return '666';
    case '777': return '777';
    case 'mega': return 'minx';
    case 'pyra': return 'pyram';
    case 'skewb': return 'skewb';
    case 'sq1': return 'sq1';
    case 'clock': return 'clock';
    default: return null;
  }
}

function dimensionsFor(eventId: string, size: number): { w: number; h: number } {
  switch (eventId) {
    case '222':   return { w: size * 8,  h: size * 6 };
    case '333':   return { w: size * 12, h: size * 9 };
    case '444':   return { w: size * 16, h: size * 12 };
    case '555':   return { w: size * 20, h: size * 15 };
    case '666':   return { w: size * 24, h: size * 18 };
    case '777':   return { w: size * 28, h: size * 21 };
    case 'minx':  return { w: size * 18, h: size * 14 };
    case 'pyram': return { w: size * 12, h: size * 10 };
    case 'skewb': return { w: size * 12, h: size * 9 };
    case 'sq1':   return { w: size * 14, h: size * 8 };
    case 'clock': return { w: size * 14, h: size * 7 };
    default:      return { w: size * 12, h: size * 9 };
  }
}

export default function CubingPreview(props: CubingPreviewProps): JSX.Element {
  const { event, scramble, className } = props;
  const size = props.size ?? 14;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const eventId = sdEventForEvent(event);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !eventId) return;

    const el = document.createElement('scramble-display');
    el.setAttribute('event', eventId);
    el.setAttribute('scramble', scramble);
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.display = 'block';
    host.appendChild(el);

    return () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, [eventId, scramble]);

  if (!eventId) {
    return <div className={className} style={{ display: 'none' }} aria-hidden />;
  }

  const { w, h } = dimensionsFor(eventId, size);
  return (
    <div
      ref={hostRef}
      className={className}
      style={{ width: w, height: h, display: 'block' }}
      role="img"
      aria-label={`${event} scramble preview`}
    />
  );
}
