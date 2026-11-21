import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { HostViewportLayout } from '@cuberoot/timer-ui';
import type { InstalledAppHost } from './platform';

type NativeNavigation = NonNullable<InstalledAppHost['primaryNavigation']>;
type NavigationState = NonNullable<Parameters<NativeNavigation['render']>[0]>;
type NavigationId = NavigationState['selected'];

export function usePrimaryNavigation(
  host: NativeNavigation | undefined,
  nav: RefObject<HTMLElement | null>,
  options: {
    visible: boolean;
    selected: NavigationId;
    vertical: boolean;
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
    visible, selected, vertical, dark, language, disabled, running, viewport, viewportHeight,
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
        state = {
          frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
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
  }, [host, nav, connected, visible, selected, vertical, dark, language, disabled, running, viewport, viewportHeight, searchRef, showSearch, searchExpanded]);

  return connected && rendered;
}
