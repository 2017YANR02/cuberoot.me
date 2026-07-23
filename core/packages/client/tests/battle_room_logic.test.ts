// 回归:/timer 联机对战的纯逻辑层(lib/battle-room-logic.ts)。
// 覆盖:有效成绩(罚时口径)、胜者判定(并列/全DNF/已离场)、玩家排序、在线判定、
// 时钟偏移 EMA、全员完赛/等待人数(离线者不阻塞)。
import { describe, it, expect } from 'vitest';
import {
  effectiveNetMs, roundWinners, sortedNetPlayers, isNetOnline, blendClockOffset,
  isRoundComplete, pendingCount, OFFLINE_MS, netEventToSelectorId, selectorIdToNetEvent, NET_EVENTS,
  playerTimeline, playerStats, roundViews, netErrorMessage, isNetAdmin, syncGate,
} from '@/lib/battle-room-logic';
import type { NetPlayerEntry, NetResult, NetRoomState, NetRoundHistory } from '@/lib/battle-room-api';

const NOW = 1_800_000_000_000;

function player(joined: number, over: Partial<NetPlayerEntry> = {}): NetPlayerEntry {
  return { name: 'P', joined, seen: NOW, ph: 'idle', at: NOW, ...over };
}

function state(over: Partial<NetRoomState>): NetRoomState {
  return {
    code: 'ABCDE', event: '333', round: 1, scrambles: { '333': "R U R' U'" },
    players: {}, results: {}, history: [], scores: {},
    admin: '', syncStart: false, startAt: null, now: NOW, ...over,
  };
}

const ok = (t: number): NetResult => ({ t, p: 'ok' });

describe('effectiveNetMs', () => {
  it('ok 原样,+2 加 2000,dnf 无穷', () => {
    expect(effectiveNetMs({ t: 9500, p: 'ok' })).toBe(9500);
    expect(effectiveNetMs({ t: 9500, p: '+2' })).toBe(11500);
    expect(effectiveNetMs({ t: 9500, p: 'dnf' })).toBe(Infinity);
  });
});

describe('roundWinners', () => {
  const players = { a: player(1), b: player(2), c: player(3) };
  it('最快有效成绩胜;+2 计入', () => {
    expect(roundWinners({ a: { t: 10000, p: 'ok' }, b: { t: 7000, p: '+2' } }, players)).toEqual(['b']);
    // +2 后反超:9000+2000 > 10000
    expect(roundWinners({ a: { t: 10000, p: 'ok' }, b: { t: 9000, p: '+2' } }, players)).toEqual(['a']);
  });
  it('并列都算胜者', () => {
    expect(roundWinners({ a: { t: 7770, p: 'ok' }, b: { t: 7770, p: 'ok' } }, players).sort()).toEqual(['a', 'b']);
  });
  it('全 DNF / 无成绩 / undefined → 空', () => {
    expect(roundWinners({ a: { t: 1, p: 'dnf' }, b: { t: 2, p: 'dnf' } }, players)).toEqual([]);
    expect(roundWinners({}, players)).toEqual([]);
    expect(roundWinners(undefined, players)).toEqual([]);
  });
  it('已离场玩家的成绩不参赛', () => {
    expect(roundWinners({ a: { t: 5000, p: 'ok' }, ghost: { t: 1000, p: 'ok' } }, players)).toEqual(['a']);
  });
  it('按项目分组:各项目各评各的最快胜者', () => {
    const mixed = {
      a: player(1, { event: '333' }), b: player(2, { event: '333' }),
      c: player(3, { event: '222' }), d: player(4, { event: '222' }),
    };
    // 333 组 a 更快、222 组 d 更快 → 两个胜者(即便 c/d 绝对时间比 a/b 快也各评各的)
    const w = roundWinners(
      { a: { t: 8000, p: 'ok' }, b: { t: 9000, p: 'ok' }, c: { t: 3000, p: 'ok' }, d: { t: 2000, p: 'ok' } },
      mixed,
    ).sort();
    expect(w).toEqual(['a', 'd']);
  });
  it('某项目组全 DNF → 该组无胜者,不影响别组', () => {
    const mixed = { a: player(1, { event: '333' }), c: player(3, { event: '222' }) };
    expect(roundWinners({ a: { t: 1, p: 'dnf' }, c: { t: 5000, p: 'ok' } }, mixed)).toEqual(['c']);
  });
});

describe('sortedNetPlayers / isNetOnline', () => {
  it('按加入顺序稳定排序', () => {
    const ids = sortedNetPlayers({ z: player(3), a: player(1), m: player(2) }).map(p => p.id);
    expect(ids).toEqual(['a', 'm', 'z']);
  });
  it('joined 相同按 id 兜底,顺序仍确定', () => {
    const ids = sortedNetPlayers({ b: player(1), a: player(1) }).map(p => p.id);
    expect(ids).toEqual(['a', 'b']);
  });
  it('心跳边界:恰好 OFFLINE_MS 在线,再多 1ms 离线', () => {
    expect(isNetOnline(player(1, { seen: NOW - OFFLINE_MS }), NOW)).toBe(true);
    expect(isNetOnline(player(1, { seen: NOW - OFFLINE_MS - 1 }), NOW)).toBe(false);
  });
});

describe('blendClockOffset', () => {
  it('首样本直取,后续 0.2 EMA 平滑', () => {
    const first = blendClockOffset(null, NOW + 500, NOW);
    expect(first).toBe(500);
    const second = blendClockOffset(first, NOW + 1500, NOW);
    expect(second).toBeCloseTo(500 + (1500 - 500) * 0.2);
  });
});

describe('isRoundComplete / pendingCount', () => {
  it('单人房不算完赛(没有对手无所谓一轮结束)', () => {
    const st = state({ players: { a: player(1) }, results: { '1': { a: { t: 1000, p: 'ok' } } } });
    expect(isRoundComplete(st)).toBe(false);
  });
  it('全员在线交卷 → 完赛;缺一人 → 未完 + 等待 1 人', () => {
    const players = { a: player(1), b: player(2) };
    expect(isRoundComplete(state({ players, results: { '1': { a: { t: 1, p: 'ok' }, b: { t: 2, p: 'ok' } } } }))).toBe(true);
    const half = state({ players, results: { '1': { a: { t: 1, p: 'ok' } } } });
    expect(isRoundComplete(half)).toBe(false);
    expect(pendingCount(half)).toBe(1);
  });
  it('离线未交卷者不阻塞完赛', () => {
    const players = { a: player(1), b: player(2), gone: player(3, { seen: NOW - OFFLINE_MS - 1 }) };
    const st = state({ players, results: { '1': { a: { t: 1, p: 'ok' }, b: { t: 2, p: 'ok' } } } });
    expect(isRoundComplete(st)).toBe(true);
    expect(pendingCount(st)).toBe(0);
  });
  it('轮次隔离:成绩挂在旧轮不算本轮', () => {
    const players = { a: player(1), b: player(2) };
    const st = state({ players, round: 2, results: { '1': { a: { t: 1, p: 'ok' }, b: { t: 2, p: 'ok' } } } });
    expect(isRoundComplete(st)).toBe(false);
    expect(pendingCount(st)).toBe(2);
  });
});

describe('isNetAdmin / syncGate', () => {
  const two = { a: player(1), b: player(2) };

  it('房主判定按服务端给的 admin;pid 为空不算', () => {
    const st = state({ players: two, admin: 'a' });
    expect(isNetAdmin(st, 'a')).toBe(true);
    expect(isNetAdmin(st, 'b')).toBe(false);
    expect(isNetAdmin(st, null)).toBe(false);
  });

  it('没开同时起表 → 不设门', () => {
    expect(syncGate(state({ players: two }), 'a').gated).toBe(false);
  });

  it('开了同时起表:2 人未交卷 → 设门,waiting 数只算未准备的', () => {
    const st = state({ players: two, syncStart: true });
    expect(syncGate(st, 'a')).toEqual({ gated: true, ready: false, waiting: 2 });
    const half = state({ players: { a: player(1, { ph: 'ready' }), b: player(2) }, syncStart: true });
    expect(syncGate(half, 'a')).toEqual({ gated: true, ready: true, waiting: 1 });
  });

  it('只剩 1 人未交卷(或独自在房)→ 不设门,一个人不用等谁', () => {
    const st = state({ players: two, syncStart: true, results: { '1': { b: ok(5000) } } });
    expect(syncGate(st, 'a').gated).toBe(false);
    expect(syncGate(state({ players: { a: player(1) }, syncStart: true }), 'a').gated).toBe(false);
  });

  it('已交卷的人不再被门拦;倒计时已落(startAt)也放行', () => {
    const done = state({ players: two, syncStart: true, results: { '1': { a: ok(5000) } } });
    expect(syncGate(done, 'a').gated).toBe(false);
    const counting = state({ players: two, syncStart: true, startAt: NOW + 3000 });
    expect(syncGate(counting, 'a').gated).toBe(false);
  });

  it('离线者不阻塞:仅剩 1 名在线未交卷 → 不设门', () => {
    const st = state({
      players: { a: player(1), gone: player(2, { seen: NOW - OFFLINE_MS - 1 }) },
      syncStart: true,
    });
    expect(syncGate(st, 'a').gated).toBe(false);
  });
});

describe('netErrorMessage', () => {
  it('裸 HTTP 404(后端无该路由)不透传状态码,翻成人话', () => {
    expect(netErrorMessage(new Error('HTTP 404')).zh).toBe('联机服务暂不可用,请稍后重试');
  });
  it('已知业务错误给对应措辞', () => {
    expect(netErrorMessage(new Error('room not found')).zh).toBe('房间不存在或已过期');
    expect(netErrorMessage(new Error('room full')).zh).toBe('房间人数已满');
    expect(netErrorMessage(new Error('name taken')).zh).toBe('这个名字房里已经有人用了,换一个');
    expect(netErrorMessage(new Error('not admin')).zh).toBe('你已不是房主了');
  });
  it('网络错误 + 5xx 各自归类', () => {
    expect(netErrorMessage(new TypeError('Failed to fetch')).zh).toBe('网络连接失败,请检查网络');
    expect(netErrorMessage(new Error('HTTP 500')).zh).toBe('服务器开小差了,请稍后重试');
  });
});

describe('event id 映射', () => {
  it('双向互逆(整表)', () => {
    for (const ev of NET_EVENTS) {
      expect(selectorIdToNetEvent(netEventToSelectorId(ev))).toBe(ev);
    }
  });
});

// history 各轮的构造:round 递增,results 存该轮成绩(默认全 333 单项目)
function hist(round: number, results: Record<string, NetResult>, winners: string[] = []): NetRoundHistory {
  const playerEvents: Record<string, string> = {};
  for (const id of Object.keys(results)) playerEvents[id] = '333';
  return { round, scrambles: { '333': `S${round}` }, playerEvents, results, winners };
}

describe('playerTimeline', () => {
  it('历史各轮 + 当前轮(旧→新),缺席轮跳过', () => {
    const st = state({
      round: 3,
      history: [
        hist(1, { a: ok(1000), b: ok(2000) }),
        hist(2, { a: ok(1200) }), // b 该轮缺席
      ],
      results: { '3': { a: ok(900), b: ok(1500) } },
    });
    expect(playerTimeline(st, 'a').map(r => r.t)).toEqual([1000, 1200, 900]);
    expect(playerTimeline(st, 'b').map(r => r.t)).toEqual([2000, 1500]);
  });
  it('当前轮未交 → 只算历史', () => {
    const st = state({ round: 2, history: [hist(1, { a: ok(1000) })], results: {} });
    expect(playerTimeline(st, 'a').map(r => r.t)).toEqual([1000]);
  });
});

describe('playerStats', () => {
  it('single/mean/ao5 基本口径', () => {
    // 7 次:1..7 秒
    const rs = [1000, 2000, 3000, 4000, 5000, 6000, 7000].map(ok);
    const s = playerStats(rs);
    expect(s.count).toBe(7);
    expect(s.single).toBe(1000);
    expect(s.mean).toBe(4000); // (1+..+7)/7 = 4
    // ao5 末 5 = 3,4,5,6,7 去掉 3 和 7,中 3 = (4+5+6)/3 = 5000
    expect(s.ao5).toBe(5000);
  });
  it('不足 5 次 ao5 = null', () => {
    expect(playerStats([ok(1000), ok(2000)]).ao5).toBeNull();
  });
  it('mean 任一 DNF 即 Infinity;single 仍取有效最快', () => {
    const rs: NetResult[] = [ok(1000), { t: 500, p: 'dnf' }, ok(3000)];
    const s = playerStats(rs);
    expect(s.single).toBe(1000);
    expect(s.mean).toBe(Infinity);
  });
  it('ao5 恰 1 个 DNF → DNF 当最差被去掉;≥2 个 DNF → Infinity', () => {
    const one: NetResult[] = [ok(1000), ok(2000), ok(3000), ok(4000), { t: 9, p: 'dnf' }];
    expect(playerStats(one).ao5).toBe(3000); // 去掉 1000 和 DNF,中 3 = (2+3+4)/3
    const two: NetResult[] = [ok(1000), ok(2000), ok(3000), { t: 9, p: 'dnf' }, { t: 8, p: 'dnf' }];
    expect(playerStats(two).ao5).toBe(Infinity);
  });
  it('空序列全 null', () => {
    expect(playerStats([])).toEqual({ count: 0, single: null, ao5: null, mean: null });
  });
});

describe('roundViews', () => {
  it('当前轮置顶(live)+ 历史新→旧', () => {
    const st = state({
      round: 3,
      scrambles: { '333': 'CUR' },
      players: { a: player(1, { event: '333' }), b: player(2, { event: '333' }) },
      history: [hist(1, { a: ok(1000) }, ['a']), hist(2, { a: ok(900) }, ['a'])],
      results: { '3': { a: ok(800), b: ok(1200) } },
    });
    const views = roundViews(st);
    expect(views.map(v => v.round)).toEqual([3, 2, 1]);
    expect(views[0]).toMatchObject({ live: true });
    expect(views[0].scrambles).toEqual({ '333': 'CUR' });
    expect(views[0].playerEvents).toEqual({ a: '333', b: '333' });
    expect(views[0].winners).toEqual(['a']); // 800 < 1200
    expect(views[1].live).toBe(false);
  });
});
