import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchUserTimes, wcaApi } from '@cuberoot/shared/wca-search';

afterEach(() => vi.restoreAllMocks());

describe('calculator WCA reference averages', () => {
  it('takes latest attempts within the newest round', async () => {
    vi.spyOn(wcaApi, 'get').mockResolvedValue({ data: [
      { event_id: '333', attempts: [100, 200, 300, 400, 500], average: 300 },
      { event_id: '333', attempts: [600, 700, 800, 900, 1000], average: 800 },
    ] });
    const result = await fetchUserTimes('times-order', '333', 6);
    expect(result?.times).toEqual([1000, 900, 800, 700, 600, 500]);
    expect(result?.ao100).toBe(750);
    expect(result?.averagePR).toBe(300);
  });

  it('preserves fractional moves in the FMC reference mean', async () => {
    vi.spyOn(wcaApi, 'get').mockResolvedValue({ data: [
      { event_id: '333fm', attempts: [17, 18, 19, 19, 21], average: 1867 },
    ] });
    const result = await fetchUserTimes('times-fmc', '333fm');
    expect(result?.times).toEqual([21, 19, 19, 18, 17]);
    expect(result?.ao100).toBe(18.67);
    expect(result?.averagePR).toBe(1867);
  });
});
