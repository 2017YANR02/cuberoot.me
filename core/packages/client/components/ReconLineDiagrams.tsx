'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { VisualCube } from '@/components/VisualCube';
import { cubeColorGroups, crossColorFromReconText } from '@/components/CubeColorChip/CubeColorChip';
import { cleanForPlayer } from '@/lib/recon-alg-utils';
import { visualCubeSchemeForOrientation } from '@/lib/cube-orientation';
import { tr } from '@/i18n/tr';
import { cubeThumbParams } from '@/lib/alg_thumb_plan';
import { CUBE_ORIENTATIONS, orientedFaceColors } from '@cuberoot/shared/timer';
import { applyScramble } from '@cuberoot/shared/timer/reconstruct/state';
import { loadAlg, type AlgSticker } from '@cuberoot/shared/alg';
import { reconCommentCaseIndex, reconCommentLinks } from '@/lib/recon-comment-links';
import { algCaseDetailHref, buildCaseSlugMap } from '@/lib/alg_case_link';

// Rebase sticker identities to the current grip before applying the library mask.
// The displayed state stays unchanged, including non-white crosses.
function LibraryLineDiagram({ setup, set, sticker, lastSlot }: {
  setup: string; set: string; sticker?: AlgSticker; lastSlot: boolean;
}) {
  const params = cubeThumbParams('3x3', set, sticker ?? { kind: 'raw', tag: '', attrs: {} });
  const frame = useMemo(() => {
    const state = applyScramble(3, setup);
    const faces = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
    const orientation = CUBE_ORIENTATIONS.find(option => {
      const shown = orientedFaceColors(option.value);
      return faces.every(face => shown[face] === state[face][4]);
    })?.value ?? '';
    const inverse = CUBE_ORIENTATIONS.find(option => {
      const shown = orientedFaceColors(option.value);
      return faces.every(face => shown[state[face][4]] === face);
    })?.value ?? '';
    return { orientation, setup: [inverse, setup].filter(Boolean).join(' ') };
  }, [setup]);
  return <VisualCube setup={frame.setup} mask={params.mask}
    scheme={params.scheme ?? visualCubeSchemeForOrientation(frame.orientation, params.view === 'oll' && !params.mask)}
    view={lastSlot ? 'iso' : params.view} hideGreySides={params.hideGreySides}
    size={28} local interactive enlargeable
    alt={tr({ zh: '执行此行前的魔方状态', en: 'Cube state before this line' })} />;
}

function retainRowKeys<T>(current: Map<string, T>, keys: Set<string>): Map<string, T> {
  return [...current.keys()].every(key => keys.has(key)) ? current
    : new Map([...current].filter(([key]) => keys.has(key)));
}

/** Shared pre-line states, F2L masking and library links for recon and timer. */
export function useReconLineDiagrams(scramble: string, text: string, enabled = true) {
  const lineSetups = useMemo(() => {
    let setup = cleanForPlayer(scramble);
    return text.replace(/\r\n?/g, '\n').split('\n').map(line => {
      const before = setup;
      setup = [setup, cleanForPlayer(line)].filter(Boolean).join(' ');
      return before;
    });
  }, [scramble, text]);
  const sourceLines = useMemo(() => text.replace(/\r\n?/g, '\n').split('\n'), [text]);
  // A later turn does not change an earlier row's state or annotation. Key
  // async results by their actual inputs, never by the whole live document.
  const rowKeys = useMemo(() => {
    const cross = crossColorFromReconText(text);
    return sourceLines.map((line, index) => JSON.stringify([scramble, lineSetups[index], line, cross]));
  }, [scramble, text, sourceLines, lineSetups]);
  const [f2lLinkRows, setF2lLinks] = useState<Map<string, Map<string, string>>>(new Map());
  const [f2lDiagrams, setF2lDiagrams] = useState<Map<string, { colors: string; facelets: string }[]>>(new Map());
  const [f2lLoading, setF2lLoading] = useState(false);
  const [libraryStickers, setLibraryStickers] = useState<Map<string, AlgSticker>>(new Map());
  const [libraryLinkRows, setLibraryLinks] = useState<Map<string, Map<string, string>>>(new Map());
  useEffect(() => {
    let cancelled = false;
    const validKeys = new Set(rowKeys);
    setLibraryLinks(current => retainRowKeys(current, validKeys));
    const stickerKeys = new Set(sourceLines.flatMap((line, index) => reconCommentLinks(line)
      .map(comment => `${rowKeys[index]}:${comment.href.split('/')[3]}`)));
    setLibraryStickers(current => retainRowKeys(current, stickerKeys));
    if (!enabled) return;
    // Bare stage labels in manually authored /recon text need the same exact
    // recognition as timer labels. Reuse the matcher and the existing dialog.
    void (async () => {
      const { identifyLibraryCase } = await import('@cuberoot/shared/timer/reconstruct/library-correction');
      const files = new Map<string, ReturnType<typeof loadAlg>>();
      const links = new Map<string, Map<string, string>>();
      const lines = text.replace(/\r\n?/g, '\n').split('\n');
      for (const [index, line] of lines.entries()) {
        if (cancelled) return;
        for (const comment of reconCommentLinks(line)) {
          const set = comment.href.split('/')[3];
          if (set === 'f2l') continue;
          try {
            if (!files.has(set)) files.set(set, loadAlg('3x3', set));
            const file = await files.get(set)!;
            const slugs = buildCaseSlugMap(file.cases, set);
            const named = reconCommentLinks(line, new Map([[set, reconCommentCaseIndex(set, file.cases)]]));
            const namedHref = named.find(link => link.start === comment.start && /^\/alg\/3x3\/[^/]+\//.test(link.href))?.href;
            const item = namedHref
              ? file.cases.find(item => item.id != null && algCaseDetailHref('3x3', set, slugs.byId.get(item.id) ?? '') === namedHref)
              : await identifyLibraryCase({ moves: cleanForPlayer(line).split(/\s+/).filter(Boolean) }, file.cases, set);
            const sticker = item?.sticker;
            const key = `${rowKeys[index]}:${set}`;
            if (sticker && !cancelled) setLibraryStickers(current => current.get(key) === sticker ? current : new Map(current).set(key, sticker));
            if (namedHref) continue;
            const slug = item?.id == null ? undefined : slugs.byId.get(item.id);
            if (slug) {
              if (!links.has(rowKeys[index])) links.set(rowKeys[index], new Map());
              links.get(rowKeys[index])!.set(set, algCaseDetailHref('3x3', set, slug));
            }
          } catch { /* Do not guess a case when the library is unavailable. */ }
        }
      }
      if (!cancelled) setLibraryLinks(links);
    })();
    return () => { cancelled = true; };
  }, [enabled, text, rowKeys, sourceLines]);
  useEffect(() => {
    let cancelled = false;
    const validKeys = new Set(rowKeys);
    setF2lLinks(current => retainRowKeys(current, validKeys));
    setF2lDiagrams(current => retainRowKeys(current, validKeys));
    const keyed = <T,>(rows: Map<number, T>) => new Map([...rows].map(([index, value]) => [rowKeys[index], value]));
    setF2lLoading(false);
    if (enabled && scramble && text.split('\n').some(line => {
      const comment = line.indexOf('//');
      if (comment < 0) return false;
      const label = line.slice(comment + 2).trim();
      return /\bF2L[1-4]?\b/i.test(label) || cubeColorGroups(label).some(group => group.colors.length === 2);
    })) {
      setF2lLoading(true);
      void import('@/lib/recon-f2l-links').then(({ reconF2lAnnotations }) => reconF2lAnnotations(scramble, text, diagrams => { if (!cancelled) setF2lDiagrams(keyed(diagrams)); }))
        .then(({ links, diagrams }) => { if (!cancelled) { setF2lLinks(keyed(links)); setF2lDiagrams(keyed(diagrams)); } })
        .catch(() => { /* Unknown states stay as plain labels, never a guessed case. */ })
        .finally(() => { if (!cancelled) setF2lLoading(false); });
    }
    return () => { cancelled = true; };
  }, [enabled, scramble, text, rowKeys]);

  const f2lLinks = new Map<number, Map<string, string>>();
  const libraryLinks = new Map<number, Map<string, string>>();
  if (enabled) rowKeys.forEach((key, index) => {
    const f2l = f2lLinkRows.get(key), library = libraryLinkRows.get(key);
    if (f2l) f2lLinks.set(index, f2l);
    if (library) libraryLinks.set(index, library);
  });
  const diagramAt = (index: number): ReactNode => {
    if (!enabled || !scramble.trim()) return null;
    const line = sourceLines[index] ?? '';
    const commentAt = line.indexOf('//');
    const label = commentAt < 0 ? '' : line.slice(commentAt + 2).trim();
    // Last-slot algorithms still involve the first two layers, even when their
    // names also mention OLL/PLL skips. Show their full pre-line state in 3D.
    const lastSlot = /\b(?:ZBLS|VLS|WV|SV)\b/i.test(label);
    const set = reconCommentLinks(line).map(link => link.href.split('/')[3])
      .find(value => value !== 'f2l');
    if (set && lineSetups[index]) return <LibraryLineDiagram setup={lineSetups[index]}
      set={set} sticker={libraryStickers.get(`${rowKeys[index]}:${set}`)} lastSlot={lastSlot} />;
    const f2l = cubeColorGroups(label).some(group => group.colors.length === 2) || /^F2L(?:[1-4])?\b/i.test(label);
    if (f2l && f2lDiagrams.has(rowKeys[index])) return <>{f2lDiagrams.get(rowKeys[index])!.map(({ colors, facelets }) =>
      <VisualCube key={colors} faceletColors={facelets} view="iso" size={28} local interactive enlargeable
        alt={tr({ zh: `执行此行前的 ${colors} F2L 状态`, en: `${colors} F2L state before this line` })} />)}</>;
    return null;
  };
  return { diagramAt, f2lLinks, f2lLoading, libraryLinks };
}

export function ReconLineDiagramProvider({ scramble, text, enabled, children }: {
  scramble: string; text: string; enabled: boolean;
  children: (diagramAt: (line: number) => ReactNode, caseHrefAt: (line: number, colors: string) => string | undefined) => ReactNode;
}) {
  const { diagramAt, f2lLinks, libraryLinks } = useReconLineDiagrams(scramble, text, enabled);
  return children(diagramAt, (line, key) => f2lLinks.get(line)?.get(key) ?? libraryLinks.get(line)?.get(key));
}
