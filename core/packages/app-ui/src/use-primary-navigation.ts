import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { HostViewportLayout } from '@cuberoot/timer-ui';
import type { InstalledAppHost } from './platform';

type NativeNavigation = NonNullable<InstalledAppHost['primaryNavigation']>;
type NavigationState = NonNullable<Parameters<NativeNavigation['render']>[0]>;
type NavigationId = NavigationState['selected'];

function centeredCapsuleLeft(container: DOMRect, width: number) {
  return container.left + (container.width - width) / 2;
}

export function useTimerNavigationAvoidance(nav: RefObject<HTMLElement | null>, enabled: boolean) {
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
      ), element => element.getBoundingClientRect())
        // Keep checking horizontal fit once the footer has moved above the capsule.
        .filter(rect => rect.width > 0 && rect.height > 0 &&
          (reserved || (rect.bottom + gap > top && rect.top - gap < bottom)))
        .sort((a, b) => a.left - b.left);

      let left = center;
      for (const rect of obstacles) {
        if (left < rect.right + gap && left + width > rect.left - gap) left = rect.right + gap;
      }
      const reserve = left > center && left + width > frame.right - safeRight - gap;
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
  }, [nav, enabled]);
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
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [host, nav, connected, visible, selected, vertical, horizontalOffset, dark, language, disabled, running, viewport, viewportHeight, searchRef, showSearch, searchExpanded]);

  return connected && rendered;
}
