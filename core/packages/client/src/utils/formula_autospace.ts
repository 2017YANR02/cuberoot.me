/**
 * 公式输入自动加空格 — textarea 与 contenteditable 共用规则。
 *
 * 规则同 recon_alg_utils.autoSpaceMoves:用户敲一个字符时若造成相邻两个 move
 * 没空格,就在中间插一个空格。两种触发方向:
 *  - BEFORE: 前一字符是 move 末尾 + 新字符是 move 起始 → 在新字符前插空格
 *  - AFTER : 新字符是 move 末尾 + 后一字符是 move 起始 → 在新字符后插空格
 * 限制:
 *  - 仅 inputType === 'insertText'(手敲单字符)触发
 *  - `//` 之后的注释段不动
 */

// move 起始字符:面 / 旋转
export const MOVE_START_RE = /[RLUDFBMESxyzrludfbmes]/;
// move 末尾字符:面 / w / ' / 2
export const MOVE_END_RE = /[RLUDFBMESwxyzrludfbmes'2]/;

/** 判断给定文本中,从 lineStart 到 pos 之间是否已进入注释 (//) */
export function inComment(text: string, pos: number): boolean {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  return text.slice(lineStart, pos).includes('//');
}

// ── textarea 版(纯字符串 + cursor offset)──

/** textarea / 纯文本输入框版本 */
export function autoSpaceMoves(
  value: string,
  cursor: number,
  inputType: string,
): { value: string; cursor: number } {
  if (inputType !== 'insertText') return { value, cursor };

  // BEFORE: 在新字符前插空格
  if (cursor >= 2) {
    const newChar = value[cursor - 1];
    const prevChar = value[cursor - 2];
    if (MOVE_START_RE.test(newChar) && MOVE_END_RE.test(prevChar) && !inComment(value, cursor - 1)) {
      value = value.slice(0, cursor - 1) + ' ' + value.slice(cursor - 1);
      cursor += 1;
    }
  }

  // AFTER: 在新字符后插空格
  if (cursor >= 1 && cursor < value.length) {
    const newChar = value[cursor - 1];
    const nextChar = value[cursor];
    if (MOVE_END_RE.test(newChar) && MOVE_START_RE.test(nextChar) && !inComment(value, cursor - 1)) {
      value = value.slice(0, cursor) + ' ' + value.slice(cursor);
    }
  }

  return { value, cursor };
}

// ── contenteditable 版(直接操作 selection)──

/** 拿到 caret 之前的所有文本 */
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

/** 拿到 caret 之后的所有文本 */
export function getTextAfterCaret(el: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer) && r.startContainer !== el) return '';
  const range = document.createRange();
  range.setStart(r.startContainer, r.startOffset);
  range.selectNodeContents(el);
  range.setEnd(el, el.childNodes.length);
  // NOTE: 上面的 setEnd 覆盖了 selectNodeContents,顺序写好;改用直接构造
  const range2 = document.createRange();
  range2.selectNodeContents(el);
  range2.setStart(r.endContainer, r.endOffset);
  return range2.toString();
}

/**
 * contenteditable 版自动加空格;在 input 事件之后调用。
 * 通过 selection 操作直接修改 DOM。
 */
export function autoSpaceMovesCE(el: HTMLElement, inputType: string): void {
  if (inputType !== 'insertText') return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const before = getTextBeforeCaret(el);
  const after = getTextAfterCaret(el);
  const newChar = before.slice(-1);
  const prevChar = before.length >= 2 ? before.slice(-2, -1) : '';
  const nextChar = after.slice(0, 1);

  // BEFORE: 在新字符前插空格
  if (
    newChar &&
    MOVE_START_RE.test(newChar) &&
    prevChar &&
    MOVE_END_RE.test(prevChar) &&
    !inComment(before, before.length - 1)
  ) {
    // 删 newChar,然后插入 ' ' + newChar
    document.execCommand('delete', false);
    document.execCommand('insertText', false, ' ' + newChar);
    return;
  }

  // AFTER: 在新字符后插空格,caret 留在空格前(用户的"插入意图"完成)
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
