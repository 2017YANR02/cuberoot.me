// @vitest-environment jsdom
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { editorCaret, editorText, setEditorCaret } from '@/lib/alg-editor-dom';
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/CubeKeyboardSection', () => ({ default: () => null }));
vi.mock('@/components/ReconAutofill', () => ({ default: ({ value, setValue }: { value: string; setValue: (s: string) => void }) =>
  createElement('button', { onClick: () => setValue(value + ' // PLL\n') }, 'complete') }));
import ReconSolutionField, { type ReconSolutionFieldHandle } from '@/components/ReconSolutionField';

it('retains multiline annotations on load, suffix normalization and completion with exact caret offsets', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host), handle = createRef<ReconSolutionFieldHandle>();
  const onChange = vi.fn();
  try {
    await act(async () => root.render(createElement(ReconSolutionField, {
      ref: handle, value: "R\nU2'", html: '<u>R</u>\n<u class="wavy"><s><em>U2\'</em></s></u>',
      onChange, scramble: '', isMobile: false,
    })));
    const el = host.querySelector<HTMLDivElement>('[contenteditable]')!;
    expect(editorText(el)).toBe("R\nU2'");
    setEditorCaret(el, 5); expect(editorCaret(el)).toBe(5);
    await act(async () => host.querySelector('button')!.click());
    expect(editorText(el)).toBe("R\nU2' // PLL\n");
    expect(el.querySelector('u.wavy s em')?.textContent).toBe("U2'");
    await act(async () => handle.current!.setText("R\nU'2 ↑↓·", '<u>R</u>\n<em>U\'2</em> ↑↓·'));
    expect(editorText(el)).toBe("R\nU2' ↑↓·");
    expect(el.querySelector('em')?.textContent).toBe("U2'");
    expect(onChange).toHaveBeenLastCalledWith("R\nU2' ↑↓·", '<u>R</u>\n<em>U2\'</em> ↑↓·');
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});
