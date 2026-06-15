import { describe, it, expect } from 'vitest';
import {
  parseHumanResult,
  changeChainOldValues,
  buildRowChangeListMap,
  buildPersonRoundChangeListMap,
  rowChangeKey,
  personRoundChangeKey,
  canonicalRound,
  effectiveFieldValue,
  effectiveAttempts,
  attemptOldValues,
  type ResultChange,
} from '@/lib/result-watch-api';
import { computeWcaBestAverage } from '@/lib/wca-compute';

// 最小 ResultChange 工厂(只填测试关心的字段)
function mk(p: Partial<ResultChange>): ResultChange {
  return {
    id: p.id ?? 1,
    wcaId: p.wcaId ?? '2019WANY36',
    personName: null,
    personIso2: null,
    resultId: p.resultId ?? null,
    competitionId: p.competitionId ?? 'JohorCubeOpen2024',
    compName: null,
    compStartDate: null,
    compIso2: null,
    eventId: p.eventId ?? '222',
    roundTypeId: p.roundTypeId ?? '1',
    changeType: p.changeType ?? 'modified',
    fields: p.fields ?? null,
    before: null,
    after: null,
    detectedAt: p.detectedAt ?? '2026-06-15T00:00:00Z',
    note: p.note ?? null,
    effectiveAt: p.effectiveAt ?? null,
    source: p.source ?? 'manual',
    createdBy: null,
    editedAt: null,
  };
}

describe('parseHumanResult', () => {
  it('seconds.centiseconds', () => {
    expect(parseHumanResult('2.83', '222')).toBe(283);
    expect(parseHumanResult('0.78', '222')).toBe(78);
    expect(parseHumanResult('12.50', '333')).toBe(1250);
  });
  it('minutes:seconds.centiseconds', () => {
    expect(parseHumanResult('1:23.45', '333')).toBe(8345);
    expect(parseHumanResult('2:00', '444')).toBe(12000);
  });
  it('DNF / DNS', () => {
    expect(parseHumanResult('DNF', '222')).toBe(-1);
    expect(parseHumanResult('dns', '222')).toBe(-2);
  });
  it('FMC single = moves, average = moves*100', () => {
    expect(parseHumanResult('25', '333fm')).toBe(25);
    expect(parseHumanResult('24.67', '333fm')).toBe(2467);
  });
  it('blank → null', () => {
    expect(parseHumanResult('', '222')).toBeNull();
    expect(parseHumanResult('   ', '222')).toBeNull();
  });
});

describe('changeChainOldValues', () => {
  it('collects superseded old values oldest→newest', () => {
    const chain = [
      mk({ id: 1, effectiveAt: '2024-06-01', fields: [{ field: 'average', old: 78, new: 283 }] }),
      mk({ id: 2, effectiveAt: '2025-01-01', fields: [{ field: 'average', old: 283, new: 310 }] }),
    ];
    expect(changeChainOldValues(chain, 'average')).toEqual([78, 283]);
    expect(changeChainOldValues(chain, 'best')).toEqual([]);
  });
  it('ignores removed + missing field', () => {
    const chain = [
      mk({ id: 1, changeType: 'removed', fields: null }),
      mk({ id: 2, fields: [{ field: 'best', old: 100, new: 120 }] }),
    ];
    expect(changeChainOldValues(chain, 'best')).toEqual([100]);
  });
  it('undefined chain → empty', () => {
    expect(changeChainOldValues(undefined, 'best')).toEqual([]);
  });
});

describe('buildRowChangeListMap', () => {
  it('groups by row key and sorts each chain ascending by effective date', () => {
    const changes = [
      mk({ id: 2, effectiveAt: '2025-01-01', fields: [{ field: 'average', old: 283, new: 310 }] }),
      mk({ id: 1, effectiveAt: '2024-06-01', fields: [{ field: 'average', old: 78, new: 283 }] }),
    ];
    const map = buildRowChangeListMap(changes);
    const chain = map.get(rowChangeKey('JohorCubeOpen2024', '222', '1'));
    expect(chain?.map((c) => c.id)).toEqual([1, 2]); // sorted ascending
  });
  it('separates different rounds', () => {
    const changes = [
      mk({ id: 1, roundTypeId: '1', fields: [{ field: 'best', old: 1, new: 2 }] }),
      mk({ id: 2, roundTypeId: 'f', fields: [{ field: 'best', old: 3, new: 4 }] }),
    ];
    const map = buildRowChangeListMap(changes);
    expect(map.size).toBe(2);
  });
});

describe('keys', () => {
  it('rowChangeKey normalizes cutoff rounds', () => {
    expect(rowChangeKey('C', '222', 'd')).toBe(rowChangeKey('C', '222', '1')); // d→1
    expect(rowChangeKey('C', '222', 'c')).toBe(rowChangeKey('C', '222', 'f')); // c→f
  });
  it('personRoundChangeKey distinguishes persons', () => {
    const a = personRoundChangeKey('2019WANY36', '222', '1');
    const b = personRoundChangeKey('2017OTHER01', '222', '1');
    expect(a).not.toBe(b);
  });
  it('canonicalRound buckets', () => {
    expect(canonicalRound('b')).toBe('1');
    expect(canonicalRound('e')).toBe('2');
    expect(canonicalRound('c')).toBe('f');
    expect(canonicalRound('z')).toBeNull();
  });
});

describe('buildPersonRoundChangeListMap', () => {
  it('keys by wcaId|event|round', () => {
    const changes = [
      mk({ wcaId: '2019WANY36', fields: [{ field: 'best', old: 1, new: 2 }] }),
      mk({ wcaId: '2017OTHER01', fields: [{ field: 'best', old: 3, new: 4 }] }),
    ];
    const map = buildPersonRoundChangeListMap(changes);
    expect(map.has(personRoundChangeKey('2019WANY36', '222', '1'))).toBe(true);
    expect(map.has(personRoundChangeKey('2017OTHER01', '222', '1'))).toBe(true);
  });
});

describe('computeWcaBestAverage', () => {
  it('Ao5 drops best+worst (Johor R1: avg 2.83)', () => {
    // attempts 4.74 2.70 2.97 0.78 2.81 → drop 0.78 + 4.74, mid three 2.70/2.81/2.97 → 2.83
    expect(computeWcaBestAverage([474, 270, 297, 78, 281], '222')).toEqual({ best: 78, average: 283 });
  });
  it('Ao5 recomputes after one solve changes', () => {
    expect(computeWcaBestAverage([474, 500, 297, 78, 281], '222')).toEqual({ best: 78, average: 351 });
  });
  it('Ao5 one DNF counts as worst', () => {
    expect(computeWcaBestAverage([500, -1, 300, 400, 350], '222')).toEqual({ best: 300, average: 417 });
  });
  it('Ao5 two DNF → average DNF', () => {
    expect(computeWcaBestAverage([500, -1, -1, 400, 350], '222')).toEqual({ best: 350, average: -1 });
  });
  it('FMC Mo3 mean*100', () => {
    expect(computeWcaBestAverage([25, 24, 26], '333fm')).toEqual({ best: 24, average: 2500 });
  });
  it('FMC Mo3 any DNF → average DNF', () => {
    expect(computeWcaBestAverage([25, -1, 26], '333fm')).toEqual({ best: 25, average: -1 });
  });
});

describe('effective value overlays', () => {
  const chain = [
    mk({ id: 1, fields: [{ field: 'attempts', old: [474, 270, 297, 78, 281], new: [474, 500, 297, 78, 281] }, { field: 'average', old: 283, new: 351 }] }),
  ];
  it('effectiveFieldValue returns latest new, else fallback', () => {
    expect(effectiveFieldValue(chain, 'average', 283)).toBe(351);
    expect(effectiveFieldValue(undefined, 'average', 283)).toBe(283);
  });
  it('effectiveAttempts returns latest new array', () => {
    expect(effectiveAttempts(chain, [474, 270, 297, 78, 281])).toEqual([474, 500, 297, 78, 281]);
  });
  it('attemptOldValues returns superseded value for the changed index only', () => {
    expect(attemptOldValues(chain, 1)).toEqual([270]);
    expect(attemptOldValues(chain, 0)).toEqual([]);
  });
});

// 管理员补录「原始各次成绩」:old=原始数组、new=当前 live 数组,旧单次/平均靠原始重算。
// 复刻 ResultChangeEditor.buildFields 在填了原始各次成绩时构造的那条变更。
describe('backfill original attempts (Johor 0.78 WR → corrected 2.83)', () => {
  const orig = [74, 70, 97, 78, 81];        // 原始(0.74 0.70 0.97 0.78 0.81)
  const live = [474, 270, 297, 78, 281];    // WCA 更正后(4.74 2.70 2.97 0.78 2.81)
  const chain = [
    mk({
      id: 1,
      effectiveAt: '2024-07-01',
      fields: [
        { field: 'attempts', old: orig, new: live },
        { field: 'best', old: 70, new: 78 },
        { field: 'average', old: 78, new: 283 },
      ],
    }),
  ];
  it('original single/average derive from the typed attempts', () => {
    expect(computeWcaBestAverage(orig, '222')).toEqual({ best: 70, average: 78 });
    expect(computeWcaBestAverage(live, '222')).toEqual({ best: 78, average: 283 });
  });
  it('current displayed values stay = live (corrected)', () => {
    expect(effectiveAttempts(chain, live)).toEqual(live);
    expect(effectiveFieldValue(chain, 'best', 78)).toBe(78);
    expect(effectiveFieldValue(chain, 'average', 283)).toBe(283);
  });
  it('each changed solve gets its original struck through; unchanged 0.78 does not', () => {
    expect(attemptOldValues(chain, 0)).toEqual([74]);
    expect(attemptOldValues(chain, 1)).toEqual([70]);
    expect(attemptOldValues(chain, 2)).toEqual([97]);
    expect(attemptOldValues(chain, 3)).toEqual([]); // 0.78 不变
    expect(attemptOldValues(chain, 4)).toEqual([81]);
  });
  it('single/average chains expose the original as struck-through', () => {
    expect(changeChainOldValues(chain, 'best')).toEqual([70]);
    expect(changeChainOldValues(chain, 'average')).toEqual([78]);
  });
});
