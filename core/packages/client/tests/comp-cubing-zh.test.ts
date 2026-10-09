// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCubingZh } from '@/lib/comp-wcif';
import { apiUrl } from '@/lib/api-base';

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('Chinese competition metadata cache', () => {
  it('refreshes metadata left by the old parser and then reuses the repaired result', async () => {
    const id = 'BeijingAutumnRivalry2026';
    localStorage.setItem(`wca-comp-cubing-zh-v3-${id}`, JSON.stringify({ t: Date.now(),
      v: { location: null, withdrawDeadline: null, reopenAt: null, nameZh: null } }));
    const meta = { location: '朝阳区望京启阳路2号 昆泰嘉晟酒店二楼宴会厅',
      withdrawDeadline: null, reopenAt: null, nameZh: '2026WCA北京金秋争霸魔方赛' };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => meta }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchCubingZh(id)).resolves.toEqual(meta);
    expect(fetchMock.mock.calls[0]).toEqual([apiUrl(`/v1/cubing-zh/${id}?v=4`)]);
    await expect(fetchCubingZh(id)).resolves.toEqual(meta);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
