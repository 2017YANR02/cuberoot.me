import { describe, expect, it, vi } from 'vitest';
import { buildCnRegistrations, buildUpcomingCompsFromWcif } from '../src/bin/fetch_upcoming_comps';

const oldId = '2019WANY36';
const newId = '2023GENG02';
const cubers = Object.fromEntries([oldId, newId].map(id => [id, {
  name: id, events: { '333': { ranking: true, wr: true, current_wr: true } },
}]));
const cn = {
  alias: 'Jiangmen-Open-2026', wcaId: 'JiangmenOpen2026', name: '江门公开赛', city: '',
  start_date: '2026-11-01', end_date: '2026-11-01', competitor_limit: 180,
};
const catalog = {
  id: cn.wcaId, name: 'Jiangmen Open 2026', city: 'Jiangmen, Guangdong', country: 'CN',
  start_date: cn.start_date, end_date: cn.end_date, events: ['3', '2'], competitor_limit: 180,
  registration_open: null, registration_close: null, latitude_degrees: 22, longitude_degrees: 113, url: '',
};
const wcif = (ids: string[]) => ({ competitors: ids, rounds: {}, eventRegs: {}, roundMeta: {}, h2hEvents: [] });
const build = (ids: string[], fromWca = [oldId]) => buildUpcomingCompsFromWcif(
  cubers, [catalog], { [cn.wcaId]: wcif(fromWca) }, [cn], { [cn.wcaId]: ids },
);

describe('cubing.com registration authority', () => {
  it('adds Geng even when the competition already has WCA top cubers', async () => {
    const result = await build([oldId, newId]);
    expect(result[0].top_cubers.map(c => c.id).sort()).toEqual([oldId, newId]);
    expect(result[0].top_cubers.find(c => c.id === newId)?.events).toEqual([{ id: '3', wr: 'current' }]);
  });
  it('replaces stale registrations instead of retaining withdrawn cubers', async () => {
    expect((await build([newId]))[0].top_cubers.map(c => c.id)).toEqual([newId]);
  });
  it.each([{ ids: [] }, { ids: ['2026TEST01'] }])('removes the top entry when no tracked cubers remain: $ids', async ({ ids }) => {
    expect(await build(ids)).toEqual([]);
  });
  it('creates a top entry from catalog metadata even when WCIF has no competitors', async () => {
    const result = await build([newId, newId], []);
    expect(result[0].events).toEqual(['3', '2']);
    expect(result[0].name).toBe(catalog.name);
    expect(result[0].top_cubers.map(c => c.id)).toEqual([newId]);
  });
  it('replaces a restored old snapshot when WCIF is deferred', async () => {
    const result = await buildUpcomingCompsFromWcif(cubers, [catalog], {}, [cn], { [cn.wcaId]: [newId] });
    expect(result[0].top_cubers.map(c => c.id)).toEqual([newId]);
  });
  it('fails on a missing roster instead of treating it as empty', async () => {
    await expect(buildUpcomingCompsFromWcif(cubers, [catalog], {}, [cn], {})).rejects.toThrow('Missing');
  });
  it('leaves WCA-only competitions on their own registration source', async () => {
    const result = await buildUpcomingCompsFromWcif(cubers, [catalog], { [cn.wcaId]: wcif([oldId]) }, [], {});
    expect(result[0].top_cubers.map(c => c.id)).toEqual([oldId]);
  });
  it('fetches one complete roster per competition and propagates failure', async () => {
    const load = vi.fn().mockResolvedValue(new Set([newId, oldId]));
    expect(await buildCnRegistrations([cn], load)).toEqual({ [cn.wcaId]: [oldId, newId] });
    expect(load).toHaveBeenCalledTimes(1);
    await expect(buildCnRegistrations([cn], async () => { throw new Error('unavailable'); }))
      .rejects.toThrow('registration refresh failed');
  });
  it('handles unopened registration and an empty competition list without retaining old entries', async () => {
    const load = vi.fn();
    expect(await buildCnRegistrations([{ ...cn, registration_open_ts: Date.now() / 1000 + 86400 }], load))
      .toEqual({ [cn.wcaId]: [] });
    expect(await buildCnRegistrations([], load)).toEqual({});
    expect(load).not.toHaveBeenCalled();
  });
});
