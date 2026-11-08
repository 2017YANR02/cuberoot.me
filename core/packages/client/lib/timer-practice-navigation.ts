import { timerPracticeContents as sharedPracticeContents } from '@cuberoot/shared/timer';
export { selectedTimerPracticeContent, type TimerPracticeContent } from '@cuberoot/shared/timer';

export function timerPracticeContents(event: string) {
  return sharedPracticeContents(event, { pllChain: true });
}
