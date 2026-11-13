// @vitest-environment jsdom
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import AlgInput, { type AlgInputHandle } from '@/components/AlgInput';
import { cleanAlgTextCE } from '@/lib/alg-autospace';

vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));

it.each(["'", '’', '′', '＇'].flatMap(apostrophe => [false, true].map(rich => ({ apostrophe, rich }))))(
  'keeps the caret after inserting $apostrophe after U2 (rich text: $rich)', async ({ apostrophe, rich }) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host), ref = createRef<AlgInputHandle>();
  const onCaretChange = vi.fn();
  try {
    await act(async () => root.render(createElement(AlgInput, {
      ref, markable: true, initialHtml: rich ? "<u>U2</u> R U2 R'" : "U2 R U2 R'", onCaretChange,
    })));
    const el = ref.current!.getElement() as HTMLDivElement;
    el.focus();
    const text = el.lastChild as Text;
    // Model the native DOM insertion before React's input handler runs.
    const offset = rich ? 5 : 7;
    text.insertData(offset, apostrophe);
    document.getSelection()!.setBaseAndExtent(text, offset + 1, text, offset + 1);
    await act(async () => el.dispatchEvent(new InputEvent('input', {
      bubbles: true, inputType: 'insertText', data: apostrophe,
    })));
    expect(ref.current!.getText()).toBe("U2 R U2' R'");
    expect(ref.current!.getCaretIndex()).toBe(8);
    expect(onCaretChange).toHaveBeenLastCalledWith("U2 R U2' R'", 8);
    if (rich) expect(el.querySelector('u')?.textContent).toBe('U2');
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});

it('preserves backward selections across cleaned rich-text nodes', () => {
  const el = document.createElement('div');
  el.innerHTML = '<u>Ｒ中</u> U2’'; document.body.append(el);
  const anchor = el.lastChild!, focus = el.firstChild!.firstChild!;
  const selection = document.getSelection()!;
  selection.setBaseAndExtent(anchor, 4, focus, 2);
  try {
    cleanAlgTextCE(el);
    expect(el.textContent).toBe("R U2'");
    expect(selection.anchorNode).toBe(anchor);
    expect(selection.anchorOffset).toBe(4);
    expect(selection.focusNode).toBe(focus);
    expect(selection.focusOffset).toBe(1);
  } finally { el.remove(); selection.removeAllRanges(); }
});
