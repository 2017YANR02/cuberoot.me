/**
 * 公式输入自动加空格 — textarea 与 contenteditable 共用规则。
 * Ported from packages/client-vite/src/utils/alg_autospace.ts
 */

export const MOVE_START_RE = /[RLUDFBMESxyzrludfbmes]/;
export const MOVE_END_RE = /[RLUDFBMESwxyzrludfbmes'2]/;

export const PUNCT_MAP: Record<string, string> = {
  '‘': "'", '’': "'",
  '“': "'", '”': "'",
  '"': "'",
  '（': '(', '）': ')',
  '，': ',', '。': '.',
  '：': ':', '；': ';',
  '？': '?', '！': '!',
  '／': '/', '［': '[',
  '］': ']',
};
export const PUNCT_RE = /[‘’“”"（），。：；？！／［］]/g;

export function normalizePunctuationTA(el: HTMLTextAreaElement): void {
  const v = el.value;
  if (!PUNCT_RE.test(v)) return;
  const s = el.selectionStart;
  const e = el.selectionEnd;
  el.value = v.replace(PUNCT_RE, ch => PUNCT_MAP[ch] ?? ch);
  el.setSelectionRange(s, e);
}

export function normalizePunctuationCE(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    if (PUNCT_RE.test(t.data)) {
      t.data = t.data.replace(PUNCT_RE, ch => PUNCT_MAP[ch] ?? ch);
    }
  }
}

export function inComment(text: string, pos: number): boolean {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  return text.slice(lineStart, pos).includes('//');
}

export function autoSpaceMoves(
  value: string,
  cursor: number,
  inputType: string,
): { value: string; cursor: number } {
  if (inputType !== 'insertText') return { value, cursor };

  if (cursor >= 2) {
    const newChar = value[cursor - 1];
    const prevChar = value[cursor - 2];
    if (MOVE_START_RE.test(newChar) && MOVE_END_RE.test(prevChar) && !inComment(value, cursor - 1)) {
      value = value.slice(0, cursor - 1) + ' ' + value.slice(cursor - 1);
      cursor += 1;
    }
  }

  if (cursor >= 1 && cursor < value.length) {
    const newChar = value[cursor - 1];
    const nextChar = value[cursor];
    if (MOVE_END_RE.test(newChar) && MOVE_START_RE.test(nextChar) && !inComment(value, cursor - 1)) {
      value = value.slice(0, cursor) + ' ' + value.slice(cursor);
    }
  }

  return { value, cursor };
}

export function getTextBeforeCaret(el: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return el.textContent ?? '';
  const r = sel.getRangeAt(0);
  if (!el.contains(r.endContainer) && r.endContainer !== el) return el.textContent ?? '';
  const range = document.createRange();
  range.selectNodeContents(el);
  range.setEnd(r.endContainer, r.endOffset);
  return range.toString();
}

export function getTextAfterCaret(el: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer) && r.startContainer !== el) return '';
  const range2 = document.createRange();
  range2.selectNodeContents(el);
  range2.setStart(r.endContainer, r.endOffset);
  return range2.toString();
}

export function autoSpaceMovesCE(el: HTMLElement, inputType: string): void {
  if (inputType !== 'insertText') return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const before = getTextBeforeCaret(el);
  const after = getTextAfterCaret(el);
  const newChar = before.slice(-1);
  const prevChar = before.length >= 2 ? before.slice(-2, -1) : '';
  const nextChar = after.slice(0, 1);

  if (
    newChar &&
    MOVE_START_RE.test(newChar) &&
    prevChar &&
    MOVE_END_RE.test(prevChar) &&
    !inComment(before, before.length - 1)
  ) {
    document.execCommand('delete', false);
    document.execCommand('insertText', false, ' ' + newChar);
    return;
  }

  if (
    newChar &&
    MOVE_END_RE.test(newChar) &&
    nextChar &&
    MOVE_START_RE.test(nextChar) &&
    !inComment(before, before.length - 1)
  ) {
    document.execCommand('insertText', false, ' ');
    sel.modify('move', 'backward', 'character');
  }
}
