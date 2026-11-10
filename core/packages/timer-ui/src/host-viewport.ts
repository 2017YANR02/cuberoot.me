import { useSyncExternalStore } from 'react';
import './host-viewport.css';

export interface ViewportRect { x: number; y: number; width: number; height: number }
export interface HostViewportLayout { bounds: ViewportRect; content: ViewportRect; bar?: ViewportRect }

let layout: HostViewportLayout | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
let observing = false;

function updateSafeInsets() {
  const rect = getUsableViewport();
  const root = document.documentElement;
  for (const [edge, pixels] of Object.entries({
    left: rect.offsetLeft, top: rect.offsetTop,
    right: window.innerWidth - rect.offsetLeft - rect.width,
    bottom: window.innerHeight - rect.offsetTop - rect.height,
  })) root.style.setProperty(`--host-safe-${edge}`, `${Math.max(0, pixels)}px`);
}

/** Native hosts supply geometry, never product navigation or device names. */
export function setHostViewportLayout(value: HostViewportLayout | null) {
  layout = value;
  const root = document.documentElement;
  root.toggleAttribute('data-host-viewport', Boolean(value));
  if (!observing) {
    observing = true;
    window.addEventListener('resize', updateSafeInsets);
    window.visualViewport?.addEventListener('resize', updateSafeInsets);
    window.visualViewport?.addEventListener('scroll', updateSafeInsets);
  }
  updateSafeInsets();
  listeners.forEach(listener => listener());
  // Existing fixed-menu and visible-height observers also need a layout pass.
  window.dispatchEvent(new Event('resize'));
}

export function useHostViewportLayout() {
  return useSyncExternalStore(subscribe, () => layout, () => null);
}

/** Intersect native usable content with zoom/keyboard geometry, in client coordinates. */
export function getUsableViewport() {
  const visual = window.visualViewport;
  const offsetLeft = visual?.offsetLeft ?? 0;
  const offsetTop = visual?.offsetTop ?? 0;
  const width = visual && visual.width > 0 ? visual.width : (document.documentElement.clientWidth || window.innerWidth);
  const height = visual && visual.height > 0 ? visual.height : (document.documentElement.clientHeight || window.innerHeight);
  const content = layout?.content;
  const left = Math.max(offsetLeft, content?.x ?? 0);
  const top = Math.max(offsetTop, content?.y ?? 0);
  const right = Math.min(offsetLeft + width, content ? content.x + content.width : Infinity);
  const bottom = Math.min(offsetTop + height, content ? content.y + content.height : Infinity);
  return { offsetLeft: left, offsetTop: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
