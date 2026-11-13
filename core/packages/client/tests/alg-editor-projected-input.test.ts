// @vitest-environment jsdom
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import Input, { AlgEditorPrefix } from '@/components/AlgEditorProjectedInput';
import type { AlgInputHandle } from '@/components/AlgInput';
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
it('shows only the suffix while retaining the complete rich-text draft and caret', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host), ref = createRef<AlgInputHandle>();
  const change = vi.fn();
  const render = (prefix: string) => root.render(createElement(AlgEditorPrefix, { value: prefix }, createElement(Input, {
    ref, markable: true, initialText: "U' R U R' U2 R U' R'", initialHtml: "U' R U R' <u>U2</u> R U' R'", onChange: change,
  })));
  try {
    await act(async () => render(''));
    const el = ref.current!.getElement()!;
    await act(async () => render("U' R U R'"));
    expect(ref.current!.getElement()).toBe(el);
    expect(el.textContent).toBe("U2 R U' R'");
    expect(ref.current!.getText()).toBe("U' R U R' U2 R U' R'");
    expect(ref.current!.getHtml()).toContain('<u>U2</u>');
    await act(async () => { el.textContent = "U R' F R F'"; el.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(ref.current!.getText()).toBe("U' R U R' U R' F R F'");
    expect(change.mock.lastCall?.[0]).toBe("U' R U R' U R' F R F'");
    await act(async () => render(''));
    expect(el.textContent).toBe("U' R U R' U R' F R F'");
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
