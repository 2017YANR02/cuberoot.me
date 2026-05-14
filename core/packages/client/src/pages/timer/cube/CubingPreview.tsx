/**
 * Static scramble preview backed by `<scramble-display>` from cubing.org's
 * scramble-display package — internally a thin wrapper around cubing/twisty.
 *
 * Accepts either timer-side EventIds (`mega`, `pyra`, ...) or WCA-style ids
 * the scramble-display library uses directly (`minx`, `pyram`, `333oh`,
 * `333bld`, `kilominx`, `fto`, ...). Reused by both /timer and /battle.
 *
 * Side-effect import registers the custom element via customElements.define.
 */

import { useEffect, useMemo, useRef, type JSX } from 'react';
import 'scramble-display';
import { renderSq1ScrambleSvg, DEFAULT_SQ1_COLORS } from '../../gen/sq1_svg';
import { renderMegaScrambleSvg, DEFAULT_MEGA_COLORS } from '../../gen/mega_svg';

interface CubingPreviewProps {
  /** Either a timer EventId or a scramble-display event id (e.g. 'minx', 'pyram'). */
  event: string;
  scramble: string;
  size?: number;
  className?: string;
  /** Force a render mode. Default `2D` (unfolded net for every puzzle —
   * matches the community-standard "show every sticker" view). Set to `3D`
   * for a drag-rotatable interactive cube. */
  visualization?: '2D' | '3D';
}

/** Normalise an event id (timer EventId OR scramble-display id) → scramble-display event. */
function normalizeEvent(event: string): string | null {
  switch (event) {
    // NxN base events — same naming both sides
    case '222': case '333': case '444': case '555': case '666': case '777':
      return event;
    // Timer-side variants → scramble-display picks the size; map to base
    case '333oh': case '333fm': case '333mr': case '333ni':
      return '333oh';  // scramble-display has a dedicated 333oh slot; falls back to 333 internally
    case '333bld': case '333bf': return '333bf';
    case '444bld': case '444bf': return '444bf';
    case '555bld': case '555bf': return '555bf';
    case '333mbld': case '333mbf': return '333mbf';
    // Puzzle aliases between timer-side / WCA-side
    case 'mega': case 'minx': return 'minx';
    case 'pyra': case 'pyram': return 'pyram';
    case 'skewb': return 'skewb';
    case 'sq1': return 'sq1';
    case 'clock': return 'clock';
    case 'fto': return 'fto';
    case 'kilominx': return 'kilominx';
    // Relays / custom / unknown — best-effort fall through
    case 'r3': case 'r4': case 'r5': case 'custom': return '333';
    default: return null;
  }
}

function dimensionsFor(eventId: string, size: number): { w: number; h: number } {
  switch (eventId) {
    case '222':   return { w: size * 8,  h: size * 6 };
    case '333':
    case '333oh':
    case '333bf':
    case '333mbf':
                  return { w: size * 12, h: size * 9 };
    case '444':
    case '444bf': return { w: size * 16, h: size * 12 };
    case '555':
    case '555bf': return { w: size * 20, h: size * 15 };
    case '666':   return { w: size * 24, h: size * 18 };
    case '777':   return { w: size * 28, h: size * 21 };
    case 'minx':  return { w: size * 17, h: size * 8 };  // tnoodle mega aspect ≈ 2.087:1 (wide unfolded)
    case 'pyram': return { w: size * 12, h: size * 10 };
    case 'skewb': return { w: size * 12, h: size * 9 };
    case 'sq1':   return { w: size * 7,  h: size * 14 }; // tnoodle SquareOnePuzzle is portrait (~1:2)
    case 'clock': return { w: size * 14, h: size * 7 };
    case 'fto':   return { w: size * 16, h: size * 12 };
    case 'kilominx': return { w: size * 18, h: size * 14 };
    default:      return { w: size * 12, h: size * 9 };
  }
}

export default function CubingPreview(props: CubingPreviewProps): JSX.Element {
  const { event, scramble, className } = props;
  const size = props.size ?? 14;
  const visualization = props.visualization ?? '2D';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const eventId = normalizeEvent(event);

  // sq1 / mega use our tnoodle puzzle ports (sq1: portrait, mega: wide
  // unfolded with all 12 face colors). Bypasses scramble-display entirely.
  // Empty scramble → ports render the solved state (don't early-return null).
  const portedSvg = useMemo(() => {
    try {
      if (eventId === 'sq1')  return renderSq1ScrambleSvg(scramble ?? '', DEFAULT_SQ1_COLORS);
      if (eventId === 'minx') return renderMegaScrambleSvg(scramble ?? '', DEFAULT_MEGA_COLORS);
      return null;
    } catch (err) {
      console.warn(`[CubingPreview] ${eventId} render failed`, err);
      return null;
    }
  }, [eventId, scramble]);

  useEffect(() => {
    if (eventId === 'sq1' || eventId === 'minx') return; // handled inline
    const host = hostRef.current;
    if (!host || !eventId) return;

    const el = document.createElement('scramble-display');
    el.setAttribute('event', eventId);
    el.setAttribute('scramble', scramble);
    el.setAttribute('visualization', visualization);
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.display = 'block';
    host.appendChild(el);

    return () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, [eventId, scramble, visualization]);

  if (!eventId) {
    return <div className={className} style={{ display: 'none' }} aria-hidden />;
  }

  const { w, h } = dimensionsFor(eventId, size);
  if (portedSvg) {
    return (
      <div
        className={className}
        style={{ width: w, height: h, display: 'block' }}
        role="img"
        aria-label={`${event} scramble preview`}
        dangerouslySetInnerHTML={{ __html: portedSvg }}
      />
    );
  }
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
