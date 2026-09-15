import { describe, expect, it } from 'vitest';
import { parsePinnedCountries, partitionPinnedCountries, pinnedCountriesKey, resolvePinnedCountries, togglePinnedCountry } from '@/lib/pinned-countries';

describe('pinned countries', () => {
  it('defaults only unsaved preferences to a valid WCA country', () => {
    expect(resolvePinnedCountries(null, 'CN')).toEqual(['cn']);
    expect(resolvePinnedCountries(null, '')).toEqual([]);
    expect(resolvePinnedCountries(null, 'invalid')).toEqual([]);
    expect(resolvePinnedCountries('[]', 'CN')).toEqual([]);
    expect(resolvePinnedCountries('["au"]', 'CN')).toEqual(['au']);
  });

  it('isolates accounts and keeps preferences when WCA is linked or unlinked', () => {
    expect(pinnedCountriesKey(null)).toBeNull();
    const key = pinnedCountriesKey({ uid: 42, wcaId: '' });
    expect(key).toBe('cuberoot-pinned-countries:u42');
    expect(pinnedCountriesKey({ uid: 42, wcaId: '2017YANR02' })).toBe(key);
    expect(pinnedCountriesKey({ uid: 43, wcaId: '' })).not.toBe(key);
    expect(pinnedCountriesKey({ wcaId: ' 2017yanr02 ' })).toBe('cuberoot-pinned-countries:2017YANR02');
  });

  it('orders WCA then IP then manual pins, deduplicates defaults and migrates legacy lists', () => {
    expect(resolvePinnedCountries(null, 'CN', 'US')).toEqual(['cn', 'us']);
    expect(resolvePinnedCountries(null, 'CN', 'cn')).toEqual(['cn']);
    expect(resolvePinnedCountries(null, '', 'US')).toEqual(['us']);
    expect(resolvePinnedCountries(null, '', 'unknown')).toEqual([]);
    expect(resolvePinnedCountries('["au","cn"]', 'cn', 'us')).toEqual(['cn', 'us', 'au']);
    expect(resolvePinnedCountries('[]', 'cn', 'us')).toEqual(['us']);
    expect(resolvePinnedCountries('[]', 'cn', 'cn')).toEqual([]);
    expect(resolvePinnedCountries('{', 'cn', 'us')).toEqual(['cn', 'us']);
  });

  it('retains explicit unpins across default changes, reloads and repinning', () => {
    let raw = togglePinnedCountry(null, 'cn', 'us', 'us');
    expect(resolvePinnedCountries(raw, 'cn', 'us')).toEqual(['cn']);
    raw = togglePinnedCountry(raw, 'cn', 'us', 'au');
    expect(resolvePinnedCountries(raw, 'cn', 'us')).toEqual(['cn', 'au']);
    expect(resolvePinnedCountries(raw, 'cn', 'de')).toEqual(['cn', 'de', 'au']);
    raw = togglePinnedCountry(raw, 'cn', 'us', 'cn');
    expect(resolvePinnedCountries(raw, 'cn', 'us')).toEqual(['au']);
    raw = togglePinnedCountry(raw, 'cn', 'us', 'us');
    expect(resolvePinnedCountries(raw, 'cn', 'us')).toEqual(['us', 'au']);
    expect(resolvePinnedCountries(togglePinnedCountry(raw, 'cn', 'us', 'invalid'), 'cn', 'us')).toEqual(['us', 'au']);
  });

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
