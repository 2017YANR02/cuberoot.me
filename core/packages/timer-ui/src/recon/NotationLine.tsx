'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import CubeColorChip, { cubeColorGroups, cubeColorGroupPunctuation, f2lDisplayColors } from '../CubeColorChip';
import { reconCommentLinks, reconCommentCaseIndex, type ReconCommentCases, type ReconCommentLink } from '@cuberoot/shared/recon/comment-links';
import type { TimerColorLetter as CubeColorLetter } from '@cuberoot/shared/timer';
import { loadAlg } from '@cuberoot/shared/alg';
import './notation-line.css';

/** Shared case-name lookup; both hosts consume the same library index. */
export function useNotationCases(text: string, enabled = true): ReconCommentCases {
  const sets = useMemo(() => enabled ? [...new Set(text.split('\n').flatMap(line =>
    reconCommentLinks(line).map(link => link.href.split('/')[3])))].sort().join(',') : '', [text, enabled]);
  const [cases, setCases] = useState<ReconCommentCases>(new Map());
  useEffect(() => {
    let active = true;
    setCases(new Map());
    if (sets) void Promise.all(sets.split(',').map(async set => {
      try { return [set, reconCommentCaseIndex(set, (await loadAlg('3x3', set)).cases)] as const; }
      catch { return [set, new Map<string, string>()] as const; }
    })).then(entries => { if (active) setCases(new Map(entries)); });
    return () => { active = false; };
  }, [sets]);
  return cases;
}

/** One DOM layout for timer reports and editable reconstruction previews.
 * Source offsets remain lossless; hosts supply only playback/cursor actions and links. */
export default function NotationLine({ line, lineStart = 0, cursorOffset = null, hlRange = null,
  wasteBrackets = new Map(), crossColor = null, links = [], colorHref, inspectionColors, diagram, trailing,
  moves, className, state, bodyClassName = '', diagramClassName = '', chipClassName = '',
  commentClassName, localize = text => text.en, renderLink,
}: {
  line: string; lineStart?: number; cursorOffset?: number | null; hlRange?: [number, number] | null;
  wasteBrackets?: ReadonlyMap<number, string>; crossColor?: CubeColorLetter | null;
  links?: readonly ReconCommentLink[]; colorHref?: (colors: string) => string | undefined;
  inspectionColors?: string; diagram?: ReactNode; trailing?: ReactNode; moves?: ReactNode;
  className?: string; state?: string; bodyClassName?: string; diagramClassName?: string;
  chipClassName?: string; commentClassName?: string;
  localize?: (text: { en: string; zh: string }) => string;
  renderLink: (href: string, children: ReactNode) => ReactNode;
}) {
  const trimmed = line.trim();
  // 行内局部位置:光标(空 span 占位)与当前招式高亮区间。
  const localCursor = cursorOffset != null && cursorOffset >= lineStart && cursorOffset <= lineStart + line.length
    ? cursorOffset - lineStart : null;
  const hlS = hlRange ? hlRange[0] - lineStart : -1;
  const hlE = hlRange ? hlRange[1] - lineStart : -1;
  const hasHl = hlRange != null && hlS < line.length && hlE > 0 && hlE > hlS;

  // 注释行整体上色;招式高亮只会落在指令区,注释行不会命中 hlRange。
  const isComment = trimmed.startsWith('//');
  const commentStart = line.indexOf('//');
  const labelStart = commentStart >= 0
    ? commentStart + 2 + (line.slice(commentStart + 2).match(/^\s*/)?.[0].length ?? 0)
    : -1;
  const labelColorGroups = labelStart >= 0
    ? cubeColorGroups(line.slice(labelStart)).map(group => ({
        ...group,
        start: group.start + labelStart,
        end: group.end + labelStart,
      }))
    : [];
  const colorsAt = new Map(labelColorGroups.map(group => [group.start, group.colors]));
  const hiddenBrackets = cubeColorGroupPunctuation(line, labelColorGroups);

  // 切点:0 / 行尾 / 光标 / 高亮起止 / 色块位置 → 分段渲染。
  const movesEnd = commentStart < 0 ? line.length : commentStart;
  const cuts = new Set<number>([0, line.length]);
  if (moves !== undefined) cuts.add(movesEnd);
  for (const offset of wasteBrackets.keys()) {
    if (offset >= lineStart && offset <= lineStart + line.length) cuts.add(offset - lineStart);
  }
  for (const offset of hiddenBrackets) { cuts.add(offset); cuts.add(offset + 1); }
  if (localCursor != null) cuts.add(localCursor);
  if (hasHl) { cuts.add(Math.max(0, hlS)); cuts.add(Math.min(line.length, hlE)); }
  for (const group of labelColorGroups) {
    cuts.add(group.start);
    cuts.add(group.end);
  }
  for (const link of links) { cuts.add(link.start); cuts.add(link.end); }
  const sorted = [...cuts].sort((a, b) => a - b);
  const parts: ReactNode[] = moves === undefined ? [] : [<Fragment key="moves">{moves}</Fragment>];
  for (let s = 0; s < sorted.length - 1; s++) {
    const a = sorted[s], b = sorted[s + 1];
    if (moves !== undefined && a < movesEnd) continue;
    if (wasteBrackets.has(lineStart + a)) parts.push(
      <span key={`waste${a}`} data-recon-text-length={0}>{wasteBrackets.get(lineStart + a)}</span>,
    );
    if (hiddenBrackets.has(a)) {
      parts.push(<span key={`bracket${a}`} data-recon-text-length={1}>{line[a] === '+' ? ' ' : null}</span>);
      continue;
    }
    const colors = colorsAt.get(a);
    if (colors) {
      const chip = <CubeColorChip colors={f2lDisplayColors(colors, crossColor)} className={`recon-label-chip ${chipClassName}`} localize={localize} />;
      const f2lHref = colorHref?.(colors);
      parts.push(
        <span key={`color${a}`} data-recon-text-length={colors.length}>
          {f2lHref
            ? renderLink(f2lHref, chip)
            : chip}
        </span>,
      );
    }
    if (localCursor === a) parts.push(<span key={`c${a}`} className="detail-cursor" />);
    const seg = line.slice(a, b);
    if (!seg) continue;
    const isColorCode = labelColorGroups.some(group => a >= group.start && b <= group.end);
    if (isColorCode) {
      // 原字母完全不渲染；色块 wrapper 的 data 长度负责维持点击光标的原始偏移。
      continue;
    }
    const inHl = hasHl && a >= Math.max(0, hlS) && b <= Math.min(line.length, hlE);
    const link = links.find(link => a >= link.start && b <= link.end);
    if (inHl) parts.push(<span key={`h${a}`} className="recon-move-current">{seg}</span>);
    else if (link) parts.push(<Fragment key={`link${a}`}>{renderLink(link.href, seg)}</Fragment>);
    else parts.push(seg);
  }
  if (wasteBrackets.has(lineStart + line.length)) parts.push(
    <span key="wasteEnd" data-recon-text-length={0}>{wasteBrackets.get(lineStart + line.length)}</span>,
  );
  if (localCursor === line.length) parts.push(<span key="cend" className="detail-cursor" />);

  const content = moves !== undefined ? <>{parts[0]}{commentStart >= 0 ? ' ' : null}<span className={commentClassName}>{parts.slice(1)}</span></> : isComment ? <span className="recon-step-label">{parts}</span> : parts;
  const lineContent = <>{content}{Boolean(inspectionColors) && (
    <span className="recon-inspection-chip" data-recon-text-length="0">
      <CubeColorChip colors={inspectionColors!} className="cube-orientation-chip" localize={localize} />
    </span>
  )}{trailing}</>;
  return <span className={className} data-state={state}>{diagram ? (
    <span className="recon-case-line">
      <span className={`recon-case-diagram ${diagramClassName}`} data-recon-text-length="0">
        {diagram}
      </span>
      <span className={`recon-case-line-text ${bodyClassName}`}>{lineContent}</span>
    </span>
  ) : <span className={`recon-plain-line ${bodyClassName}`}>{lineContent}</span>}</span>;
}
