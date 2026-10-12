import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock('../src/routes/cubing_live.js', () => ({ resolveRecordResult: mocks.resolve,
  extractInferredRecords: vi.fn(), enrichRecordTags: vi.fn() }));
vi.mock('../src/monitors/names.js', () => ({ enrichName: async (name: string) => name }));
vi.mock('../src/db/connection.js', () => ({ query: vi.fn() }));
import { recordToEvent } from '../src/monitors/wca_live_record';
import { toFormatEvent } from '../src/monitors/wca_live_pr';
import { toRecordEvent } from '../src/monitors/cubing_record';

const href = '/wca/comp/GLSGdanskVI2026/result/333/f/87';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue({ href, tied: true });
});
const record: Parameters<typeof recordToEvent>[0] = {
  id: 'record', tag: 'ER', type: 'average', attemptResult: 437,
  result: { person: { name: 'Teodor Zajder', wcaId: 'person', country: { name: 'Poland', iso2: 'PL' } },
    round: { id: 'live-round', name: 'Final', number: 3, competitionEvent: { event: { id: '333', name: '3x3x3 Cube' },
      competition: { id: 'live-comp', name: 'GLS Gdańsk VI 2026', wcaId: 'GLSGdanskVI2026', venues: [] } } } },
};
describe('record push entrypoints', () => {
  it.each(['WR', 'ER', 'NR'])('WCA Live %s carries exact destination and tie state', async tag => {
    expect(await recordToEvent({ ...record, tag })).toMatchObject({ url: `https://cuberoot.me${href}`, tied: true });
    expect(mocks.resolve).toHaveBeenCalledWith('GLSGdanskVI2026', expect.objectContaining({ roundNumber: 3, personWcaId: 'person', value: 437 }), tag, 'PL');
  });
  it('PR uses the same site result resolution', async () => {
    expect(await toFormatEvent({ resultId: 'result', wcaid: 'person', name: 'Teodor Zajder', personIso2: 'PL', personCountryEn: 'Poland',
      eventId: '333', eventName: '3x3x3 Cube', recType: 'average', value: 437, recordTag: 'PR',
      roundId: 'live-round', roundNumber: 3, compId: 'live-comp', compWcaId: 'GLSGdanskVI2026', compName: 'GLS Gdańsk VI 2026', compIso2: 'PL',
    })).toMatchObject({ url: `https://cuberoot.me${href}` });
  });
  it('cubing source also resolves against site data instead of assuming the source number', async () => {
    expect(await toRecordEvent({ uid: 'id', groupKey: 'key', tag: 'ER', recType: 'average', attemptResult: 437,
      eventId: '333', roundId: 'f', personNumber: 99, roundNumber: 3, personName: 'Teodor Zajder', personRegion: 'Poland',
      compIso2: 'PL', compName: 'GLS Gdańsk VI 2026', compNameEn: 'GLS Gdańsk VI 2026', slug: 'GLS-Gdansk-VI-2026', compType: 'WCA',
    })).toMatchObject({ url: `https://cuberoot.me${href}`, tied: true });
  });
  it('an unavailable site result causes a retry instead of an imprecise push', async () => {
    mocks.resolve.mockRejectedValue(new Error('result not available'));
    await expect(recordToEvent(record)).rejects.toThrow('result not available');
  });
});
