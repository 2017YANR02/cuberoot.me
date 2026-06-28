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

/** 从 endIdx(含)向前跳过修饰符 w'2,取这一步转动的面字母(找不到返回 '')。 */
function moveBaseFaceBack(value: string, endIdx: number): string {
  let i = endIdx;
  while (i >= 0 && /[w'2]/.test(value[i])) i--;
  return i >= 0 ? value[i] : '';
}

/**
 * 同轴对面「连写」对:U 后接 D、F 后接 B 不加空格(用户记号,如 U'D / U2D / U2'D / F'B' / F2B)。
 * R 后接 L 等仍照常加空格 —— 仅这两个有序对例外。大小写均按同一面处理。
 */
function isGluedOppositePair(firstBase: string, secondBase: string): boolean {
  const a = firstBase.toUpperCase();
  const b = secondBase.toUpperCase();
  return (a === 'U' && b === 'D') || (a === 'F' && b === 'B');
}

const OPEN_TO_CLOSE: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

/**
 * `//` 注释标记后紧跟非空格内容时,自动在 `//` 与内容之间补一个空格(规范注释格式)。
 * 只在刚插入那个字符时触发:`//Y` → `// Y`(光标随内容后移);已有空格 / 输入第三个 `/` 不动。
 */
export function autoSpaceAfterComment(
  value: string,
  cursor: number,
  inputType: string,
): { value: string; cursor: number } {
  if (inputType !== 'insertText' || cursor < 3) return { value, cursor };
  const newChar = value[cursor - 1];
  if (value[cursor - 3] === '/' && value[cursor - 2] === '/' && newChar !== ' ' && newChar !== '/') {
    value = value.slice(0, cursor - 1) + ' ' + value.slice(cursor - 1);
    cursor += 1;
  }
  return { value, cursor };
}

/**
 * 输入左括号 ( [ { 时自动补上对应右括号,光标停在左括号右侧(两括号之间)。
 * 只处理刚插入的那个左括号(insertText);粘贴 / 删除不触发。全角已先被标点规范成半角。
 */
export function autoCloseBracket(
  value: string,
  cursor: number,
  inputType: string,
): { value: string; cursor: number } {
  if (inputType !== 'insertText' || cursor < 1) return { value, cursor };
  const close = OPEN_TO_CLOSE[value[cursor - 1]];
  if (close) {
    value = value.slice(0, cursor) + close + value.slice(cursor);
    // cursor 不变 → 停在左括号右侧
  }
  return { value, cursor };
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
    if (MOVE_START_RE.test(newChar) && MOVE_END_RE.test(prevChar) && !inComment(value, cursor - 1)
      && !isGluedOppositePair(moveBaseFaceBack(value, cursor - 2), newChar)) {
      value = value.slice(0, cursor - 1) + ' ' + value.slice(cursor - 1);
      cursor += 1;
    }
  }

  if (cursor >= 1 && cursor < value.length) {
    const newChar = value[cursor - 1];
    const nextChar = value[cursor];
    if (MOVE_END_RE.test(newChar) && MOVE_START_RE.test(nextChar) && !inComment(value, cursor - 1)
      && !isGluedOppositePair(moveBaseFaceBack(value, cursor - 1), nextChar)) {
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
    !inComment(before, before.length - 1) &&
    !isGluedOppositePair(moveBaseFaceBack(before, before.length - 2), newChar)
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
    !inComment(before, before.length - 1) &&
    !isGluedOppositePair(moveBaseFaceBack(before, before.length - 1), nextChar)
  ) {
    document.execCommand('insertText', false, ' ');
    sel.modify('move', 'backward', 'character');
  }
}
