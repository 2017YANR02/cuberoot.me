/**
 * rank-client — "我这个成绩在 WCA 历史里能排第几" 的前端查询.
 *
 * 给 /timer 的排名徽章用(Solo 停表 / Battle 每局结束).调服务器
 * GET /v1/wca/rank-for(精确按选手个人最佳去重的排名,见 server 端注释).
 * 传入 country(iso2)时额外返回 NR(国家)/ CR(大洲)排名.
 * 失败/无 WCA 对应项目时静默返回 null —— 徽章直接不渲染,绝不抛错、绝不挡渲染.
 *
 * 注意:本地 dev 把 /v1 反代到 api.cuberoot.me,所以这个端点必须先部署到
 * 生产 api 才能在本地 dev 看到真实名次(NR/CR 字段同理,部署后才有).
 */
import type { EventId } from '@/app/[lang]/timer/_lib/types';
import { toWcaEventForRank } from '@/app/[lang]/timer/_shared/event-bridge';
import { apiUrl } from '@/lib/api-base';

/** 单个地域档位的名次 + 上榜总数(算百分位用). */
export interface RegionRank {
  /** 1-based 精确名次(按选手个人最佳去重,PR 严格小于本成绩的人数 + 1) */
  rank: number;
  /** 该档位上榜选手总数 */
  total: number;
}

export interface RankResult {
  /** 世界排名(始终有) */
  world: RegionRank;
  /** 国家排名(传了有效 country 且服务端部署后才有) */
  national: RegionRank | null;
  /** 大洲排名(同上) */
  continental: RegionRank | null;
  /** 服务端回显的国家 iso2 / 大洲 id */
  country?: string;
  continent?: string;
}

function parseRegion(v: unknown): RegionRank | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { rank?: unknown; total?: unknown };
  if (typeof o.rank !== 'number' || !Number.isFinite(o.rank)) return null;
  const total = typeof o.total === 'number' && Number.isFinite(o.total) ? o.total : 0;
  return { rank: o.rank, total };
}

/** rank-for / rank-for-batch 单条响应({rank,total,national,continental})→ RankResult|null. */
function parseRankResult(v: unknown): RankResult | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { rank?: unknown; total?: unknown; national?: unknown; continental?: unknown; country?: unknown; continent?: unknown };
  const world = parseRegion({ rank: o.rank, total: o.total });
  if (!world) return null;
  return {
    world,
    national: parseRegion(o.national),
    continental: parseRegion(o.continental),
    country: typeof o.country === 'string' ? o.country : undefined,
    continent: typeof o.continent === 'string' ? o.continent : undefined,
  };
}

// ── 模块级缓存:让排名「秒出」──────────────────────────────────────────────
// 同一会话内,(event,type,value,country) 的名次只查一次.比赛页在轮次成绩加载时
// 用 prefetchRanksForWca 批量预热;成绩弹窗打开时同步读缓存即瞬时显示,未命中才回退单查.
// 值含义:RankResult=有名次 / null=查过但无(项目不支持/解析失败) / 不存在 key=没查过.
const rankCache = new Map<string, RankResult | null>();
const rankInflight = new Set<string>();

function rankKey(wcaEvent: string, type: string, value: number, country?: string): string {
  return `${wcaEvent}|${type}|${value}|${(country || '').toUpperCase()}`;
}

/** 同 fetchRankForWca 的入参校验,返回归一化后的 (value, key);非法返 null. */
function normRankArgs(
  wcaEvent: string,
  centis: number,
  type: 'single' | 'average',
  country?: string,
): { value: number; key: string } | null {
  if (!wcaEvent) return null;
  if (!Number.isFinite(centis) || centis <= 0) return null;
  const value = Math.round(centis);
  if (value <= 0) return null;
  if (type === 'average' && (wcaEvent === '333mbf' || wcaEvent === '333fm')) return null;
  return { value, key: rankKey(wcaEvent, type, value, country) };
}

/**
 * 同步读缓存,不发请求.
 * 返回 RankResult(已缓存有名次)/ null(已查无 或 入参非法,无需再查)/ undefined(没查过,需 fetch).
 */
export function getCachedRankForWca(
  wcaEvent: string,
  centis: number,
  type: 'single' | 'average',
  country?: string,
): RankResult | null | undefined {
  const n = normRankArgs(wcaEvent, centis, type, country);
  if (!n) return null; // 非法 = 确定无名次,不触发 fetch
  return rankCache.get(n.key);
}

interface RankQuery { event: string; type: 'single' | 'average'; value: number; country?: string }

/** 批量预取一组 (event,type,value,country) 的名次进缓存(一次 POST /v1/wca/rank-for-batch).
 *  已缓存/在途的自动跳过;失败静默(下次再试).不返回数据,只为预热缓存. */
export async function prefetchRanksForWca(items: RankQuery[]): Promise<void> {
  const toFetch: { q: RankQuery; value: number; key: string }[] = [];
  for (const it of items) {
    const n = normRankArgs(it.event, it.value, it.type, it.country);
    if (!n) continue;
    if (rankCache.has(n.key) || rankInflight.has(n.key)) continue;
    rankInflight.add(n.key);
    toFetch.push({ q: it, value: n.value, key: n.key });
  }
  if (toFetch.length === 0) return;
  try {
    const res = await fetch(apiUrl('/v1/wca/rank-for-batch'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: toFetch.map(t => ({ event: t.q.event, type: t.q.type, value: t.value, country: t.q.country })),
      }),
    });
    if (!res.ok) { for (const t of toFetch) rankInflight.delete(t.key); return; }
    const data = (await res.json()) as { results?: unknown[] };
    const arr = Array.isArray(data?.results) ? data.results : [];
    toFetch.forEach((t, i) => {
      rankCache.set(t.key, parseRankResult(arr[i]));
      rankInflight.delete(t.key);
    });
  } catch {
    for (const t of toFetch) rankInflight.delete(t.key); // 网络错误不缓存,下次再试
  }
}

/**
 * 查 (eventId, centis, type[, country]) 的排名.
 * @param eventId 计时器内部 EventId(可能是 relay/training/custom 等非 WCA 项).
 * @param centis  有效成绩,单位厘秒(centiseconds),正整数.
 * @param type    'single' | 'average'.
 * @param country 可选,用户国家 iso2(如 'US' / 'CN').传了才返回 NR/CR.
 * @returns RankResult | null（无 WCA 对应 / 网络错误 / 非法入参 -> null）.
 */
export async function fetchRankFor(
  eventId: string,
  centis: number,
  type: 'single' | 'average',
  country?: string,
): Promise<RankResult | null> {
  const wcaEvent = toWcaEventForRank(eventId as EventId);
  if (!wcaEvent) return null; // relays / CFOP-LL 训练 / custom 等无 WCA 排名
  return fetchRankForWca(wcaEvent, centis, type, country);
}

/**
 * 同 fetchRankFor,但直接收 WCA 标准 event id(如 '333' / '333bf' / 'minx'),
 * 跳过 timer EventId 映射.给已持有 WCA id 的页面用(如 /wca/comp 的成绩弹窗).
 */
export async function fetchRankForWca(
  wcaEvent: string,
  centis: number,
  type: 'single' | 'average',
  country?: string,
): Promise<RankResult | null> {
  const n = normRankArgs(wcaEvent, centis, type, country);
  if (!n) return null;
  if (rankCache.has(n.key)) return rankCache.get(n.key) ?? null; // 命中缓存,瞬时

  try {
    let path = `/v1/wca/rank-for?event=${encodeURIComponent(wcaEvent)}&type=${type}&centis=${n.value}`;
    if (country) path += `&country=${encodeURIComponent(country)}`;
    const res = await fetch(apiUrl(path));
    if (!res.ok) return null;
    const result = parseRankResult(await res.json());
    rankCache.set(n.key, result); // 缓存(含 null = 确定无名次),供后续秒出
    return result;
  } catch {
    return null; // 离线 / CORS / 超时 —— 优雅降级,徽章隐藏(不缓存,下次可重试)
  }
}
