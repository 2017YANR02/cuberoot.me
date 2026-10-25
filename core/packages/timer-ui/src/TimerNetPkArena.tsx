import { useEffect, useRef, useState, type ReactNode, type ComponentProps } from 'react';
import { effectiveNetMs, formatMs, isNetOnline, type NetRoomState, type NetResult } from '@cuberoot/shared/timer';
import { SegmentTime } from './SegmentTime';
import TimingSurface from './TimingSurface';
import { timerRoomPlayerName } from './TimerRoomPlayers';
import { TimerRemoteLiveCube } from './TimerRemoteLiveCube';
import type { NetBattleLiveCubePlayer } from './net-battle-live';
import type { NetPkLock } from './net-battle-live-view';
import './net-live.css';
interface RemoteTimerDigitsProps {
  player: NetRoomState['players'][string] | null;
  result?: NetResult;
  online: boolean;
  clockOffsetMs: number | null;
  precision: Parameters<typeof formatMs>[1];
}

function remoteTimerText(
  player: NetRoomState['players'][string] | null,
  result: NetResult | undefined,
  online: boolean,
  clockOffsetMs: number | null,
  precision: Parameters<typeof formatMs>[1],
): string {
  if (result) {
    if (result.p === 'dnf') return 'DNF';
    return `${formatMs(effectiveNetMs(result), precision)}${result.p === '+2' ? '+' : ''}`;
  }
  if (!player || !online || player.ph !== 'solving') return formatMs(0, precision);
  return formatMs(Math.max(0, Date.now() + (clockOffsetMs ?? 0) - player.at), 2);
}

/** Keep the opponent's fast clock updates isolated from the room shell. */
function RemoteTimerDigits({
  player,
  result,
  online,
  clockOffsetMs,
  precision,
}: RemoteTimerDigitsProps) {
  const [text, setText] = useState(() => remoteTimerText(player, result, online, clockOffsetMs, precision));
  useEffect(() => {
    let raf = 0;
    let previous = '';
    const tick = () => {
      const next = remoteTimerText(player, result, online, clockOffsetMs, precision);
      if (next !== previous) {
        previous = next;
        setText(next);
      }
      if (!result && player?.ph === 'solving' && online) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [clockOffsetMs, online, player, precision, result]);
  return <SegmentTime text={text} />;
}

export function TimerNetPkArena({ children, room, pid, lock, liveCubePlayers, ownStatus, language, liveCubeView, timerFont, timerFontScale, fontSize, precision, clockOffsetMs }: {
  children: ReactNode; room: NetRoomState; pid: string; lock: NetPkLock;
  liveCubePlayers: Record<string, NetBattleLiveCubePlayer>; ownStatus: string; language: 'en' | 'zh';
  liveCubeView: ComponentProps<typeof TimerRemoteLiveCube>['mode']; timerFont: string; timerFontScale?: number;
  fontSize?: string; precision: 2 | 3; clockOffsetMs: number | null;
}) {
  const tr = (text: { en: string; zh: string }) => text[language];
  const opponentSurfaceRef = useRef<HTMLDivElement | null>(null);
  const curResults = room.results[String(room.round)] ?? {};
  const opponentId = lock?.opponentId ?? null;
  const opponent = opponentId ? room.players[opponentId] ?? null : null;
  const opponentResult = opponentId ? curResults[opponentId] : undefined;
  const opponentLive = opponentId ? liveCubePlayers[opponentId] : undefined;
  const opponentOnline = !!opponent && isNetOnline(opponent, room.now);
  const opponentFeedReady = !!opponentLive?.connected
    && opponentLive.smart
    && opponentLive.round === room.round;
  const opponentPhase = opponentResult
    ? 'stopped'
    : opponent?.ph === 'solving'
      ? 'running'
      : opponent?.ph === 'inspecting'
        ? 'inspecting'
        : opponent?.ph === 'ready'
          ? 'ready'
          : 'idle';
  const opponentColorClass = `${opponentResult?.p === 'dnf'
    ? 'dnf'
    : opponentPhase === 'running'
      ? 'running'
      : opponentPhase === 'inspecting'
        ? 'inspection'
        : opponentPhase === 'ready'
          ? 'ready'
          : ''
    } tf-${timerFont}`.trim();
  const opponentStatus = !opponentOnline
    ? tr({ zh: '对手离线', en: 'Opponent offline' })
    : !opponentFeedReady
      ? tr({ zh: '实况重连中…', en: 'Reconnecting live feed…' })
      : opponentResult
        ? tr({ zh: '已完成', en: 'Finished' })
        : opponent?.ph === 'solving'
          ? tr({ zh: '计时中', en: 'Solving' })
          : opponent?.ph === 'inspecting'
            ? tr({ zh: '观察中', en: 'Inspecting' })
            : opponent?.ph === 'ready'
              ? tr({ zh: '已准备', en: 'Ready' })
              : tr({ zh: '待开始', en: 'Waiting' });
  const myPlayer = pid ? room.players[pid] : undefined;
  const myPkName = myPlayer ? timerRoomPlayerName(myPlayer, language) : tr({ zh: '我', en: 'Me' });
  const opponentPkName = opponent
    ? timerRoomPlayerName(opponent, language)
    : lock?.opponentName ?? tr({ zh: '对手', en: 'Opponent' });
  const opponentCubeSlot = opponentId && opponentLive?.facelets
    ? <TimerRemoteLiveCube playerId={opponentId} live={opponentLive} reconnecting={!opponentFeedReady} mode={liveCubeView} language={language} />
    : undefined;
  return (
        <div className="net-pk-arena">
          <section className="net-pk-side is-self" aria-label={tr({ zh: '我的计时与智能魔方', en: 'My timer and smart cube' })}>
            <header className="net-pk-side-head surface-chrome">
              <span className="net-pk-side-name">{myPkName}</span>
              <span className="net-pk-side-role">{tr({ zh: '我', en: 'Me' })}</span>
              <span className="net-pk-side-status">{ownStatus}</span>
            </header>
            {children}
          </section>
          <section className="net-pk-side is-opponent" aria-label={tr({ zh: '对手计时与智能魔方', en: 'Opponent timer and smart cube' })}>
            <header className="net-pk-side-head surface-chrome">
              <span className="net-pk-side-name">{opponentPkName}</span>
              <span className="net-pk-side-status">{opponentStatus}</span>
            </header>
            <TimingSurface
              phase={opponentPhase}
              colorClass={opponentColorClass}
              fontSize={fontSize} fontScale={timerFontScale}
              digits={(
                <RemoteTimerDigits
                  player={opponent}
                  result={opponentResult}
                  online={opponentOnline}
                  clockOffsetMs={clockOffsetMs}
                  precision={precision}
                />
              )}
              surfaceRef={opponentSurfaceRef}
              cornerSlot={opponentCubeSlot}
              className="net-pk-opponent-timing"
              ariaLabel={tr({ zh: '对手计时', en: 'Opponent timer' })}
            />
          </section>
        </div>
  );
}
