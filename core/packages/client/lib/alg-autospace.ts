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

// 零宽字符(U+200B/200C/200D、U+FEFF):不可见,多半是从别处粘贴带进来的垃圾,没有保留价值。
// 跟可见的 regrip 标注 ↑↓·⅓⅔ 不同 —— 这些一输入就直接删掉,不进数据(也就不必靠校验放行)。
const ZERO_WIDTH_RE = /[​‌‍﻿]/g;

/** 删掉零宽字符,并按删掉的(光标前的)个数回退光标。无零宽时原样返回。 */
export function stripZeroWidth(value: string, cursor: number): { value: string; cursor: number } {
  const cleaned = value.replace(ZERO_WIDTH_RE, '');
  if (cleaned === value) return { value, cursor };
  const cleanedBefore = value.slice(0, cursor).replace(ZERO_WIDTH_RE, '');
  return { value: cleaned, cursor: cleanedBefore.length };
}

/**
 * ## 中文输入法开着也要能打公式
 *
 * 网页**改不了操作系统的输入法** —— `ime-mode` 只有 IE / Firefox 认,Chrome 从来不支持,
 * 也没有任何 API 能替用户按下 Shift。所以不去「强制切英文」,改成**让它打不进来**:
 *
 * - 全角 → 半角:`Ｒ` → `R`、`’` → `'`、`，` → `,`、全角空格 → 空格。中文输入法下
 *   顺手打出的全角字符是最常见的脏数据,而且肉眼几乎看不出来。
 * - 中日韩字符(汉字 / 假名 / 谚文 / 中文标点)**直接删**。公式里不可能出现它们,
 *   删掉比留着让校验器事后报错强。
 *
 * 只洗**招式区**:
 * - `//` 到行尾是注释,原样保留 —— 注释就是拿来写人话的(`R U R' // 插右前槽`)。
 * - `↑↓·⅓⅔` 保留 —— 那是换握标注,是公式的一部分(见 docs/alg-upstream-notation.md)。
 */
const CJK_RE = /[、-〿぀-ヿㇰ-ㇿ㈀-鿿가-힯豈-﫿]/;

// 不带 /g:带 /g 的正则 `.test()` 会记 lastIndex,逐字符调用时结果隔一次翻一次。
const ZERO_WIDTH_1_RE = /[​‌‍﻿]/;

function cleanChar(ch: string): string {
  const code = ch.codePointAt(0)!;
  if (code === 0x3000) return ' ';                                   // 全角空格
  if (code >= 0xFF01 && code <= 0xFF5E) return String.fromCharCode(code - 0xFEE0); // 全角 ASCII
  if (PUNCT_MAP[ch]) return PUNCT_MAP[ch];                           // 弯引号 / 中文标点
  if (ZERO_WIDTH_1_RE.test(ch)) return '';
  if (CJK_RE.test(ch)) return '';
  return ch;
}

/**
 * 洗一段文本。**`//` 到行尾是注释,一个字都不动** —— 注释就是拿来写人话的
 * (`R U R' // 插右前槽`),/recon 的解法框全靠它。招式区才管。
 *
 * `inCmt` 进 / 出:contenteditable 那边一行会被拆成好几个文本节点,注释状态得跨节点带着走,
 * 否则后半个节点会被当成招式区洗掉中文。
 */
function cleanStr(s: string, inCmt = false): { out: string; inCmt: boolean } {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\n') { inCmt = false; out += ch; continue; }
    if (inCmt) { out += ch; continue; }
    if (ch === '/' && s[i + 1] === '/') { inCmt = true; out += '//'; i++; continue; }
    out += cleanChar(ch);
  }
  return { out, inCmt };
}

/**
 * 公式输入清洗(纯函数,给**受控**输入框用):全角→半角、零宽 / 中日韩字符删掉,
 * `//` 后的注释原样保留。
 * 光标按「清洗后的前缀长度」重算 —— 否则在中间删掉一个字,光标会跳到行尾。
 */
export function cleanAlgText(value: string, cursor: number): { value: string; cursor: number } {
  const cleaned = cleanStr(value).out;
  if (cleaned === value) return { value, cursor };
  return { value: cleaned, cursor: cleanStr(value.slice(0, cursor)).out.length };
}

/** contenteditable 版:逐个文本节点洗,注释状态跨节点接力。 */
export function cleanAlgTextCE(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  let inCmt = false;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    const r = cleanStr(t.data, inCmt);
    inCmt = r.inCmt;
    const cleaned = r.out;
    if (cleaned !== t.data) t.data = cleaned;
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
 * 同轴对面「连写」对:U/D 轴(UD / DU)、F/B 轴(FB / BF)两个方向都不加空格
 * (用户记号,如 U'D / U2D / U2'D / F'B' / F2B,以及反向 DU / D2U / BF / B'F)。
 * R/L 轴仍照常加空格 —— 只有 U-D、F-B 两条轴例外。大小写均按同一面处理。
 */
function isGluedOppositePair(firstBase: string, secondBase: string): boolean {
  const a = firstBase.toUpperCase();
  const b = secondBase.toUpperCase();
  return (a === 'U' && b === 'D') || (a === 'D' && b === 'U')
    || (a === 'F' && b === 'B') || (a === 'B' && b === 'F');
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
  if (!close) return { value, cursor };
  // 左括号前若紧贴非空白内容(且不是另一个左括号)→ 先补一个空格,把括号组跟前文分开。
  // 注释里也生效:`// BO(` → `// BO (`(再补右括号成 `// BO ()`)。
  const before = cursor >= 2 ? value[cursor - 2] : '';
  if (before && before !== ' ' && before !== '\n' && !OPEN_TO_CLOSE[before]) {
    value = value.slice(0, cursor - 1) + ' ' + value.slice(cursor - 1);
    cursor += 1; // 光标跟着左括号右移
  }
  value = value.slice(0, cursor) + close + value.slice(cursor);
  // cursor 不变 → 停在左括号右侧(两括号之间)
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
    // 新输入的是一步转动,而前一个字符是「转动结尾」或「右括号」(如 (U U') 后接 R)→ 补空格。
    const afterMove = MOVE_END_RE.test(prevChar)
      && !isGluedOppositePair(moveBaseFaceBack(value, cursor - 2), newChar);
    const afterCloseParen = prevChar === ')';
    if (MOVE_START_RE.test(newChar) && (afterMove || afterCloseParen) && !inComment(value, cursor - 1)) {
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

  const afterMove = MOVE_END_RE.test(prevChar)
    && !isGluedOppositePair(moveBaseFaceBack(before, before.length - 2), newChar);
  const afterCloseParen = prevChar === ')';
  if (
    newChar &&
    MOVE_START_RE.test(newChar) &&
    prevChar &&
    (afterMove || afterCloseParen) &&
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
    !inComment(before, before.length - 1) &&
    !isGluedOppositePair(moveBaseFaceBack(before, before.length - 1), nextChar)
  ) {
    document.execCommand('insertText', false, ' ');
    sel.modify('move', 'backward', 'character');
  }
}
