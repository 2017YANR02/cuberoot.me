import { invertAlg } from '@cuberoot/shared/alg-transform';
import { normalizeReconMoveSuffixOrder } from '@cuberoot/shared/recon-completion';

export function invertPocketAlg(text: string): string {
  return invertAlg(normalizeReconMoveSuffixOrder(text));
}

// On a 2×2 a two-layer wide turn is an ordinary whole-cube rotation.
// Wide aliases remain valid in pasted text, but the keyboard offers x/y/z.
export function pocketKeyboardMove(sign: string): boolean {
  return /^[RLUDFBxyz]$/.test(sign);
}

export function pocketInvalidSpans(text: string): { text: string; bad?: boolean }[] | null {
  return layerInvalidSpans(text, 2);
}

export function layerInvalidSpans(text: string, order: 2 | 4): { text: string; bad?: boolean }[] | null {
  const spans: { text: string; bad?: boolean }[] = [];
  let end = 0;
  // Skip comments and attached finger annotations. Bracketed commutators still
  // contain moves and must be checked. Preserve offsets in the original draft.
  const tokens = /\/\/[^\n]*|\[[LR][1-5h]:[^\s\]]*\]|\)\d+|(?:(\d+)(?:-(\d+))?)?([RLUDFBrludfbMESmesxyz])w?(?:\d+['′’]?|['′’]\d*)?|\d+/g;
  for (const match of text.matchAll(tokens)) {
    const [, from, to, face] = match;
    if (!face) continue;
    const outsideCube = [from, to].some(layer => layer !== undefined && (Number(layer) < 1 || Number(layer) > order));
    if (!outsideCube && (order === 4 || !/^[MESmes]$/.test(face))) continue;
    if (match.index > end) spans.push({ text: text.slice(end, match.index) });
    spans.push({ text: match[0], bad: true });
    end = match.index + match[0].length;
  }
  if (!spans.length) return null;
  if (end < text.length) spans.push({ text: text.slice(end) });
  return spans;
}
