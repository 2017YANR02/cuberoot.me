'use client';

import { useCallback, useLayoutEffect, useRef, type RefObject, type MouseEvent } from 'react';
import type { AlgViewMode } from '@/components/AlgViewModeToggle';

const CASE = '[data-alg-motion-case]';
const LIMIT = 60;
const visible = (rect: DOMRect) => rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
type Part = { element: HTMLElement; image: boolean };
type Snapshot = { rect: DOMRect; parts: Map<string, DOMRect> };

function parts(card: Element): Map<string, Part> {
  const result = new Map<string, Part>();
  card.querySelectorAll<HTMLElement>('.alg-case-cube > *').forEach((element, index) => {
    result.set(`image-${index}`, { element, image: true });
  });
  for (const [key, selector] of [['title', '.alg-case-detail-link'], ['setup', '.alg-case-standard'], ['algorithm', '.alg-alg-text']]) {
    const element = card.querySelector<HTMLElement>(selector);
    if (element) result.set(key, { element, image: false });
  }
  return result;
}

/** Only explicit view actions animate; hydration, filtering and storage updates do not. */
export function useAlgViewTransition(root: RefObject<HTMLDivElement | null>, layout: unknown) {
  const pending = useRef<Map<string, Snapshot> | null>(null);
  const running = useRef<Animation[]>([]);
  const cancel = useCallback(() => {
    const previous = running.current;
    running.current = [];
    previous.forEach(animation => animation.cancel());
    root.current?.removeAttribute('data-alg-view-animating');
  }, [root]);

  const change = useCallback((commit: () => void, nextView: AlgViewMode) => {
    const container = root.current;
    pending.current = null;
    if (container && !matchMedia('(prefers-reduced-motion: reduce)').matches && typeof Element.prototype.animate === 'function') {
      const cards = Array.from(container.querySelectorAll<HTMLElement>(CASE));
      const first = cards[0]?.getBoundingClientRect();
      const style = getComputedStyle(container);
      const columns = Number(style.getPropertyValue(nextView === 'cards' ? '--alg-card-columns' : '--alg-full-columns'));
      // Every case has an >=84px diagram. This deliberately underestimates row
      // height, covering newly visible destination cards without rendering SVGs.
      const count = first ? Math.ceil(Math.max(0, innerHeight - first.top) / 84) * columns : 0;
      // Deeply scrolled or very large windows fall back to an immediate change.
      if (count > 0 && count <= LIMIT) {
        const snapshot = new Map<string, Snapshot>();
        for (const card of cards.slice(0, LIMIT)) {
          const rect = card.getBoundingClientRect();
          if (snapshot.size >= count && rect.top >= innerHeight) break;
          snapshot.set(card.dataset.algMotionCase!, {
            rect,
            parts: new Map(Array.from(parts(card), ([key, part]) => [key, part.element.getBoundingClientRect()])),
          });
        }
        pending.current = snapshot;
      }
    }
    // Capture the current animated geometry before cancelling a rapid reversal.
    cancel();
    commit();
  }, [cancel, root]);

  useLayoutEffect(() => {
    const before = pending.current;
    pending.current = null;
    cancel();
    const container = root.current;
    if (!before || !container) return;
    const moves: { element: HTMLElement; frames: Keyframe[] }[] = [];
    // Batch all layout reads before starting any animation.
    for (const card of Array.from(container.querySelectorAll<HTMLElement>(CASE)).slice(0, LIMIT)) {
      const old = before.get(card.dataset.algMotionCase!);
      const rect = card.getBoundingClientRect();
      if (!visible(rect) && (!old || !visible(old.rect))) continue;
      for (const [key, { element, image }] of parts(card)) {
        const target = element.getBoundingClientRect();
        const source = old?.parts.get(key);
        if (!source || !target.width || !target.height) {
          moves.push({ element, frames: [{ opacity: 0 }, { opacity: 1 }] });
          continue;
        }
        const dx = source.left - target.left, dy = source.top - target.top;
        // Only diagrams scale; text keeps its glyph proportions throughout.
        const scale = image ? source.width / target.width : 1;
        if (Math.abs(dx) + Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.01) continue;
        moves.push({ element, frames: [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, transformOrigin: '0 0' },
          { transform: 'translate(0, 0) scale(1)', transformOrigin: '0 0' },
        ] });
      }
    }
    if (!moves.length) return;
    container.setAttribute('data-alg-view-animating', '');
    const animations = moves.map(({ element, frames }) => element.animate(frames, {
      duration: 280, easing: 'cubic-bezier(.22, 1, .36, 1)',
    }));
    running.current = animations;
    void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (running.current === animations) cancel();
    });
  }, [layout, cancel, root]);

  useLayoutEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { pending.current = null; cancel(); };
    window.addEventListener('resize', stop);
    media.addEventListener('change', stop);
    return () => {
      window.removeEventListener('resize', stop);
      media.removeEventListener('change', stop);
      stop();
    };
  }, [cancel]);
  return change;
}

type EntryPart = { rect: DOMRect; text: string };
// Browser-only, one pending navigation. No DOM nodes or generated diagrams retained.
let entry: { path: string; id: string; orientation: string; expires: number; width: number; height: number; parts: Map<string, EntryPart> } | null = null;
const textOf = (element: Element) => (element.getAttribute('data-alg-shared-title')
  ?? (element instanceof HTMLInputElement ? element.value : element.textContent) ?? '').replace(/\s+/g, '');
const sameText = (key: string, left: string, right: string) => key === 'title'
  ? left === right
  : left.replace(/[()·]/g, '') === right.replace(/[()·]/g, '');

export function captureAlgCaseNavigation(event: MouseEvent<HTMLDivElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
  const link = (event.target as Element).closest<HTMLAnchorElement>('a.alg-case-cardlink, a.alg-case-detail-link');
  const card = link?.closest<HTMLElement>(CASE);
  if (!link || !card || (link.target && link.target !== '_self')) return;
  entry = null;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const captured = new Map<string, EntryPart>();
  for (const [key, selector] of [
    ['image', '.alg-case-cube .puzzle-art'], ['title', '[data-alg-shared-title]'],
    ['setup', '.alg-case-standard code'], ['algorithm', '.alg-alg-text'],
  ]) {
    const element = card.querySelector(selector);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (visible(rect)) captured.set(key, { rect, text: textOf(element) });
  }
  entry = { path: new URL(link.href).pathname, id: card.dataset.algMotionCase!, orientation: card.dataset.algMotionOri ?? '0',
    expires: performance.now() + 2500, width: innerWidth, height: innerHeight, parts: captured };
}

/** Consume only a matching list click; direct URLs, reloads and embedded dialogs stay instant. */
export function useAlgCaseEntryTransition(root: RefObject<HTMLDivElement | null>, id: string, enabled: boolean) {
  const replay = useRef<typeof entry>(null);
  useLayoutEffect(() => {
    const before = entry ?? replay.current, container = root.current;
    if (!enabled || !container || !before || before.id !== id || before.path !== location.pathname) {
      replay.current = null;
      return;
    }
    // StrictMode can replay effects after a microtask checkpoint. Keep this
    // mount's snapshot until a successful playback, not just until a microtask.
    replay.current = before;
    entry = null;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches || performance.now() > before.expires || before.width !== innerWidth || before.height !== innerHeight || typeof Element.prototype.animate !== 'function') return;
    const candidates = new Map<string, HTMLElement[]>();
    const orientationImage = container.querySelector<HTMLElement>(`.alg-case-detail-ori[data-alg-motion-ori="${before.orientation}"] .alg-case-detail-ori-label .puzzle-art`);
    const image = orientationImage ?? (before.orientation === '0' ? container.querySelector<HTMLElement>('.alg-meta-related-card.is-current .puzzle-art') : null);
    if (image) candidates.set('image', [image]);
    for (const [key, selector] of [
      ['title', '[data-alg-shared-title], .alg-case-name-input'],
      ['setup', '.alg-case-standard code, .alg-meta-scramble-row .alg-meta-algline-code'],
      ['algorithm', '.alg-alg-text, .alg-meta-case-algs .alg-meta-algline-code'],
    ]) candidates.set(key, Array.from(container.querySelectorAll<HTMLElement>(selector)).slice(0, LIMIT));
    const moves: { element: HTMLElement; frames: Keyframe[] }[] = [];
    for (const [key, elements] of candidates) {
      const source = before.parts.get(key);
      if (!source) continue;
      // The case id already matches. An admin edits the DB name (Aa/Jb),
      // whereas the public title can be its display alias (A+/J).
      const element = elements.find(element => key === 'image'
        || (key === 'title' && element.matches('.alg-case-name-input'))
        || sameText(key, textOf(element), source.text));
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (!visible(rect) || !rect.width || !rect.height) continue;
      moves.push({ element, frames: [
        { transform: `translate(${source.rect.left - rect.left}px, ${source.rect.top - rect.top}px) scale(${key === 'image' ? source.rect.width / rect.width : 1})`, transformOrigin: '0 0' },
        { transform: 'none', transformOrigin: '0 0' },
      ] });
    }
    const animations = moves.map(({ element, frames }) => element.animate(frames, { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' }));
    let cancelled = false;
    const cancel = () => { cancelled = true; animations.forEach(animation => animation.cancel()); };
    void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (!cancelled && replay.current === before) replay.current = null;
    });
    window.addEventListener('resize', cancel);
    media.addEventListener('change', cancel);
    return () => {
      cancel();
      window.removeEventListener('resize', cancel);
      media.removeEventListener('change', cancel);
    };
  }, [root, id, enabled]);
}
