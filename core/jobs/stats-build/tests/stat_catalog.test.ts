import { describe, expect, it, vi } from 'vitest';
import {
  WCA_STAT_PAGE_IDS, WCA_STAT_DATA_ONLY_IDS, WCA_STAT_REMOVED_IDS,
  assertWcaStatRegistry, isWcaStatPage,
} from '@cuberoot/shared/wca-stat-catalog';
import { REGISTRY } from '../src/bin/compute.js';
import { buildStatIndex } from '../src/bin/compute_index.js';

describe('statistics publication route contract', () => {
  const ids = Object.keys(REGISTRY);

  it('classifies every real producer and requires a producer for every public page', () => {
    expect(() => assertWcaStatRegistry(ids)).not.toThrow();
    expect(() => assertWcaStatRegistry([...ids, 'new_unclassified_stat'])).toThrow('unclassified');
    expect(() => assertWcaStatRegistry(ids.filter(id => id !== 'competition_streaks'))).toThrow('missing producers');
    for (const id of WCA_STAT_REMOVED_IDS) {
      expect(() => assertWcaStatRegistry([...ids, id])).toThrow('removed producers');
    }
  });

  it('publishes exactly the public pages without reading embedded or removed data', () => {
    const readStat = vi.fn((id: string) => JSON.stringify({ title: id, titleZh: id }));
    const index = buildStatIndex(readStat);
    const published = index.categories.flatMap(category => category.stats.map(stat => stat.id));
    expect([...published].sort()).toEqual([...WCA_STAT_PAGE_IDS].sort());
    expect(published.every(isWcaStatPage)).toBe(true);
    for (const id of [...WCA_STAT_DATA_ONLY_IDS, ...WCA_STAT_REMOVED_IDS]) {
      expect(readStat).not.toHaveBeenCalledWith(id);
    }
  });
});
