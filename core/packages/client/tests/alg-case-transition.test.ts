// @vitest-environment jsdom
import { act, createElement as h, StrictMode, useRef, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { captureAlgCaseNavigation, useAlgCaseEntryTransition } from '@/hooks/useAlgViewTransition';

it('animates an admin raw name from its display alias and survives StrictMode replay', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 30, 88, 88));
  const animations: { element: Element; cancel: ReturnType<typeof vi.fn> }[] = [];
  const previousAnimate = Element.prototype.animate;
  Element.prototype.animate = function () {
    const cancel = vi.fn();
    animations.push({ element: this, cancel });
    return { cancel, finished: new Promise(() => {}) } as unknown as Animation;
  };
  function Detail() {
    const ref = useRef<HTMLDivElement>(null);
    useAlgCaseEntryTransition(ref, '4305', true);
    return h('div', { ref }, h('input', { className: 'alg-case-name-input', defaultValue: 'Aa' }));
  }
  function Harness() {
    const [detail, setDetail] = useState(false);
    return detail ? h(Detail) : h('div', { onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
      captureAlgCaseNavigation(event);
      event.preventDefault();
      history.replaceState(null, '', '/zh/alg/3x3/pll/a+');
      setDetail(true);
    } }, h('article', { 'data-alg-motion-case': '4305' },
      h('a', { href: '/zh/alg/3x3/pll/a+', className: 'alg-case-detail-link' },
        h('span', { 'data-alg-shared-title': 'A+' }, 'A+'))));
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    history.replaceState(null, '', '/zh/alg/3x3/pll');
    await act(async () => root.render(h(StrictMode, null, h(Harness))));
    await act(async () => container.querySelector('a')!.click());
    const name = container.querySelector('input')!;
    expect(name.value).toBe('Aa');
    expect(animations.some(a => a.element === name && a.cancel.mock.calls.length === 0)).toBe(true);
    await act(async () => root.unmount());
    expect(animations.every(a => a.cancel.mock.calls.length > 0)).toBe(true);
  } finally {
    container.remove();
    if (previousAnimate) Element.prototype.animate = previousAnimate;
    else Reflect.deleteProperty(Element.prototype, 'animate');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
