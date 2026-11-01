import { describe, expect, it } from 'vitest';
import { compMapAddress, resolveCompLocation } from '@/lib/comp-localize';

describe('Chinese competition addresses', () => {
  const original = '浙江省 宁波市 海曙区环城西路南段325号开元名庭酒店二楼青云厅';
  const full = '浙江省宁波市海曙区环城西路南段325号开元名庭酒店二楼青云厅';
  it('joins Chinese segments while retaining indoor directions for display', () => {
    const result = resolveCompLocation({ city: 'Ningbo', country_iso2: 'CN', venue_address: '' }, { location: original }, true);
    expect(result.address).toBe(full);
    expect(result.text).toBe(full);
    expect(compMapAddress(result.address, true, 'CN')).toBe('浙江省宁波市海曙区环城西路南段325号开元名庭酒店');
  });
  it('removes indoor suffixes without discarding building identifiers or standalone hall names', () => {
    expect(compMapAddress('北京市启阳路2号酒店青云厅', true, 'CN')).toBe('北京市启阳路2号酒店');
    expect(compMapAddress('科技园3号楼2层201室', true, 'CN')).toBe('科技园3号楼');
    expect(compMapAddress('三楼村文化中心', true, 'CN')).toBe('三楼村文化中心');
    expect(compMapAddress('上海音乐厅', true, 'CN')).toBe('上海音乐厅');
  });
  it('leaves other countries and English mode unchanged', () => {
    expect(compMapAddress(full, false, 'CN')).toBe(full);
    expect(compMapAddress(full, true, 'SG')).toBe(full);
    expect(resolveCompLocation({ city: '', country_iso2: 'SG', venue_address: original }, null, true).address).toBe(original);
  });
});
