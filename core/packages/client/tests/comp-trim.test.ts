// /v1/cubing-live 的 ?only= 首屏分片(server/src/utils/comp_trim.ts)。
// 比赛页首屏只渲染当前项目 —— 分片必须:①带上该项目「全部」轮次(双轮合并榜要两轮都在);
// ②users / personalRecords 同步收窄;③events 元数据整份保留(项目栏、轮次切换靠它);
// ④打上 partial 标记(客户端据此再拉全量);⑤认不出的 only 一律返回 null → 调用方发全量。
import { describe, it, expect } from 'vitest';
import { trimToRounds, eventRoundKeys, resolveOnlyKeys, type TrimmableComp } from '../../server/src/utils/comp_trim';

const COMP: TrimmableComp = {
  events: [
    { i: '333', rs: [{ i: '1' }, { i: 'f' }] },
    { i: '333fm', rs: [{ i: '1' }, { i: 'f' }] },
    { i: '444', rs: [{ i: 'f' }] }, // 报了名但还没成绩
  ],
  users: {
    '1': { wcaid: '2015AAAA01' },
    '2': { wcaid: '2016BBBB02' },
    '3': { wcaid: '2017CCCC03' },
    '9': { wcaid: '2018DDDD09' }, // 只报了 333,不该出现在 333fm 分片里
  },
  resultsByRound: {
    '333:1': [{ n: 9 }],
    '333:f': [{ n: 9 }],
    '333fm:1': [{ n: 1 }, { n: 2 }],
    '333fm:f': [{ n: 2 }, { n: 3 }],
    '444:f': [],
  },
  personalRecords: {
    '2015AAAA01': { '333fm': {} },
    '2016BBBB02': { '333fm': {} },
    '2017CCCC03': { '333fm': {} },
    '2018DDDD09': { '333': {} },
  },
};

const defaultEvent = () => '333';

describe('eventRoundKeys', () => {
  it('列出该项目所有有成绩的轮次', () => {
    expect(eventRoundKeys(COMP, '333fm')).toEqual(['333fm:1', '333fm:f']);
  });
  it('无成绩的轮次不算(444 只有空数组)', () => {
    expect(eventRoundKeys(COMP, '444')).toEqual([]);
  });
  it('项目不存在 → 空', () => {
    expect(eventRoundKeys(COMP, '666')).toEqual([]);
  });
  it('前缀不误伤:333 不吃掉 333fm 的轮次', () => {
    expect(eventRoundKeys(COMP, '333')).toEqual(['333:1', '333:f']);
  });
});

describe('trimToRounds', () => {
  const out = trimToRounds(COMP, eventRoundKeys(COMP, '333fm'));

  it('只留该项目的轮次(双轮都在)', () => {
    expect(Object.keys(out.resultsByRound).sort()).toEqual(['333fm:1', '333fm:f']);
  });
  it('users 收窄到这些轮出现过的选手', () => {
    expect(Object.keys(out.users).sort()).toEqual(['1', '2', '3']);
  });
  it('personalRecords 跟着收窄', () => {
    expect(Object.keys(out.personalRecords!).sort()).toEqual(['2015AAAA01', '2016BBBB02', '2017CCCC03']);
  });
  it('events 元数据整份保留', () => {
    expect(out.events).toEqual(COMP.events);
  });
  it('打上 partial 标记', () => {
    expect(out.partial).toBe(true);
  });
  it('不改原对象', () => {
    expect(Object.keys(COMP.resultsByRound).length).toBe(5);
    expect(COMP.partial).toBeUndefined();
  });
});

describe('resolveOnlyKeys', () => {
  it('<event> → 整个项目', () => {
    expect(resolveOnlyKeys(COMP, '333fm', defaultEvent)).toEqual(['333fm:1', '333fm:f']);
  });
  it('<event>:<round> → 单轮', () => {
    expect(resolveOnlyKeys(COMP, '333fm:f', defaultEvent)).toEqual(['333fm:f']);
  });
  it('auto → 默认项目', () => {
    expect(resolveOnlyKeys(COMP, 'auto', defaultEvent)).toEqual(['333:1', '333:f']);
  });
  it('项目没成绩 → null(回全量),不返回空表格', () => {
    expect(resolveOnlyKeys(COMP, '444', defaultEvent)).toBeNull();
  });
  it('不存在的项目 / 轮次 / 乱码 → null', () => {
    expect(resolveOnlyKeys(COMP, '666', defaultEvent)).toBeNull();
    expect(resolveOnlyKeys(COMP, '333fm:zzz', defaultEvent)).toBeNull();
    expect(resolveOnlyKeys(COMP, 'a:b:c', defaultEvent)).toBeNull();
  });
  it('auto 但比赛一场成绩都没有 → null', () => {
    expect(resolveOnlyKeys(COMP, 'auto', () => null)).toBeNull();
  });
});
