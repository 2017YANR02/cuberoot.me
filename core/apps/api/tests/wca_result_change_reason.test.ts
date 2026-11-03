import { expect, it, vi } from 'vitest';
import { inferPlacementChangeReason, type ReasonChange } from '../src/utils/wca_result_change_reason';

const query = vi.hoisted(() => vi.fn());
vi.mock('../src/db/connection.js', () => ({ query }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAdminOrApiKey: vi.fn(), requireAuth: vi.fn(), checkRateLimit: vi.fn(),
}));
import { wcaResultWatchRoutes } from '../src/routes/wca_result_watch';

// Public history IDs 77 and 88: unchanged 6.73, while Wang's 5.03 becomes 7.41.
const fp = { c: 'GuangzhouSmallCubes2025', e: '333', r: 'f', f: 'a',
  a: 673, b: 578, p: 10, at: [668, 627, 578, 957, 724] };
const subject: ReasonChange = {
  id: 77, wca_id: '2023XIUY01', competition_id: fp.c, event_id: fp.e, round_type_id: fp.r,
  change_type: 'modified', before_json: fp, after_json: { ...fp, p: 9 },
  detected_at: '2026-10-21T17:51:00.423Z', source: 'auto', status: 'approved', person_name: null,
};
const wang: ReasonChange = { ...subject, id: 88, wca_id: '2019WANY36', person_name: 'Yiheng Wang (王艺衡)',
  detected_at: '2026-10-21T17:51:17.697Z',
  before_json: { ...fp, a: 503, b: 427, p: 1, at: [446, 515, 549, 681, 427] },
  after_json: { ...fp, a: 741, b: 515, p: 15, at: [846, 515, 549, 1081, 827] },
};

it('explains the full rank displacement using the actual Guangzhou correction', () => {
  expect(inferPlacementChangeReason(subject, [wang])).toEqual({ kind: 'inferred', causes: [{
    changeId: 88, wcaId: '2019WANY36', personName: wang.person_name, changeType: 'modified',
    field: 'average', oldValue: 503, newValue: 741, oldPlace: 1, newPlace: 15,
  }] });
});

it('does not attribute Xuzhou June placements to the October Wang correction', () => {
  const before = { ...fp, c: 'XuzhouZenith2026', r: '3', a: 679, b: 533, p: 12 };
  const june = { ...subject, competition_id: before.c, round_type_id: '3',
    detected_at: '2026-06-29T09:26:03.675Z', before_json: before, after_json: { ...before, p: 13 } };
  const october = { ...wang, competition_id: before.c, round_type_id: '3',
    before_json: { ...before, a: 401, b: 316, p: 1 }, after_json: { ...before, a: 503, b: 364, p: 3 } };
  expect(inferPlacementChangeReason(june, [october])).toEqual({ kind: 'unknown', causes: [] });
});

it('rejects unrelated, pending, manual, repeated and incomplete evidence', () => {
  for (const candidates of [[], [{ ...wang, status: 'pending' }], [{ ...wang, status: 'rejected' }],
    [{ ...wang, source: 'manual' }], [{ ...wang, event_id: '222' }], [{ ...wang, round_type_id: '3' }],
    [{ ...wang, competition_id: 'Other2025' }], [{ ...wang, detected_at: 'invalid' }],
    [{ ...wang, after_json: { ...wang.after_json, a: 600 } }], [wang, { ...wang, id: 90 }]]) {
    expect(inferPlacementChangeReason(subject, candidates)).toEqual({ kind: 'unknown', causes: [] });
  }
  expect(inferPlacementChangeReason({ ...subject, after_json: { ...fp, p: 8 } }, [wang]))
    .toEqual({ kind: 'unknown', causes: [] });
  expect(inferPlacementChangeReason({ ...subject, after_json: { ...fp, a: 700, p: 9 } }, [wang])).toBeNull();
});

it('accounts for ties, DNF, removals and more than one opponent', () => {
  const tied = { ...wang, after_json: { ...fp, a: 673, b: 578, p: 9 } };
  expect(inferPlacementChangeReason(subject, [tied])?.kind).toBe('inferred');
  expect(inferPlacementChangeReason(subject, [{ ...tied, after_json: { ...fp, b: 577 } }])?.kind).toBe('unknown');
  expect(inferPlacementChangeReason(subject, [{ ...wang, after_json: { ...fp, a: -1, b: -1 } }])?.kind).toBe('inferred');
  expect(inferPlacementChangeReason(subject, [{ ...wang, change_type: 'removed', after_json: null }])?.causes[0].newValue).toBeNull();
  const second = { ...wang, id: 90, wca_id: '2020TEST01' };
  expect(inferPlacementChangeReason({ ...subject, after_json: { ...fp, p: 8 } }, [wang, second])?.causes.length).toBe(2);
});

it('does not guess head-to-head bracket rankings', () => {
  expect(inferPlacementChangeReason({ ...subject,
    before_json: { ...fp, f: 'h', a: 0 }, after_json: { ...fp, f: 'h', a: 0, p: 9 },
  }, [wang])).toEqual({ kind: 'unknown', causes: [] });
});

it('explains a worsening position and uses best for an average tie breaker', () => {
  const improved = { ...wang, before_json: wang.after_json, after_json: wang.before_json };
  expect(inferPlacementChangeReason({ ...subject, after_json: { ...fp, p: 11 } }, [improved])?.kind).toBe('inferred');
  const tieBreaker = { ...wang,
    before_json: { ...fp, b: 577, p: 9 }, after_json: { ...fp, b: 579, p: 10 },
  };
  expect(inferPlacementChangeReason(subject, [tieBreaker])?.causes[0])
    .toMatchObject({ field: 'best', oldValue: 577, newValue: 579 });
});

it('returns opponent evidence even when the public query filters to one person and one row', async () => {
  query.mockReset();
  query.mockResolvedValueOnce([subject]).mockResolvedValueOnce([wang]);
  const response = await wcaResultWatchRoutes.request('/wca/result-watch/changes?wcaId=2023XIUY01&limit=1&v=3');
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.changes).toHaveLength(1);
  expect(body.changes[0].placementReason.causes[0].wcaId).toBe('2019WANY36');
  expect(query.mock.calls[1][1]).toEqual([[77], 1800000, 1800000]);
});
