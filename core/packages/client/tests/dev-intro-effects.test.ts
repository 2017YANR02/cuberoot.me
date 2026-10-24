// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installIntroEffects } from '@/app/[lang]/dev/_shared/intro-effects';

const observers: FakeIntersectionObserver[] = [];
const frames = new Map<number, FrameRequestCallback>();
const cleanups: (() => void)[] = [];
let frameRequests = 0;

class FakeIntersectionObserver {
  readonly observed = new Set<Element>();
  readonly disconnect = vi.fn(() => this.observed.clear());
  private callbacks = 0;
  constructor(readonly callback: IntersectionObserverCallback, readonly options: IntersectionObserverInit) {
    observers.push(this);
  }
  observe(target: Element) { this.observed.add(target); }
  unobserve(target: Element) { this.observed.delete(target); }
  emit(target: Element, isIntersecting = true) {
    if (++this.callbacks > 20) throw new Error('Intersection callback limit exceeded');
    this.callback([{ target, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function flushFrame() {
  const pending = [...frames.entries()];
  pending.forEach(([id, callback]) => { frames.delete(id); callback(0); });
}

function fixture() {
  const root = document.createElement('div');
  root.innerHTML = `<nav class="nav-links"><a href="#one">One</a><a href="#two">Two</a></nav>
    <a href="#top">Top</a><a href="#missing">Missing</a>
    <section id="one"><div class="card"></div><div class="float"></div></section>
    <section id="two"><div class="custom"></div></section>`;
  document.body.append(root);
  const one = root.querySelector<HTMLElement>('#one')!;
  const two = root.querySelector<HTMLElement>('#two')!;
  Object.defineProperty(one, 'offsetTop', { value: 0 });
  Object.defineProperty(two, 'offsetTop', { value: 300 });
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ top: 20 } as DOMRect);
  vi.spyOn(two, 'getBoundingClientRect').mockReturnValue({ top: 300 } as DOMRect);
  return root;
}

function mount(root: HTMLElement, overrides: Partial<Parameters<typeof installIntroEffects>[1]> = {}) {
  const cleanup = installIntroEffects(root, {
    revealSelector: '.card',
    activeColor: 'var(--ts-bright)',
    stagger: () => { root.querySelector<HTMLElement>('.card')!.style.transitionDelay = '60ms'; },
    ...overrides,
  });
  cleanups.push(cleanup);
  return cleanup;
}

beforeEach(() => {
  observers.length = 0;
  frameRequests = 0;
  frames.clear();
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    if (++frameRequests > 30) throw new Error('Animation frame limit exceeded');
    frames.set(frameRequests, callback);
    return frameRequests;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('scrollY', 0);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  cleanups.splice(0).reverse().forEach(cleanup => cleanup());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('reveals once and settles identical frame, scroll and observer writes', async () => {
  const root = fixture();
  mount(root);
  const card = root.querySelector<HTMLElement>('.card')!;
  const observer = observers[0];
  expect(observer.options).toEqual({ threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  expect(card.className).toBe('card fade-up');
  expect(card.style.transitionDelay).toBe('60ms');
  observer.emit(card, false);
  expect(observer.observed.has(card)).toBe(true);
  observer.emit(card);
  expect(card.className).toBe('card fade-up visible');
  expect(observer.observed.size).toBe(0);
  flushFrame();

  let mutationCount = 0;
  const mutations = new MutationObserver(records => {
    mutationCount += records.length;
    if (mutationCount > 20) { mutations.disconnect(); throw new Error('DOM mutation limit exceeded'); }
  });
  mutations.observe(root, { attributes: true, subtree: true });
  for (let i = 0; i < 3; i++) {
    observer.emit(card);
    window.dispatchEvent(new Event('scroll'));
    flushFrame();
  }
  await Promise.resolve();
  mutations.disconnect();
  expect(mutationCount).toBe(0);
  expect(frames.size).toBe(1);
});

it('keeps navigation offsets, page colors, smooth anchors and parallax', () => {
  const root = fixture();
  mount(root, { activeColor: 'var(--moon-warm)' });
  const [one, two] = root.querySelectorAll<HTMLAnchorElement>('.nav-links a');
  expect(one.style.color).toBe('var(--moon-warm)');
  vi.stubGlobal('scrollY', 180);
  window.dispatchEvent(new Event('scroll'));
  expect(one.style.color).toBe('');
  expect(two.style.color).toBe('var(--moon-warm)');
  const click = new MouseEvent('click', { cancelable: true });
  two.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 420, behavior: 'smooth' });
  root.querySelector<HTMLAnchorElement>('a[href="#top"]')!.dispatchEvent(new MouseEvent('click', { cancelable: true }));
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 140, behavior: 'smooth' });
  const missing = new MouseEvent('click', { cancelable: true });
  root.querySelector<HTMLAnchorElement>('a[href="#missing"]')!.dispatchEvent(missing);
  expect(missing.defaultPrevented).toBe(false);
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: window.innerWidth, clientY: window.innerHeight }));
  flushFrame();
  expect(root.querySelector<HTMLElement>('.float')!.style.translate).toBe('0.36px 0.36px');
});

it('cleans each mounted root, ignores queued callbacks and remounts with new content', () => {
  const outer = fixture();
  const closeOuter = mount(outer);
  const inner = fixture();
  const closeInner = mount(inner, {
    revealSelector: '.custom', threshold: 0.12, rootMargin: '0px 0px -40px 0px',
  });
  const custom = inner.querySelector<HTMLElement>('.custom')!;
  expect(observers[1].observed.has(custom)).toBe(true);
  expect(observers[1].options).toEqual({ threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  expect(frames.size).toBe(2);
  const staleFrame = [...frames.values()][1];
  closeInner();
  expect(observers[1].disconnect).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(1);
  observers[1].emit(custom);
  staleFrame(0);
  expect(custom.className).toBe('custom fade-up');
  expect(frames.size).toBe(1);
  vi.stubGlobal('scrollY', 180);
  window.dispatchEvent(new Event('scroll'));
  expect(inner.querySelector<HTMLAnchorElement>('a[href="#one"]')!.style.color).toBe('var(--ts-bright)');
  expect(outer.querySelector<HTMLAnchorElement>('a[href="#two"]')!.style.color).toBe('var(--ts-bright)');
  const detachedClick = new MouseEvent('click', { cancelable: true });
  inner.querySelector<HTMLAnchorElement>('a[href="#two"]')!.dispatchEvent(detachedClick);
  expect(detachedClick.defaultPrevented).toBe(false);
  closeOuter();
  expect(frames.size).toBe(0);
  mount(inner, { revealSelector: '.custom' });
  expect(observers).toHaveLength(3);
  observers[2].emit(custom);
  expect(custom.className).toBe('custom fade-up visible');
  expect(frames.size).toBe(1);
});
