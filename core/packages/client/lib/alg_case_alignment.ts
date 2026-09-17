import { loadAlg as loadSourceAlg, isMergedOhCmllEntry, type AlgCase, type AlgEntry, type AlgFile, type AlgPuzzle } from '@cuberoot/shared/alg';
import { duplicateAlgKey } from '@cuberoot/shared/alg-notation';
import { adjacentUEdits, applyAlgTextEdits, displayCaseScramble, oriAdjustSetup, uTurnOrder } from '@/lib/alg_display';
import { CUBE_ORIENTATIONS } from '@/lib/alg_goals';
import { setupForCase, validateAlgCase, validateStoredAlgCase } from '@/lib/alg_validation';
import { algHtmlText, editAlgHtmlText } from '@/lib/alg_html';
import { normalizeAlg } from '@/lib/alg_normalize';
import { tr } from '@/i18n/tr';
import { cacheAlignedOhEntries, ohAlgsForCase, supportsOhHands } from '@/lib/alg_oh_hand';

// Local presentation metadata must never be written back as source data.
const ISSUE = Symbol('case-alignment-issue');
const SOURCE = Symbol('case-alignment-source');
const CANONICAL_CASE = Symbol('canonical-case-state');
const SOURCE_CASE = Symbol('case-alignment-source-case');
const COEP = Symbol('aligned-coep');
type CheckedCase = AlgCase & { [CANONICAL_CASE]?: true; [SOURCE_CASE]?: AlgCase; [COEP]?: AlgEntry };
type CheckedEntry = AlgEntry & { [ISSUE]?: string; [SOURCE]?: AlgEntry };
export function sourceAlgCase(c: AlgCase): AlgCase {
  return (c as CheckedCase)[SOURCE_CASE] ?? c;
}
export function caseCoepEntry(c: AlgCase): AlgEntry | undefined {
  return (c as CheckedCase)[COEP];
}
export function sourceCaseEntry(entry: AlgEntry): AlgEntry {
  return (entry as CheckedEntry)[SOURCE] ?? entry;
}
export function sourceCaseAlg(entry: AlgEntry): string {
  return sourceCaseEntry(entry).alg;
}
export function caseAlgIssue(entry: AlgEntry): string | undefined {
  return (entry as CheckedEntry)[ISSUE];
}

function simplifyEntry(puzzle: AlgPuzzle, entry: AlgEntry): AlgEntry {
  const order = uTurnOrder(puzzle);
  if (!order) return entry;
  return { ...entry,
    alg: applyAlgTextEdits(entry.alg, adjacentUEdits(entry.alg, order)),
    algHtml: entry.algHtml ? editAlgHtmlText(entry.algHtml, adjacentUEdits(algHtmlText(entry.algHtml), order)) : undefined,
  };
}

/** The thumbnail, scramble, player and every alternative share this state. */
export function commonCaseSetup(puzzle: AlgPuzzle, set: string, c: AlgCase, ori = 0): string {
  // CS/CSP diagrams have always used the first solution's inverse because
  // scraped setups can omit a shape-changing initial layer adjustment.
  const shape = !(c as CheckedCase)[CANONICAL_CASE] && puzzle === 'sq1' && (set === 'cs' || set === 'csp');
  const base = (c as CheckedCase)[CANONICAL_CASE]
    ? c.setup
    : setupForCase(puzzle, shape ? '' : c.setup, c.algs[0]?.[0]?.alg);
  return displayCaseScramble(puzzle, set, oriAdjustSetup(base, ori));
}

function adjustments(puzzle: AlgPuzzle): string[] {
  if (puzzle === 'sq1') {
    const turns = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6];
    return ['', ...turns.flatMap(u => turns.map(d => `(${u},${d})`))];
  }
  if (puzzle === '2x2') {
    return CUBE_ORIENTATIONS.flatMap(rotation => ['', 'U', "U'", 'U2']
      .map(u => [rotation, u].filter(Boolean).join(' ')));
  }
  if (puzzle === 'skewb') return CUBE_ORIENTATIONS;
  if (puzzle === 'megaminx') return ['', 'U', "U'", 'U2', "U2'"];
  if (puzzle === 'pyraminx') return ['', 'U', "U'"];
  if (puzzle === 'fto') return ['', 'U', "U'", 'Uo', "Uo'", 'Uo U', "Uo U'", "Uo' U", "Uo' U'"];
  return ['', 'U', "U'", 'U2'];
}

/**
 * Align source alternatives to the public case, never to their own inverse.
 * Only verified starting adjustments and the validator's finishing adjustment
 * may be added. Unrelated/incorrect source algorithms remain explicit failures.
 */
export async function alignCaseEntry(
  puzzle: AlgPuzzle, set: string, c: AlgCase, entry: AlgEntry, ori = 0,
): Promise<AlgEntry> {
  const setup = commonCaseSetup(puzzle, set, c, ori);
  let html = entry.algHtml;
  if (html) {
    try {
      // Stale rich text must not override the verified move sequence. Preserve
      // the original markup in SOURCE for editing; render plain moves instead.
      if (normalizeAlg(puzzle, algHtmlText(html)) !== normalizeAlg(puzzle, entry.alg)) html = undefined;
    } catch { html = undefined; }
  }
  let reason = '';
  for (const prefix of adjustments(puzzle)) {
    const alg = [prefix, entry.alg].filter(Boolean).join(' ');
    const result = await validateAlgCase(setup, alg, c.sticker, puzzle, set);
    if (!result.ok) { reason ||= result.reason ?? ''; continue; }
    let suffix = result.auf ?? '';
    let completed = [alg, suffix].filter(Boolean).join(' ');
    let stored = await validateStoredAlgCase(setup, completed, c.sticker, puzzle, set);
    if (!stored.ok && puzzle === 'sq1') {
      for (const tail of adjustments(puzzle)) {
        const candidate = [alg, tail].filter(Boolean).join(' ');
        stored = await validateStoredAlgCase(setup, candidate, c.sticker, puzzle, set);
        if (stored.ok) { suffix = tail; completed = candidate; break; }
      }
    }
    if (!stored.ok) { reason ||= stored.reason ?? ''; continue; }
    const completedEntry = simplifyEntry(puzzle, {
      ...entry,
      [SOURCE]: sourceCaseEntry(entry),
      setup,
      alg: completed,
      algHtml: html ? [prefix, html, suffix].filter(Boolean).join(' ') : undefined,
      [ISSUE]: undefined,
    } as CheckedEntry);
    // Reduction changes presentation and finger markup, but must preserve the
    // actual puzzle transformation at this case's fixed starting state.
    if (!(await validateStoredAlgCase(setup, completedEntry.alg, c.sticker, puzzle, set)).ok) {
      throw new Error(`U reduction changed the solution: ${puzzle}/${set} ${c.name}`);
    }
    return completedEntry;
  }
  return { ...entry, setup, algHtml: html, [SOURCE]: sourceCaseEntry(entry), [ISSUE]: reason || tr({
    zh: '原公式与本图不匹配，无法通过起手调整对齐',
    en: 'The source algorithm does not match this case after starting adjustments',
  }) } as CheckedEntry;
}

const fileCache = new WeakMap<AlgFile, Promise<AlgFile>>();
export function alignAlgFile(file: AlgFile): Promise<AlgFile> {
  const cached = fileCache.get(file);
  if (cached) return cached;
  const pending = prepareFile(file).then(result => {
    fileCache.set(result, Promise.resolve(result));
    return result;
  });
  fileCache.set(file, pending);
  return pending;
}

async function prepareFile(file: AlgFile): Promise<AlgFile> {
  const puzzle = file.puzzle as AlgPuzzle;
  const cases: AlgCase[] = [];
  let checked = 0;
  for (const c of file.cases) {
    if ((c as CheckedCase)[CANONICAL_CASE]) { cases.push(c); continue; }
    const setup = commonCaseSetup(puzzle, file.set, c);
    const aligned: CheckedCase = { ...c, setup, algs: [], [CANONICAL_CASE]: true, [SOURCE_CASE]: sourceAlgCase(c) };
    for (let oi = 0; oi < c.algs.length; oi++) {
      const entries: AlgEntry[] = [];
      for (const entry of c.algs[oi]) {
        const result = await alignCaseEntry(puzzle, file.set, aligned, entry, oi);
        const duplicate = isMergedOhCmllEntry(entry) && !caseAlgIssue(result)
          ? entries.find(e => !caseAlgIssue(e) && duplicateAlgKey(e.alg) === duplicateAlgKey(result.alg)) : undefined;
        if (duplicate) {
          // The source remains in OH CMLL; the combined view keeps one row with all tags.
          duplicate.tags = [...new Set([...(duplicate.tags ?? []), ...(result.tags ?? [])])];
        } else entries.push(result);
        // Long sets must leave time for input and the loading indicator to paint.
        if (++checked % 32 === 0 && typeof window !== 'undefined') {
          await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
      }
      aligned.algs.push(entries);
    }
    if (c.meta?.coep?.alg) {
      aligned[COEP] = await alignCaseEntry(puzzle, file.set, aligned, { alg: c.meta.coep.alg });
    }
    cases.push(aligned);
  }
  if (supportsOhHands(puzzle, file.set)) {
    const sourceCases = file.cases.map(sourceAlgCase);
    for (const c of cases) for (let oi = 0; oi < c.algs.length; oi++) {
      const aligned = [];
      for (const entry of ohAlgsForCase(sourceAlgCase(c), sourceCases, oi, 'right')) {
        aligned.push(await alignCaseEntry(puzzle, file.set, c, entry, oi));
      }
      cacheAlignedOhEntries(c, oi, aligned);
    }
  }
  return { ...file, cases };
}

/** Client library entry point; source loading remains shared with other runtimes. */
export async function loadAlg(puzzle: AlgPuzzle, set: string, opts?: { fresh?: boolean }): Promise<AlgFile> {
  return alignAlgFile(await loadSourceAlg(puzzle, set, opts));
}

/** Unmatched source rows stay visible in the library but cannot become exercises. */
export async function loadTrainingAlg(puzzle: AlgPuzzle, set: string): Promise<AlgFile> {
  const file = await loadAlg(puzzle, set);
  return { ...file, cases: file.cases.map(c => ({
    ...c, algs: c.algs.map(entries => entries.filter(entry => !caseAlgIssue(entry))),
  })).filter(c => c.algs.every(entries => entries.length > 0)) };
}
