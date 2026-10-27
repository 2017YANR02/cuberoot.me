// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { installSiteCorners } from '@2017yanr02/continuous-corners/site';

describe('continuous corners on large dynamic lists', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let controller: ReturnType<typeof installSiteCorners> | undefined;
  let replace: Mock<(this: CSSStyleSheet, text: string) => void>;
  let resizeCallback: ResizeObserverCallback;

  async function flush() {
    await Promise.resolve();
    const batch = [...frames.values()];
    frames.clear();
    batch.forEach(callback => callback(0));
    await new Promise(resolve => window.setTimeout(resolve, 0));
  }

  function card() {
    const element = document.createElement('div');
    element.style.cssText = 'display:block;box-sizing:border-box;width:200px;height:60px;border-radius:10px;background-color:rgb(240, 240, 240);background-image:none;border:1px solid rgb(10, 10, 10);transition-property:none;transition-duration:0s;animation-name:none;';
    // JSDOM does not expand border-radius or supply border-image's UA default.
    for (const corner of ['top-left', 'top-right', 'bottom-right', 'bottom-left']) element.style.setProperty(`border-${corner}-radius`, '10px');
    element.style.borderImageSource = 'none';
    return element;
  }

  beforeEach(() => {
    frames = new Map();
    nextFrame = 0;
    document.body.replaceChildren();
    Object.defineProperty(document, 'adoptedStyleSheets', { configurable: true, writable: true, value: [] });
    replace = vi.fn(function (this: CSSStyleSheet, text: string) {
      while (this.cssRules.length) this.deleteRule(0);
      for (const rule of text.split('\n').filter(Boolean)) this.insertRule(rule, this.cssRules.length);
    });
    vi.stubGlobal('CSSStyleSheet', class extends CSSStyleSheet { replaceSync = replace; });
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resizeCallback = callback; }
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  });

  afterEach(() => {
    controller?.destroy();
    controller = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('leaves the rendering callback free before computing decorative paint', async () => {
    document.body.append(card());
    controller = installSiteCorners(document.body);
    await Promise.resolve();
    const batch = [...frames.values()];
    frames.clear();
    batch.forEach(callback => callback(0));
    expect(controller.stats().passes).toBe(0);
    expect(document.adoptedStyleSheets[0].cssRules.length).toBe(0);
    await new Promise(resolve => window.setTimeout(resolve, 0));
    expect(controller.stats().surfaces).toBe(1);
  });

  it('cancels paint when destroyed between the rendering callback and its task', async () => {
    document.body.append(card());
    controller = installSiteCorners(document.body);
    await Promise.resolve();
    const batch = [...frames.values()];
    frames.clear();
    batch.forEach(callback => callback(0));
    controller.destroy();
    await new Promise(resolve => window.setTimeout(resolve, 0));
    expect(controller.stats().passes).toBe(0);
    expect(document.adoptedStyleSheets).toHaveLength(0);
  });

  it('scans a parent subtree once for a batch of appended rows', async () => {
    const list = document.createElement('section');
    document.body.append(list);
    controller = installSiteCorners(document.body);
    await flush();
    const scan = vi.spyOn(list, 'querySelectorAll');
    for (let i = 0; i < 100; i++) list.append(card());
    await flush();
    expect(controller.stats().surfaces).toBe(100);
    expect(scan.mock.calls.filter(([selector]) => selector === '*').length).toBeLessThanOrEqual(1);
  });

  it('updates a hovered surface without replacing unrelated rules', async () => {
    const rows = Array.from({ length: 100 }, card);
    document.body.append(...rows);
    controller = installSiteCorners(document.body);
    await flush();
    const sheet = document.adoptedStyleSheets[0];
    expect(sheet.cssRules.length).toBe(100);
    const untouched = sheet.cssRules[99];
    replace.mockClear();
    rows[0].style.backgroundColor = 'rgb(200, 20, 20)';
    rows[0].dispatchEvent(new Event('pointerover', { bubbles: true }));
    await flush();
    expect(replace.mock.calls.length).toBe(0);
    expect(sheet.cssRules[99]).toBe(untouched);
    expect(sheet.cssRules[0].cssText).toContain('200%2C%2020%2C%2020');
  });

  it('does not repaint for the initial unchanged resize notification', async () => {
    const row = card();
    document.body.append(row);
    controller = installSiteCorners(document.body);
    await flush();
    const before = controller.stats().passes;
    resizeCallback([{ target: row, borderBoxSize: [{ inlineSize: 200, blockSize: 60 }] } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    await flush();
    expect(controller.stats().passes).toBe(before);
    resizeCallback([{ target: row, borderBoxSize: [{ inlineSize: 210, blockSize: 60 }] } as unknown as ResizeObserverEntry], {} as ResizeObserver);
    await flush();
    expect(controller.stats().passes).toBe(before + 1);
  });

  it('ignores temporary layout probes but still detects a real insertion', async () => {
    const row = card();
    document.body.append(row);
    controller = installSiteCorners(document.body);
    await flush();
    const before = controller.stats().passes;
    const probe = document.createElement('div');
    document.body.append(probe);
    probe.style.transform = 'translateX(10px)';
    probe.remove();
    await flush();
    expect(controller.stats().passes).toBe(before);
    document.body.append(card());
    await flush();
    expect(controller.stats().surfaces).toBe(2);
  });

  it('does not repaint local geometry for compositor-only animation frames', async () => {
    const row = card();
    document.body.append(row);
    controller = installSiteCorners(document.body);
    await flush();
    const before = controller.stats().passes;
    for (let i = 0; i < 4; i++) {
      row.style.transform = `translateX(${i * 10}px)`;
      row.style.opacity = String(1 - i / 10);
      await flush();
    }
    expect(controller.stats().passes).toBe(before);
    row.style.width = '210px';
    await flush();
    expect(controller.stats().passes).toBe(before + 1);
  });

  it('still invalidates concentric descendants when an ancestor transforms', async () => {
    const container = card();
    container.dataset.cornerContainer = '';
    container.append(card());
    document.body.append(container);
    controller = installSiteCorners(document.body);
    await flush();
    const before = controller.stats().passes;
    container.style.transform = 'scale(0.8)';
    await flush();
    expect(controller.stats().passes).toBe(before + 1);
    container.style.removeProperty('transform');
    await flush();
    expect(controller.stats().passes).toBe(before + 2);
  });

  it('keeps dynamic selection, theme refresh and native exclusions working', async () => {
    const style = document.createElement('style');
    style.textContent = '.corner-test { background-color: rgb(240, 240, 240); } .corner-test[aria-selected="true"] { background-color: rgb(200, 20, 20); } html[data-theme="dark"] .corner-test { background-color: rgb(20, 20, 20); }';
    document.head.append(style);
    const row = card();
    row.className = 'corner-test';
    row.style.removeProperty('background-color');
    const native = card();
    native.dataset.cornerShape = 'native';
    native.append(card());
    const animated = card();
    animated.style.transitionProperty = 'background-color';
    animated.style.transitionDuration = '0.2s';
    document.body.append(row, native, animated);
    try {
      controller = installSiteCorners(document.body);
      await flush();
      expect(controller.stats().surfaces).toBe(1);
      row.setAttribute('aria-selected', 'true');
      await flush();
      expect(document.adoptedStyleSheets[0].cssRules[0].cssText).toContain('200%2C%2020%2C%2020');
      document.documentElement.dataset.theme = 'dark';
      await flush();
      expect(document.adoptedStyleSheets[0].cssRules[0].cssText).toContain('20%2C%2020%2C%2020');
      await flush();
      expect(frames.size).toBe(0);
    } finally {
      style.remove();
      delete document.documentElement.dataset.theme;
    }
  });

  it('keeps structural selectors current and removes detached surfaces', async () => {
    const first = card();
    const second = card();
    document.body.append(first, second);
    controller = installSiteCorners(document.body);
    await flush();
    const before = document.adoptedStyleSheets[0].cssRules[1] as CSSStyleRule;
    const previousSelector = before.selectorText;
    first.remove();
    await flush();
    expect(controller.stats().surfaces).toBe(1);
    const remaining = document.adoptedStyleSheets[0].cssRules[0] as CSSStyleRule;
    expect(remaining.selectorText).not.toBe(previousSelector);
    expect(second.matches(remaining.selectorText)).toBe(true);
    controller.destroy();
    expect(document.adoptedStyleSheets).toHaveLength(0);
    expect(frames.size).toBe(0);
    controller = installSiteCorners(document.body);
    await flush();
    expect(controller.stats().surfaces).toBe(1);
  });

  it('invalidates existing nodes moved and removed in the same mutation batch', async () => {
    const first = card();
    const second = card();
    document.body.append(first, second);
    controller = installSiteCorners(document.body);
    await flush();
    document.body.append(first);
    first.remove();
    await flush();
    expect(controller.stats().surfaces).toBe(1);
    expect(second.matches((document.adoptedStyleSheets[0].cssRules[0] as CSSStyleRule).selectorText)).toBe(true);
  });

  it('clears removed structural rules before measuring surviving siblings', async () => {
    const first = card();
    const second = card();
    document.body.append(first, second);
    controller = installSiteCorners(document.body);
    await flush();
    const removed = document.adoptedStyleSheets[0].cssRules[0] as CSSStyleRule;
    const computed = window.getComputedStyle.bind(window);
    let measuredSurvivor = false;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      if (element === second) {
        measuredSurvivor = true;
        expect(removed.style.cssText).toBe('');
      }
      return computed(element, pseudo);
    });
    first.remove();
    await flush();
    expect(measuredSurvivor).toBe(true);
    expect(controller.stats().surfaces).toBe(1);
  });

  it('decorates only near-viewport surfaces and releases them after scrolling away', async () => {
    let intersect: IntersectionObserverCallback;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { intersect = callback; }
      observe = observe;
      unobserve() {}
      disconnect = disconnect;
    });
    const rows = Array.from({ length: 100 }, card);
    document.body.append(...rows);
    controller = installSiteCorners(document.body);
    await flush();
    expect(observe.mock.calls.length).toBeGreaterThanOrEqual(100);
    expect(controller.stats().surfaces).toBe(0);
    const notify = (target: Element, isIntersecting: boolean) => intersect(
      [{ target, isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver,
    );
    notify(rows[0], true);
    await flush();
    expect(controller.stats().surfaces).toBe(1);
    notify(rows[0], false);
    notify(rows[1], true);
    await flush();
    expect(controller.stats().surfaces).toBe(1);
    expect(rows[1].matches((document.adoptedStyleSheets[0].cssRules[0] as CSSStyleRule).selectorText)).toBe(true);
    controller.destroy();
    expect(disconnect.mock.calls.length).toBe(1);
  });
});
