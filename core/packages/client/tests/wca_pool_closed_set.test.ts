/**
 * 稀有难度档的「封闭集」契约:服务端在全时段(无 from/to)路径上是扫完全集再 LIMIT,
 * 所以「要 FETCH_COUNT 条却回得更少」== 匹配全集就这么多。池子据此把全集存下本地循环,
 * 不再为同样几条真题反复打那个 1.4-2.6s 的全分区扫描查询(0 步十字 / 8 步双色十字全库仅 2-4 条)。
 *
 * 回归点:改 fillDate 的采样/封闭判定时,若不慎让常见档也被判成封闭,出题会被固定 50 条垄断;
 * 若让稀有档不再封闭,用户每出两三题就卡一次转圈(本测试的 fetch 调用次数即是那个症状的代理指标)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WcaSourceSpec } from '@/app/[lang]/timer/_lib/scramble/wca_pool';

vi.mock('@/lib/api-base', () => ({ apiUrl: (p: string) => `http://test${p}` }));

const baseSpec: WcaSourceSpec = {
  event: '333', mode: 'date', comp: '', compName: '', round: '', group: '',
  from: '', to: '', optimal: false,
};

/** 服务端一条真题的响应形状(只用到 pool 读的字段)。 */
function item(n: number) {
  return { scramble: `R U${' '.repeat(0)} F${n}`, ci: 'C1', cn: 'Comp One', e: '333', r: '1', g: 'A', n, x: 0 as const };
}

/** 每个用例都要全新模块实例 —— pools / closedFor 是模块级状态。 */
async function freshPool() {
  vi.resetModules();
  return import('@/app/[lang]/timer/_lib/scramble/wca_pool');
}

function mockFetch(rows: number) {
  const fn = vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({ event: '333', scrambles: Array.from({ length: rows }, (_, i) => item(i)) }),
  }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => { vi.unstubAllGlobals(); });

describe('wca_pool 封闭集(稀有难度档)', () => {
  const rareSpec: WcaSourceSpec = {
    ...baseSpec,
    diff: { variant: 'std', stage: 'cross', colors: 'WY', steps: [8] },
  };

  it('回得少于所要条数 → 认定为全集,之后只本地循环不再联网', async () => {
    const fetchFn = mockFetch(2); // 全库仅 2 条(生产实测 colors=WY steps=8)
    const { nextWca, peekWca } = await freshPool();

    expect(await nextWca(rareSpec)).toBeTruthy();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // 反复出题:队列见底会触发 fill,但封闭后走本地洗牌灌回,不再发请求。
    for (let i = 0; i < 40; i++) {
      const s = peekWca(rareSpec) ?? (await nextWca(rareSpec));
      expect(s).toBeTruthy();
      await Promise.resolve(); // 让后台 fill 的 microtask 跑完
    }
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('只端出那 2 条真题(重复是预期的,内容不能凭空多出来)', async () => {
    mockFetch(2);
    const { nextWca, peekWca } = await freshPool();
    await nextWca(rareSpec);
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const s = peekWca(rareSpec) ?? (await nextWca(rareSpec));
      if (s) seen.add(s);
      await Promise.resolve();
    }
    expect(seen.size).toBe(2);
  });

  it('回满 FETCH_COUNT(常见档)→ 不封闭,继续按需联网采样新批次', async () => {
    const fetchFn = mockFetch(50); // 服务端上限,说明还有更多没捞完
    const { nextWca, peekWca } = await freshPool();

    await nextWca(rareSpec);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    // 消耗到低于 REFILL_AT(8)必须重新联网 —— 否则常见档会被首批 50 条垄断。
    for (let i = 0; i < 45; i++) { peekWca(rareSpec); await Promise.resolve(); }
    expect(fetchFn.mock.calls.length).toBeGreaterThan(1);
  });

  it('遍历进度 seen/total:逐条累加,练满即 seen == total 且不再增长', async () => {
    mockFetch(2);
    const { nextWca, peekWca, wcaPoolProgress } = await freshPool();

    // 首条出题前总数未知(还没联网 → 未封闭)。
    expect(wcaPoolProgress(rareSpec)).toBeNull();

    await nextWca(rareSpec);
    expect(wcaPoolProgress(rareSpec)).toEqual({ total: 2, seen: 1 });

    // 端出第二条(不同的一条)→ 遍历完成。
    let guard = 0;
    while ((wcaPoolProgress(rareSpec)?.seen ?? 0) < 2 && guard++ < 20) {
      peekWca(rareSpec); await Promise.resolve();
    }
    expect(wcaPoolProgress(rareSpec)).toEqual({ total: 2, seen: 2 });

    // 之后是重复出题,seen 不会超过 total(UI 的「已练 n/N」不能显示 3/2)。
    for (let i = 0; i < 15; i++) { peekWca(rareSpec); await Promise.resolve(); }
    expect(wcaPoolProgress(rareSpec)).toEqual({ total: 2, seen: 2 });
  });

  it('常见档(回满)不报进度 —— UI 不该显示「已练 n/50」', async () => {
    mockFetch(50);
    const { nextWca, wcaPoolProgress } = await freshPool();
    await nextWca(rareSpec);
    expect(wcaPoolProgress(rareSpec)).toBeNull();
  });

  it('有日期范围时不判封闭(那条路是 comp-sampling,回得少 ≠ 穷尽)', async () => {
    const fetchFn = mockFetch(2);
    const dated: WcaSourceSpec = { ...rareSpec, from: '2015-01-01', to: '2016-01-01' };
    const { nextWca, peekWca } = await freshPool();

    await nextWca(dated);
    const first = fetchFn.mock.calls.length;
    for (let i = 0; i < 10; i++) { peekWca(dated); await Promise.resolve(); }
    expect(fetchFn.mock.calls.length).toBeGreaterThan(first);
  });
});
