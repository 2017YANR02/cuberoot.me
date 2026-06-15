import { describe, it, expect } from 'vitest';
import {
  parseHumanResult,
  changeChainOldValues,
  buildRowChangeListMap,
  buildPersonRoundChangeListMap,
  rowChangeKey,
  personRoundChangeKey,
  canonicalRound,
  type ResultChange,
} from '@/lib/result-watch-api';

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
