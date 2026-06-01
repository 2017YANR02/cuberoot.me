/**
 * rank-client — "我这个成绩在 WCA 历史里能排第几" 的前端查询.
 *
 * 给 /timer 的世界排名徽章用(Solo 停表 / Battle 每局结束).调服务器
 * GET /v1/wca/rank-for(精确按选手个人最佳去重的排名,见 server 端注释),
 * 失败/无 WCA 对应项目时静默返回 null —— 徽章直接不渲染,绝不抛错、绝不挡渲染.
 *
 * 注意:本地 dev 把 /v1 反代到 api.cuberoot.me,所以这个端点必须先部署到
 * 生产 api 才能在本地 dev 看到真实名次.
 */
import type { EventId } from '@/app/[lang]/timer/_lib/types';
import { toWcaEventForRank } from '@/app/[lang]/timer/_shared/event-bridge';
import { apiUrl } from '@/lib/api-base';

export interface RankResult {
  /** 1-based 世界排名(精确或饱和下界) */
  rank: number;
  /** true = 成绩太慢,服务器扫描截断,rank 是下界,应渲染 "#N+" */
  saturated: boolean;
}

/**
 * 查 (eventId, centis, type) 的世界排名.
 * @param eventId 计时器内部 EventId(可能是 relay/training/custom 等非 WCA 项).
 * @param centis  有效成绩,单位厘秒(centiseconds),正整数.
 * @param type    'single' | 'average'.
 * @returns {rank, saturated} | null（无 WCA 对应 / 网络错误 / 非法入参 -> null）.
 */
export async function fetchRankFor(
  eventId: string,
  centis: number,
  type: 'single' | 'average',
): Promise<RankResult | null> {
  const wcaEvent = toWcaEventForRank(eventId as EventId);
  if (!wcaEvent) return null; // relays / CFOP-LL 训练 / custom 等无 WCA 排名
  if (!Number.isFinite(centis) || centis <= 0) return null;
  const value = Math.round(centis);
  if (value <= 0) return null;

  // 这些项目无 average 排名(333mbf / 333fm 的 average 不是时间)
  if (type === 'average' && (wcaEvent === '333mbf' || wcaEvent === '333fm')) return null;

  try {
    const url = apiUrl(
      `/v1/wca/rank-for?event=${encodeURIComponent(wcaEvent)}&type=${type}&centis=${value}`,
    );
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { rank?: unknown; saturated?: unknown };
    if (typeof data?.rank !== 'number' || !Number.isFinite(data.rank)) return null;
    return { rank: data.rank, saturated: data.saturated === true };
  } catch {
    return null; // 离线 / CORS / 超时 —— 优雅降级,徽章隐藏
  }
}
