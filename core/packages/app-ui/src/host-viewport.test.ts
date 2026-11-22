// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getUsableViewport, setHostViewportLayout } from '@cuberoot/timer-ui';

afterEach(() => { setHostViewportLayout(null); vi.unstubAllGlobals(); });

describe('host usable viewport', () => {
  it('keeps ordinary hosts on the browser viewport', () => {
    expect(getUsableViewport()).toEqual({ offsetLeft: 0, offsetTop: 0, width: 1024, height: 768 });
    expect(document.documentElement.hasAttribute('data-host-viewport')).toBe(false);
  });
  it('keeps menus inside native content, including a left rail and keyboard', () => {
    const visual = Object.assign(new EventTarget(), { offsetLeft: 0, offsetTop: 0, width: 1024, height: 420 });
    vi.stubGlobal('visualViewport', visual);
    setHostViewportLayout({ bounds: { x: 0, y: 0, width: 1024, height: 768 },
      content: { x: 70, y: 20, width: 930, height: 720 },
      bar: { x: 10, y: 120, width: 52, height: 620 } });
    expect(getUsableViewport()).toEqual({ offsetLeft: 70, offsetTop: 20, width: 930, height: 400 });
    expect(document.documentElement.style.getPropertyValue('--host-safe-bottom')).toBe('348px');
    visual.height = 768;
    visual.dispatchEvent(new Event('resize'));
    expect(getUsableViewport().height).toBe(720);
  });
  it('notifies existing menu observers when folding changes native geometry', () => {
    const onResize = vi.fn();
    window.addEventListener('resize', onResize);
    setHostViewportLayout({ bounds: { x: 0, y: 0, width: 1024, height: 768 },
      content: { x: 0, y: 0, width: 940, height: 740 } });
    expect(onResize).toHaveBeenCalledOnce();
    expect(getUsableViewport().width).toBe(940);
    window.removeEventListener('resize', onResize);
  });
});

describe('folded viewport', () => {
  const bounds = { x: 0, y: 0, width: 900, height: 760 };
  const content = { x: 30, y: 50, width: 800, height: 650 };

  it.each([
    [{ x: 30, y: 310, width: 800, height: 40 }, { x: 100, y: 300 }, [30, 50, 800, 260]],
    [{ x: 30, y: 310, width: 800, height: 40 }, { x: 100, y: 352 }, [30, 350, 800, 350]],
    [{ x: 410, y: 50, width: 40, height: 650 }, { x: 395, y: 400 }, [30, 50, 380, 650]],
    [{ x: 410, y: 50, width: 40, height: 650 }, { x: 451, y: 400 }, [450, 50, 380, 650]],
  ] as const)('keeps an anchored popup entirely on its side of the fold', (hinge, anchor, expected) => {
    setHostViewportLayout({ bounds, content, hinge });
    const { offsetLeft, offsetTop, width, height } = getUsableViewport(anchor);
    expect([offsetLeft, offsetTop, width, height]).toEqual(expected);
  });

  it('uses the remaining visible pane when the keyboard hides the other one', () => {
    vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { offsetLeft: 0, offsetTop: 0, width: 900, height: 330 }));
    setHostViewportLayout({ bounds, content, hinge: { x: 30, y: 310, width: 800, height: 40 } });
    expect(getUsableViewport({ x: 40, y: 500 })).toEqual({ offsetLeft: 30, offsetTop: 50, width: 800, height: 260 });
  });
});
