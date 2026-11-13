// @vitest-environment jsdom
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { regenerateMirrorAlgs } from '@cuberoot/shared/alg-mirror';

vi.mock('react-i18next', () => ({ useTranslation: () => ({}) }));
vi.mock('@/i18n/tr', () => ({ tr: (text: { en: string }) => text.en }));
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/CubeKeyboardSection', () => ({ default: () => null }));
vi.mock('@/components/AlgMirrorPanel', () => ({ default: () => null, hasMirror: () => false }));

import AlgEditor, { type AlgEditorHandle } from '@/components/AlgEditor';

it('deletes a last-row counterpart with its local siblings, lists the other case, and preserves cancellation', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  const initial = regenerateMirrorAlgs({ id: 1, algs: [[{ alg: "U R U' R'" }], [], [], []] },
    { id: 2, algs: [[], [], [], []] }).algsById;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host), ref = createRef<AlgEditorHandle>(), change = vi.fn();
  const dialogButton = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
    .find(button => button.textContent?.trim() === name)!;
  try {
    await act(async () => root.render(createElement(AlgEditor, {
      ref, initialValue: initial.get(2)!, onChange: change,
      mirror: { selfId: 2, selfName: 'B', partner: { id: 1, name: 'A', algs: initial.get(1)! } },
    })));
    const remove = host.querySelector<HTMLButtonElement>('.alg-editor-remove')!;
    expect(remove).not.toBeNull();
    await act(async () => remove.click());
    expect(host.querySelectorAll('.alg-del-alg')).toHaveLength(4);
    expect(host.querySelector('[role="dialog"]')!.textContent).toContain('A FR');
    expect(host.querySelector('[role="dialog"]')!.textContent).not.toContain('source');
    await act(async () => dialogButton('Cancel').click());
    expect(ref.current!.getValue().flat().filter(e => e.alg)).toEqual(initial.get(2)!.flat());
    expect(change).not.toHaveBeenCalled();
    await act(async () => remove.click());
    await act(async () => dialogButton('Delete').click());
    expect(ref.current!.getValue().flat().filter(e => e.alg)).toEqual([]);
    expect(change).toHaveBeenCalledOnce();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});
