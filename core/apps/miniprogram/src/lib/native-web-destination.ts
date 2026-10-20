import { parseNativeTimerLink, type NativeTimerLink } from './native-timer-link';

export interface NativeWebDestination {
  method: 'redirectTo' | 'switchTab';
  url: string;
  timerLink?: NativeTimerLink;
}

/** Exact destinations only. Unknown query/fragment state must not be discarded. */
export function nativeWebDestination(path: string): NativeWebDestination | null {
  const bare = path.replace(/^\/(?:zh|en)(?=\/|$)/, '').replace(/\/$/, '') || '/';
  if (bare === '/contact') return { method: 'redirectTo', url: '/pages/contact/index' };
  if (bare === '/privacy') return { method: 'redirectTo', url: '/pages/privacy/index' };
  if (bare === '/timer') return { method: 'switchTab', url: '/pages/timer/index' };
  if (bare === '/') return { method: 'switchTab', url: '/pages/tools/index' };
  const timerLink = parseNativeTimerLink(path);
  if (timerLink && (timerLink.event || timerLink.scramble)) {
    return { method: 'switchTab', url: '/pages/timer/index', timerLink };
  }
  return null;
}
