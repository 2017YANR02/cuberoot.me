import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type PointerEvent, type RefObject } from 'react';
import type { HostViewportLayout } from '@cuberoot/timer-ui';
import type { InstalledAppHost } from './platform';

type NativeNavigation = NonNullable<InstalledAppHost['primaryNavigation']>;
type NavigationState = NonNullable<Parameters<NativeNavigation['render']>[0]>;
type NavigationId = NavigationState['selected'];

function centeredCapsuleLeft(container: DOMRect, width: number) {
  return container.left + (container.width - width) / 2;
}

interface NavigationDrag {
  pointerId: number;
  holdTimer: number;
  nav: HTMLElement;
  maxTravel: number;
  startX: number;
  travel: number;
}

function positionNavigationLens(nav: HTMLElement, travel: number) {
  nav.style.setProperty('--app-nav-lens-travel', `${travel}px`);
}

function clearNavigationDrag({ nav, pointerId, holdTimer }: NavigationDrag) {
  window.clearTimeout(holdTimer);
  nav.removeAttribute('data-lens-pressed');
  nav.removeAttribute('data-lens-dragging');
  nav.style.removeProperty('--app-nav-lens-travel');
  if (nav.hasPointerCapture(pointerId)) nav.releasePointerCapture(pointerId);
}

export function useDraggablePrimaryNavigation(
  enabled: boolean,
  select: (destination: NavigationId) => void,
): HTMLAttributes<HTMLElement> | undefined {
  const drag = useRef<NavigationDrag | null>(null);
  const handledPointer = useRef(false);

  useLayoutEffect(() => {
    return () => {
      const active = drag.current;
      drag.current = null;
      if (active) clearNavigationDrag(active);
    };
  }, [enabled]);

  if (!enabled) return;

  const finish = (event: PointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    handledPointer.current = true;
    const { nav } = active;
    const dragging = nav.hasAttribute('data-lens-dragging');
    clearNavigationDrag(active);
    if (event.type !== 'pointerup') return;
    const button = dragging
      ? Array.from(nav.querySelectorAll<HTMLButtonElement>(':scope > button[data-destination]')).find(item => {
        const { left, right } = item.getBoundingClientRect();
        return event.clientX >= left && event.clientX < right;
      })
      : document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>('button[data-destination]');
    if (!button || button.parentElement !== nav || button.disabled) return;
    const destination = button.dataset.destination;
    if (destination === 'timer' || destination === 'tools' || destination === 'account') select(destination);
  };

  return {
    onPointerDown(event) {
      if (!event.isPrimary || event.button !== 0 || drag.current) return;
      handledPointer.current = false;
      const nav = event.currentTarget;
      const button = event.target instanceof Element && event.target.closest<HTMLButtonElement>('button[data-destination]');
      if (!button || button.parentElement !== nav || button.disabled) return;
      const bounds = nav.getBoundingClientRect();
      const slot = button.getBoundingClientRect();
      if (!bounds.width || !slot.width) return;
      try { nav.setPointerCapture(event.pointerId); } catch { return; }
      const travel = slot.left - bounds.left;
      const active: NavigationDrag = {
        pointerId: event.pointerId,
        nav,
        maxTravel: bounds.width - slot.width,
        startX: event.clientX,
        travel,
        // A tap should slide the settled lens without flashing the held glass.
        holdTimer: window.setTimeout(() => {
          if (drag.current !== active) return;
          positionNavigationLens(nav, travel);
          nav.setAttribute('data-lens-pressed', '');
        }, 120),
      };
      drag.current = active;
    },
    onPointerMove(event) {
      const active = drag.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const delta = event.clientX - active.startX;
      if (!active.nav.hasAttribute('data-lens-dragging')) {
        if (Math.abs(delta) < 4) return;
        window.clearTimeout(active.holdTimer);
        active.nav.setAttribute('data-lens-pressed', '');
        active.nav.setAttribute('data-lens-dragging', '');
      }
      const travel = Math.max(0, Math.min(active.maxTravel, active.travel + delta));
      positionNavigationLens(active.nav, travel);
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: finish,
    onClickCapture(event) {
      if (!handledPointer.current || event.detail === 0) return;
      handledPointer.current = false;
      event.stopPropagation();
      event.preventDefault();
    },
    onContextMenu(event) {
      if (drag.current) event.preventDefault();
    },
  };
}

export function useTimerNavigationAvoidance(nav: RefObject<HTMLElement | null>, enabled: boolean, keepCentered: boolean) {
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const capsule = nav.current;
    const shell = capsule?.parentElement;
    const footer = shell?.querySelector<HTMLElement>('.timer-solo-main > .timer-stage-footer');
    if (!enabled || !capsule || !shell || !footer) {
      setOffset(0);
      return;
    }

    const gap = 8;
    const update = () => {
      const { top, bottom, width } = capsule.getBoundingClientRect();
      const frame = shell.getBoundingClientRect();
      const center = centeredCapsuleLeft(frame, width);
      const safeRight = parseFloat(getComputedStyle(capsule).getPropertyValue('--app-nav-safe-right')) || 0;
      const reserved = footer.hasAttribute('data-nav-clearance');
      const obstacles = Array.from(footer.querySelectorAll(
        '.shell-stat-rail, .shell-device-center, .timer-stage-rankings, .timer-stage-preview',
      ), element => {
        const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
        // The stats button already includes 8px of horizontal padding around its text.
        const inlineGap = element.classList.contains('shell-stat-rail') ? 0 : gap;
        return { left: left - inlineGap, right: right + inlineGap, top, bottom, width, height };
      })
        // Keep checking horizontal fit once the footer has moved above the capsule.
        .filter(rect => rect.width > 0 && rect.height > 0 &&
          (reserved || (rect.bottom + gap > top && rect.top - gap < bottom)))
        .sort((a, b) => a.left - b.left);

      let left = center;
      for (const rect of obstacles) {
        if (left < rect.right && left + width > rect.left) left = rect.right;
      }
      const reserve = left > center && (keepCentered || left + width > frame.right - safeRight - gap);
      footer.toggleAttribute('data-nav-clearance', reserve);
      setOffset(reserve ? 0 : left - center);
    };

    const resize = new ResizeObserver(update);
    const observe = () => {
      resize.disconnect();
      for (const element of [shell, capsule, footer, ...footer.children, ...footer.querySelectorAll('.shell-stat-rail')]) {
        resize.observe(element);
      }
      update();
    };
    const mutations = new MutationObserver(observe);
    mutations.observe(footer, { childList: true, subtree: true });
    shell.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update);
    observe();
    return () => {
      resize.disconnect();
      mutations.disconnect();
      shell.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      footer.removeAttribute('data-nav-clearance');
    };
  }, [nav, enabled, keepCentered]);
  return enabled ? offset : 0;
}

export function usePrimaryNavigation(
  host: NativeNavigation | undefined,
  nav: RefObject<HTMLElement | null>,
  options: {
    visible: boolean;
    selected: NavigationId;
    vertical: boolean;
    horizontalOffset: number;
    dark: boolean;
    language: string;
    disabled: boolean;
    running: boolean;
    viewport: HostViewportLayout | null;
    viewportHeight: number;
    viewportTop: number;
    searchRef: RefObject<HTMLButtonElement | null>;
    showSearch: boolean;
    searchExpanded: boolean;
  },
  select: (id: NavigationId | 'search') => void,
) {
  const [connected, setConnected] = useState(false);
  const [rendered, setRendered] = useState(false);
  const selectRef = useRef(select);
  selectRef.current = select;
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!host) return;
    let active = true;
    const listener = host.addSelectListener(id => {
      if (active) selectRef.current(id);
    });
    void listener.then(() => { if (active) setConnected(true); }).catch(() => {});
    return () => {
      active = false;
      last.current = undefined;
      setConnected(false);
      void host.render(null).catch(() => {});
      void listener.then(handle => handle.remove()).catch(() => {});
    };
  }, [host]);

  const {
    visible, selected, vertical, horizontalOffset, dark, language, disabled, running, viewport, viewportHeight,
    searchRef, showSearch, searchExpanded,
  } = options;
  // Measure after every relevant React commit, including a native fold geometry
  // event that moves the bar without changing its width or height.
  useLayoutEffect(() => {
    if (!host || !connected) return;
    const update = () => {
      const element = nav.current;
      const frame = element?.getBoundingClientRect();
      const searchButton = showSearch ? searchRef.current : null;
      const searchFrame = searchButton?.getBoundingClientRect();
      let state: NavigationState | null = null;
      if (visible && element && frame?.width && frame.height) {
        const container = element.parentElement?.getBoundingClientRect();
        // The native host animates to the target independently of the CSS transition.
        const x = !vertical && container
          ? centeredCapsuleLeft(container, frame.width) + horizontalOffset : frame.x;
        state = {
          frame: { x, y: frame.y, width: frame.width, height: frame.height },
          search: searchButton && searchFrame?.width && searchFrame.height ? {
            frame: { x: searchFrame.x, y: searchFrame.y, width: searchFrame.width, height: searchFrame.height },
            label: searchButton.getAttribute('aria-label') ?? '',
            expanded: searchExpanded,
          } : undefined,
          items: Array.from(element.querySelectorAll<HTMLButtonElement>('button[data-destination]'), button => ({
            id: button.dataset.destination as NavigationId,
            label: button.getAttribute('aria-label') ?? '',
            disabled: button.disabled,
          })),
          selected,
          vertical,
          dark,
        };
      }
      const signature = JSON.stringify(state);
      if (last.current === signature) return;
      last.current = signature;
      void host.render(state).then(ok => {
        if (last.current === signature) setRendered(ok);
      }).catch(() => {
        if (last.current === signature) setRendered(false);
      });
    };
    update();
    const frame = requestAnimationFrame(update);
    const visualViewport = window.visualViewport;
    const resize = new ResizeObserver(update);
    const shell = nav.current?.parentElement;
    if (shell) resize.observe(shell);
    window.addEventListener('resize', update);
    visualViewport?.addEventListener('scroll', update);
    visualViewport?.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('resize', update);
      visualViewport?.removeEventListener('scroll', update);
      visualViewport?.removeEventListener('resize', update);
    };
  }, [host, nav, connected, visible, selected, vertical, horizontalOffset, dark, language, disabled, running, viewport, viewportHeight, options.viewportTop, searchRef, showSearch, searchExpanded]);

  return connected && rendered;
}
