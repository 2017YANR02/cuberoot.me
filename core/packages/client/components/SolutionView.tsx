'use client';

/**
 * 解法文本展示——高亮阶段注释 + 虚拟光标 + 光标跟随 twisty-player
 * 共享组件:详情页只读展示、编辑页标准化只读视图都用它
 *
 * 光标与「当前招式」橙色高亮都走 React state 声明式渲染(不再手动 splitText 插
 * DOM):点击 / 方向键更新 cursorOffset + hlRange,渲染时按行切段、把光标位置插
 * 一个零宽 span、把当前招式 token 包一层 .recon-move-current。高亮规则与 /sim 一致
 * (PlayerControls 的 highlightRange):优先高亮光标所在行的招式 —— 行内光标前的招式,
 * 否则该行第一个招式(光标落在行首 `(` 等分隔符前时,高亮本行首招而非上一行末招)。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { findTokenPositions, extractAlgFromText, syncPlayerToMoveCount, countMovesExpanded, type TokenPosition } from '@/lib/recon-alg-utils';
import { parseSq1Tokens } from '@cuberoot/shared/sq1-notation';
import './solution_view.css';

/** 获取点击在 DOM 元素纯文本中的绝对偏移 */
function getTextOffsetInElement(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return -1;
  const node = sel.anchorNode;
  let offset = sel.anchorOffset;
  if (!node || !el.contains(node)) return -1;
  let current: Node | null = node;
  while (current && current !== el) {
    let prev = current.previousSibling;
    while (prev) {
      offset += (prev.textContent || '').length;
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
function snapCaretToLine(raw: number, plainText: string, positions: TokenPosition[]): number {
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

/** 光标位置该高亮哪一个招式 token 的字符区间(与 /sim highlightRange 同规则):
 *  优先本行光标前的招式,否则本行第一个招式,否则退回光标前最后一个招式。 */
function computeHighlightRange(plainText: string, offset: number): [number, number] | null {
  const positions = findTokenPositions(plainText);
  if (positions.length === 0) return null;
  const lineOf = (pos: number) => {
    let n = 0;
    for (let i = 0; i < pos && i < plainText.length; i++) if (plainText[i] === '\n') n++;
    return n;
  };
  const caretLine = lineOf(offset);
  let prev = -1, next = -1;
  for (let i = 0; i < positions.length; i++) {
    if (positions[i].start <= offset) prev = i;
    if (next === -1 && positions[i].start >= offset) next = i;
  }
  let idx: number;
  if (prev >= 0 && lineOf(positions[prev].start) === caretLine) idx = prev;
  else if (next >= 0 && lineOf(positions[next].start) === caretLine) idx = next;
  else idx = prev;
  if (idx < 0) return null;
  const p = positions[idx];
  return [p.start, p.end];
}

export default function SolutionView({ text, playerRef, crossLineIdx = -1, crossNormalized = false, onToggleCross }: {
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerRef: MutableRefObject<any>;
  /** cross 行索引;>=0 时该行末尾渲染内联切换按钮。-1 表示不渲染 */
  crossLineIdx?: number;
  crossNormalized?: boolean;
  onToggleCross?: () => void;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const cursorOffsetRef = useRef<number | null>(null);
  // 光标字符偏移 + 当前招式高亮区间(声明式渲染)。text 变化时清空(偏移失效)。
  const [cursorOffset, setCursorOffset] = useState<number | null>(null);
  const [hlRange, setHlRange] = useState<[number, number] | null>(null);

  useEffect(() => {
    cursorOffsetRef.current = null;
    setCursorOffset(null);
    setHlRange(null);
  }, [text]);

  // Scrub the player to the caret. SQ1 uses the cuber-engine player
  // (Sq1ReconPlayer, `__kind: 'sq1'`): count tuple/slice tokens directly —
  // extractAlgFromText would strip the `(t,b)` parens SQ1 depends on.
  const syncToOffset = useCallback((text: string, offset: number) => {
    const player = playerRef.current;
    if (!player) return;
    const textBefore = text.substring(0, offset);
    if (player.__kind === 'sq1') {
      player.jumpToMoveCount?.(parseSq1Tokens(textBefore).length);
      return;
    }
    // cuber NxN engine (CuberReconPlayer) scrubs by whitespace move count, same
    // as the submit form's caret handler — it has no cubing.js indexer.
    if (player.__kind === 'nxn-cuber') {
      const moves = extractAlgFromText(textBefore).trim().split(/\s+/).filter(Boolean);
      player.jumpToMoveCount?.(moves.length);
      return;
    }
    syncPlayerToMoveCount(player, countMovesExpanded(extractAlgFromText(textBefore)));
  }, [playerRef]);

  const moveCaret = useCallback((plainText: string, offset: number) => {
    cursorOffsetRef.current = offset;
    setCursorOffset(offset);
    setHlRange(computeHighlightRange(plainText, offset));
    syncToOffset(plainText, offset);
  }, [syncToOffset]);

  // NOTE: 点击解法文本——计算偏移 → 磁吸到 token 边界 → 更新光标 + 高亮 + 同步 player
  const handleClick = useCallback(() => {
    const el = preRef.current;
    if (!el) return;
    let offset = getTextOffsetInElement(el);
    if (offset < 0) return;
    const plainText = el.textContent || '';
    const result = findTokenPositions(plainText);
    offset = snapCaretToLine(offset, plainText, result);
    moveCaret(plainText, offset);
  }, [moveCaret]);

  // NOTE: 方向键导航——左右按 token 跳转,上下按行跳转
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const el = preRef.current;
    if (!el || !playerRef.current) return;
    const fullText = el.textContent || '';
    const tokens = findTokenPositions(fullText);
    if (tokens.length === 0) return;
    const cur = cursorOffsetRef.current ?? 0;
    let newPos = cur;

    if (e.key === 'ArrowRight') {
      for (const t of tokens) {
        if (t.start >= cur) { newPos = t.end; break; }
      }
    } else if (e.key === 'ArrowLeft') {
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].end < cur) { newPos = tokens[j].end; break; }
      }
    } else {
      const lines = fullText.split('\n');
      const lineStarts: number[] = [];
      let off = 0;
      for (const line of lines) { lineStarts.push(off); off += line.length + 1; }
      let curLine = 0;
      for (let l = lineStarts.length - 1; l >= 0; l--) {
        if (cur >= lineStarts[l]) { curLine = l; break; }
      }
      const targetLine = e.key === 'ArrowDown' ? curLine + 1 : curLine - 1;
      if (targetLine < 0 || targetLine >= lines.length) return;
      const targetStart = lineStarts[targetLine];
      const targetEnd = targetStart + lines[targetLine].length;
      if (e.key === 'ArrowDown') {
        for (const t of tokens) {
          if (t.start >= targetStart && t.end <= targetEnd) { newPos = t.end; break; }
        }
      } else {
        for (let n = tokens.length - 1; n >= 0; n--) {
          if (tokens[n].start >= targetStart && tokens[n].end <= targetEnd) { newPos = tokens[n].end; break; }
        }
      }
    }
    if (newPos === cur) return;
    e.preventDefault();
    moveCaret(fullText, newPos);
  }, [playerRef, moveCaret]);

  const lines = useMemo(() => text.split(/\r?\n/), [text]);
  // 每行起始的全局字符偏移(含换行),用于把全局 cursorOffset / hlRange 映射到行内局部位置。
  const lineStarts = useMemo(() => {
    const out: number[] = [];
    let off = 0;
    for (const line of lines) { out.push(off); off += line.length + 1; }
    return out;
  }, [lines]);

  return (
    <pre
      key={crossNormalized ? 'normalized' : 'original'}
      ref={preRef}
      className="detail-solution-text"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ cursor: 'text', outline: 'none' }}
    >
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const nl = i > 0 ? '\n' : '';
        const lineStart = lineStarts[i];
        const toggle = i === crossLineIdx && onToggleCross ? (
          <button
            type="button"
            className={`recon-cross-toggle${crossNormalized ? ' active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleCross(); }}
            title={crossNormalized ? 'Show original' : 'Normalize cross'}
            tabIndex={-1}
          >
            <ArrowRightLeft size={12} />
          </button>
        ) : null;

        // 行内局部位置:光标(空 span 占位)与当前招式高亮区间。
        const localCursor = cursorOffset != null && cursorOffset >= lineStart && cursorOffset <= lineStart + line.length
          ? cursorOffset - lineStart : null;
        const hlS = hlRange ? hlRange[0] - lineStart : -1;
        const hlE = hlRange ? hlRange[1] - lineStart : -1;
        const hasHl = hlRange != null && hlS < line.length && hlE > 0 && hlE > hlS;

        // 注释行整体上色;招式高亮只会落在指令区,注释行不会命中 hlRange。
        const isComment = trimmed.startsWith('//');

        // 切点:0 / 行尾 / 光标 / 高亮起止 → 分段渲染,光标插空 span,高亮段包 .recon-move-current。
        const cuts = new Set<number>([0, line.length]);
        if (localCursor != null) cuts.add(localCursor);
        if (hasHl) { cuts.add(Math.max(0, hlS)); cuts.add(Math.min(line.length, hlE)); }
        const sorted = [...cuts].sort((a, b) => a - b);
        const parts: React.ReactNode[] = [];
        for (let s = 0; s < sorted.length - 1; s++) {
          const a = sorted[s], b = sorted[s + 1];
          if (localCursor === a) parts.push(<span key={`c${a}`} className="detail-cursor" />);
          const seg = line.slice(a, b);
          if (!seg) continue;
          const inHl = hasHl && a >= Math.max(0, hlS) && b <= Math.min(line.length, hlE);
          if (inHl) parts.push(<span key={`h${a}`} className="recon-move-current">{seg}</span>);
          else parts.push(seg);
        }
        if (localCursor === line.length) parts.push(<span key="cend" className="detail-cursor" />);

        const content = isComment ? <span className="recon-step-label">{parts}</span> : parts;
        return <span key={i}>{nl}{content}{toggle}</span>;
      })}
    </pre>
  );
}
