// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureView, visibleSiteElements } from '../app/[lang]/site/view-transition';

function directory(grid = false) {
  const list = document.createElement('div');
  list.style.cssText = '--site-grid-gap:12px;--site-grid-min-width:250px;--site-grid-min-height:190px;--site-grid-column-count:0;--site-list-gap:6px;--site-list-min-height:60px';
  vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 300, 1280, 30000));
  list.append(document.createElement('header'));
  const names = Array.from({ length: 386 }, (_, index) => {
    const row = document.createElement('article');
    row.dataset.flipId = `site-${index}`;
    const top = 300 + (grid ? Math.floor(index / 4) * 240 : index * 75);
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, top, 300, grid ? 240 : 75));
    const name = document.createElement('span');
    name.dataset.flipId = `site-${index}-name`;
    vi.spyOn(name, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, top + 10, 100, 20));
    row.append(name);
    list.append(row);
    return name;
  });
  document.body.append(list);
  return { list, names };
}

beforeEach(() => vi.stubGlobal('innerHeight', 900));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('site view transition source coverage', () => {
  it('captures below-screen origins for a denser destination without measuring the whole directory', () => {
    const { list, names } = directory();
    expect(visibleSiteElements(list)).toHaveLength(8);
    const state = captureView(list, 'grid');
    for (const name of names.slice(0, 12)) expect(state.has(name)).toBe(true);
    expect(state.get(names[8])!.top).toBeGreaterThan(window.innerHeight);
    expect(state.size).toBeLessThanOrEqual(20);
    expect(names[30].getBoundingClientRect).not.toHaveBeenCalled();
    expect(names[385].getBoundingClientRect).not.toHaveBeenCalled();
  });

  it('retains every visible source when the destination holds fewer entries', () => {
    const { list, names } = directory(true);
    expect(visibleSiteElements(list)).toHaveLength(12);
    const state = captureView(list, 'list');
    for (const name of names.slice(0, 12)) expect(state.has(name)).toBe(true);
    expect(state.size).toBe(12);
    expect(names[30].getBoundingClientRect).not.toHaveBeenCalled();
  });

  it('falls back to visible entries if layout metrics are unavailable', () => {
    const { list, names } = directory();
    list.removeAttribute('style');
    expect(captureView(list, 'grid').size).toBe(8);
    expect(names[385].getBoundingClientRect).not.toHaveBeenCalled();
  });
});
