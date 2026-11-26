import type { PracticeRole } from './replay-training-session';
import type { TrainerSolve } from './trainer-store';

export type RetestPlan = {
  since?: number;
  previous?: {at: number; caseName: string; before: string[]; after: string[]}[];
  group?: string;
  before?: string[];
  afterAt?: number;
  after?: string[];
  manualBefore?: string;
  manualAfter?: string;
  manual?: boolean;
};
type Sample = TrainerSolve & { practiceSample: NonNullable<TrainerSolve['practiceSample']> };

export function practiceGroups(solves: TrainerSolve[], owner: string, exactCase?: string, scope?: string, role: PracticeRole = 'retest') {
  const groups = new Map<string, Sample[]>();
  const seen = new Set<string>();
  for (const solve of solves) {
    const sample = solve.practiceSample;
    if (!sample?.id || sample.owner !== owner || (exactCase !== undefined && solve.caseKey !== exactCase) ||
      !Number.isFinite(sample.startedAt) || seen.has(sample.id)) continue;
    if (sample.replay ? sample.replay.scope !== scope || sample.replay.role !== role : role === 'recorded') continue;
    seen.add(sample.id);
    const identity = [solve.caseKey, sample.clock, sample.conditions];
    if (sample.replay) identity.push(sample.replay.scope);
    const key = JSON.stringify(identity);
    const group = groups.get(key) ?? [];
    group.push(solve as Sample);
    groups.set(key, group);
  }
  for (const group of groups.values()) group.sort((a, b) => a.practiceSample.startedAt - b.practiceSample.startedAt);
  return groups;
}

export function retestWindows(group: Sample[], plan: RetestPlan) {
  const ids = (rows: Sample[]) => rows.map(row => row.practiceSample.id);
  const since = plan.since ?? 0;
  const before = plan.before ?? ids(group.filter(row => row.practiceSample.startedAt >= since).slice(-5));
  const after = plan.after ?? (plan.afterAt === undefined ? [] : ids(group.filter(row =>
    row.practiceSample.startedAt >= plan.afterAt! && !before.includes(row.practiceSample.id)).slice(0, 5)));
  const times = (selection: string[]) => selection.flatMap(id => {
    const row = group.find(item => item.practiceSample.id === id);
    if (!row) return [];
    if (row.penalty === 'DNF') return ['DNF'];
    return [((row.ms + (row.penalty === '+2' ? 2000 : 0)) / 1000).toFixed(3)];
  });
  return {before, after, beforeTimes: times(before), afterTimes: times(after)};
}
