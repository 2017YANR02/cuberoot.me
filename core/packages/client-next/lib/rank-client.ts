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
  if (!wcaEvent) return null;
  if (!Number.isFinite(centis) || centis <= 0) return null;
  const value = Math.round(centis);
  if (value <= 0) return null;

  // 这些项目无 average 排名(333mbf / 333fm 的 average 不是时间)
  if (type === 'average' && (wcaEvent === '333mbf' || wcaEvent === '333fm')) return null;

  try {
    let path = `/v1/wca/rank-for?event=${encodeURIComponent(wcaEvent)}&type=${type}&centis=${value}`;
    if (country) path += `&country=${encodeURIComponent(country)}`;
    const res = await fetch(apiUrl(path));
    if (!res.ok) return null;
    const data = (await res.json()) as {
      rank?: unknown; total?: unknown;
      national?: unknown; continental?: unknown;
      country?: unknown; continent?: unknown;
    };
    const world = parseRegion({ rank: data?.rank, total: data?.total });
    if (!world) return null;
    return {
      world,
      national: parseRegion(data?.national),
      continental: parseRegion(data?.continental),
      country: typeof data?.country === 'string' ? data.country : undefined,
      continent: typeof data?.continent === 'string' ? data.continent : undefined,
    };
  } catch {
    return null; // 离线 / CORS / 超时 —— 优雅降级,徽章隐藏
  }
}
