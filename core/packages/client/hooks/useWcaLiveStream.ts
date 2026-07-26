// 跟踪 WCA Live 的轮次成绩 —— 轮询 GraphQL HTTP query,不是 subscription。
//
// 为什么不用 subscription:WCA Live 的 Phoenix socket 配了严格的 check_origin,只放行
// live.worldcubeassociation.org 自己。浏览器强制发 Origin 且不可改,所以从我们的页面连
// wss://live.worldcubeassociation.org/socket 恒 403(2026-07-26 实测:自家 Origin 与不带
// Origin 的非浏览器客户端 → 101;cuberoot.me / example.com / localhost / 连 WCA 主站 → 403)。
// 这条路对任何第三方站点都不通,不是配置问题。
//
// 同一个服务的 HTTP GraphQL 口(/api)却是全开的:access-control-allow-origin: *,
// preflight 放行,字段与 subscription 完全一致。单轮响应 ~3.3KB,别名批量三轮 ~5KB。
// 于是改成轮询:比 WS 慢一个轮询周期,但 WS 那条路是 0% 可用。
//
// 跟 cubing.com WS 那套(useLiveStream,中国比赛)对称:初始快照走 server
// /v1/cubing-live(WCA Live 源),这里只负责后续增量,拿到的 round 是完整 results 列表。

import { useEffect, useRef, useState } from 'react';
import type { LiveResultRow, WsStatus } from './useLiveStream';

const WCA_LIVE_API = 'https://live.worldcubeassociation.org/api';
/** 轮询间隔。成绩录入本身就有延迟,15s 的滞后观赛无感;别再压低 —— 每个观众都直接打
 *  WCA Live,大赛几百人同时看时这个数字乘出去就是它要扛的 QPS。 */
const POLL_MS = 15_000;

export interface WcaLiveRoundUpdate {
  eventId: string;
  roundTypeId: string;       // '1'/'2'/'3'/'f' 等(client 端 round.i)
  format: string;
  rows: LiveResultRow[];
}

interface UseWcaLiveStreamArgs {
  /** 同时跟踪的 round liveId → (eventId, roundTypeId, format) 映射 */
  rounds: { liveId: string; eventId: string; roundTypeId: string; format: string }[];
  /** WCA ID → number 映射(server 端已经分配过号,这里复用) */
  numByWcaId: Map<string, number>;
  onRoundUpdate: (update: WcaLiveRoundUpdate) => void;
}

interface AbsRoundResult {
  id: string;
  ranking: number | null;
  best: number | null;
  average: number | null;
  singleRecordTag: string | null;
  averageRecordTag: string | null;
  attempts: { result: number }[];
  person: { name: string; wcaId: string; country: { iso2: string } };
}

interface AbsRound {
  id: string;
  format: { id: string };
  results: AbsRoundResult[];
}

/** 一次请求取回所有跟踪中的轮次:每轮一个别名 + 一个 ID 变量,字段走 fragment 不重复。 */
function buildBatchQuery(count: number): string {
  const params = Array.from({ length: count }, (_, i) => `$id${i}: ID!`).join(', ');
  const picks = Array.from({ length: count }, (_, i) => `r${i}: round(id: $id${i}) { ...RoundData }`).join('\n    ');
  return `
  query Rounds(${params}) {
    ${picks}
  }
  fragment RoundData on Round {
    id format { id }
    results {
      id ranking best average
      singleRecordTag averageRecordTag
      attempts { result }
      person { name wcaId country { iso2 } }
    }
  }`;
}

export function useWcaLiveStream({ rounds, numByWcaId, onRoundUpdate }: UseWcaLiveStreamArgs) {
  const [status, setStatus] = useState<WsStatus>('idle');
  const onUpdateRef = useRef(onRoundUpdate);
  onUpdateRef.current = onRoundUpdate;
  const numByWcaIdRef = useRef(numByWcaId);
  numByWcaIdRef.current = numByWcaId;

  useEffect(() => {
    if (rounds.length === 0) return;
    setStatus('connecting');

    const query = buildBatchQuery(rounds.length);
    const variables: Record<string, string> = {};
    rounds.forEach((r, i) => { variables[`id${i}`] = r.liveId; });

    let cancelled = false;
    let timer: number | null = null;
    let inflight: AbortController | null = null;
    // 每轮上一次的 rows 指纹:WCA Live 每次都回完整 results,不比对就会每 15s 整批替换一次
    // data,把成绩表整个 re-render 一遍(大赛上千行)。内容没变就什么都不做。
    const lastSeen = new Map<string, string>();

    const emit = (link: UseWcaLiveStreamArgs['rounds'][number], r: AbsRound) => {
      const map = numByWcaIdRef.current;
      const rows: LiveResultRow[] = [];
      for (const res of r.results) {
        const wid = res.person.wcaId;
        const num = wid ? (map.get(wid) ?? 0) : 0; // 未知选手 num=0;UI 渲染会跳过
        rows.push({
          i: parseInt(res.id, 10) || 0, c: 0, n: num,
          e: link.eventId, r: link.roundTypeId, f: r.format.id,
          b: res.best ?? 0, a: res.average ?? 0,
          v: res.attempts.map(a => a.result),
          sr: res.singleRecordTag ?? '',
          ar: res.averageRecordTag ?? '',
        });
      }
      const fingerprint = JSON.stringify(rows);
      if (lastSeen.get(link.liveId) === fingerprint) return;
      lastSeen.set(link.liveId, fingerprint);
      onUpdateRef.current({
        eventId: link.eventId,
        roundTypeId: link.roundTypeId,
        format: r.format.id,
        rows,
      });
    };

    const poll = async () => {
      if (cancelled) return;
      inflight?.abort();
      const ac = new AbortController();
      inflight = ac;
      try {
        const res = await fetch(WCA_LIVE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables }),
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { data?: Record<string, AbsRound | null> };
        if (cancelled) return;
        if (!json.data) throw new Error('no data');
        rounds.forEach((link, i) => {
          const r = json.data?.[`r${i}`];
          if (r) emit(link, r);
        });
        setStatus('open');
      } catch (e) {
        if (cancelled || (e as Error).name === 'AbortError') return;
        // 一次失败不代表断了 —— 保持定时器继续试,只把指示灯打成 error
        setStatus('error');
      }
    };

    // 页面切到后台就停(不烧别人的 API 也不烧用户流量),回到前台立刻补一次再继续
    const schedule = () => {
      if (timer !== null) return;
      timer = window.setInterval(() => { void poll(); }, POLL_MS);
    };
    const unschedule = () => {
      if (timer !== null) { clearInterval(timer); timer = null; }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { void poll(); schedule(); }
      else { unschedule(); inflight?.abort(); }
    };

    void poll();
    schedule();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      unschedule();
      inflight?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
      setStatus('closed');
    };
  // rounds 变了才重建轮询,所以 dep 用 JSON 稳定 key 而不是数组引用
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rounds)]);

  return status;
}
