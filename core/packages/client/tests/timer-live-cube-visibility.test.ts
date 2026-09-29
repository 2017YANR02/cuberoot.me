// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TimingSurface } from '@cuberoot/timer-ui';
import LiveCubeState from '@cuberoot/timer-ui/LiveCubeState';

const sharedCss = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/live-cube.css')), 'utf8');
const workspaceCss = readFileSync(new URL(import.meta.resolve('@cuberoot/timer-ui/timer-workspace.css')), 'utf8');
const hosts = [
  ['Web', 'timer-shell', 'app/[lang]/timer/_shell/shell.css'],
  ['Windows / Android', 'app-shell', new URL(import.meta.resolve('@cuberoot/app-ui/app.css'))],
] as const;

it.each(hosts)('%s keeps the live cube visible during a solve, while static previews fade', async (_, hostClass, cssPath) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const style = document.createElement('style');
  style.textContent = readFileSync(cssPath, 'utf8').replace(/^@import[^;]+;/gm, '') + '\n' + sharedCss + '\n' + workspaceCss;
  document.head.append(style);
  const host = document.createElement('main');
  document.body.append(host);
  const root = createRoot(host);
  const surfaceRef = createRef<HTMLDivElement>();
  const draw = (live: boolean, running: boolean, hidden = false, reduced = false) => act(async () => {
    host.className = `${hostClass}${running && !reduced ? ' is-solving' : ''}${hidden && hostClass === 'timer-shell' ? ' hide-ui' : ''}`;
    host.toggleAttribute('data-timer-hide-ui', hidden && hostClass === 'app-shell');
    root.render(createElement(TimingSurface, {
      layout: 'solo', surfaceRef, phase: running ? 'running' : 'idle', colorClass: '', digits: '1.23',
      scrambleSlot: 'R U',
      cornerSlot: live ? createElement('div', { className: 'timer-live-cube' },
        createElement(LiveCubeState, {
          mode: 'net', algAnchored: true, moves: [],
          facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
        }),
        createElement('button', { className: 'live-cube-calibrate' }, 'Calibrate'),
      ) : createElement('div', { 'data-static-preview': '' }),
    }));
  });
  const cube = () => host.querySelector<HTMLElement>('.timing-surface-cube')!;
  try {
    await draw(true, false);
    const net = host.querySelector('.timer-live-net');
    expect(net).not.toBeNull();
    expect(getComputedStyle(cube()).opacity).not.toBe('0');
    await draw(true, true);
    expect(host.querySelector('.timer-live-net')).toBe(net);
    expect(getComputedStyle(cube()).opacity).toBe('1');
    expect(getComputedStyle(host.querySelector('.timing-surface-scramble')!).opacity).toBe('0');
    expect(getComputedStyle(host.querySelector('.live-cube-calibrate')!).opacity).toBe('0');
    await draw(true, true, true);
    expect(getComputedStyle(cube()).opacity).toBe('0');
    expect(getComputedStyle(cube()).visibility).toBe('hidden');
    await draw(true, true, true, true);
    expect(getComputedStyle(cube()).visibility).toBe('hidden');
    expect(getComputedStyle(host.querySelector('.timing-surface-scramble')!).visibility).toBe('hidden');
    await draw(false, true);
    expect(host.querySelector('[data-static-preview]')).not.toBeNull();
    expect(getComputedStyle(cube()).opacity).toBe('0');
    await draw(true, false);
    expect(getComputedStyle(cube()).opacity).not.toBe('0');
    expect(getComputedStyle(cube()).visibility).not.toBe('hidden');
  } finally {
    await act(async () => root.unmount());
    host.remove(); style.remove(); vi.unstubAllGlobals();
  }
});
