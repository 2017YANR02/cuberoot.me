import type { ReplayPairTrainingInput } from '@cuberoot/timer-ui/reconstruct-report';
import { encodeReplayUrl } from '@/app/[lang]/timer/_lib/share/encode';
import type { ReplayF2lCases } from '@cuberoot/shared/site-assistant-replay';
import { practiceSlot, scopedPracticeSlot } from './replay-practice-view';
import type { F2lSlotId } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import { persistItem } from './safe-storage';

export type PracticeRole = keyof ReplayF2lCases;
export type PracticeGoal = 'recognition' | 'execution' | 'transition' | 'routes';
export type GuidedDrill = {goal: PracticeGoal; whiteBottom?:boolean; sourceStage?:string; setup?:string; original?:string; reference?:string; entryAfter?:number; recordedTurns?:number; referenceTurns?:number};
export const goalLabels = {
  recognition:{zh:'识别',en:'recognition'}, execution:{zh:'执行',en:'execution'},
  transition:{zh:'衔接',en:'transition'}, routes:{zh:'路线对比',en:'route comparison'},
};
export type ReplayAttemptSource = { scope: string; role: PracticeRole };
export interface ReplayTrainingSession {
  owner: string;
  scope: string;
  returnPath: string;
  cases: ReplayF2lCases;
  slot?: F2lSlotId;
  drill?:GuidedDrill;
}

const prefix = 'cfop-training-session:';
const ttl = 7 * 86400_000;
export const replayReturnChannel = 'cfop-return-to-replay';

export function rememberReplayTraining(id: string, session: ReplayTrainingSession) {
  try {
    const now = Date.now();
    for (const key of Object.keys(localStorage).filter(key => key.startsWith(prefix))) {
      if (Number(JSON.parse(localStorage.getItem(key) ?? '{}').expires) < now) localStorage.removeItem(key);
    }
    return persistItem(prefix + id, JSON.stringify({ ...session, expires: now + ttl }));
  } catch { return false; }
}

export function isReplayReturnPath(path:unknown): path is string {
  return typeof path==='string' && /^\/(?:zh\/|en\/)?timer\?(?:share|replay)=[^#\s&]+(?:&practiceSolve=[^#\s&]+)?$/.test(path);
}

export function linkedReplayPractice(token: string | null, owner: string, set: string, caseId?: number) {
  const match = /^([\da-f-]{36})\.(recorded|retest)$/.exec(token ?? '');
  if (!match || !caseId) return;
  try {
    const entry = JSON.parse(localStorage.getItem(prefix + match[1]) ?? 'null');
    const role = match[2] as PracticeRole;
    const item = entry?.cases?.[role];
    if (entry?.owner !== owner || !(entry.expires > Date.now()) || typeof entry.scope !== 'string'
      || item?.set !== set || item?.id !== caseId || !isReplayReturnPath(entry.returnPath)) return;
    const drill: GuidedDrill | undefined = entry.drill && Object.hasOwn(goalLabels, entry.drill.goal) ? entry.drill : undefined;
    const slot = set === 'f2l' || set === 'adv-f2l' ? practiceSlot(entry.slot) ?? scopedPracticeSlot(entry.scope) : undefined;
    return { id: match[1], role, ...(slot && {slot}), ...(drill && {drill}), scope: entry.scope as string, returnPath: entry.returnPath as string };
  } catch { return; }
}

/** Prefer the still-mounted report with its selected history and stage. */
export function returnToTrainingReplay(id: string, returnPath: string) {
  if (typeof BroadcastChannel === 'undefined') { window.location.assign(returnPath); return; }
  const channel = new BroadcastChannel(replayReturnChannel);
  const fallback = () => { channel.close(); window.location.assign(returnPath); };
  const timer = window.setTimeout(fallback, 500);
  channel.onmessage = event => {
    if (event.data?.type !== 'ready' || event.data.id !== id) return;
    clearTimeout(timer);
    channel.close();
    window.close();
    window.setTimeout(() => { if (!window.closed) window.location.assign(returnPath); }, 150);
  };
  channel.postMessage({ type: 'return', id });
}

export function replayTrainingReturnPath(solve: NonNullable<ReplayPairTrainingInput['origin']>['solve']) {
  const url = new URL(encodeReplayUrl(solve));
  url.pathname = location.pathname.startsWith('/zh/') ? '/zh/timer' : '/timer';
  if (new URLSearchParams(location.search).get('share') === solve.id) {
    url.search = new URLSearchParams({ share: solve.id }).toString();
  } else if (!solve.id.startsWith('replay-')) {
    url.searchParams.set('practiceSolve', solve.id);
  }
  return url.pathname + url.search;
}

export function createReplayTrainingSession(owner: string, origin?: ReplayPairTrainingInput['origin'], cases?: ReplayF2lCases): ReplayTrainingSession | undefined {
  if (origin && (cases?.recorded || cases?.retest)) {
    return {owner, scope: origin.scope, returnPath: replayTrainingReturnPath(origin.solve), cases};
  }
}
