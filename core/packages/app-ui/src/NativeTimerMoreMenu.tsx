import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TimerMoreMenu, type TimerMoreMenuItem } from '@cuberoot/timer-ui';
import type { InstalledAppHost } from './platform';

type MenuHost = NonNullable<InstalledAppHost['timerMoreMenu']>;

export function NativeTimerMoreMenu({ host, label, items, enabled }: {
  host: MenuHost;
  label: string;
  items: readonly TimerMoreMenuItem[];
  enabled: boolean;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const current = useRef({ items, enabled });
  current.current = { items, enabled };
  const [connected, setConnected] = useState(false);
  const [rendered, setRendered] = useState(false);
  const signature = useRef<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const listener = host.addSelectListener(id => {
      if (!active || !current.current.enabled) return;
      const item = current.current.items.find(candidate => candidate.id === id);
      if (item && !item.disabled) item.onSelect?.();
    });
    void listener.then(() => { if (active) setConnected(true); }).catch(() => {});
    return () => {
      active = false;
      signature.current = undefined;
      void host.render(null).catch(() => {});
      void listener.then(handle => handle.remove()).catch(() => {});
    };
  }, [host]);

  useLayoutEffect(() => {
    if (!connected) return;
    const element = anchor.current?.querySelector('button');
    if (!element) return;
    const update = () => {
      const { x, y, width, height } = element.getBoundingClientRect();
      const state = enabled && width > 0 && height > 0 ? {
        frame: { x, y, width, height },
        label,
        items: items.map(({ id, label, active, disabled, danger }) => ({ id, label, active, disabled, danger })),
      } : null;
      const next = JSON.stringify(state);
      if (signature.current === next) return;
      signature.current = next;
      void host.render(state).then(ok => {
        if (signature.current === next) setRendered(ok);
      }).catch(() => {
        if (signature.current === next) setRendered(false);
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    const header = element.closest('header');
    if (header) observer.observe(header);
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  });

  return <span ref={anchor} inert={rendered && enabled} data-no-timer>
    <TimerMoreMenu
      triggerLabel={label}
      triggerClassName="timer-solo-control"
      triggerDisabled={!enabled}
      items={items}
    />
  </span>;
}
