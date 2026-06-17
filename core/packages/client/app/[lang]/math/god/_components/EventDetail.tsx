'use client';

/**
 * /math/god?event=X — focused single-event deep-dive.
 *
 * EventDetail renders the shared chrome (back link + jump dropdown + prev/next),
 * a minimal identity hero (icon + name + lede), then mounts the per-event body:
 *   - a bespoke component from events/<Name>.tsx if registered in BESPOKE,
 *   - else a rich default built from god_data + god_deep_data.
 *
 * The body owns its headline number cards (<EvHighlights>) + deep sections.
 */
import { Suspense, lazy, useMemo, type ComponentType } from 'react';
import Link from '@/components/AppLink';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { VisualCube } from '@/components/VisualCube';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { PUZZLES, WCA_EVENT_ORDER, type PuzzleEntry } from './god_data';
import { tr, MathText } from './events/_shared';
import { useTranslation } from 'react-i18next';

export type EventBody = ComponentType<{ isZh: boolean; eventId: string }>;

/** Bespoke per-event articles. Events not listed fall back to DefaultDetail.
 *  Add an entry here once its events/<Name>.tsx file exists. */
const BESPOKE: Record<string, ReturnType<typeof lazy<EventBody>>> = {
  '222': lazy(() => import('./events/Cube222')),
  '333': lazy(() => import('./events/Cube333')),
  '444': lazy(() => import('./events/Cube444')),
  '555': lazy(() => import('./events/BigCubes')),
  '666': lazy(() => import('./events/BigCubes')),
  '777': lazy(() => import('./events/BigCubes')),
  clock: lazy(() => import('./events/Clock')),
  minx: lazy(() => import('./events/Megaminx')),
  pyram: lazy(() => import('./events/Pyraminx')),
  skewb: lazy(() => import('./events/Skewb')),
  '333fm': lazy(() => import('./events/Fmc')),
  '333mbf': lazy(() => import('./events/Mbld')),
  sq1: lazy(() => import('./events/Sq1')),
};

const DefaultDetail = lazy(() => import('./events/_DefaultDetail'));

const byId = new Map(PUZZLES.map((p) => [p.id, p]));

export function eventName(id: string): { zh: string; en: string } | null {
  return byId.get(id)?.name ?? null;
}

export function isKnownEvent(id: string | null | undefined): boolean {
  return !!id && byId.has(id);
}

export default function EventDetail({ eventId, setEvent }: {
  eventId: string;
  setEvent: (id: string | null) => void;
}) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const p = byId.get(eventId);

  const idx = WCA_EVENT_ORDER.indexOf(eventId as (typeof WCA_EVENT_ORDER)[number]);
  const prev = idx > 0 ? WCA_EVENT_ORDER[idx - 1] : null;
  const next = idx >= 0 && idx < WCA_EVENT_ORDER.length - 1 ? WCA_EVENT_ORDER[idx + 1] : null;

  const Body: EventBody = BESPOKE[eventId] ?? DefaultDetail;

  // same-group siblings (3×3 family, NxN bf pairs, …)
  const siblings = useMemo(() => {
    if (!p) return [] as PuzzleEntry[];
    const group = p.sameGroupAs ?? p.id;
    return PUZZLES.filter((q) => (q.sameGroupAs ?? q.id) === group && q.id !== p.id);
  }, [p]);

  if (!p) return null;

  return (
    <div className="god-ev-body-root">
      {/* chrome */}
      <nav className="god-ev-nav" aria-label={tr({ zh: '项目导航', en: 'event navigation' })}>
        <Link href="/math/god" className="god-ev-arrow">
          <ArrowLeft size={14} />
          <span>{tr({ zh: '全部项目', en: 'All events' })}</span>
        </Link>
        <select
          className="god-ev-jump"
          value={eventId}
          onChange={(e) => setEvent(e.target.value)}
          aria-label={tr({ zh: '跳到项目', en: 'jump to event' })}
        >
          {WCA_EVENT_ORDER.map((id) => {
            const q = byId.get(id);
            return <option key={id} value={id}>{q ? tr(q.name) : id}</option>;
          })}
        </select>
        <span className="god-ev-nav-sep" />
        <span className="god-ev-arrows">
          {prev && (
            <Link href={`/math/god?event=${prev}`} className="god-ev-arrow" title={tr(byId.get(prev)!.name)}>
              <ChevronLeft size={14} />
              <span>{tr(byId.get(prev)!.name)}</span>
            </Link>
          )}
          {next && (
            <Link href={`/math/god?event=${next}`} className="god-ev-arrow" title={tr(byId.get(next)!.name)}>
              <span>{tr(byId.get(next)!.name)}</span>
              <ChevronRight size={14} />
            </Link>
          )}
        </span>
      </nav>

      {/* identity hero */}
      <header className="god-ev-hero">
        <div className="god-ev-hero-icon">
          {p.puzzleSize ? (
            <VisualCube algorithm="" view="iso" puzzleSize={p.puzzleSize} size={72} alt={p.name.en} />
          ) : (
            <EventIcon event={p.id} className="god-card-cubing-icon" />
          )}
        </div>
        <div>
          <div className="god-ev-eyebrow">
            <EventIcon event={p.id} className="god-card-eventicon" />
            {tr({ zh: '上帝之数 — 单项目详解', en: "God's number — single event" })}
          </div>
          <h1 className="god-ev-title">{tr(p.name)}</h1>
        </div>
      </header>

      <Suspense fallback={<div className="god-loading">…</div>}>
        <Body isZh={isZh} eventId={eventId} />
      </Suspense>

      {/* related events */}
      {siblings.length > 0 && (
        <section className="god-ev-related">
          <div className="god-ev-related-h">{tr({ zh: '同群项目', en: 'Same-group events' })}</div>
          <div className="god-ev-related-row">
            {siblings.map((q) => (
              <Link key={q.id} href={`/math/god?event=${q.id}`} className="god-ev-relchip">
                <EventIcon event={q.id} />
                <span>{tr(q.name)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Used by the default body + hero to print a state-space line. */
export function StatesLine({ p }: { p: PuzzleEntry }) {
  return <MathText>{`|G| = ${p.states.sci}`}</MathText>;
}
