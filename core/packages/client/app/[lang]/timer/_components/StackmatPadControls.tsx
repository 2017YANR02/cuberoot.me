'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { STACKMAT_G5_PARTS } from '@/components/StackmatIcon';
import { tr } from '@/i18n/tr';
import { createPadInput, requiredPads, STACKMAT_PADS, type StackmatPad } from '../_lib/stackmat/pad-input';

export interface StackmatPadHost {
  down: () => void;
  up: () => void;
  cancel: () => void;
  running: () => boolean;
  enabled: boolean;
  playerId?: number;
  indicator?: 'idle' | 'holding' | 'ready';
}
const KEYSETS = [
  ['KeyA', 'KeyS', 'KeyD', 'KeyF'], ['KeyJ', 'KeyK', 'KeyL', 'Semicolon'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR'], ['KeyU', 'KeyI', 'KeyO', 'KeyP'],
] as const;
const keyLabel = (code: string) => code === 'Semicolon' ? ';' : code.replace('Key', '');
const contours = Object.fromEntries(STACKMAT_G5_PARTS.map(([, attributes]) => [attributes.key, attributes.d as string]));
const positions = [[118, 159], [249, 228], [551, 228], [682, 159]];

export default function StackmatPadControls({ mode, host }: { mode: '2-pad' | '4-pad'; host: StackmatPadHost }) {
  const latest = useRef(host);
  latest.current = host;
  const [pressed, setPressed] = useState<ReadonlySet<StackmatPad>>(new Set());
  const controller = useMemo(() => createPadInput(requiredPads(mode), {
    down: () => latest.current.down(), up: () => latest.current.up(),
    cancel: () => latest.current.cancel(), running: () => latest.current.running(),
  }), [mode]);
  const keys = KEYSETS[host.playerId ?? 0] ?? KEYSETS[0];
  useEffect(() => {
    const cancel = () => { controller.cancel(); setPressed(controller.pressed()); };
    cancel();
    if (!host.enabled) return;
    const excluded = (target: EventTarget | null) => target instanceof Element
      && !!target.closest('input, textarea, select, button, [contenteditable="true"], [role="dialog"], [data-no-timer]:not([data-stackmat-pads])');
    const down = (event: KeyboardEvent) => {
      const index = keys.indexOf(event.code as never);
      if (index < 0 || event.repeat || event.ctrlKey || event.metaKey || event.altKey || excluded(event.target)) return;
      const pad = STACKMAT_PADS[index];
      if (!requiredPads(mode).includes(pad)) return;
      event.preventDefault();
      controller.down(`key:${event.code}`, pad);
      setPressed(controller.pressed());
    };
    const up = (event: KeyboardEvent) => {
      controller.up(`key:${event.code}`);
      setPressed(controller.pressed());
    };
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      controller.cancel();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [controller, host.enabled, keys, mode]);

  return <svg className="timer-stackmat-pads" viewBox="-8 8 816 280" data-no-timer data-stackmat-pads
    aria-label={tr({ zh: '计时感应区', en: 'Timer touch pads' })}>
    {requiredPads(mode).map(pad => {
      const index = STACKMAT_PADS.indexOf(pad);
      const [x, y] = positions[index];
      return <g key={pad}>
        <path d={contours[pad.replace('-palm', '-palm-surface').replace('-thumb', '-thumb-recess')]}
          data-pad={pad} role="button" tabIndex={host.enabled ? 0 : -1} aria-disabled={!host.enabled}
          aria-label={`${tr({ zh: '感应区', en: 'Touch pad' })} ${keyLabel(keys[index])}`}
          aria-pressed={pressed.has(pad)} className="timer-stackmat-pad"
          onPointerDown={event => {
            if (!host.enabled || event.button !== 0) return;
            event.preventDefault(); event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            controller.down(`pointer:${event.pointerId}`, pad); setPressed(controller.pressed());
          }}
          onPointerUp={event => {
            event.preventDefault(); event.stopPropagation();
            controller.up(`pointer:${event.pointerId}`); setPressed(controller.pressed());
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { controller.cancel(); setPressed(controller.pressed()); }}
          onLostPointerCapture={event => {
            // A normal release already removed this contact; only an unexpected loss cancels.
            controller.lost(`pointer:${event.pointerId}`); setPressed(controller.pressed());
          }} />
        <text x={x} y={y} textAnchor="middle" className="timer-stackmat-key">{keyLabel(keys[index])}</text>
      </g>;
    })}
  </svg>;
}
