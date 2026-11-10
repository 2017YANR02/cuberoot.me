'use client';

import { getUsableViewport } from './host-viewport';
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Check, GripHorizontal, MoveVertical, RotateCcw } from 'lucide-react';
import { DEFAULT_SOLO_LAYOUT, type SoloLayout } from '@cuberoot/shared/timer';
import './solo-layout-editor.css';

const regions = [
  { selector: '.scramble-text', gap: 'scrambleGap', scale: 'scrambleFontScale', label: { zh: '打乱文字', en: 'Scramble' }, min: 0.6, max: 2.5 },
  { selector: '.scramble-src-row', gap: 'sourceGap', scale: 'sourceScale', label: { zh: '比赛信息', en: 'Competition information' }, min: 0.5, max: 2 },
  { selector: '.timer-display-wrap', gap: 'timerGap', scale: 'timerFontScale', label: { zh: '计时数字', en: 'Timer digits' }, min: 0.5, max: 2 },
  { selector: '.timing-surface-cube-frame', gap: 'cubeGap', scale: 'cubeScale', label: { zh: '魔方图示', en: 'Cube preview' }, min: 0.5, max: 2 },
] as const;
type Region = typeof regions[number];

/** Editing chrome for this page's existing regions; never reparent live timer DOM. */
export interface TimerSoloLayoutSettings { soloLayout: SoloLayout; timerFontScale: number; scrambleFontScale: number; }
interface LayoutHost { getSettings(): TimerSoloLayoutSettings; updateSettings(patch: Partial<TimerSoloLayoutSettings>): void; language: 'en' | 'zh'; }

/** Use the visible viewport, including zoom/keyboard offsets on touch devices. */
function viewportOverflow(elements: Element[]) {
  const viewport = getUsableViewport();
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  const right = left + Math.min(viewport?.width ?? window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
  const bottom = top + (viewport?.height ?? window.innerHeight);
  return elements.map(element => {
    const rect = element.getBoundingClientRect();
    return [Math.max(0, left - rect.left), Math.max(0, top - rect.top),
      Math.max(0, rect.right - right), Math.max(0, rect.bottom - bottom)];
  });
}

function interpolateLayout(from: TimerSoloLayoutSettings, to: TimerSoloLayoutSettings, fraction: number): TimerSoloLayoutSettings {
  const mix = (a: number, b: number, precision: number) => Math.round((a + (b - a) * fraction) * precision) / precision;
  const soloLayout = { ...from.soloLayout };
  for (const key of Object.keys(soloLayout) as (keyof SoloLayout)[]) {
    soloLayout[key] = mix(from.soloLayout[key], to.soloLayout[key], key.endsWith('Scale') ? 100 : 1);
  }
  return { soloLayout, timerFontScale: mix(from.timerFontScale, to.timerFontScale, 100),
    scrambleFontScale: mix(from.scrambleFontScale, to.scrambleFontScale, 100) };
}

/** Preview in the live flow without saving rejected candidates or waiting for
 * an installed host's asynchronous settings repository. Restored before paint. */
function layoutPreview(surface: HTMLElement, before: TimerSoloLayoutSettings) {
  const overrides: { element: HTMLElement; property: string; value(settings: TimerSoloLayoutSettings): string }[] = [];
  const variables = { scrambleGap: 'scramble-gap', sourceGap: 'source-gap', timerGap: 'timer-gap',
    cubeGap: 'cube-gap', sourceScale: 'source-scale', cubeScale: 'cube-scale' } as const;
  for (const key of Object.keys(variables) as (keyof SoloLayout)[]) {
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
  const originals = overrides.map(({ element, property }) => ({ value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }));
  return {
    apply(settings: TimerSoloLayoutSettings) {
      for (const override of overrides) override.element.style.setProperty(override.property, override.value(settings));
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

export function TimerSoloLayoutEditor({ surfaceRef, contentKey, onDone, getSettings, updateSettings, language, regionSelectors }: LayoutHost & {
  surfaceRef: RefObject<HTMLElement | null>; contentKey: string; onDone(): void;
  regionSelectors?: Partial<Record<Region['gap'], string>>;
}) {
  const tr = (value: { en: string; zh: string }) => value[language];
  const [targets, setTargets] = useState<Element[][]>([]);
  useEffect(() => {
    setTargets(regions.map(region => Array.from(surfaceRef.current?.querySelectorAll(regionSelectors?.[region.gap] ?? region.selector) ?? [])));
  }, [surfaceRef, contentKey, regionSelectors]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onDone(); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onDone]);
  const updateWithinViewport = (patch: Partial<TimerSoloLayoutSettings>) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const settings = getSettings();
    const before: TimerSoloLayoutSettings = { soloLayout: { ...settings.soloLayout },
      timerFontScale: settings.timerFontScale, scrambleFontScale: settings.scrambleFontScale };
    const requested = { ...before, ...patch };
    const elements = targets.flat().flatMap(element => [element, ...element.querySelectorAll('.timer-display-value, .solo-layout-handle')])
      .filter(element => element.isConnected);
    const baseline = viewportOverflow(elements);
    const preview = layoutPreview(surface, before);
    const fits = () => viewportOverflow(elements).every((edges, index) => edges.every((overflow, edge) =>
      // Existing long content can be brought back in, but never pushed farther out.
      overflow <= Math.max(baseline[index][edge], 0.5)));
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
  return <>{regions.flatMap((region, index) => (targets[index] ?? []).map((target, targetIndex) =>
    createPortal(<RegionHandles region={region} getSettings={getSettings} updateSettings={updateWithinViewport} language={language} />, target, `${region.gap}-${targetIndex}`)))}
    {surfaceRef.current && createPortal(
      <div className="solo-layout-toolbar" role="toolbar" aria-label={tr({ zh: '布局调整', en: 'Layout editing' })} data-no-timer data-site-surface="popover">
        <button title={tr({ zh: '恢复默认布局', en: 'Reset layout' })} type="button"
          className="solo-layout-reset" aria-label={tr({ zh: '恢复默认布局', en: 'Reset layout' })}
          onClick={() => updateWithinViewport({ soloLayout: { ...DEFAULT_SOLO_LAYOUT }, timerFontScale: 1, scrambleFontScale: 1 })}>
          <RotateCcw size={16} strokeWidth={1.7} />
        </button>
        <button type="button" className="solo-layout-done" onClick={onDone}>
          <Check size={15} strokeWidth={2} />{tr({ zh: '完成', en: 'Done' })}
        </button>
      </div>, surfaceRef.current)}
  </>;
}

function RegionHandles({ region, getSettings, updateSettings, language }: LayoutHost & { region: Region }) {
  const tr = (value: { en: string; zh: string }) => value[language];
  const drag = useRef<{ y: number; value: number; size: number; direction: number; mode: 'move' | 'size' } | null>(null);
  const current = (mode: 'move' | 'size') => {
    const settings = getSettings();
    return mode === 'move' ? settings.soloLayout[region.gap]
      : region.scale === 'timerFontScale' || region.scale === 'scrambleFontScale'
        ? settings[region.scale] : settings.soloLayout[region.scale];
  };
  const apply = (mode: 'move' | 'size', requested: number) => {
    const value = mode === 'move' ? Math.round(Math.max(0, Math.min(240, requested)))
      : Math.round(Math.max(region.min, Math.min(region.max, requested)) * 100) / 100;
    if (value === current(mode)) return;
    if (mode === 'size' && (region.scale === 'timerFontScale' || region.scale === 'scrambleFontScale')) {
      updateSettings({ [region.scale]: value });
    } else {
      const key: keyof SoloLayout = mode === 'move' ? region.gap : region.scale as keyof SoloLayout;
      updateSettings({ soloLayout: { ...getSettings().soloLayout, [key]: value } });
    }
  };
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
      aria-label={`${tr(region.label)} · ${tr(mode === 'move' ? { zh: '上下拖动', en: 'Drag vertically' } : { zh: '拖动缩放', en: 'Drag to resize' })}`}
      onPointerDown={event => start(event, mode)}
      onPointerMove={event => {
        const active = drag.current;
        if (!active) return;
        event.preventDefault();
        event.stopPropagation();
        const delta = (event.clientY - active.y) * active.direction;
        apply(active.mode, active.value + (active.mode === 'move' ? delta : delta / active.size * active.value));
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
      {mode === 'move' ? <span className="solo-layout-grip"><GripHorizontal size={16} strokeWidth={1.7} /></span> : <span className="solo-layout-size-knob"><MoveVertical size={12} strokeWidth={1.8} /></span>}
    </button>)}
  </div>;
}
