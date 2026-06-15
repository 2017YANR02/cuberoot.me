'use client';

/**
 * 解法文本展示——高亮阶段注释 + 虚拟光标 + 光标跟随 twisty-player
 * 共享组件:详情页只读展示、编辑页标准化只读视图都用它
 */
import { useCallback, useRef, type MutableRefObject } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { findTokenPositions, snapToTokenBoundary, extractAlgFromText, syncPlayerToMoveCount, countMovesExpanded } from '@/lib/recon-alg-utils';
import { parseSq1Tokens } from '@/lib/sq1-svg';
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

/** 在 DOM 元素的指定纯文本偏移处插入可视闪烁光标 */
function insertVisualCursor(el: HTMLElement, textOffset: number) {
  const old = el.querySelector('.detail-cursor');
  if (old) old.remove();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let accumulated = 0;
  let targetNode: Text | null = null;
  let localOffset = 0;
  while (walker.nextNode()) {
    const nodeLen = (walker.currentNode as Text).textContent?.length || 0;
    if (accumulated + nodeLen >= textOffset) {
      targetNode = walker.currentNode as Text;
      localOffset = textOffset - accumulated;
      break;
    }
    accumulated += nodeLen;
  }
  if (!targetNode) return;
  const cursor = document.createElement('span');
  cursor.className = 'detail-cursor';
  cursor.textContent = '​';
  const afterNode = targetNode.splitText(localOffset);
  afterNode.parentNode!.insertBefore(cursor, afterNode);
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
  const cursorOffsetRef = useRef(0);

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
    syncPlayerToMoveCount(player, countMovesExpanded(extractAlgFromText(textBefore)));
  }, [playerRef]);

  // NOTE: 点击解法文本——计算偏移 → 磁吸到 token 边界 → 插入光标 + 同步 player
  const handleClick = useCallback(() => {
    const el = preRef.current;
    if (!el) return;
    let offset = getTextOffsetInElement(el);
    if (offset < 0) return;
    const plainText = (el.textContent || '').replace(/​/g, '');
    const result = findTokenPositions(plainText);
    offset = snapToTokenBoundary(offset, result);
    cursorOffsetRef.current = offset;
    insertVisualCursor(el, offset);
    syncToOffset(plainText, offset);
  }, [syncToOffset]);

  // NOTE: 方向键导航——左右按 token 跳转,上下按行跳转
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const el = preRef.current;
    if (!el || !playerRef.current) return;
    const fullText = (el.textContent || '').replace(/​/g, '');
    const tokens = findTokenPositions(fullText);
    if (tokens.length === 0) return;
    let newPos = cursorOffsetRef.current;

    if (e.key === 'ArrowRight') {
      for (const t of tokens) {
        if (t.start >= cursorOffsetRef.current) { newPos = t.end; break; }
      }
    } else if (e.key === 'ArrowLeft') {
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].end < cursorOffsetRef.current) { newPos = tokens[j].end; break; }
      }
    } else {
      const lines = fullText.split('\n');
      const lineStarts: number[] = [];
      let off = 0;
      for (const line of lines) { lineStarts.push(off); off += line.length + 1; }
      let curLine = 0;
      for (let l = lineStarts.length - 1; l >= 0; l--) {
        if (cursorOffsetRef.current >= lineStarts[l]) { curLine = l; break; }
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
    if (newPos === cursorOffsetRef.current) return;
    e.preventDefault();
    cursorOffsetRef.current = newPos;
    insertVisualCursor(el, newPos);
    syncToOffset(fullText, newPos);
  }, [playerRef, syncToOffset]);

  const lines = text.split(/\r?\n/);
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
        if (trimmed.startsWith('//')) {
          return <span key={i}>{nl}<span className="recon-step-label">{line}</span>{toggle}</span>;
        }
        return <span key={i}>{nl}{line}{toggle}</span>;
      })}
    </pre>
  );
}
