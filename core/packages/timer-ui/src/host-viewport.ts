import { useSyncExternalStore } from 'react';
import './host-viewport.css';

export interface ViewportRect { x: number; y: number; width: number; height: number }
export interface HostViewportLayout {
  bounds: ViewportRect;
  content: ViewportRect;
  bar?: ViewportRect;
  hinge?: ViewportRect;
  topBar?: ViewportRect;
}

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
  root.toggleAttribute('data-host-hinge', Boolean(value?.hinge));
  const bar = value?.topBar;
  root.toggleAttribute('data-host-top-bar', Boolean(bar));
  for (const [edge, pixels] of Object.entries({
    left: bar?.x,
    top: bar?.y,
    right: value && bar ? value.bounds.width - bar.x - bar.width : undefined,
    height: bar?.height,
  })) {
    if (pixels === undefined) root.style.removeProperty(`--host-top-bar-${edge}`);
    else root.style.setProperty(`--host-top-bar-${edge}`, `${pixels}px`);
  }
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
export function getUsableViewport(anchor?: { x: number; y: number; width?: number; height?: number }) {
  const visual = window.visualViewport;
  const offsetLeft = visual?.offsetLeft ?? 0;
  const offsetTop = visual?.offsetTop ?? 0;
  const width = visual && visual.width > 0 ? visual.width : (document.documentElement.clientWidth || window.innerWidth);
  const height = visual && visual.height > 0 ? visual.height : (document.documentElement.clientHeight || window.innerHeight);
  const content = layout?.content;
  let left = Math.max(offsetLeft, content?.x ?? 0);
  let top = Math.max(offsetTop, content?.y ?? 0);
  let right = Math.min(offsetLeft + width, content ? content.x + content.width : Infinity);
  let bottom = Math.min(offsetTop + height, content ? content.y + content.height : Infinity);
  const hinge = layout?.hinge;
  if (hinge && hinge.x < right && hinge.y < bottom && hinge.x + hinge.width > left && hinge.y + hinge.height > top) {
    const horizontal = hinge.width > hinge.height;
    const start = horizontal ? top : left;
    const end = horizontal ? bottom : right;
    const near = horizontal ? hinge.y : hinge.x;
    const far = near + (horizontal ? hinge.height : hinge.width);
    const center = anchor && (horizontal ? anchor.y + (anchor.height ?? 0) / 2 : anchor.x + (anchor.width ?? 0) / 2);
    const first = far >= end || (near > start && (center === undefined ? near - start >= end - far : center < (near + far) / 2));
    if (horizontal) {
      if (first) bottom = Math.min(bottom, near);
      else top = Math.max(top, far);
    } else if (first) right = Math.min(right, near);
    else left = Math.max(left, far);
  }
  return { offsetLeft: left, offsetTop: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
