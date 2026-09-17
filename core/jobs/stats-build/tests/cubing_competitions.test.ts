import { expect, it } from 'vitest';
import { mergeCompetitionNames, parseCubingCompetitionList } from '@cuberoot/shared/cubing-competitions';

it('reads the redesigned upstream payload including its explicit WCA identity and pagination', () => {
  const payload = [{ competitions: 1, total: 2 }, [3], 1244,
    { type: 4, alias: 5, name: 6, nameZh: 7, startDate: 8, wcaCompetitionId: 9 },
    'WCA', 'Guangzhou-GraDUAL-3x3-IV-2026', 'Guangzhou GraDUAL 3x3 IV 2026',
    '2026WCA广州三速双轮角逐赛 IV', '2026-09-16', 'GuangzhouGraDUAL3x3IV2026'];
  const parsed = parseCubingCompetitionList(`<script id="__NUXT_DATA__">${JSON.stringify(payload)}</script>`);
  expect(parsed.totalPages).toBe(13);
  expect(parsed.competitions[0].wcaCompetitionId).toBe('GuangzhouGraDUAL3x3IV2026');
  expect(parsed.competitions[0].nameZh).toBe('2026WCA广州三速双轮角逐赛 IV');
});

it('fails a changed/empty upstream instead of publishing an empty name index', () => {
  expect(() => parseCubingCompetitionList('<html>maintenance</html>')).toThrow();
  expect(() => parseCubingCompetitionList('<script id="__NUXT_DATA__">[]</script>')).toThrow();
  expect(() => mergeCompetitionNames({ Historic: '历史赛' }, {})).toThrow();
  expect(mergeCompetitionNames({ Historic: '历史赛' }, { New: '新比赛' })).toEqual({ Historic: '历史赛', New: '新比赛' });
});
