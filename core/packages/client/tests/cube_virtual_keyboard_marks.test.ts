// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('@/i18n/tr', () => ({
  tr: ({ zh }: { zh: string }) => zh,
}));

import CubeVirtualKeyboard from '@/components/CubeVirtualKeyboard';

function placeCaretAtEnd(el: HTMLElement) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function dispatchPointer(target: HTMLElement, type: 'pointerdown' | 'pointerup') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  target.dispatchEvent(event);
}

describe('CubeVirtualKeyboard formula marks', () => {
  let host: HTMLDivElement;
  let editor: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: () => undefined,
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });

    editor = document.createElement('div');
    editor.contentEditable = 'true';
    document.body.appendChild(editor);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: (_command: string, _showUi: boolean, value?: string) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const text = document.createTextNode(value ?? '');
        range.insertNode(text);
        range.setStartAfter(text);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: value ?? '', inputType: 'insertText' }));
        return true;
      },
    });

    await act(async () => {
      root.render(createElement(CubeVirtualKeyboard, {
        target: { current: editor },
        enableMarks: true,
      }));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    editor.remove();
    host.remove();
    vi.restoreAllMocks();
  });

  async function chooseMark(key: string) {
    const trigger = host.querySelector<HTMLButtonElement>('[data-key="marks-trigger"]');
    expect(trigger).not.toBeNull();
    await act(async () => {
      dispatchPointer(trigger!, 'pointerdown');
      dispatchPointer(trigger!, 'pointerup');
    });
    const item = host.querySelector<HTMLButtonElement>(`[data-mk="${key}"]`);
    expect(item).not.toBeNull();
    await act(async () => item!.click());
  }

  it.each([
    ['mark-u', '<u>U\'</u>'],
    ['mark-em', '<em>U\'</em>'],
    ['mark-wavy', '<u class="wavy">U\'</u>'],
    ['mark-s', '<s>U\'</s>'],
  ])('renders %s around the previous move', async (key, expectedHtml) => {
    editor.textContent = "R U R' U'";
    placeCaretAtEnd(editor);

    await chooseMark(key);

    expect(editor.innerHTML).toContain(expectedHtml);
    expect(editor.textContent).toBe("R U R' U' ");
  });

  it.each([
    ['mark-up', '↑ '],
    ['mark-down', '↓ '],
    ['mark-mid', '·'],
  ])('inserts %s as visible formula text', async (key, inserted) => {
    editor.textContent = 'R ';
    placeCaretAtEnd(editor);

    await chooseMark(key);

    expect(editor.textContent).toBe(`R ${inserted}`);
  });

  it('can add strikethrough when the move already has a wavy underline', async () => {
    editor.innerHTML = 'R <u class="wavy">U\'</u> ';
    placeCaretAtEnd(editor);

    await chooseMark('mark-s');

    expect(editor.querySelector('u.wavy s')?.textContent).toBe("U'");
    expect(editor.textContent).toBe("R U' ");
  });

  it.each([
    ['mark-wavy', 'u.wavy'],
    ['mark-s', 's'],
  ])('applies %s to the move before inline grip marks', async (key, selector) => {
    editor.textContent = "R U R' U R U2' ·↓   R'";
    const text = editor.firstChild as Text;
    const caret = editor.textContent.indexOf("R'", editor.textContent.indexOf('·'));
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(text, caret);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    await chooseMark(key);

    expect(editor.querySelector(selector)?.textContent).toBe("U2'");
    expect(editor.textContent).toBe("R U R' U R U2' ·↓   R'");
  });

  it('switches a solid underline to a visible wavy underline without nesting', async () => {
    editor.innerHTML = "R <u>U2'</u> ";
    placeCaretAtEnd(editor);

    await chooseMark('mark-wavy');

    expect(editor.querySelector('u.wavy')?.textContent).toBe("U2'");
    expect(editor.querySelector('u.wavy u')).toBeNull();
    expect(editor.querySelector('u:not(.wavy)')).toBeNull();
  });
});
