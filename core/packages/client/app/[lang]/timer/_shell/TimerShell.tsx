'use client';

/**
 * TimerShell — the mode host for /timer.
 *
 * One URL param owns the whole experience: ?players=1..4 | net (nuqs, default
 * 1, force-written even when default via clearOnDefault:false — a bare /timer
 * gets ?players=1 on first paint so the URL is always shareable/bookmarkable
 * with the exact mode). players=1 renders SoloView; players>=2
 * renders BattleView (2 = the original versus/side duo, 3/4 = 田字格 grid);
 * players=net renders NetBattleView (多设备联机对战:创建/加入房间,各自设备
 * 计时,同一条打乱)。?room=CODE 的邀请链接即使没带 players 也强制进联机模式。
 * The old ?mode=solo|duo param and the solo/duo segmented pill are gone — the
 * single 人数 select (rendered here, injected into each view's chrome) is the
 * only switcher. Changing player count is a genuine big-mode switch between
 * full-screen experiences, so it pushes a history entry (history:'push') →
 * browser back / iOS edge-swipe returns to the previous count.
 *
 * SSG note: useQueryState calls useSearchParams, but app/[lang]/layout.tsx wraps
 * pages in <Suspense>, so static generation does not bail. To avoid an SSR /
 * hydration mismatch (server prerenders with empty searchParams → SoloView) we
 * keep a `mounted` gate on the BattleView render: first client paint is always
 * SoloView, and we only swap to BattleView after mount once nuqs has read the
 * real URL param.
 */

import { useEffect, useState } from 'react';
import { useQueryState, createParser } from 'nuqs';
import SoloView from './SoloView';
import BattleView from './BattleView';
import NetBattleView from './NetBattleView';
import { tr } from '@/i18n/tr';

type PlayersMode = number | 'net';

/** ?players= 解析:1..4 本机人数,'net' 联机对战;其余值归一到 1。 */
const parseAsPlayers = createParser<PlayersMode>({
  parse: (v) => {
    if (v === 'net') return 'net';
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(1, Math.min(4, n)) : 1;
  },
  serialize: (v) => String(v),
});

export default function TimerShell() {
  const [mounted, setMounted] = useState(false);
  const [playersParam, setPlayersParam] = useQueryState(
    'players',
    parseAsPlayers.withDefault(1).withOptions({ history: 'push', clearOnDefault: false }),
  );
  // ?room=CODE 邀请链接:没带 players 也进联机模式(链接可能被裁剪只剩 room)
  const [roomParam, setRoomParam] = useQueryState('room');
  const isNet = playersParam === 'net' || (!!roomParam && typeof playersParam === 'number' && playersParam === 1);
  const playerCount = typeof playersParam === 'number' ? Math.max(1, Math.min(4, playersParam)) : 1;

  useEffect(() => { setMounted(true); }, []);
  // 裸 /timer 强制写显式 ?players=1(默认人数也进 URL,不再省略)。
  useEffect(() => {
    if (typeof window !== 'undefined' && !new URLSearchParams(window.location.search).has('players')) {
      void setPlayersParam(roomParam ? 'net' : playerCount, { history: 'replace' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playersControl = (
    <select
      className="shell-players-select"
      data-no-timer
      value={isNet ? 'net' : playerCount}
      onChange={(e) => {
        const v = e.target.value;
        // 切离联机模式顺手清 ?room(否则 room 参数会把 players=1 又拽回联机);
        // 服务端玩家条目靠心跳超时标离线、24h TTL 清理,无需显式退房。
        if (v !== 'net') void setRoomParam(null);
        void setPlayersParam(v === 'net' ? 'net' : parseInt(v));
      }}
      title={tr({ zh: '人数', en: 'Players' })}
      aria-label={tr({ zh: '人数', en: 'Players' })}
    >
      {[1, 2, 3, 4].map(n => (
        <option key={n} value={n}>{tr({ zh: `${n}人`, en: `${n}P` })}</option>
      ))}
      <option value="net">{tr({ zh: '联机', en: 'Online' })}</option>
    </select>
  );

  // First paint is always Solo (mounted gate keeps SSG calm). After mount, if
  // ?players=net we render <NetBattleView/>, ?players>=2 renders <BattleView/>;
  // the players select is injected into each view's chrome. Switching never
  // remounts the page — each view owns its own engine state.
  if (mounted && isNet) {
    return (
      <NetBattleView
        playersControl={playersControl}
        onExitNet={() => { void setRoomParam(null); void setPlayersParam(1); }}
      />
    );
  }
  if (mounted && playerCount >= 2) {
    return <BattleView playerCount={playerCount} playersControl={playersControl} />;
  }

  return <SoloView playersControl={playersControl} />;
}
