import type { AlgFile } from '@cuberoot/shared/alg';
import { algCaseDetailHref, buildCaseSlugMap } from '@cuberoot/shared/recon/alg-case-link';
import { pllCommentName, primaryCaseName } from '@cuberoot/shared/recon/alg-case-display';
import { assistantAlgorithmSelection } from '@cuberoot/shared/site-assistant-algorithms';
import type { CfopFormulaFocus, CfopFormulaTarget } from '@cuberoot/timer-ui/reconstruct/cfop-diagnosis';
import { caseKey } from './trainer-case-key';
import { findPreferredAlg, preferredAlgSlot } from './alg-preferred-algs';

function pllKey(name: string) {
  return pllCommentName(name.trim().replace(/^PLL[ -]+/i, '')).toLowerCase();
}

export function replayFormulaCard(data: AlgFile, target: CfopFormulaTarget, preferences: Readonly<Record<string, string>>) {
  const { set } = target;
  if (data.puzzle !== '3x3' || data.set !== set) return;
  const matches = data.cases.filter(item => set === 'zbll' ? [item.meta?.ollcp, item.name].includes(target.caseName) : set === 'oll'
    ? item.name.trim() === target.caseName
    : [item.name, item.meta?.ollcp].some(name => name && pllKey(name) === pllKey(target.caseName)));
  if (matches.length !== 1) return;
  const [item] = matches;
  const caseId = item.id;
  if (caseId === undefined || !Number.isSafeInteger(caseId) || caseId < 1) return;
  const slug = buildCaseSlugMap(data.cases, set).byId.get(caseId);
  if (!slug) return;
  const entries = item.algs[0]?.filter(entry => entry.alg.trim()) ?? [];
  const preferred = findPreferredAlg(entries, preferences[preferredAlgSlot(item)]);
  const formula = assistantAlgorithmSelection(item, '3x3', set, preferred ? entries.indexOf(preferred) : 0);
  if (!formula) return;
  return {
    ...formula, caseId, trainerKey: caseKey(item), puzzle: '3x3' as const, set, name: primaryCaseName('3x3', set, item),
    href: algCaseDetailHref('3x3', set, slug),
  };
}

export function replayFormulaTrainingHref(set: CfopFormulaTarget['set'], caseId: number, focus: CfopFormulaFocus) {
  const query = new URLSearchParams({ cases: String(caseId), mode: focus === 'recognition' ? 'memo' : 'train' });
  if (focus === 'recognition') query.set('draw', 'train');
  return `/alg/3x3/${set}/run?${query}`;
}

export const replayRetestAttempts = 5;

export function summarizeReplayRetest(input: string) {
  const entries = input.normalize('NFKC').trim().split(/[\s,，、]+/).filter(Boolean);
  const validTime = /^(?:\d+(?:\.\d{1,3})?|\.\d{1,3})$/;
  const seconds = entries.filter(value => value.toUpperCase() !== 'DNF');
  const invalid = entries.length > replayRetestAttempts || seconds.some(value => !validTime.test(value) || Number(value) <= 0 || Number(value) > 3600);
  const completed = !invalid && entries.length === replayRetestAttempts;
  const times = seconds.map(value => Math.round(Number(value) * 1000)).sort((left, right) => left - right);
  const middle = Math.floor(times.length / 2);
  const medianMs = completed && times.length >= 3
    ? times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2
    : null;
  return { invalid, completed, correct: seconds.length, medianMs };
}

/** Match a verified, cross-down stage against the same library the trainer opens. */
export async function verifiedPracticeFormula(set: 'oll' | 'pll', setup: string, library: AlgFile) {
  const [{findPhotoAlg}, {applyScramble, toFaceletString}, {isF2l, isOll, isSolved}] = await Promise.all([
    import('@cuberoot/shared/cube-photo/lookup'), import('@cuberoot/shared/timer/reconstruct/state'),
    import('@cuberoot/shared/timer/reconstruct/cfop-detect'),
  ]);
  const state = applyScramble(3, setup);
  if (!isF2l(state) || (set === 'oll' ? isOll(state) : !isOll(state) || isSolved(state))) return;
  const faces = toFaceletString(state);
  const centers = Object.fromEntries(Array.from('URFDLB', (face, i) => [faces[9*i + 4], face]));
  const match = findPhotoAlg(Array.from(faces, color => centers[color]).join(''), set, library);
  return match?.caseId ? {set, caseName: match.caseName} : undefined;
}
