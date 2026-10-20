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
import { ReconCrossToggle } from '@cuberoot/timer-ui';
import { useReconLineDiagrams } from './ReconLineDiagrams';
import Link from '@/components/ReconCaseLink';
import { reconCommentLinks } from '@/lib/recon-comment-links';
import { tr } from '@/i18n/tr';
import { crossColorFromReconText } from '@/components/CubeColorChip/CubeColorChip';
import NotationLine, { useNotationCases } from '@cuberoot/timer-ui/recon/NotationLine';
import { findTokenPositions, syncReconPlayerCursorFromText, reconInspectionOrientations, reconWasteBrackets } from '@/lib/recon-alg-utils';
import { getTextOffsetInElement, snapCaretToLine } from '@cuberoot/timer-ui/recon/text-cursor';
import './solution_view.css';

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

export default function SolutionView({ text, event, scramble = '', sourceText = text, playerRef, crossLineIdx = -1, crossNormalized = false, onToggleCross, autoWaste = false }: {
  text: string;
  event?: string;
  scramble?: string;
  sourceText?: string;
  autoWaste?: boolean;
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
  const plainText = useMemo(() => text.replace(/\r\n?/g, '\n'), [text]);
  const inspectionColors = useMemo(() => new Map(reconInspectionOrientations(plainText).map(item => [item.line, item.colors])), [plainText]);
  const crossColor = useMemo(() => crossColorFromReconText(plainText), [plainText]);
  const linkComments = event === '3x3' || event === '333' || event === 'oh' || event === '333oh';
  const { diagramAt, f2lLinks, f2lLoading, libraryLinks } = useReconLineDiagrams(scramble, sourceText, linkComments);
  const wasteBrackets = useMemo(() => autoWaste && linkComments
    ? reconWasteBrackets(plainText, scramble) : new Map<number, string>(), [autoWaste, linkComments, plainText, scramble]);
  const commentCases = useNotationCases(plainText, linkComments);

  useEffect(() => {
    cursorOffsetRef.current = null;
    setCursorOffset(null);
    setHlRange(null);
  }, [text]);

  const syncToOffset = useCallback((text: string, offset: number, autoplay = false) => {
    syncReconPlayerCursorFromText(playerRef.current, text.substring(0, offset), autoplay);
  }, [playerRef]);

  const moveCaret = useCallback((plainText: string, offset: number, autoplay = false) => {
    cursorOffsetRef.current = offset;
    setCursorOffset(offset);
    setHlRange(computeHighlightRange(plainText, offset));
    syncToOffset(plainText, offset, autoplay);
  }, [syncToOffset]);

  // NOTE: 点击解法文本——计算偏移 → 磁吸到 token 边界 → 更新光标 + 高亮 + 同步 player
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!e.currentTarget.contains(e.target as Node) || (e.target as Element).closest('a, button')) return;
    const el = preRef.current;
    if (!el) return;
    let offset = getTextOffsetInElement(el, { x: e.clientX, y: e.clientY });
    if (offset < 0) return;
    const result = findTokenPositions(plainText);
    offset = snapCaretToLine(offset, plainText, result);
    moveCaret(plainText, offset, true);
  }, [moveCaret, plainText]);

  // NOTE: 方向键导航——左右按 token 跳转,上下按行跳转
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.target as Element).closest('a, button')) return;
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const el = preRef.current;
    if (!el || !playerRef.current) return;
    const fullText = plainText;
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
  }, [playerRef, moveCaret, plainText]);

  const lines = useMemo(() => plainText.split('\n'), [plainText]);
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
      className="detail-solution-text recon-notation-list"
      aria-busy={f2lLoading}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ cursor: 'text', outline: 'none' }}
    >
      {lines.map((line, i) => {
        const nl = i > 0 ? '\n' : '';
        const lineStart = lineStarts[i];
        const toggle = i === crossLineIdx && onToggleCross ? (
          <ReconCrossToggle normalized={crossNormalized} onToggle={onToggleCross}
            label={crossNormalized ? 'Show original' : 'Normalize cross'} tabIndex={-1} />
        ) : null;

        const links = linkComments ? reconCommentLinks(line, commentCases, set => libraryLinks.get(i)?.get(set)).flatMap(link => {
          if (link.href !== '/alg/3x3/f2l') return [link];
          const href = f2lLinks.get(i)?.get('F2L');
          return href ? [{ ...link, href }] : [];
        }) : [];
        return <span key={i}>{nl}<NotationLine line={line} lineStart={lineStart}
          cursorOffset={cursorOffset} hlRange={hlRange} wasteBrackets={wasteBrackets}
          crossColor={crossColor} links={links} colorHref={colors => linkComments ? f2lLinks.get(i)?.get(colors) : undefined}
          inspectionColors={inspectionColors.get(i)} diagram={diagramAt(i)} trailing={toggle}
          localize={tr} renderLink={(href, children) => <Link href={href} prefetch={false} className="recon-comment-link">{children}</Link>}
        /></span>;
      })}
    </pre>
  );
}
