'use client';

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Check, GripHorizontal, MoveVertical, RotateCcw } from '@app-foundation/icons/lucide';
import { Tooltip } from '@/components/Tooltip';
import { DEFAULT_SOLO_LAYOUT } from '../_lib/settings/layout';
import { tr } from '@/i18n/tr';
import { getSettings, updateSettings } from '../_lib/settings';
import type { SoloLayout } from '../_lib/settings/layout';
import './solo-layout-editor.css';

const regions = [
  { selector: '.scramble-text', gap: 'scrambleGap', scale: 'scrambleFontScale', label: { zh: '打乱文字', en: 'Scramble' }, min: 0.6, max: 2.5 },
  { selector: '.scramble-src-row', gap: 'sourceGap', scale: 'sourceScale', label: { zh: '比赛信息', en: 'Competition information' }, min: 0.5, max: 2 },
  { selector: '.timer-display-wrap', gap: 'timerGap', scale: 'timerFontScale', label: { zh: '计时数字', en: 'Timer digits' }, min: 0.5, max: 2 },
  { selector: '.timing-surface-cube-frame', gap: 'cubeGap', scale: 'cubeScale', label: { zh: '魔方图示', en: 'Cube preview' }, min: 0.5, max: 2 },
] as const;
type Region = typeof regions[number];

/** Editing chrome for this page's existing regions; never reparent live timer DOM. */
export default function SoloLayoutEditor({ surfaceRef, contentKey, onDone }: {
  surfaceRef: RefObject<HTMLDivElement | null>; contentKey: string; onDone(): void;
}) {
  const [targets, setTargets] = useState<(Element | null)[]>([]);
  useEffect(() => {
    setTargets(regions.map(region => surfaceRef.current?.querySelector(region.selector) ?? null));
  }, [surfaceRef, contentKey]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onDone(); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onDone]);
  return <>{regions.map((region, index) => targets[index]
    ? createPortal(<RegionHandles region={region} />, targets[index]!, region.gap)
    : null)}
    {surfaceRef.current && createPortal(
      <div className="solo-layout-toolbar" role="toolbar" aria-label={tr({ zh: '布局调整', en: 'Layout editing' })} data-no-timer data-site-surface="popover">
        <span className="solo-layout-toolbar-label">{tr({ zh: '拖动调整', en: 'Drag to arrange' })}</span>
        <Tooltip content={tr({ zh: '恢复默认布局', en: 'Reset layout' })}>{tip => <button {...tip} type="button"
          className="solo-layout-reset" aria-label={tr({ zh: '恢复默认布局', en: 'Reset layout' })}
          onClick={() => updateSettings({ soloLayout: { ...DEFAULT_SOLO_LAYOUT }, timerFontScale: 1, scrambleFontScale: 1 })}>
          <RotateCcw size={16} strokeWidth={1.7} />
        </button>}</Tooltip>
        <button type="button" className="solo-layout-done" onClick={onDone}>
          <Check size={15} strokeWidth={2} />{tr({ zh: '完成', en: 'Done' })}
        </button>
      </div>, surfaceRef.current)}
  </>;
}

function RegionHandles({ region }: { region: Region }) {
  const drag = useRef<{ y: number; value: number; size: number; mode: 'move' | 'size' } | null>(null);
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
    drag.current = { y: event.clientY, value: current(mode), mode, size: Math.max(40, regionElement?.getBoundingClientRect().height ?? 100) };
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
        const delta = event.clientY - active.y;
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
