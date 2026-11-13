// @vitest-environment jsdom
import { act, createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlgEntry } from '@cuberoot/shared/alg';

vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }));
vi.mock('@/i18n/tr', () => ({ tr: (value: { en: string }) => value.en }));
vi.mock('@/components/CubeKeyboardSection', () => ({ default: () => null }));
vi.mock('@/components/AlgMirrorPanel', () => ({ default: () => null, hasMirror: () => false }));
vi.mock('@/components/AlgInput', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return { default: forwardRef(({ initialText, initialHtml }: { initialText: string; initialHtml?: string }, ref) => {
    useImperativeHandle(ref, () => ({ getText: () => initialText, getHtml: () => initialHtml ?? initialText, getElement: () => null }));
    return createElement('code', null, initialText);
  }) };
});

import AlgEditor, { type AlgEditorHandle } from '@/components/AlgEditor';
import AlgTagLabel from '@/components/AlgTagLabel';

describe('formula tag editor with the shared menu and fixed tags', () => {
  let host: HTMLDivElement;
  let root: Root;
  const ref = createRef<AlgEditorHandle>();
  const initial: AlgEntry[][] = [[{ alg: "R U'", algHtml: "<u>R</u> U'", tags: ['oh'], setup: 'F', source: 'cuberoot', note: { en: 'Keep', zh: '保留' } }, { alg: 'L' }], [{ alg: 'F', tags: ['ft'] }]];
  const render = async () => act(async () => root.render(createElement(AlgEditor, { initialValue: initial, ref })));
  const click = async (name: string) => act(async () => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('[role="listbox"] button'), ...host.querySelectorAll('button')];
    const button = buttons.find(b => b.getAttribute('aria-label') === name || b.textContent?.trim() === name || b.querySelector('.sr-only')?.textContent === name);
    expect(button, name).toBeTruthy(); button!.click();
  });
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
    vi.stubGlobal('fetch', vi.fn());
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it('opens tools explicitly, toggles them closed, and dismisses on Escape or outside press', async () => {
    await render();
    const toggle = host.querySelector<HTMLButtonElement>('.alg-editor-tools-toggle')!;
    const tools = host.querySelector('.alg-editor-tools')!;
    expect(tools.getAttribute('data-tools-open')).toBe('false');
    await act(async () => toggle.click());
    expect(tools.getAttribute('data-tools-open')).toBe('true');
    await act(async () => toggle.click());
    expect(tools.getAttribute('data-tools-open')).toBe('false');
    await act(async () => toggle.click());
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(tools.getAttribute('data-tools-open')).toBe('false');
    expect(document.activeElement).toBe(toggle);
    await act(async () => toggle.click());
    await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(tools.getAttribute('data-tools-open')).toBe('false');
    expect(ref.current!.getValue()).toEqual(initial);
  });

  it('uses one menu per row to toggle multiple tags without changing moves, marks, metadata or another orientation', async () => {
    await render();
    expect(host.querySelectorAll('.alg-editor-row .alg-tag-select')).toHaveLength(3);
    expect(host.querySelector('.alg-tag-select .compact-select-arrow')).toBeNull();
    await act(async () => {
      const event = new MouseEvent('pointerover', { bubbles: true });
      Object.defineProperty(event, 'pointerType', { value: 'mouse' });
      host.querySelector('.alg-tag-select button')!.dispatchEvent(event);
    });
    expect(document.querySelector('[role="listbox"]')?.getAttribute('aria-multiselectable')).toBe('true');
    expect(document.querySelectorAll('[role="listbox"] button:not([role="option"])')).toHaveLength(0);
    expect(host.querySelector('.alg-tag-manager')).toBeNull();
    expect([...document.querySelectorAll('[role="option"] .sr-only')].map(el => el.textContent)).toEqual(['Mainstream', 'Beginner pick', 'Left OH', 'Feet', 'FMC', 'Big cube', 'Keyboard']);
    const options = [...document.querySelectorAll('[role="option"]')];
    expect(options[0].querySelector('.sr-only')?.textContent).toBe('Mainstream');
    expect(options[0].querySelector('.lucide-flame')?.getAttribute('width')).toBe('1em');
    expect(options[1].querySelector('.sr-only')?.textContent).toBe('Beginner pick');
    expect(options.slice(0, 2).map(option => option.textContent)).toEqual(['Mainstream', 'Beginner pick']);
    expect(options[0].querySelector('[title]')).toBeNull();
    await act(async () => {
      const hover = new MouseEvent('pointerover', { bubbles: true });
      Object.defineProperty(hover, 'pointerType', { value: 'mouse' });
      options[0].dispatchEvent(hover);
    });
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Mainstream');
    expect(options.some(option => option.textContent?.includes('S style'))).toBe(false);
    expect(document.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain('Left OH');
    expect(document.querySelector('[role="option"][aria-selected="true"] .lucide-check')).toBeNull();
    await click('Feet');
    expect(ref.current!.getValue()[0][0]).toEqual({ ...initial[0][0], tags: ['oh', 'ft'] });
    await click('Algorithm tags'); await click('Left OH');
    expect(ref.current!.getValue()[0][0].tags).toEqual(['ft']);
    await click('Algorithm tags'); await click('Feet');
    expect(ref.current!.getValue()[0][0].tags).toEqual([]);
    await click('Algorithm tags'); await click('Left OH');
    expect(ref.current!.getValue()).toEqual(initial);
    await click('Algorithm tags'); await click('Mainstream');
    expect(ref.current!.getValue()[0][0]).toEqual({ ...initial[0][0], tags: ['oh', 'mainstream'] });
    expect(ref.current!.getValue()[1]).toEqual(initial[1]);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps presentation formatting out of semantic previews', async () => {
    const source: AlgEntry = { alg: "F' L F L' y'", tags: ['oh'] };
    let preview: AlgEntry | undefined;
    await act(async () => root.render(createElement(AlgEditor, {
      initialValue: [[source]],
      formatInitialAlg: alg => alg.replace(/ y'$/, ''),
      renderOrientation: (rows, _oi, firstEntry) => {
        preview = firstEntry;
        return rows;
      },
    })));
    expect(host.querySelector('code')?.textContent).toBe("F' L F L'");
    expect(preview).toEqual(source);
  });

  it('allows only one beginner pick across all case orientations and can clear it', async () => {
    const onChange = vi.fn();
    await act(async () => root.render(createElement(AlgEditor, { initialValue: initial, ref, onChange })));
    const pick = async (index: number) => {
      await act(async () => host.querySelectorAll<HTMLButtonElement>('.alg-tag-select button')[index].click());
      await click('Beginner pick');
    };
    await pick(0);
    expect(ref.current!.getValue()[0][0].tags).toEqual(['oh', 'beginner']);
    await pick(2);
    expect(ref.current!.getValue()[0][0]).toEqual(initial[0][0]);
    expect(ref.current!.getValue()[1][0].tags).toEqual(['ft', 'beginner']);
    expect(ref.current!.getValue().flat().filter(entry => entry.tags?.includes('beginner'))).toHaveLength(1);
    await pick(2);
    expect(ref.current!.getValue()).toEqual(initial);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('draws the L and R hand marks inside the one-handed icon', async () => {
    await act(async () => root.render(createElement('div', null,
      createElement(AlgTagLabel, { tag: 'oh', label: 'Left OH', hand: 'left' }),
      createElement(AlgTagLabel, { tag: 'oh', label: 'Right OH', hand: 'right' }),
    )));
    const icons = [...host.querySelectorAll('.alg-tag-oh-icon')];
    expect(icons).toHaveLength(2);
    expect(icons.map(icon => icon.querySelector('.alg-tag-hand')?.textContent)).toEqual(['L', 'R']);
    expect(icons.every(icon => icon.querySelector('.event-333oh'))).toBe(true);
  });

  it('uses a plain book for the beginner tag without a check symbol', async () => {
    await act(async () => root.render(createElement(AlgTagLabel, { tag: 'beginner', label: 'Beginner pick' })));
    expect(host.querySelector('.lucide-book-open')).not.toBeNull();
    expect(host.querySelector('.lucide-book-open-check')).toBeNull();
  });
});
