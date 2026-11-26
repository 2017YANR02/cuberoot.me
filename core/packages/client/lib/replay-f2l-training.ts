import type { ReplayF2lCases } from '@cuberoot/shared/site-assistant-replay';
import type { ReplayPairTrainingInput } from '@cuberoot/timer-ui/reconstruct-report';
import { resolveCaseSlug } from './alg_case_link';
import { loadLibrarySource } from './alg-library-cache';
import { f2lCaseIndex } from './recon-f2l-links';
import { replayFormulaCard } from './replay-formula-training';
import { caseKey } from './trainer-case-key';

export async function recordedPairCase(fingerprint: string) {
  for (const set of ['f2l', 'adv-f2l'] as const) {
    const file = await loadLibrarySource('3x3', set);
    const matches = f2lCaseIndex(file, set).get(fingerprint);
    if (!matches) continue;
    if (matches.size !== 1) return;
    const slug = [...matches][0].split('/').at(-1)!;
    const item = resolveCaseSlug(file.cases, slug, '3x3', set);
    if (item?.id) return { set, id: item.id, name: item.name };
    return;
  }
}

export async function replayRetestCase(key?: string) {
  if (!key) return;
  const file = await loadLibrarySource('3x3', 'f2l');
  const matches = file.cases.filter(item => caseKey(item) === key);
  if (matches.length === 1 && matches[0].id) return { set: 'f2l' as const, id: matches[0].id, name:matches[0].name };
}

async function recordedTrainingCase(input: ReplayPairTrainingInput): Promise<ReplayF2lCases['recorded']> {
  if (input.fingerprint) {
    const pair = await recordedPairCase(input.fingerprint);
    return pair && {set: pair.set, id: pair.id};
  }
  if (input.formula) {
    const file = await loadLibrarySource('3x3', input.formula.set);
    const card = replayFormulaCard(file, input.formula, {});
    return card && {set: card.set, id: card.caseId};
  }
}

export async function replayF2lTrainingCases(input: ReplayPairTrainingInput): Promise<ReplayF2lCases> {
  const [recorded, retest] = await Promise.all([
    recordedTrainingCase(input).catch(() => undefined),
    replayRetestCase(input.retestCaseKey).catch(() => undefined),
  ]);
  return { recorded, retest: retest && {set:retest.set, id:retest.id} };
}
