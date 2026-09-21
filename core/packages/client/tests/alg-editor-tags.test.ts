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

  it('uses one menu per row to toggle multiple tags without changing moves, marks, metadata or another orientation', async () => {
    await render();
    expect(host.querySelectorAll('.alg-editor-row .alg-tag-select')).toHaveLength(3);
    expect(host.querySelector('.alg-tag-select .compact-select-arrow')).toBeNull();
    await click('Algorithm tags');
    expect(document.querySelector('[role="listbox"]')?.getAttribute('aria-multiselectable')).toBe('true');
    expect(document.querySelectorAll('[role="listbox"] button:not([role="option"])')).toHaveLength(0);
    expect(host.querySelector('.alg-tag-manager')).toBeNull();
    expect([...document.querySelectorAll('[role="option"] .sr-only')].map(el => el.textContent)).toEqual(['Left OH', 'Feet', 'FMC', 'Big cube', 'Keyboard', 'Beginner pick']);
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
