/** Shared read-only reconstruction text hit testing, extracted from SolutionView. */
export interface TokenPosition { start: number; end: number; text: string }

/** 获取点击在 DOM 元素纯文本中的绝对偏移 */
function sourceTextLength(node: Node): number {
  if (node instanceof HTMLElement) {
    const replacedLength = node.dataset.reconTextLength;
    if (replacedLength != null) return Number(replacedLength);
  }
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').length;
  let length = 0;
  for (const child of node.childNodes) length += sourceTextLength(child);
  return length;
}

export function getTextOffsetInElement(el: HTMLElement, point?: { x: number; y: number }): number {
  const sel = window.getSelection();
  const caret = point ? document.caretPositionFromPoint?.(point.x, point.y) : null;
  const hit = point ? document.caretRangeFromPoint?.(point.x, point.y) : null;
  const node = caret?.offsetNode ?? hit?.startContainer ?? sel?.anchorNode;
  let offset = caret?.offset ?? hit?.startOffset ?? sel?.anchorOffset ?? 0;
  if (!node || !el.contains(node)) return -1;
  if (node.nodeType !== Node.TEXT_NODE) {
    offset = Array.from(node.childNodes).slice(0, offset).reduce((sum, child) => sum + sourceTextLength(child), 0);
  }
  let current: Node | null = node;
  while (current && current !== el) {
    let prev = current.previousSibling;
    while (prev) {
      offset += sourceTextLength(prev);
      prev = prev.previousSibling;
    }
    current = current.parentNode;
  }
  return offset;
}

/** 把点击偏移磁吸到「本行」的招式边界——保证光标落在点击那一行(不像旧的
 *  snapToTokenBoundary 会退回上一行末招)。规则:落在本行首招之前 → 行首列 0(此时
 *  textBefore 干净、不含半个 `(` 分组,player 计步不受污染);落在本行末招之后 → 末招
 *  结尾;行内 → 最近的招式边界。无招式的行(纯注释 / 空行)→ 行首列 0。 */
export function snapCaretToLine(raw: number, plainText: string, positions: TokenPosition[]): number {
  const lineStart = plainText.lastIndexOf('\n', Math.max(0, raw - 1)) + 1;
  let lineEnd = plainText.indexOf('\n', raw);
  if (lineEnd === -1) lineEnd = plainText.length;
  const onLine = positions.filter(t => t.start >= lineStart && t.end <= lineEnd);
  if (onLine.length === 0) return lineStart;
  const first = onLine[0];
  const last = onLine[onLine.length - 1];
  if (raw <= first.start) return lineStart;
  if (raw >= last.end) return last.end;
  let best = first.start, bestD = Math.abs(first.start - raw);
  for (const t of onLine) {
    for (const b of [t.start, t.end]) {
      const d = Math.abs(b - raw);
      if (d < bestD) { bestD = d; best = b; }
    }
  }
  return best;
}
