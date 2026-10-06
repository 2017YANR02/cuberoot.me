import type { EventId, TimerScrambleSourceSnapshot } from './types';

export interface LocalBattleScramble {
  scramble: string;
  source?: TimerScrambleSourceSnapshot;
  /** Official occurrence, not a lookup keyed by scramble text. */
  wca?: { ci: string; cn: string; e: string; r: string; g: string; n: number; x: 0 | 1 };
}
export const LOCAL_BATTLE_SCRAMBLE_TIMEOUT_MS = 12_000;
export const LOCAL_BATTLE_SCRAMBLE_COPY = {
  source: { en: 'Scramble source', zh: '打乱来源' },
  wca: { en: 'WCA real', zh: 'WCA 真题' },
  random: { en: 'Random', zh: '随机生成' },
  failed: { en: 'Unable to load scramble. Retry', zh: '打乱加载失败，点击重试' },
  loading: { en: 'Generating scramble…', zh: '生成打乱中…' },
};
/** One timeout/failure policy for Web and installed providers. Real-source failure
 * must never silently turn into a random scramble or an error string to solve. */
export function requestLocalBattleScramble(
  event: EventId,
  provide: (event: EventId, signal: AbortSignal) => Promise<LocalBattleScramble>,
  signal?: AbortSignal,
): Promise<LocalBattleScramble> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    const finish = (value?: LocalBattleScramble, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout); signal?.removeEventListener('abort', abort);
      controller.abort();
      if (value && value.scramble.trim() && !value.scramble.startsWith('⚠️')) resolve(value);
      else reject(error ?? new Error('Invalid local battle scramble'));
    };
    const abort = () => finish(undefined, new Error('Local battle scramble cancelled'));
    const timeout = setTimeout(() => finish(undefined, new Error('Local battle scramble timeout')), LOCAL_BATTLE_SCRAMBLE_TIMEOUT_MS);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    Promise.resolve().then(() => provide(event, controller.signal)).then(value => finish(value), error => finish(undefined, error));
  });
}
