import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultRecordNotificationPreferences, matchesRecordNotification, parseRecordNotificationPreferences } from '@cuberoot/shared/record-notifications';
import type { InferredRecord } from '../src/routes/cubing_live';

const mocks = vi.hoisted(() => ({ query: vi.fn(), tx: vi.fn(), notify: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query, withTransaction: (fn: (tx: unknown) => unknown) => fn(mocks.tx) }));
vi.mock('../src/utils/notify.js', () => ({ notify: mocks.notify }));
vi.mock('../src/routes/wca_recent_records.js', () => ({ formatInferred: async () => ({ cn: '4.52 三阶平均纪录', en: '4.52 3x3 record' }) }));
import { deliverRecordNotifications, observeRecordNotifications, recordNotificationKey } from '../src/utils/record_notifications';

const record: InferredRecord = { id: 'source-id', compId: 'WuhanCrimsonAutumn2026', compNameEn: 'Wuhan Crimson Autumn 2026',
  eventId: '333', roundId: 'f', type: 'average', tag: 'FWR', attemptResult: 452,
  personWcaId: '2025LIAN01', personName: 'Yunzhi Lian', personIso2: 'CN', startDate: '2026-09-13' };

describe('record subscription rules', () => {
  const prefs = { ...defaultRecordNotificationPreferences(), levels: ['CR'] as const, events: ['333'], types: ['average'] as const, regions: ['AS'] };
  const selected = () => ({ ...prefs, levels: [...prefs.levels], types: [...prefs.types] });
  it('includes own PR even with every optional filter empty', () => {
    expect(matchesRecordNotification({ levels: [], events: [], types: [], regions: ['fr'] }, record.personWcaId, { ...record, tag: 'PR' })).toBe(true);
    expect(matchesRecordNotification(defaultRecordNotificationPreferences(), null, { ...record, personWcaId: '', tag: 'PR' })).toBe(false);
  });
  it.each([0, -1, -2, NaN, 4.52])('rejects invalid/non-result value %s even for its owner', attemptResult => {
    expect(matchesRecordNotification(defaultRecordNotificationPreferences(), record.personWcaId, { ...record, attemptResult })).toBe(false);
  });
  it('applies type, event, scope and region together for other competitors', () => {
    expect(matchesRecordNotification(selected(), null, { ...record, tag: 'AsR' }, 'AS')).toBe(true);
    expect(matchesRecordNotification(selected(), null, { ...record, tag: 'AsR', type: 'single' }, 'AS')).toBe(false);
    expect(matchesRecordNotification(selected(), null, { ...record, tag: 'AsR', eventId: '222' }, 'AS')).toBe(false);
    expect(matchesRecordNotification(selected(), null, { ...record, tag: 'NR' }, 'AS')).toBe(false);
    expect(matchesRecordNotification(selected(), null, { ...record, tag: 'ER' }, 'EU')).toBe(false);
    expect(matchesRecordNotification({ ...selected(), regions: ['cn'] }, null, { ...record, tag: 'CR' })).toBe(true);
  });
  it('validates complete bounded settings and refuses unknown/duplicate values', () => {
    expect(parseRecordNotificationPreferences(defaultRecordNotificationPreferences())).toEqual(defaultRecordNotificationPreferences());
    for (const value of [null, [], {}, { ...selected(), levels: ['PR'] }, { ...selected(), levels: ['WR', 'WR'] },
      { ...selected(), events: ['magic'] }, { ...selected(), types: ['mean'] }, { ...selected(), regions: ['China'] },
      { ...selected(), own: false }]) expect(parseRecordNotificationPreferences(value)).toBeNull();
  });
  it('includes world and continental records in the corresponding national subscription', () => {
    const national = { ...selected(), levels: ['NR'] as ('NR')[], regions: ['cn'] };
    expect(matchesRecordNotification(national, null, { ...record, tag: 'WR' }, 'AS')).toBe(true);
    expect(matchesRecordNotification(national, null, { ...record, tag: 'AsR' }, 'AS')).toBe(true);
    expect(matchesRecordNotification(selected(), null, { ...record, tag: 'WR' }, 'AS')).toBe(true);
    expect(matchesRecordNotification(national, null, { ...record, tag: 'FWR' }, 'AS')).toBe(false);
    expect(matchesRecordNotification(national, null, { ...record, tag: 'WR', personIso2: 'US' }, 'NA')).toBe(false);
  });
});

describe('record notification ledger', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.query.mockResolvedValue([]); mocks.tx.mockResolvedValue([]); mocks.notify.mockResolvedValue(undefined); });
  it('deduplicates by achievement across source IDs and record marker changes', () => {
    expect(recordNotificationKey({ ...record, id: 'another-source', tag: 'WR' })).toBe(recordNotificationKey(record));
    expect(recordNotificationKey({ ...record, attemptResult: 451 })).not.toBe(recordNotificationKey(record));
    expect(recordNotificationKey({ ...record, roundId: '1' })).not.toBe(recordNotificationKey(record));
  });
  it('writes the entire first snapshot as already delivered, and later achievements as pending', async () => {
    mocks.tx.mockResolvedValueOnce([{ comp_id: record.compId }]);
    await observeRecordNotifications(record.compId, [record]);
    expect(mocks.tx.mock.calls[2][1]).toEqual([recordNotificationKey(record), record.compId, record, true]);
    expect(mocks.notify).not.toHaveBeenCalled();
    mocks.tx.mockClear();
    await observeRecordNotifications(record.compId, [record]);
    expect(mocks.tx.mock.calls[2][1][3]).toBe(false);
  });
  it('includes owner, matches opt-in subscribers, and excludes later subscriptions/accounts', async () => {
    const prefs = { ...defaultRecordNotificationPreferences(), levels: ['FWR'] };
    const user = { id: 1, wca_id: record.personWcaId, lang: 'zh', created_at: '2026-09-01', updated_at: null, preferences: null };
    mocks.query.mockResolvedValueOnce([{ event_key: 'key', payload: record, observed_at: '2026-09-13' }])
      .mockResolvedValueOnce([user, { ...user, id: 2, wca_id: null, lang: 'en', preferences: prefs },
        { ...user, id: 3, wca_id: null, preferences: prefs, updated_at: '2026-09-14' },
        { ...user, id: 4, wca_id: null, preferences: prefs, created_at: '2026-09-14' },
        { ...user, id: 5, wca_id: null }]);
    await deliverRecordNotifications(record.compId);
    expect(mocks.notify).toHaveBeenCalledTimes(2);
    expect(mocks.notify.mock.calls[0][0]).toMatchObject({ recipients: [record.personWcaId], kind: 'wca_record', actorKey: '', dedupeKey: 'key', excerpt: '4.52 三阶平均纪录' });
    expect(mocks.notify.mock.calls[1][0]).toMatchObject({ recipients: ['u2'], excerpt: '4.52 3x3 record' });
    expect(mocks.query.mock.calls[2][0]).toContain('delivered = TRUE');
  });
  it('leaves failed delivery pending so the next sweep can retry', async () => {
    mocks.query.mockResolvedValueOnce([{ event_key: 'key', payload: record, observed_at: '2026-09-13' }])
      .mockResolvedValueOnce([{ id: 1, wca_id: record.personWcaId, created_at: '2026-09-01', preferences: null }]);
    mocks.notify.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(deliverRecordNotifications(record.compId)).rejects.toThrow('database unavailable');
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
});
