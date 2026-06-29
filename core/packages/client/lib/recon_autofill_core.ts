/**
 * Pure (DOM-free) core of recon autofill — extracted from ReconAutofill.tsx so
 * it can be unit-tested. The React component handles popup rendering and
 * keyboard wiring; this module handles the cube-state → suggestions logic.
 */

import type { KPattern } from 'cubing/kpuzzle';
import { patternFromAlg, isAlgPrefix, simplifyAlg } from './cube3';
import {
  detectStage, crossOnDRotation,
  evaluateCanonical, F2L_SLOT_DEFS, F2L_SLOTS_BY_FACE, topEdgesOriented,
} from './stage_detect';
import { lookupF2lAlgsRobust } from './f2l_lookup';
import { lookupOllAlgs } from './oll_lookup';
import { lookupPllAlgs } from './pll_lookup';
import { lookupZbllAlgsRobust } from './zbll_lookup';
import { lookupZblsAlgs, lookupZblsAlgsBrute } from './zbls_lookup';
import { F2L_SLOT_DEFS as _SLOTS_FOR_BRUTE } from './stage_detect';
import type { Alg3x3Set } from '@cuberoot/shared/alg';

/** Invert a space-separated move sequence (reverse order + flip each move). */
function invertSeq(seq: string): string {
  return seq.trim().split(/\s+/).filter(Boolean).reverse().map(tok => {
    const m = /^([A-Za-z]+)(\d*)('?)$/.exec(tok);
    if (!m) return tok;
    const [, base, digit, prime] = m;
    if (digit === '2') return base + '2';           // 自反,方向无关
    return base + digit + (prime ? '' : "'");        // 翻转方向
  }).join(' ');
}

/**
 * Expand grouped repeats so cubing.js sees plain moves:
 *   `(R' F R F')2` → `R' F R F' R' F R F'`、`(R U)2'` → 逆序重复、`(R U)` → 去括号。
 * 不展开会被下面的 paren-strip 砍成悬空数字 `R' F R F' 2`,cubing.js 解析失败 → 整条建议失效。
 * 循环处理一层嵌套(由内向外),非贪婪匹配最内层 `(...)`。
 */
function expandGroups(text: string): string {
  let cur = text;
  for (let guard = 0; guard < 8; guard++) {
    const next = cur.replace(/\(([^()]*)\)\s*(\d*)\s*('?)/g, (_m, inner: string, countStr: string, prime: string) => {
      const count = countStr ? parseInt(countStr, 10) : 1;
      const seq = prime ? invertSeq(inner) : inner.trim();
      return Array.from({ length: Math.max(0, count) }, () => seq).join(' ');
    });
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/** Strip comments + paren grouping, return a string with only move tokens. */
export function movesOnly(text: string): string {
  return expandGroups(text
    .split('\n')
    .map(line => {
      const i = line.indexOf('//');
      return (i >= 0 ? line.substring(0, i) : line);
    })
    .join(' '))
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

/** cross 已建立的阶段(非 none / 非 pscross)。 */
function crossDone(stage: string): boolean {
  return stage !== 'none' && stage !== 'pscross';
}

/**
 * 「cancel into」prev 修正:计算用于解读「当前行」的 effective prev pattern。
 *
 * 正常每行结尾 cross 都在;但 cancel-into 行会故意留一两步、把 cross 边翻上去,靠下一行首动
 * 抵消补回 —— 于是上一行结尾 cross 是断的。这种情况下,直接拿「scramble+prevMoves」当 prev 会
 * 让下一行把"被 cancel 的那把"和"真正新解的那把"一起算成 xxcross。
 *
 * 修正:仅当①上一行结尾 cross 断了、且②再上一行结尾 cross 已建立(说明这是 cancel-into 而非
 * 还没拼出 cross)时,把当前行的前缀逐步并入 prev,直到 cross 复原 —— 此时被 cancel 的那把已
 * 计入 prev,当前行只会被记成真正新解的 pair。其余情况返回原始 prev。
 */
export async function resolveEffectivePrev(
  scramble: string,
  prevMoves: string,
  lineMoves: string,
  linesBefore: string,
): Promise<KPattern> {
  const prevPattern = await patternFromAlg([scramble, prevMoves].filter(Boolean).join(' '));
  const ps = await detectStage(prevPattern);
  if (crossDone(ps.stage)) return prevPattern;

  // 再上一行边界:linesBefore 去尾换行后,最后一个 '\n' 之前即"上一行之前"的全部内容。
  const lb = linesBefore.replace(/\n+$/, '');
  const lastNl = lb.lastIndexOf('\n');
  const beforePrev = lastNl >= 0 ? lb.substring(0, lastNl) : '';
  const beforePrevPattern = await patternFromAlg([scramble, movesOnly(beforePrev)].filter(Boolean).join(' '));
  if (!crossDone((await detectStage(beforePrevPattern)).stage)) return prevPattern;

  // cancel-into:并入当前行前缀,直到 cross 复原(被 cancel 的那把就在此刻补完)。
  const tokens = lineMoves.split(/\s+/).filter(Boolean);
  for (let k = 1; k <= tokens.length; k++) {
    const st = await patternFromAlg([scramble, prevMoves, tokens.slice(0, k).join(' ')].filter(Boolean).join(' '));
    if (crossDone((await detectStage(st)).stage)) return st;
  }
  return prevPattern;
}

export interface AlgSuggestion {
  text: string;
  category: Alg3x3Set;
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
  let category: Alg3x3Set;
  if (stageInfo.stage === 'solved') return { kind: 'empty', reasonKey: 'recon.autofill.empty.solved' };
  else if (stageInfo.stage === 'oll') category = 'pll';
  else if (stageInfo.stage === 'f2l') {
    // F2L done. If LL edges are already oriented (e.g. user did ZBLS / EOF2L)
    // skip OLL → suggest ZBLL (one alg to solve everything).
    category = topEdgesOriented(stageInfo.canonicalPattern) ? 'zbll' : 'oll';
  }
  else if (
    stageInfo.stage === 'cross' || stageInfo.stage === 'xcross'
    || stageInfo.stage === 'xxcross' || stageInfo.stage === 'xxxcross'
  ) category = 'f2l';
  else if (stageInfo.stage === 'pscross') return { kind: 'empty', reasonKey: 'recon.autofill.empty.pscross' };
  else return { kind: 'empty', reasonKey: 'recon.autofill.empty.no_cross' };

  const scored: AlgSuggestion[] = [];

  // Every fingerprint is geometric / center-relative, so a cross-on-D frame is
  // sufficient AND color-neutral for all stages: F2L/ZBLS are positional, OLL's
  // mask is relative to the U-center, PLL/ZBLL encode side stickers relative to
  // the centers. None require default (yellow-cross-on-D) centers, so we use the
  // same `crossOnDRotation` everywhere — a non-yellow cross (e.g. white-cross
  // solve) no longer flips the solved cross onto U and loses every OLL/PLL match.
  const canonRot = await crossOnDRotation(startState);
  const startCanonical = canonRot ? startState.applyAlg(canonRot) : startState;

  // Track WHY no candidates are produced so we can return a useful reason.
  let lookupHadEntries = false;
  let prefixFilteredOutAll = true;

  if (category === 'f2l') {
    // Identify the cross + already-solved pairs frame-invariantly via detectStage
    // (NOT crossOnDRotation): for a tilted / non-yellow solve two faces can both
    // momentarily look like a cross, and crossOnDRotation may pick the wrong one,
    // landing the lookup in a frame where the cross-on-D DB algs don't apply at
    // all — which is exactly what broke non-yellow F2L autofill. detectStage's
    // piece-identity choice matches the user's actual solve.
    const sInfo = await detectStage(startState);
    if (!crossDone(sInfo.stage)) return { kind: 'empty', reasonKey: 'recon.autofill.empty.no_cross' };
    const crossFace = sInfo.crossFaceHome;
    const solvedKeys = new Set(sInfo.solvedPairs.map(([c, e]) => `${c}.${e}`));
    const targets = F2L_SLOTS_BY_FACE[crossFace]
      .filter(p => !solvedKeys.has(`${p.corner}.${p.edge}`))
      .map(p => [p.corner, p.edge] as [number, number]);

    // Robust, color-neutral, rotation-aware F2L search in the user's RAW frame.
    // Returns ready-to-insert raw algs and flags those that also finish LL EO
    // (effectively a ZBLS / EOLS — tagged 'zbls' for the badge + score boost).
    const robust = await lookupF2lAlgsRobust(startState, {
      crossFace, prevPairs: sInfo.solvedPairs, targets,
    });
    if (robust.length > 0) lookupHadEntries = true;
    for (const e of robust) {
      if (!e.alg) continue;
      if (!isAlgPrefix(lineMovesUpToCaret, e.alg)) continue;
      prefixFilteredOutAll = false;
      const cat: Alg3x3Set = e.eoDone ? 'zbls' : 'f2l';
      const bonus = e.eoDone ? 5 : 0;
      scored.push({ text: e.alg, category: cat, caseName: e.caseName, score: 100 + bonus - e.alg.length * 0.01 });
    }

    // At xxxcross also query the dedicated ZBLS DB (EOLS-style algs that solve
    // the last slot AND orient LL edges but aren't in the F2L DB). These come
    // back in the cross-on-D canonical frame, so prefix canonRot for execution.
    if (sInfo.stage === 'xxxcross') {
      const preEval = evaluateCanonical(startCanonical);
      for (let slotIdx = 0; slotIdx < F2L_SLOT_DEFS.length; slotIdx++) {
        const slotId = F2L_SLOT_DEFS[slotIdx].id;
        if (preEval.solvedSlots.includes(slotId)) continue;
        let zblsEntries = await lookupZblsAlgs(startCanonical, slotIdx);
        if (zblsEntries.length === 0) {
          const prevSolvedEdgeSlots: number[] = [];
          for (const id of preEval.solvedSlots) {
            const def = _SLOTS_FOR_BRUTE.find(d => d.id === id);
            if (def) prevSolvedEdgeSlots.push(def.edgeSlot);
          }
          zblsEntries = await lookupZblsAlgsBrute(startCanonical, slotIdx, prevSolvedEdgeSlots);
        }
        if (zblsEntries.length > 0) lookupHadEntries = true;
        for (const e of zblsEntries) {
          const rawAlg = canonRot ? simplifyAlg(`${canonRot} ${e.alg}`) : e.alg;
          if (!rawAlg) continue;
          if (!isAlgPrefix(lineMovesUpToCaret, rawAlg)) continue;
          prefixFilteredOutAll = false;
          let post: KPattern;
          try { post = startCanonical.applyAlg(e.alg); } catch { continue; }
          const ev = evaluateCanonical(post);
          if (!ev.solvedSlots.includes(slotId)) continue;
          if (!preEval.solvedSlots.every(s => ev.solvedSlots.includes(s))) continue;
          if (!topEdgesOriented(post)) continue;
          scored.push({ text: rawAlg, category: 'zbls', caseName: e.caseName, score: 105 - rawAlg.length * 0.01 });
        }
      }
    }
  } else if (category === 'zbll') {
    // ZBLL: the fingerprint lookup was per-cross-colour (slow ~9.5s build) AND
    // missed non-yellow / tilted crosses entirely. Use the frame-invariant robust
    // search, which returns RAW-frame algs that actually solve the cube (verified
    // by piece identity) regardless of cross colour. crossFaceHome is only a hint
    // — it can be wrong for ambiguous LL states, so the search falls back to the
    // colour that genuinely solves.
    const robust = await lookupZbllAlgsRobust(startState, stageInfo.crossFaceHome);
    if (robust.length > 0) lookupHadEntries = true;
    for (const e of robust) {
      if (!e.alg) continue;
      if (!isAlgPrefix(lineMovesUpToCaret, e.alg)) continue;
      prefixFilteredOutAll = false;
      scored.push({ text: e.alg, category, caseName: e.caseName, score: 100 - e.alg.length * 0.01 });
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
