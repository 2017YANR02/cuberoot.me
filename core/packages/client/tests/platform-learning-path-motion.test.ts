// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { animateLearningPath } from '@/components/platform/learning-path-motion';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

// jsdom has no layout engine. Supply compact and expanded reference rectangles
// so this test checks the actual keyframes, timing and cleanup independently.
it.each([1440, 1280, 768])('sequences both directions against measured rectangles at %i px', async width => {
  const mobile = width < 700;
  const media = new EventTarget();
  vi.stubGlobal('matchMedia', (query: string) => Object.assign(media, { matches: query.includes('width') && mobile }));
  const grid = document.createElement('ol');
  grid.dataset.layout = 'compact';
  Object.defineProperty(grid, 'clientWidth', { value: width });
  grid.innerHTML = Array.from({ length: 6 }, () => `<li><button><span class="path-title"></span><span class="path-hint"></span><span class="platform-home-milestone-number"></span></button>
    <div class="path-details"><div class="path-columns"><div><a></a></div><div><a></a><a></a></div></div></div></li>`).join('');
  document.body.append(grid);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function(this: Element) {
    const list = this.closest('ol')!;
    const expanded = list.dataset.layout === 'expanded';
    if (this === list) return new DOMRect(0, 0, width, expanded ? 400 : mobile ? 960 : 160);
    const i = [...list.children].indexOf(this);
    const w = expanded ? Math.min(width, 840) : mobile ? width : width / 6;
    return new DOMRect(expanded ? (width-w)/2 : mobile ? 0 : i*w, !expanded && mobile ? i*160 : 0, w, expanded ? 400 : 160);
  });
  const calls: {node: Element; frames: Keyframe[]; options: KeyframeAnimationOptions}[] = [];
  const cancel = vi.fn();
  const animate = function(this: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
    calls.push({node: this, frames, options});
    return { finished: Promise.resolve(), cancel };
  };
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
  try {
    for (const i of [0, 2, 5]) {

      for (const opening of [true, false]) {
        grid.dataset.layout = opening ? 'compact' : 'expanded';
        calls.length = 0;
        const run = animateLearningPath(grid, i, opening, new AbortController().signal);
        expect(grid.dataset.motion).toBe('running');
        const target = grid.nextElementSibling as HTMLElement;
        expect(target.inert).toBe(true);
        expect(target.getAttribute('aria-hidden')).toBe('true');
        const compact = opening ? grid : target;
        const active = compact.children[i]!;
        const shape = calls.find(call => call.node === active && call.frames[0]?.transform)!;
        const centered = shape.frames[opening ? 1 : 0]!;
        const dx = mobile ? 0 : (width - width / 6) / 2 - i * width / 6;
        const shift = String(centered.transform).match(/^translate\(([^,]+)px, (.+)px\)$/)!;
        expect(Number(shift[1])).toBeCloseTo(dx, 6);
        expect(Number(shift[2])).toBe(mobile && i ? -i * 160 : 0);
        for (const call of calls.filter(call => call.node !== grid.parentElement)) {
          for (const frame of call.frames) expect(Object.keys(frame).every(k => ['opacity','transform','clipPath'].includes(k))).toBe(true);
        }
        for (const [j, card] of [...compact.children].entries()) {
          if (j === i) continue;
          const fade = calls.find(call => call.node === card)!;
          expect(fade.frames[opening ? 1 : 0]!.transform).toBe(`translateX(${mobile ? 0 : Math.sign(j-i)*18}px) scale(.97)`);
        }
        await run;
        expect(grid.querySelector('[style]')).toBeNull();
        expect(grid.dataset.motion).toBeUndefined();
        expect(document.querySelector('.path-measure')).toBeNull();
      }
    }
    const reduced = new EventTarget();
    vi.stubGlobal('matchMedia', () => Object.assign(reduced, {matches: true}));
    calls.length = 0;
    await animateLearningPath(grid, 0, true, new AbortController().signal);
    expect(calls).toHaveLength(0);
    expect(grid.dataset.motion).toBeUndefined();
  } finally {
    if (descriptor) Object.defineProperty(Element.prototype, 'animate', descriptor);
    else Reflect.deleteProperty(Element.prototype, 'animate');
  }
});
