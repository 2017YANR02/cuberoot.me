'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { usePanelClamp } from '@/hooks/usePanelClamp';
import { useT } from '@/hooks/useT';

export function VideoContextMenu({ player, position, onClose, className, children }: {
  player: RefObject<HTMLDivElement | null>;
  position: { x: number; y: number };
  onClose: (position: null) => void;
  className: string;
  children: ReactNode;
}) {
  const t = useT();
  const contextPanel = useRef<HTMLDivElement>(null);
  usePanelClamp(true, contextPanel);
  useLayoutEffect(() => {
    const fit = () => {
      const container = player.current?.getBoundingClientRect();
      const popup = contextPanel.current;
      if (!container || !popup) return;
      const left = Math.max(8, -container.left + 8);
      const top = Math.max(8, -container.top + 8);
      const right = Math.min(container.width, window.innerWidth - container.left) - 8;
      const bottom = Math.min(container.height, window.innerHeight - container.top) - 8;
      popup.style.maxHeight = `${Math.max(0, bottom - top)}px`;
      popup.style.left = `${Math.max(left, Math.min(position.x, right - popup.offsetWidth))}px`;
      popup.style.top = `${Math.max(top, Math.min(position.y, bottom - popup.offsetHeight))}px`;
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    if (player.current) observer?.observe(player.current);
    window.addEventListener('resize', fit);
    window.addEventListener('scroll', fit, true);
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit); window.removeEventListener('scroll', fit, true); };
  }, [position, player]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!contextPanel.current?.contains(event.target as Node)) onClose(null); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(null); player.current?.focus({ preventScroll: true }); }
    };
    contextPanel.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [onClose, player]);

  return <div ref={contextPanel} className={className} role="menu" data-site-surface="popover" aria-label={t('视频菜单', 'Video menu')}
      onKeyDown={event => {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }
        if (event.key === 'Tab') onClose(null);
      }}>
    {children}
  </div>;
}
