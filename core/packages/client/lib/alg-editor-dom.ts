import { escapeAlgText } from './alg_html';
import { getTextBeforeCaret } from './alg-autospace';
export type AlgEditorElement = HTMLTextAreaElement | HTMLDivElement;
export const editorText = (el: AlgEditorElement): string => el instanceof HTMLTextAreaElement ? el.value : el.textContent ?? '';
export const editorCaret = (el: AlgEditorElement): number => el instanceof HTMLTextAreaElement ? el.selectionStart : getTextBeforeCaret(el).length;
export function setEditorCaret(el: AlgEditorElement, offset: number) {
  if (el instanceof HTMLTextAreaElement) el.setSelectionRange(offset, offset);
  else placeCaretAtTextOffset(el, offset);
}

export function textPointAtOffset(
  root: HTMLElement,
  offset: number,
  bias: 'forward' | 'backward',
): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) nodes.push(current as Text);
  if (nodes.length === 0) return null;

  let consumed = 0;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const end = consumed + node.data.length;
    if (offset < end || (offset === end && (bias === 'backward' || i === nodes.length - 1))) {
      return { node, offset: Math.max(0, offset - consumed) };
    }
    consumed = end;
  }
  return null;
}

export function placeCaretAtTextOffset(root: HTMLElement, offset: number) {
  ensureEditorLineEnd(root);
  const sel = window.getSelection();
  const point = textPointAtOffset(root, offset, 'backward');
  if (!sel || !point) return;
  const range = document.createRange();
  range.setStart(point.node, point.offset);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** A trailing newline needs a layout-only break for Chromium's editing caret.
 * It contributes no source text and is removed by the shared HTML allowlist. */
export function ensureEditorLineEnd(root: HTMLElement) {
  if (root.textContent?.endsWith('\n') && root.lastChild?.nodeName !== 'BR') {
    root.appendChild(document.createElement('br'));
  }
}

/** Chromium insertText turns newlines into block elements; inline HTML keeps source offsets and native undo. */
export function insertEditorText(el: AlgEditorElement, text: string) {
  if (el instanceof HTMLDivElement && /[\r\n]/.test(text)) {
    const normalized = text.replace(/\r\n?/g, '\n');
    const caret = editorCaret(el);
    document.execCommand('insertHTML', false, escapeAlgText(normalized).replace(/\n/g, '&#10;'));
    setEditorCaret(el, caret + normalized.length);
  } else document.execCommand('insertText', false, text);
}
