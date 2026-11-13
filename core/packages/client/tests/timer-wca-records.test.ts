// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compareTimerWcaRecord, hasTimerWcaRecords, selectTimerWcaRecords, toWcaSpelling, type EventId, type Solve } from '@cuberoot/shared/timer';
import { parseWcaRecordsBundle, WCA_WORLD_RECORDS_PATH, type WcaRecordRow } from '@cuberoot/shared/wca-records';
import { statsUrl } from '@cuberoot/shared/stats-base';
import { TimerRecordsOverlay } from '@cuberoot/timer-ui';

const row = (patch: Partial<WcaRecordRow> = {}): WcaRecordRow => ({
  e: '333', t: 's', v: 400, l: 'WR', p: '2020TEST01', pn: 'Test Person (测试选手)',
  c: 'Example2026', cn: 'Example 2026', d: '2026-02-01', a: null, ...patch,
});
const solves = (event: EventId, values: number[]): Solve[] => values.map((timeMs, i) => ({
  id: String(i), timeMs, event, penalty: 'ok', scramble: '', ts: i,
}));

describe('WCA records for every timer event', () => {
  const events: EventId[] = ['333', '222', '444', '555', '666', '777', '333bld', '333fm', '333oh',
    'clock', 'mega', 'pyra', 'skewb', 'sq1', '444bld', '555bld', '333mbld', 'magic', 'mmagic'];

  it.each(events)('selects current records for %s without dropping ties', event => {
    const e = toWcaSpelling(event);
    const current = row({ e, v: 300 });
    const tied = row({ e, v: 300, p: '2020TEST02', d: '2026-02-02' });
    const records = [row({ e, v: 400 }), tied, current, row({ e, v: -1 }), row({ e, v: 200, l: 'NR' })];
    expect(hasTimerWcaRecords(event)).toBe(true);
    expect(selectTimerWcaRecords(event, records)).toEqual([current, tied]);
  });

  it.each(['333ni', '333mr', '666bld', 'cross', 'fto', 'custom'] as EventId[])('does not invent WRs for %s', event => {
    expect(hasTimerWcaRecords(event)).toBe(false);
    expect(selectTimerWcaRecords(event, [row()])).toEqual([]);
  });

  it('rejects incomplete data and preserves the published update date', () => {
    const valid = { updated: '2026-02-02', rows: [row()] };
    expect(parseWcaRecordsBundle(valid)).toEqual(valid);
    for (const invalid of [null, {}, { rows: [] }, { ...valid, rows: [] }, { ...valid, rows: [null] },
      { ...valid, rows: [row({ v: NaN })] }, { ...valid, rows: [row({ a: [NaN] })] }]) {
      expect(parseWcaRecordsBundle(invalid)).toBeNull();
    }
  });

  it('compares timed singles in milliseconds, applying penalties and ignoring DNF', () => {
    const attempts = solves('333', [1000, 4500, 8000]);
    attempts[0].penalty = 'DNF';
    attempts[1].penalty = '+2';
    expect(compareTimerWcaRecord(row(), attempts)).toEqual({
      recordText: '4.00', pbText: '6.50', gap: 2500, gapText: '2.50',
    });
  });

  it.each(['666', '777', '444bld', '555bld'] as EventId[])('uses Mo3 for the %s average, not Ao5 or Bo3', event => {
    const record = row({ e: toWcaSpelling(event), t: 'a', v: 5000, a: [4900, 5000, 5100] });
    const attempts = solves(event, [60000, 90000, 120000]);
    expect(compareTimerWcaRecord(record, attempts)).toEqual({
      recordText: '50.00', pbText: '1:30.00', gap: 40000, gapText: '40.00',
    });
    attempts[0].penalty = 'DNF';
    expect(compareTimerWcaRecord(record, attempts).pbText).toBeNull();
  });

  it('uses the published Ao5 format for 3BLD', () => {
    const record = row({ e: '333bf', t: 'a', v: 1400, a: [1300, 1400, 1500, 1600, 1200] });
    expect(compareTimerWcaRecord(record, solves('333bld', [10000, 20000, 30000, 40000, 100000])).pbText).toBe('30.00');
    expect(compareTimerWcaRecord(record, solves('333bld', [10000, 20000, 30000])).pbText).toBeNull();
  });

  it('keeps FMC singles, means and gaps in moves', () => {
    const attempts = solves('333fm', [20000, 24000, 28000]);
    expect(compareTimerWcaRecord(row({ e: '333fm', v: 16 }), attempts)).toEqual({
      recordText: '16', pbText: '20', gap: 4000, gapText: '4',
    });
    expect(compareTimerWcaRecord(row({ e: '333fm', t: 'a', v: 1933, a: [19, 19, 20] }), attempts)).toEqual({
      recordText: '19.33', pbText: '24', gap: 4670, gapText: '4.67',
    });
  });

  it('formats MBLD as solved/attempted plus time and excludes unofficial averages', () => {
    const single = row({ e: '333mbf', v: 380350302 });
    expect(selectTimerWcaRecords('333mbld', [single, row({ e: '333mbf', t: 'a' })])).toEqual([single]);
    const attempts = solves('333mbld', [3000000, 3300000]);
    attempts[0].mbld = { solved: 8, attempted: 10 };
    attempts[1].mbld = { solved: 11, attempted: 13 };
    expect(compareTimerWcaRecord(single, attempts)).toEqual({
      recordText: '63/65 58:23', pbText: '11/13 55:00', gap: null, gapText: null,
    });
  });
});

describe('record overlay loading', () => {
  let root: Root;
  let container: HTMLDivElement;
  let request: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    request = vi.fn();
    vi.stubGlobal('fetch', request);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  const response = (rows = [row()]) => ({ ok: true, json: async () => ({ updated: '2026-02-02', rows }) });
  async function render(event: EventId = '333', isZh = true) {
    await act(async () => root.render(createElement(TimerRecordsOverlay, { event, solves: solves(event, [4000]), isZh })));
  }

  it('loads the records-page feed, shows its date and localizes holders', async () => {
    request.mockResolvedValue(response());
    await render();
    expect(request.mock.calls[0][0]).toBe(statsUrl(WCA_WORLD_RECORDS_PATH));
    expect(container.textContent).toContain('数据更新 2026-02-02');
    expect(container.textContent).toContain('测试选手');
    expect(container.textContent).toContain('持平 WR');
    expect(container.textContent).not.toContain('已超 WR');
    await render('333', false);
    expect(container.textContent).toContain('Test Person');
    expect(container.textContent).not.toContain('测试选手');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('shows every tied holder and changes event without another request', async () => {
    request.mockResolvedValue(response([row(), row({ p: '2020TEST02', pn: 'Second Holder' }), row({ e: 'minx', v: 2500 })]));
    await render();
    expect(container.textContent).toContain('Second Holder');
    await render('mega');
    expect(container.textContent).toContain('25.00');
    expect(container.textContent).not.toContain('Second Holder');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(['http', 'invalid', 'network'])('allows retry after %s failure without showing invented records', async failure => {
    if (failure === 'http') request.mockResolvedValueOnce({ ok: false, status: 503 });
    else if (failure === 'invalid') request.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    else request.mockRejectedValueOnce(new Error('offline'));
    request.mockResolvedValueOnce(response());
    await render();
    expect(container.textContent).toContain('加载失败');
    expect(container.textContent).not.toContain('WR 单次');
    expect(container.textContent).not.toContain('2026-01-15');
    await act(async () => container.querySelector('button')!.click());
    expect(container.textContent).toContain('WR 单次');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not request data for training events and aborts on unmount', async () => {
    await render('333ni');
    expect(request).not.toHaveBeenCalled();
    request.mockImplementation(() => new Promise(() => {}));
    await render();
    expect(container.textContent).toContain('加载中');
    const signal = request.mock.calls[0][1].signal as AbortSignal;
    await act(async () => root.render(null));
    expect(signal.aborted).toBe(true);
  });
});
