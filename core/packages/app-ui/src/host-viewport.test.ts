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
