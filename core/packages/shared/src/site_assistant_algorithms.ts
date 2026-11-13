import type { AlgCase, AlgFile } from './alg_types';
import { requires3x3AlgCaseSetup, type AlgPuzzle } from './alg_catalog';
import { isAssistantAlgorithms, type AssistantAlgorithmCard, type AssistantAnswer } from './site_assistant';

/** The library and replies select from the same primary formula group. */
export function assistantAlgorithmSelection(c: AlgCase, puzzle: string, set: string, alternative: number) {
  const entries = c.algs[0]?.filter(entry => entry.alg.trim()) ?? [];
  const entry = entries[alternative];
  if (!entry) return undefined;
  return {alg: entry.alg, setup: entry.setup ?? (requires3x3AlgCaseSetup(puzzle, set) ? c.setup : undefined),
    sticker: c.sticker, alternative, alternativeCount: entries.length};
}

export function nextAssistantAlgorithm(data: AlgFile, current: AssistantAlgorithmCard): AssistantAlgorithmCard {
  if (data.puzzle !== current.puzzle || data.set !== current.set || current.caseId === undefined) throw new Error('Mismatched algorithm library');
  const c = data.cases.find(item => item.id === current.caseId);
  if (!c) throw new Error('Algorithm case unavailable');
  const first = assistantAlgorithmSelection(c, current.puzzle, current.set, 0);
  if (!first) throw new Error('Algorithm unavailable');
  // Locate the saved formula after library edits/reordering. A removed formula
  // starts at the first; its old index must not select a different case.
  let found = -1;
  for (let i = 0; i < first.alternativeCount; i++) {
    const entry = assistantAlgorithmSelection(c, current.puzzle, current.set, i)!;
    if (entry.alg === current.alg && entry.setup === current.setup) { found = i; break; }
  }
  const selection = assistantAlgorithmSelection(c, current.puzzle, current.set, (found + 1) % first.alternativeCount)!;
  return {...current, ...selection};
}

/** Per-surface cache: coalesces requests, bounds memory and never caches failure. */
export function createAssistantAlgorithmLoader(load: (puzzle: AlgPuzzle, set: string) => Promise<AlgFile>) {
  const cache = new Map<string, {expires: number; file: Promise<AlgFile>}>();
  return async (card: AssistantAlgorithmCard) => {
    const key = `${card.puzzle}/${card.set}`;
    let entry = cache.get(key);
    if (entry && entry.expires <= Date.now()) { cache.delete(key); entry = undefined; }
    if (!entry) {
      const file = Promise.resolve().then(() => load(card.puzzle, card.set));
      entry = {expires: Date.now() + 300_000, file};
      cache.set(key, entry);
      while (cache.size > 8) cache.delete(cache.keys().next().value!);
    }
    try { return nextAssistantAlgorithm(await entry.file, card); }
    catch (error) { if (cache.get(key)===entry) cache.delete(key); throw error; }
  };
}

/** Immutable update shared by Web and mini programs. An obsolete async result
 * cannot overwrite a newer selection or a replacement conversation. */
export function replaceAssistantAlgorithm(answer: AssistantAnswer, artifactIndex: number, cardIndex: number,
  expected: AssistantAlgorithmCard, next: AssistantAlgorithmCard): AssistantAnswer {
  const artifact = answer.artifacts?.[artifactIndex];
  if (artifact?.kind !== 'algorithms' || artifact.cards[cardIndex] !== expected) return answer;
  if (next.puzzle !== expected.puzzle || next.set !== expected.set || next.caseId !== expected.caseId) throw new Error('Mismatched algorithm case');
  const updated = {...artifact, cards: artifact.cards.map((card, i) => i === cardIndex ? next : card)};
  if (!isAssistantAlgorithms(updated)) throw new Error('Invalid algorithm card');
  return {...answer, artifacts: answer.artifacts!.map((item, i) => i === artifactIndex ? updated : item)};
}
