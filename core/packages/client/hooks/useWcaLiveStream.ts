// 订阅 WCA Live 的 GraphQL subscription `roundUpdated` —— 整批 round 数据推送。
// 协议:Phoenix Channels + Absinthe (wca-live 仓库 schema/scoretaking_subscription_types.ex)。
//
// 跟现在 cubing.com WS 那套对称:初始快照走 server /v1/cubing-live(WCA Live 源),
// 这里只负责后续增量。subscription 收到的 round 是完整 results 列表,直接整批替换。
//
// phoenix + @absinthe/socket 走动态 import — 这俩加传递依赖 ~20 KB gzip,
// 静态 import 会被 CompDetailPage(主 bundle 内常驻)拉进所有页面首屏。

import { useEffect, useRef, useState } from 'react';
import type { LiveResultRow, WsStatus } from './useLiveStream';

const WCA_LIVE_WS = 'wss://live.worldcubeassociation.org/socket';

export interface WcaLiveRoundUpdate {
  eventId: string;
  roundTypeId: string;       // '1'/'2'/'3'/'f' 等(client 端 round.i)
  format: string;
  rows: LiveResultRow[];
}

interface UseWcaLiveStreamArgs {
  /** 同时订阅的 round liveId → (eventId, roundTypeId, format) 映射 */
  rounds: { liveId: string; eventId: string; roundTypeId: string; format: string }[];
  /** WCA ID → number 映射(server 端已经分配过号,这里复用) */
  numByWcaId: Map<string, number>;
  onRoundUpdate: (update: WcaLiveRoundUpdate) => void;
}

const ROUND_SUBSCRIPTION = `
  subscription RoundUpdated($id: ID!) {
    roundUpdated(id: $id) {
      id format { id }
      results {
        id ranking best average
        singleRecordTag averageRecordTag
        attempts { result }
        person { name wcaId country { iso2 } }
      }
    }
  }
`;

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

export function useWcaLiveStream({ rounds, numByWcaId, onRoundUpdate }: UseWcaLiveStreamArgs) {
  const [status, setStatus] = useState<WsStatus>('idle');
  const onUpdateRef = useRef(onRoundUpdate);
  onUpdateRef.current = onRoundUpdate;
  const numByWcaIdRef = useRef(numByWcaId);
  numByWcaIdRef.current = numByWcaId;

  useEffect(() => {
    if (rounds.length === 0) return;
    setStatus('connecting');

    // 捕获到 cleanup 闭包里 — async 加载完才有值;cleanup 同步触发时若 null 就跳过
    let phoenixSocket: { disconnect: () => void } | null = null;
    let absintheSocket: unknown = null;
    let AbsintheSocketMod: typeof import('@absinthe/socket') | null = null;
    const notifiers: unknown[] = [];
    let alive = true;
    let cancelled = false;

    void (async () => {
      const [{ Socket: PhoenixSocket }, AbsintheSocket] = await Promise.all([
        import('phoenix'),
        import('@absinthe/socket'),
      ]);
      if (cancelled) return;
      AbsintheSocketMod = AbsintheSocket;
      phoenixSocket = new PhoenixSocket(WCA_LIVE_WS, {});
      absintheSocket = AbsintheSocket.create(phoenixSocket as Parameters<typeof AbsintheSocket.create>[0]);

      for (const link of rounds) {
        const notifier = AbsintheSocket.send(absintheSocket as Parameters<typeof AbsintheSocket.send>[0], {
          operation: ROUND_SUBSCRIPTION,
          variables: { id: link.liveId },
        });
        AbsintheSocket.observe(absintheSocket as Parameters<typeof AbsintheSocket.observe>[0], notifier, {
          onAbort: () => setStatus('error'),
          onError: () => setStatus('error'),
          onStart: () => { if (alive) setStatus('open'); },
          onResult: (resp: { data?: { roundUpdated?: { results: AbsRoundResult[]; format: { id: string } } }; errors?: unknown[] }) => {
            const r = resp?.data?.roundUpdated;
            if (!r) return;
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
            onUpdateRef.current({
              eventId: link.eventId,
              roundTypeId: link.roundTypeId,
              format: r.format.id,
              rows,
            });
          },
        });
        notifiers.push(notifier);
      }
    })();

    return () => {
      cancelled = true;
      alive = false;
      if (AbsintheSocketMod && absintheSocket) {
        for (const n of notifiers) {
          try { AbsintheSocketMod.cancel(absintheSocket as Parameters<typeof AbsintheSocketMod.cancel>[0], n as Parameters<typeof AbsintheSocketMod.cancel>[1]); } catch { /* noop */ }
        }
      }
      try { phoenixSocket?.disconnect(); } catch { /* noop */ }
      setStatus('closed');
    };
  // rounds 重新 mount 才订阅,所以 dep 用 JSON 稳定 key 而不是数组引用
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rounds)]);

  return status;
}
