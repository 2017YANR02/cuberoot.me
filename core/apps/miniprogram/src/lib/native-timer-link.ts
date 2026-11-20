import { TIMER_COMPOUND_SCRAMBLE_CHILDREN, type TimerCompoundScrambleEventId } from '@cuberoot/shared/timer/compound-scramble';
import { isNetBattleRoomCode } from '@cuberoot/shared/timer/net-battle';
import { extractReplayParam } from '@cuberoot/shared/timer/replay-input';
import { isTimerOrdinaryEvent } from '@cuberoot/shared/timer/event-catalog';
import { miniProgramApi } from './platform';
import { tr } from './i18n';

export interface NativeTimerLink { event?: string; scramble?: string; roomCode?: string; replayInput?: string }

export function parseNativeTimerLink(path: string): NativeTimerLink | null {
  if (path.length > 8192 || path.includes('#')) return null;
  const [pathname, query, extra] = path.split('?');
  if (extra !== undefined || !/^\/(?:(?:zh|en)\/)?timer\/?$/.test(pathname)) return null;
  const result: NativeTimerLink = {};
  const seen = new Set<string>();
  let room: string | undefined, players: string | undefined, replay: string | undefined;
  try {
    for (const part of (query ?? '').split('&').filter(Boolean)) {
      const at = part.indexOf('=');
      if (at < 0) return null;
      const key = decodeURIComponent(part.slice(0, at).replace(/\+/g, ' '));
      const value = decodeURIComponent(part.slice(at + 1).replace(/\+/g, ' '));
      if (seen.has(key)) return null;
      seen.add(key);
      if (key === 'event') {
        if (!isTimerOrdinaryEvent(value)) return null;
        result.event = value;
      } else if (key === 'scramble') {
        if (!value.trim() || value.length > 4000 || /[\u0000-\u001f\u007f]/.test(value)) return null;
        result.scramble = value.trim();
      } else if (key === 'room') room = value;
      else if (key === 'players') players = value;
      else if (key === 'replay' && /^[A-Za-z0-9_-]+$/.test(value) && extractReplayParam(value)) replay = `replay=${value}`;
      else if (key === 'share' && /^[A-Za-z0-9_-]{8,16}$/.test(value)) replay = `share=${value}`;
      else return null;
    }
  } catch { return null; }
  if (replay) return seen.size === 1 ? { replayInput: replay } : null;
  if (room !== undefined || players !== undefined) {
    return seen.size === 2 && players === 'net' && isNetBattleRoomCode(room) ? { roomCode: room } : null;
  }
  // A timer link can carry one line for the manual queue. Attempts containing
  // multiple puzzles can still be shared by project alone.
  const children = TIMER_COMPOUND_SCRAMBLE_CHILDREN[result.event as TimerCompoundScrambleEventId];
  if (result.scramble && children && children.length > 1) return null;
  return result;
}

// Page entries have separate bundles; transport belongs to the shared App instance.
interface LinkApp { nativeTimerLink?: NativeTimerLink }
export function queueNativeTimerLink(link: NativeTimerLink): () => void {
  const app = getApp<LinkApp>();
  app.nativeTimerLink = link;
  return () => { if (app.nativeTimerLink === link) delete app.nativeTimerLink; };
}
export function takeNativeTimerLink(): NativeTimerLink | undefined {
  if (typeof getApp !== 'function') return;
  const app = getApp<LinkApp>();
  const link = app.nativeTimerLink;
  delete app.nativeTimerLink;
  return link;
}

export function confirmNativeTimerLink(
  timer: { busy: boolean; selectEvent(event: string): void; setManualScrambles(scramble: string): void },
  isCurrent: () => boolean,
  refresh: () => void,
  openTool?: (link: NativeTimerLink) => void,
): void {
  const link = takeNativeTimerLink();
  if (!link) return;
  const unavailable = () => miniProgramApi().showToast({ icon: 'none', title: tr({ zh: '计时结束后请重新打开链接', en: 'Reopen the link after timing' }) });
  if (timer.busy) { unavailable(); return; }
  if (link.roomCode || link.replayInput) {
    if (isCurrent()) openTool?.(link);
    return;
  }
  let settled = false;
  miniProgramApi().showModal({
    title: tr({ zh: '使用分享的计时设置？', en: 'Use shared timer settings?' }),
    content: [link.event, link.scramble?.slice(0, 300), link.scramble
      ? tr({ zh: '确认后替换当前手动打乱队列。', en: 'Confirming replaces the current manual scramble queue.' }) : ''].filter(Boolean).join('\n'),
    success(result) {
      if (settled) return;
      settled = true;
      if (!result.confirm || !isCurrent()) return;
      if (timer.busy) { unavailable(); return; }
      if (link.event) timer.selectEvent(link.event);
      if (link.scramble) timer.setManualScrambles(link.scramble);
      refresh();
    },
  });
}
