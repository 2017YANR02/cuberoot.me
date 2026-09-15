import { describe, expect, it } from 'vitest';
import { parsePinnedCountries, partitionPinnedCountries } from '@/lib/pinned-countries';

describe('pinned countries', () => {
  it('recovers from corrupt or non-array storage', () => {
    for (const raw of ['', '{', 'null', '{}', '42', '"cn"']) {
      expect(parsePinnedCountries(raw)).toEqual([]);
    }
  });

  it('normalizes country codes and rejects unknown values without interpreting continents', () => {
    expect(parsePinnedCountries('["CN","cn",null,3,"world","_Asia","invalid","US","au"]')).toEqual(['cn', 'us', 'au']);
  });

  it('keeps pin order, available options, casing and original callback values', () => {
    const items = [{ iso: 'US', value: 'USA' }, { iso: 'de', value: 'Germany' }, { iso: 'CN', value: 'China' }];
    const result = partitionPinnedCountries(items, ['au', 'cn', 'us'], item => item.iso);
    expect(result.pinned).toEqual([items[2], items[0]]);
    expect(result.pinned[0]).toBe(items[2]);
    expect(result.others).toEqual([items[1]]);
    expect(items.map(item => item.value)).toEqual(['USA', 'Germany', 'China']);
  });

  it('does not insert pinned countries excluded by a search or an empty menu', () => {
    expect(partitionPinnedCountries(['de'], ['cn', 'us'], iso => iso)).toEqual({ pinned: [], others: ['de'] });
    expect(partitionPinnedCountries<string>([], ['cn'], iso => iso)).toEqual({ pinned: [], others: [] });
  });

  it('restores original order when pins are removed', () => {
    expect(partitionPinnedCountries(['us', 'de', 'cn'], [], iso => iso)).toEqual({ pinned: [], others: ['us', 'de', 'cn'] });
  });
});
