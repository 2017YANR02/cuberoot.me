import type { TimerPhase } from '@cuberoot/shared/timer';

export type MobileBackView = 'timer' | 'tools' | 'account' | 'history' | 'settings';

export type MobileBackAction =
  | 'close-overlay'
  | 'close-more'
  | 'close-manual-entry'
  | 'exit-fullscreen'
  | 'cancel-arm'
  | 'block-busy'
  | 'close-subview'
  | 'embedded-back'
  | 'exit-app';

export interface MobileBackContext {
  fullscreen: boolean;
  manualEntryOpen: boolean;
  moreOpen: boolean;
  mutationBusy: boolean;
  overlayOpen: boolean;
  phase: TimerPhase;
  view: MobileBackView;
  webDepth: number;
}

/** Android Back priority shared by the real listener and unit tests. */
export function mobileBackAction(context: MobileBackContext): MobileBackAction {
  if (context.overlayOpen) return 'close-overlay';
  if (context.moreOpen) return 'close-more';
  if (context.manualEntryOpen) return 'close-manual-entry';
  if (context.fullscreen) return 'exit-fullscreen';
  if (context.phase === 'holding'
    || context.phase === 'ready'
    || context.phase === 'inspecting') return 'cancel-arm';
  if (context.phase === 'running' || context.mutationBusy) return 'block-busy';
  if (context.view === 'history' || context.view === 'settings') return 'close-subview';
  if (context.view === 'tools' || context.view === 'account') {
    return context.webDepth > 0 ? 'embedded-back' : 'close-subview';
  }
  return 'exit-app';
}
