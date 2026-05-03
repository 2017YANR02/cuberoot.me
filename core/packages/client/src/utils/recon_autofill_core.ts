/**
 * Pure (DOM-free) core of recon autofill — extracted from ReconAutofill.tsx so
 * it can be unit-tested. The React component handles popup rendering and
 * keyboard wiring; this module handles the cube-state → suggestions logic.
 */

import type { KPattern } from 'cubing/kpuzzle';
import { patternFromAlg, isAlgPrefix, simplifyAlg } from './cube3';
import {
  detectStage, defaultCentersRotation, crossOnDRotation,
  evaluateCanonical, F2L_SLOT_DEFS,
} from './stage_detect';
import { lookupF2lAlgs } from './f2l_lookup';
import { lookupOllAlgs } from './oll_lookup';
import { lookupPllAlgs } from './pll_lookup';
import type { AlgdbCategory } from '@cuberoot/shared/algdb';

/** Strip comments + paren grouping, return a string with only move tokens. */
export function movesOnly(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const i = line.indexOf('//');
      return (i >= 0 ? line.substring(0, i) : line);
    })
    .join(' ')
    // Strip anything that isn't a valid alg-token char. Catches parens,
    // regrip arrows (↑↓), middle dot (·), ellipsis (... / …), and any other
    // annotation. Kept: ASCII letters / digits / apostrophe / whitespace.
    .replace(/[^A-Za-z0-9'\s]/g, ' ')
    // cubing.js's Alg parser rejects merged tokens like `U'D`, `U2D`, `RD`,
    // `R2'F`, `Rw'D`. A silent parse-fail downstream falls back to the solved
    // cube and breaks autofill (sees "all slots solved" → 0 hints). Insert a
    // space between two move letters, after `'` before letter, and after digit
    // before letter. `w` is excluded from the letter set so wide moves (`Rw`,
    // `Uw'`) stay intact.
    .replace(/([UDFBLRMESxyzudfblr])(?=[UDFBLRMESxyzudfblr])/g, '$1 ')
    .replace(/(')(?=[A-Za-z])/g, '$1 ')
    .replace(/(\d)(?=[A-Za-z])/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lineRange(text: string, idx: number): { start: number; end: number } {
  let s = idx;
  while (s > 0 && text[s - 1] !== '\n') s--;
  let e = idx;
  while (e < text.length && text[e] !== '\n') e++;
  return { start: s, end: e };
}

export interface AlgSuggestion {
  text: string;
  category: AlgdbCategory;
  caseName: string;
  score: number;
}

/**
 * Result of `suggestAlg`. `kind: 'ok'` carries the suggestions; `kind: 'empty'`
 * carries an i18n key explaining WHY no suggestion is available, so the popup
 * can show that to the user instead of just silently doing nothing.
 *
 * `null` is reserved for "no popup at all" (e.g. caret is in a comment, so
 * we shouldn't even try).
 */
export type SuggestResult =
  | { kind: 'ok'; suggestions: AlgSuggestion[] }
  | { kind: 'empty'; reasonKey: string };

export async function suggestAlg(
  scramble: string,
  value: string,
  caret: number,
): Promise<SuggestResult | null> {
  const { start } = lineRange(value, caret);
  const lineUpToCaret = value.substring(start, caret);
  if (lineUpToCaret.includes('//')) return null;

  const linesBefore = value.substring(0, start);
  const prevMoves = movesOnly(linesBefore);
  const lineMovesUpToCaret = movesOnly(value.substring(start, caret));
  const startStateAlg = [scramble, prevMoves].filter(Boolean).join(' ');
  const startState = await patternFromAlg(startStateAlg);

  const stageInfo = await detectStage(startState);
  let category: AlgdbCategory;
  if (stageInfo.stage === 'solved') return { kind: 'empty', reasonKey: 'recon.autofill.empty.solved' };
  else if (stageInfo.stage === 'oll') category = 'pll';
  else if (stageInfo.stage === 'f2l') category = 'oll';
  else if (
    stageInfo.stage === 'cross' || stageInfo.stage === 'xcross'
    || stageInfo.stage === 'xxcross' || stageInfo.stage === 'xxxcross'
  ) category = 'f2l';
  else if (stageInfo.stage === 'pscross') return { kind: 'empty', reasonKey: 'recon.autofill.empty.pscross' };
  else return { kind: 'empty', reasonKey: 'recon.autofill.empty.no_cross' };

  const scored: AlgSuggestion[] = [];

  // F2L fingerprints are geometric and only require cross-on-D (not default
  // centers) — so for color-neutral solves we route through crossOnDRotation.
  // OLL/PLL fingerprints depend on absolute face indices, so they still need
  // default centers (limits OLL/PLL suggestions to yellow-cross solves for now).
  const f2lRot = category === 'f2l'
    ? await crossOnDRotation(startState)
    : await defaultCentersRotation(startState);
  const canonRot = f2lRot;
  const startCanonical = canonRot ? startState.applyAlg(canonRot) : startState;

  // Track WHY no candidates are produced so we can return a useful reason.
  let lookupHadEntries = false;
  let prefixFilteredOutAll = true;

  if (category === 'f2l') {
    const preEval = evaluateCanonical(startCanonical);
    if (!preEval.crossOk) return { kind: 'empty', reasonKey: 'recon.autofill.empty.no_cross' };
    const solvedSet = new Set(preEval.solvedSlots);
    for (let slotIdx = 0; slotIdx < F2L_SLOT_DEFS.length; slotIdx++) {
      const slotId = F2L_SLOT_DEFS[slotIdx].id;
      if (solvedSet.has(slotId)) continue;
      const entries = await lookupF2lAlgs(startCanonical, slotIdx);
      if (entries.length > 0) lookupHadEntries = true;
      for (const e of entries) {
        const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
        if (!rawAlg) continue;
        if (!isAlgPrefix(lineMovesUpToCaret, rawAlg)) continue;
        prefixFilteredOutAll = false;
        let post: KPattern;
        try { post = startState.applyAlg(rawAlg); } catch { continue; }
        const postInfo = await detectStage(post);
        if (!postInfo.solvedSlots.includes(slotId)) continue;
        let preserved = true;
        for (const prevSlot of preEval.solvedSlots) {
          if (!postInfo.solvedSlots.includes(prevSlot)) { preserved = false; break; }
        }
        if (!preserved) continue;
        scored.push({ text: rawAlg, category: 'f2l', caseName: e.caseName, score: 100 - rawAlg.length * 0.01 });
      }
    }
  } else {
    const entries = category === 'oll'
      ? await lookupOllAlgs(startCanonical)
      : await lookupPllAlgs(startCanonical);
    if (entries.length > 0) lookupHadEntries = true;
    const goalSolved = category === 'pll';
    for (const e of entries) {
      const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
      if (!rawAlg) continue;
      if (!isAlgPrefix(lineMovesUpToCaret, rawAlg)) continue;
      prefixFilteredOutAll = false;
      let post: KPattern;
      try { post = startState.applyAlg(rawAlg); } catch { continue; }
      const postInfo = await detectStage(post);
      const ok = goalSolved
        ? postInfo.stage === 'solved'
        : (postInfo.stage === 'oll' || postInfo.stage === 'solved');
      if (!ok) continue;
      scored.push({ text: rawAlg, category, caseName: e.caseName, score: 100 - rawAlg.length * 0.01 });
    }
  }

  const seenText = new Set<string>();
  scored.sort((a, b) => b.score - a.score);
  const top: AlgSuggestion[] = [];
  for (const c of scored) {
    if (c.score <= 0) continue;
    if (seenText.has(c.text)) continue;
    seenText.add(c.text);
    top.push(c);
    if (top.length >= 12) break;
  }
  if (top.length === 0) {
    let reasonKey: string;
    if (!lookupHadEntries) {
      reasonKey = `recon.autofill.empty.no_algdb_match.${category}`;
    } else if (prefixFilteredOutAll && lineMovesUpToCaret.length > 0) {
      reasonKey = 'recon.autofill.empty.prefix_no_match';
    } else {
      reasonKey = `recon.autofill.empty.no_algdb_match.${category}`;
    }
    return { kind: 'empty', reasonKey };
  }
  return { kind: 'ok', suggestions: top };
}
