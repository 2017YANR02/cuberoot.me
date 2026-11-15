'use client';

import { useCallback, useEffect, useRef, type RefObject, type MouseEvent } from 'react';

/** 时间网格和月历共用手势；保留旧页直到新页提交，两个画面同时移动。 */
export function useCalendarSwipe(container: RefObject<HTMLElement | null>, previous: () => void, next: () => void) {
  const navigation = useRef({ previous, next });
  const ignoreTapUntil = useRef(0);
  const cancelRef = useRef<() => void>(() => {});
  const readyRef = useRef<() => void>(() => {});
  const onPageReady = useCallback(() => readyRef.current(), []);
  useEffect(() => { navigation.current = { previous, next }; }, [previous, next]);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    let gesture: { id: number; x: number; y: number; at: number; horizontal: boolean } | null = null;
    let offset = 0;
    let animations: Animation[] = [];
    let backdrop: HTMLElement | null = null;
    let outgoing: HTMLElement | null = null;
    let frame = 0;
    let settling = false;
    let disposed = false;
    const content = () => root.querySelector<HTMLElement>('.cal-swipe-content:not([data-swipe-snapshot])');
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 只复制已画好的 DOM，不挂载第二个 FullCalendar 或加载第二份事件。
    // cloneNode 不保留滚动位置；同步 scroller，避免旧画面闪回午夜。
    const snapshot = (element: HTMLElement, layer: 'backdrop' | 'outgoing') => {
      const copy = element.cloneNode(true) as HTMLElement;
      copy.dataset.swipeSnapshot = layer;
      copy.setAttribute('aria-hidden', 'true');
      copy.inert = true;
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      Object.assign(copy.style, {
        position: 'absolute', left: `${element.offsetLeft}px`, top: `${element.offsetTop}px`,
        width: `${element.offsetWidth}px`, height: `${element.offsetHeight}px`,
        margin: '0', transform: '', opacity: '1', pointerEvents: 'none',
        zIndex: layer === 'backdrop' ? '1' : '2',
      });
      root.append(copy);
      const scrollers = copy.querySelectorAll<HTMLElement>('.fc-scroller');
      element.querySelectorAll<HTMLElement>('.fc-scroller').forEach((source, index) => {
        scrollers[index].scrollTop = source.scrollTop;
        scrollers[index].scrollLeft = source.scrollLeft;
      });
      return copy;
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      readyRef.current = () => {};
      animations.forEach(animation => animation.cancel());
      animations = [];
      const element = content();
      if (element) { element.style.transform = ''; element.style.opacity = ''; }
      backdrop?.remove();
      outgoing?.remove();
      backdrop = outgoing = null;
      root.classList.remove('cal-swipe-active');
      offset = 0;
      settling = false;
      ignoreTapUntil.current = performance.now() + 120;
    };
    const animate = (element: HTMLElement, from: number, to: number, duration: number) => {
      const animation = element.animate([
        { transform: `translate3d(${from}px,0,0)` }, { transform: `translate3d(${to}px,0,0)` },
      ], { duration, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
      animations.push(animation);
      return animation;
    };
    const cancel = () => {
      gesture = null;
      if (settling) return;
      if (!offset) { reset(); return; }
      cancelAnimationFrame(frame);
      frame = 0;
      settling = true;
      const element = content();
      if (!element || reduced()) { reset(); return; }
      void animate(element, offset, 0, 140).finished.then(() => { if (!disposed) reset(); }, () => {});
    };
    cancelRef.current = cancel;
    const start = (event: TouchEvent) => {
      if (settling) return;
      gesture = null;
      if (event.touches.length !== 1) return;
      if ((event.target as Element).closest('input, textarea, select, button:not([data-calendar-day]), [contenteditable], .fc-popover, .fc-event-resizer, .cal-mobile-months')) return;
      const touch = event.touches[0];
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, at: performance.now(), horizontal: false };
    };
    const move = (event: TouchEvent) => {
      if (!gesture) return;
      if (event.touches.length !== 1 || (!gesture.horizontal && performance.now() - gesture.at >= 500)) { cancel(); return; }
      const touch = event.touches[0];
      const dx = touch.clientX - gesture.x;
      const dy = Math.abs(touch.clientY - gesture.y);
      if (!gesture.horizontal) {
        if (Math.max(Math.abs(dx), dy) < 10) return;
        if (Math.abs(dx) < dy * 1.5) { cancel(); return; }
        gesture.horizontal = true;
        const element = content();
        if (element && !reduced()) {
          backdrop = snapshot(element, 'backdrop');
          root.classList.add('cal-swipe-active');
        }
      }
      if (!event.cancelable) { cancel(); return; }
      event.preventDefault();
      ignoreTapUntil.current = performance.now() + 700;
      offset = Math.max(-root.clientWidth, Math.min(root.clientWidth, dx));
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        const element = content();
        if (element && !reduced()) element.style.transform = `translate3d(${offset}px,0,0)`;
      });
    };
    const end = (event: TouchEvent) => {
      const swipe = gesture;
      if (!swipe?.horizontal) { gesture = null; return; }
      const touch = Array.from(event.changedTouches).find(item => item.identifier === swipe.id);
      if (!touch || event.touches.length) { cancel(); return; }
      const dx = touch.clientX - swipe.x;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(touch.clientY - swipe.y) * 1.5) { cancel(); return; }
      gesture = null;
      settling = true;
      cancelAnimationFrame(frame);
      frame = 0;
      ignoreTapUntil.current = Infinity;
      const direction = dx < 0 ? -1 : 1;
      const element = content();
      const motion = !!element && !reduced();
      if (motion) {
        const width = element.offsetWidth;
        outgoing = snapshot(element, 'outgoing');
        outgoing.style.transform = `translate3d(${offset}px,0,0)`;
        element.style.opacity = '0';
        element.style.transform = `translate3d(${-direction * width + offset}px,0,0)`;
        // 调用方在新日期 DOM 提交后通知；等待期间旧画面仍完全覆盖视口。
        readyRef.current = () => {
          readyRef.current = () => {};
          frame = requestAnimationFrame(() => {
            frame = 0;
            const incoming = content();
            if (!incoming || !outgoing || disposed) { reset(); return; }
            incoming.style.opacity = '1';
            const duration = Math.max(120, 220 * (1 - Math.abs(offset) / width));
            const oldAnimation = animate(outgoing, offset, direction * width, duration);
            const newAnimation = animate(incoming, -direction * width + offset, 0, duration);
            const startTime = document.timeline.currentTime;
            oldAnimation.startTime = startTime;
            newAnimation.startTime = startTime;
            void newAnimation.finished.then(() => { if (!disposed) reset(); }, () => {});
          });
        };
      }
      // 等原 touch 收尾，避免 FullCalendar 将松手当作新建/拖动。
      queueMicrotask(() => {
        if (disposed) return;
        try {
          if (direction < 0) navigation.current.next();
          else navigation.current.previous();
          if (!motion) reset();
        } catch (error) { reset(); throw error; }
      });
    };
    root.addEventListener('touchstart', start, { capture: true, passive: true });
    root.addEventListener('touchmove', move, { capture: true, passive: false });
    root.addEventListener('touchend', end, { capture: true });
    root.addEventListener('touchcancel', cancel, { capture: true });
    return () => {
      disposed = true;
      root.removeEventListener('touchstart', start, true);
      root.removeEventListener('touchmove', move, true);
      root.removeEventListener('touchend', end, true);
      root.removeEventListener('touchcancel', cancel, true);
      reset();
      cancelRef.current = () => {};
    };
  }, [container]);

  return {
    ignoreTapUntil,
    onPageReady,
    cancelSwipe: () => cancelRef.current(),
    onClickCapture: (event: MouseEvent) => {
      if (event.detail !== 0 && performance.now() < ignoreTapUntil.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
