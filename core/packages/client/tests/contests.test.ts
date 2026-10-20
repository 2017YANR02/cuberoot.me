import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/wca-events', () => ({ eventDisplayName: (id: string) => id }));
import { contestEventName } from '@/app/[lang]/contests/catalog';
import { contestsHref } from '@/lib/contests-api';

describe('Contests display contracts', () => {
  it('preserves external IDs when translating uncommon event names', () => {
    const event = { eventId: '101010bf', name: '10x10x10 Blindfolded', format: 'time' as const, category: { categoryId: 'extreme-bld', name: 'Extreme BLD', videoBased: true } };
    expect(contestEventName(event, true)).toBe('10阶盲拧');
    expect(contestEventName(event, false)).toBe('10x10x10 Blindfolded');
    expect(event.eventId).toBe('101010bf');
  });
  it('links by stable person identity and retains China filters', () => {
    expect(contestsHref({ view: 'person', id: '2017BRYA06' })).toBe('/contests?view=person&id=2017BRYA06');
    expect(contestsHref({ view: 'rankings', event: '333_mirror_blocks', region: 'CN' })).toBe('/contests?view=rankings&event=333_mirror_blocks&region=CN');
  });
});
