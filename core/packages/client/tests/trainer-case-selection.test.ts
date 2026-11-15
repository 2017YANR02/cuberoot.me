import { expect, it } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';
import { caseKeysFromIds } from '@/lib/trainer-case-key';
import { retiredAlgTrainerHref } from '@/lib/timer-training-catalog';
import { trainingSearchParams } from '@/lib/timer-training-location';

const cases = [
  { id: 11, subgroup: 'T', name: 'TU2' },
  { id: 12, subgroup: 'T', name: 'TU3' },
  { id: 21, subgroup: 'U', name: 'UU2' },
  { id: 22, subgroup: 'U', name: 'UU3' },
] as AlgCase[];

it('selects only the requested library IDs across subgroups, without duplicates', () => {
  expect(caseKeysFromIds(cases, '11,21,11')).toEqual(['T|TU2', 'U|UU2']);
  expect(caseKeysFromIds(cases, null)).toBeNull();
});

it('does not broaden an empty, malformed or stale explicit selection', () => {
  for (const ids of ['', '9999', 'NaN,-1,0,1.1,11abc']) expect(caseKeysFromIds(cases, ids)).toEqual([]);
  expect(caseKeysFromIds(cases, '9999,12')).toEqual(['T|TU3']);
});

it('preserves the selected cases when the trainer link maps into the timer', () => {
  const href = retiredAlgTrainerHref('/alg/3x3/zbll/run?cases=11%2C21&mode=train');
  const url = new URL(href, 'https://example.test');
  expect(url.pathname).toBe('/timer');
  const search = trainingSearchParams(url.searchParams);
  expect(search.get('cases')).toBe('11,21');
  expect(search.get('mode')).toBe('train');
  expect(caseKeysFromIds(cases, search.get('cases'))).toEqual(['T|TU2', 'U|UU2']);
});
