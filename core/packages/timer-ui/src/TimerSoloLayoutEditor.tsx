'use client';

import { getUsableViewport } from './host-viewport';
import { useEffect, useEffectEvent, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Check, GripHorizontal, MoveDiagonal2, RotateCcw, X } from 'lucide-react';
import { DEFAULT_SOLO_LAYOUT, TIMER_SOLO_LAYOUT_COPY, TIMER_SOLO_LAYOUT_REGIONS, timerSoloDragValue, timerSoloRegionPatch, timerSoloRegionValue,
  type SoloLayout, type TimerSoloHideableRegion, type TimerSoloLayoutRegion, type TimerSoloLayoutSettings } from '@cuberoot/shared/timer/solo-layout';
import './solo-layout-editor.css';
import { fitSoloSpacing } from './solo-spacing-fit';

const defaultSelectors = {
  scrambleGap: '.scramble-text',
  sourceGap: '.scramble-src-row',
  timerGap: '.timer-display-wrap',
  cubeGap: '.timing-surface-cube-frame',
};

/** Editing chrome for this page's existing regions; never reparent live timer DOM. */
export type { TimerSoloLayoutSettings } from '@cuberoot/shared/timer/solo-layout';
interface LayoutHost { getSettings(): TimerSoloLayoutSettings; updateSettings(patch: Partial<TimerSoloLayoutSettings>): void; language: 'en' | 'zh'; }

/** Use the visible viewport, including zoom/keyboard offsets on touch devices. */
function viewportOverflow(elements: Element[], stage?: DOMRect) {
  const viewport = getUsableViewport(stage);
  const left = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const top = Math.max(viewportTop, stage?.top ?? viewportTop);
  const right = left + Math.min(viewport?.width ?? window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
  const bottom = Math.min(viewportBottom, stage?.bottom ?? viewportBottom);
  return elements.map(element => {
    const rect = element.getBoundingClientRect();
    return [Math.max(0, left - rect.left), Math.max(0, top - rect.top),
      Math.max(0, rect.right - right), Math.max(0, rect.bottom - bottom)];
  });
}

function interpolateLayout(from: TimerSoloLayoutSettings, to: TimerSoloLayoutSettings, fraction: number): TimerSoloLayoutSettings {
  const mix = (a: number, b: number, precision: number) => Math.round((a + (b - a) * fraction) * precision) / precision;
  const soloLayout = { ...to.soloLayout };
  for (const key of Object.keys(soloLayout) as (keyof SoloLayout)[]) {
    if (key === 'hideCompetitionInfo' || key === 'hideCubePreview') continue;
    soloLayout[key] = mix(from.soloLayout[key], to.soloLayout[key], key.endsWith('Scale') ? 100 : 1);
  }
  return { soloLayout, timerFontScale: mix(from.timerFontScale, to.timerFontScale, 100),
    scrambleFontScale: mix(from.scrambleFontScale, to.scrambleFontScale, 100) };
}

/** Preview in the live flow without saving rejected candidates or waiting for
 * an installed host's asynchronous settings repository. Restored before paint. */
function layoutPreview(surface: HTMLElement, before: TimerSoloLayoutSettings, positionOnly: boolean) {
  const overrides: { element: HTMLElement; property: string; value(settings: TimerSoloLayoutSettings): string }[] = [];
  for (const region of TIMER_SOLO_LAYOUT_REGIONS) {
    overrides.push({ element: surface, property: `--solo-${region.gap.slice(0, -3)}-offset-y`,
      value: settings => `${settings.soloLayout[region.offset]}px` });
  }
  if (!positionOnly) {
    const variables = { scrambleGap: 'scramble-gap', sourceGap: 'source-gap', timerGap: 'timer-gap',
      cubeGap: 'cube-gap', sourceScale: 'source-scale', cubeScale: 'cube-scale' } as const;
    for (const key of Object.keys(variables) as (keyof typeof variables)[]) {
      for (const mode of ['solo', 'battle']) overrides.push({ element: surface, property: `--${mode}-${variables[key]}`,
        value: settings => `${settings.soloLayout[key]}${key.endsWith('Gap') ? 'px' : ''}` });
    }
    for (const element of surface.querySelectorAll<HTMLElement>('.scramble-strip')) {
      overrides.push({ element, property: '--scramble-scale', value: settings => String(settings.scrambleFontScale) });
    }
    for (const element of surface.querySelectorAll<HTMLElement>('.timer-display')) {
      const size = parseFloat(getComputedStyle(element).fontSize);
      if (Number.isFinite(size)) overrides.push({ element, property: 'font-size',
        value: settings => `${size * settings.timerFontScale / before.timerFontScale}px` });
    }
  }
  const originals = overrides.map(({ element, property }) => ({ value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }));
  return {
    apply(settings: TimerSoloLayoutSettings) {
      for (const override of overrides) override.element.style.setProperty(override.property, override.value(settings));
      // Measure the same fitted whitespace the live canvas will render. Stored
      // large gaps must not prevent resizing after rotation or a window shrink.
      if (!positionOnly && surface.matches('.timer-solo-main') && surface.closest('[data-spacing-flow]')) {
        fitSoloSpacing(surface, settings.soloLayout);
      }
    },
    restore() {
      overrides.forEach(({ element, property }, index) => {
        const original = originals[index];
        if (original.value) element.style.setProperty(property, original.value, original.priority);
        else element.style.removeProperty(property);
      });
    },
  };
}

function regionOverlaps(elements: Element[]) {
  const rects = elements.map(element => element.getBoundingClientRect());
  return rects.flatMap((first, index) => rects.slice(index + 1).map(second => {
    if (first.right <= second.left || second.right <= first.left) return 0;
    return Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  }));
}

export function TimerSoloLayoutEditor({ surfaceRef, contentKey, onDone, getSettings, updateSettings, language, regionSelectors, hideableRegions }: LayoutHost & {
  surfaceRef: RefObject<HTMLElement | null>; contentKey: string; onDone(): void;
  regionSelectors?: Partial<Record<TimerSoloLayoutRegion['gap'], string>>;
  hideableRegions?: readonly TimerSoloHideableRegion[];
}) {
  const tr = (value: { en: string; zh: string }) => value[language];
  const [targets, setTargets] = useState<Element[][]>([]);
  const resetRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const collect = () => {
      const next = TIMER_SOLO_LAYOUT_REGIONS.map(region => Array.from(surface.querySelectorAll(regionSelectors?.[region.gap] ?? defaultSelectors[region.gap])));
      setTargets(previous => previous.length === next.length && next.every((elements, index) =>
        elements.length === previous[index].length && elements.every((element, item) => element === previous[index][item])) ? previous : next);
    };
    collect();
    // Rotation moves the single preview between canvas and footer. Rebind its
    // handles; inserting those handles must not schedule another state change.
    const observer = new MutationObserver(collect);
    observer.observe(surface, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [surfaceRef, contentKey, regionSelectors]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onDone(); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onDone]);
  const updateWithinViewport = (patch: Partial<TimerSoloLayoutSettings>, positionOnly = false) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const settings = getSettings();
    const before: TimerSoloLayoutSettings = { soloLayout: { ...settings.soloLayout },
      timerFontScale: settings.timerFontScale, scrambleFontScale: settings.scrambleFontScale };
    const requested = { ...before, ...patch };
    const regions = targets.flat().filter(element => element.isConnected);
    const elements = regions.flatMap(element => [element, ...element.querySelectorAll('.timer-display-value, .solo-layout-handle')])
      .concat(Array.from(surface.querySelectorAll('.timer-stage-footer')))
      .filter(element => element.isConnected);
    const stage = positionOnly ? surface.getBoundingClientRect() : undefined;
    const baseline = viewportOverflow(elements, stage?.height ? stage : undefined);
    const limitOverlap = surface.matches('.timer-solo-main');
    const overlaps = limitOverlap ? regionOverlaps(regions) : [];
    const preview = layoutPreview(surface, before, positionOnly);
    const fits = () => viewportOverflow(elements, stage?.height ? stage : undefined).every((edges, index) => edges.every((overflow, edge) =>
      // Existing long content can be brought back in, but never pushed farther out.
      overflow <= Math.max(baseline[index][edge], 0.5)))
      && (!limitOverlap || regionOverlaps(regions).every((overlap, index) => overlap <= Math.max(overlaps[index], 0.5)));
    let accepted = before;
    try {
      preview.apply(requested);
      if (fits()) accepted = requested;
      else {
        let lower = 0;
        let upper = 1;
        // Whole-pixel gaps and two-decimal scales need at most ten probes.
        // No observers, recursive updates or intermediate settings writes.
        for (let attempt = 0; attempt < 10; attempt++) {
          const fraction = (lower + upper) / 2;
          const candidate = interpolateLayout(before, requested, fraction);
          preview.apply(candidate);
          if (fits()) { accepted = candidate; lower = fraction; }
          else upper = fraction;
        }
      }
    } finally {
      preview.restore();
    }
    if (JSON.stringify(accepted) !== JSON.stringify(before)) updateSettings(accepted);
  };
  return <>{TIMER_SOLO_LAYOUT_REGIONS.flatMap((region, index) => {
    const onHide = 'hide' in region && hideableRegions?.includes(region.gap) ? () => {
      updateSettings({ soloLayout: { ...getSettings().soloLayout, [region.hide]: true } });
      resetRef.current?.focus();
    } : undefined;
    return (targets[index] ?? []).map((target, targetIndex) =>
      createPortal(<RegionHandles target={target} region={region} getSettings={getSettings}
        updateSettings={updateWithinViewport} language={language} onHide={onHide} />, target, `${region.gap}-${targetIndex}`));
  })}
    {surfaceRef.current && createPortal(
      <div className="solo-layout-toolbar" role="toolbar" aria-label={tr(TIMER_SOLO_LAYOUT_COPY.edit)} data-no-timer data-site-surface="popover">
        <button ref={resetRef} title={tr(TIMER_SOLO_LAYOUT_COPY.reset)} type="button"
          className="solo-layout-reset" aria-label={tr(TIMER_SOLO_LAYOUT_COPY.reset)}
          onClick={() => updateWithinViewport({ soloLayout: { ...DEFAULT_SOLO_LAYOUT }, timerFontScale: 1, scrambleFontScale: 1 })}>
          <RotateCcw size={16} strokeWidth={1.7} />
        </button>
        <button type="button" className="solo-layout-done" onClick={onDone}>
          <Check size={15} strokeWidth={2} />{tr(TIMER_SOLO_LAYOUT_COPY.done)}
        </button>
      </div>, surfaceRef.current)}
  </>;
}

function RegionHandles({ target, region, getSettings, updateSettings, language, onHide }: Omit<LayoutHost, 'updateSettings'> & {
  target: Element; region: TimerSoloLayoutRegion;
  updateSettings(patch: Partial<TimerSoloLayoutSettings>, positionOnly: boolean): void;
  onHide?: () => void;
}) {
  const tr = (value: { en: string; zh: string }) => value[language];
  const drag = useRef<{ y: number; value: number; size: number; direction: number; mode: 'move' | 'size' } | null>(null);
  const isSoloRegion = Boolean(target.closest('.timer-solo-main'));
  const current = (mode: 'move' | 'size') => timerSoloRegionValue(getSettings(), region, mode, isSoloRegion);
  const apply = (mode: 'move' | 'size', requested: number) => {
    const patch = timerSoloRegionPatch(getSettings(), region, mode, requested, isSoloRegion);
    if (!Object.keys(patch).length) return false;
    updateSettings(patch, isSoloRegion && mode === 'move');
    return true;
  };
  const resizeBy = useEffectEvent((factor: number) => {
    const scale = current('size');
    if ((factor > 1 && scale >= region.max) || (factor < 1 && scale <= region.min)) return true;
    return apply('size', scale * factor);
  });
  useEffect(() => {
    let pendingFactor = 1;
    let gestureScale: number | null = null;
    const resize = (factor: number) => {
      // Keep fractional input until it reaches the layout's scale precision.
      pendingFactor *= factor;
      if (resizeBy(pendingFactor)) pendingFactor = 1;
    };
    const onWheel = (event: Event) => {
      if (!(event instanceof WheelEvent) || (!isSoloRegion && !event.ctrlKey)) return;
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
      if (!event.deltaY) return;
      event.preventDefault();
      event.stopPropagation();
      if (gestureScale !== null) return;
      const delta = -event.deltaY * unit;
      // Wheel notches can deliver much larger deltas than trackpad pinches.
      const step = event.ctrlKey ? delta / 100 : Math.max(-0.12, Math.min(0.12, delta / 800));
      resize(Math.exp(step));
    };
    // WebKit exposes the cumulative pinch scale through native gesture events.
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      pendingFactor = 1;
      gestureScale = 1;
    };
    const onGestureChange = (event: Event) => {
      const { scale } = event as Event & { scale?: number };
      if (gestureScale === null || typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return;
      event.preventDefault();
      event.stopPropagation();
      resize(scale / gestureScale);
      gestureScale = scale;
    };
    const onGestureEnd = () => {
      pendingFactor = 1;
      gestureScale = null;
    };
    target.addEventListener('wheel', onWheel, { passive: false });
    target.addEventListener('gesturestart', onGestureStart, { passive: false });
    target.addEventListener('gesturechange', onGestureChange, { passive: false });
    target.addEventListener('gestureend', onGestureEnd);
    return () => {
      target.removeEventListener('wheel', onWheel);
      target.removeEventListener('gesturestart', onGestureStart);
      target.removeEventListener('gesturechange', onGestureChange);
      target.removeEventListener('gestureend', onGestureEnd);
    };
  }, [isSoloRegion, target]);
  const start = (event: PointerEvent<HTMLButtonElement>, mode: 'move' | 'size') => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const regionElement = event.currentTarget.parentElement?.parentElement;
    drag.current = { y: event.clientY, value: current(mode), mode,
      direction: regionElement?.closest('[data-flipped="true"]') ? -1 : 1,
      size: Math.max(40, regionElement?.getBoundingClientRect().height ?? 100) };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  return <div className="solo-layout-handles" data-no-timer onClick={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}>
    {(['move', 'size'] as const).map(mode => <button key={mode} type="button"
      className={`solo-layout-handle solo-layout-handle--${mode}`}
      aria-label={`${tr(region.label)} · ${tr(TIMER_SOLO_LAYOUT_COPY[mode])}`}
      onPointerDown={event => start(event, mode)}
      onPointerMove={event => {
        const active = drag.current;
        if (!active) return;
        event.preventDefault();
        event.stopPropagation();
        const delta = (event.clientY - active.y) * active.direction;
        apply(active.mode, timerSoloDragValue(active.mode, active.value, delta, active.size));
      }}
      onPointerUp={event => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const direction = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
        apply(mode, current(mode) + direction * (mode === 'move' ? 4 : 0.05));
      }}>
      {mode === 'move' ? <span className="solo-layout-grip"><GripHorizontal size={16} strokeWidth={1.7} /></span> : <span className="solo-layout-knob"><MoveDiagonal2 size={12} strokeWidth={1.8} aria-hidden="true" /></span>}
    </button>)}
    {onHide && 'hideLabel' in region && <button type="button" className="solo-layout-handle solo-layout-handle--hide"
      aria-label={tr(region.hideLabel)} onClick={onHide}>
      <span className="solo-layout-knob"><X size={13} strokeWidth={1.8} aria-hidden="true" /></span>
    </button>}
  </div>;
}
