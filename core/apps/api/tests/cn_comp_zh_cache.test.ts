import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), upcomingName: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/upcoming_comps_cache.js', () => ({
  getUpcomingCnCompName: mocks.upcomingName, getUpcomingComps: vi.fn(),
}));
import { getCnCompZh, parseCnCompZh } from '../src/utils/cn_comp_zh_cache';

const empty = { location: null, withdrawDeadline: null, reopenAt: null, nameZh: null };
// Relevant SSR markup captured from Beijing Autumn Rivalry 2026, 2026-09-19.
const modern = `<h1 class="min-w-0 text-xl">2026WCA北京金秋争霸魔方赛</h1>
  <dl><div><dt class="shrink-0">地点</dt><dd class="min-w-0"><span>中国 北京市 朝阳区 · 朝阳区望京启阳路2号 昆泰嘉晟酒店二楼宴会厅</span></dd></div></dl>
  <div data-active-timeline="false"><div><p class="text-xs">退赛截止时间</p><p>2026年9月18日 20:00</p></div></div>
  <div data-active-timeline="true"><div><p class="text-xs">报名重启时间</p><p>2026年9月19日 20:00</p></div></div>`;
const expected = {
  location: '中国 北京市 朝阳区 朝阳区望京启阳路2号 昆泰嘉晟酒店二楼宴会厅',
  withdrawDeadline: '2026-09-18 20:00:00', reopenAt: '2026-09-19 20:00:00',
  nameZh: '2026WCA北京金秋争霸魔方赛',
};

beforeEach(() => { mocks.query.mockReset(); mocks.upcomingName.mockReset(); });
afterEach(() => vi.unstubAllGlobals());

describe('cubing.com Chinese competition metadata', () => {
  it('reads nested location and new timeline labels while keeping Beijing wall-clock dates', () => {
    expect(parseCnCompZh(modern)).toEqual(expected);
  });

  it('retains legacy metadata and excludes registration notices from dates', () => {
    expect(parseCnCompZh(`<h1 class="heading-title">2026WCA测试赛 &amp; 交流赛</h1><dl>
      <dt>地点</dt><dd>中国 北京 <a href="/venue">测试场馆</a></dd>
      <dt>退赛截止时间</dt><dd>2026-09-08 09:00:01<div class="text-info">暂停报名</div></dd>
      <dt>重开报名时间</dt><dd>2026-09-09 09:30:00</dd></dl>`)).toEqual({
      location: '中国 北京 测试场馆', withdrawDeadline: '2026-09-08 09:00:01',
      reopenAt: '2026-09-09 09:30:00', nameZh: '2026WCA测试赛 & 交流赛',
    });
  });

  it.each(['', '<h1>Too Many Requests</h1>', '<dt>地点</dt><dd>Beijing, China</dd>',
    '<dt>退赛截止时间</dt><dd>尚未公布</dd>', '<dt>地点</dt><p>无关内容</p>'])('does not turn unavailable metadata into Chinese values: %s', html => {
    expect(parseCnCompZh(html)).toEqual(empty);
  });

  it('scrapes and persists fresh metadata when no usable cached location exists', async () => {
    mocks.query.mockResolvedValue([]);
    mocks.upcomingName.mockResolvedValue('Beijing Autumn Rivalry 2026');
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => modern }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getCnCompZh('BeijingAutumnRivalry2026')).resolves.toEqual(expected);
    expect(fetchMock).toHaveBeenCalledWith('https://cubing.com/competition/Beijing-Autumn-Rivalry-2026?lang=zh',
      expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(mocks.query.mock.calls.at(-1)?.[1]).toEqual([
      'BeijingAutumnRivalry2026', expected.location, expected.withdrawDeadline, expected.reopenAt, expected.nameZh,
    ]);
  });

  it('reuses complete cached metadata without scraping upstream', async () => {
    mocks.query.mockResolvedValue([{ location_zh: expected.location, name_zh: expected.nameZh,
      withdraw_deadline: expected.withdrawDeadline, reopen_at: expected.reopenAt }]);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getCnCompZh('BeijingAutumnRivalry2026')).resolves.toEqual(expected);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([true, false])('does not persist empty or failed upstream responses (HTTP ok: %s)', async ok => {
    mocks.query.mockResolvedValue([]);
    mocks.upcomingName.mockResolvedValue('Missing Competition 2026');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok, text: async () => '<h1>Not found</h1>' })));
    await expect(getCnCompZh('MissingCompetition2026')).resolves.toEqual(empty);
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes('INSERT'))).toBe(false);
  });
});
