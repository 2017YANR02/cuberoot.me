import {
  TIMER_SMALL_HINT_EVENTS,
  type TimerSmallHintEvent,
} from '@cuberoot/puzzle-solvers/timer-small-hints';

export { TIMER_SMALL_HINT_EVENTS };
export type { TimerSmallHintEvent };

export interface TimerSmallPuzzleHintCopy {
  readonly alreadySolved: string;
  readonly computing: string;
  readonly failed: string;
  readonly fullSolve: string;
  readonly noSolution: string;
  readonly perFace: string;
  readonly title: string;
}

type TimerCopyLanguage = 'en' | 'zh' | 'zh-Hans';

const TITLES: Readonly<Record<TimerSmallHintEvent, Readonly<Record<'en' | 'zh', string>>>> = {
  '222': { en: '2x2 solver hints', zh: '二阶解法提示' },
  pyra: { en: 'Pyraminx solver hints', zh: '金字塔解法提示' },
  skewb: { en: 'Skewb solver hints', zh: '斜转解法提示' },
};

const SECTIONS: Readonly<Record<TimerSmallHintEvent, Readonly<Record<'en' | 'zh', string>>>> = {
  '222': { en: 'Per-face', zh: '六个面' },
  pyra: { en: 'Per-face V', zh: '四个面 (V)' },
  skewb: { en: 'Per-face', zh: '六个面' },
};

export function timerSupportsSmallPuzzleHints(event: string): event is TimerSmallHintEvent {
  return (TIMER_SMALL_HINT_EVENTS as readonly string[]).includes(event);
}

export function timerSmallPuzzleHintCopy(
  event: TimerSmallHintEvent,
  language: TimerCopyLanguage,
): TimerSmallPuzzleHintCopy {
  const locale = language === 'en' ? 'en' : 'zh';
  return {
    alreadySolved: locale === 'zh' ? '已还原' : 'already solved',
    computing: locale === 'zh' ? '计算中…' : 'Computing…',
    failed: locale === 'zh' ? '未能计算解法' : 'Unable to compute hints',
    fullSolve: locale === 'zh' ? '完整还原' : 'Full solve',
    noSolution: locale === 'zh' ? '未找到' : 'no solution',
    perFace: SECTIONS[event][locale],
    title: TITLES[event][locale],
  };
}
