import { Alg } from 'cubing/alg';
import type { LblExample } from './content';

export const DAISY_PRACTICE_TARGET = 'F2 R2 B2 L2';

/** Practice finishes the whole daisy; short teaching demonstrations stay unchanged. */
export function daisyPracticeExample(example: LblExample, index: number): LblExample {
  const adjustments: Record<number, Pick<LblExample, 'alg' | 'hint'>> = {
    3: { alg: "F U' R", hint: {
      zh: '压前层送到二楼，转顶层让开已有花瓣，再右手上，完成四片花瓣。',
      en: 'Lower the front to bring the edge to the middle, move the top petals out of the way, then lift with the right face to complete all four petals.',
    } },
    4: { alg: "F U L'", hint: {
      zh: '压前层送到二楼，转顶层让开已有花瓣，再左手上，完成四片花瓣。',
      en: 'Lower the front to bring the edge to the middle, move the top petals out of the way, then lift with the left face to complete all four petals.',
    } },
    5: { alg: "y' U R2", hint: {
      zh: '把白棱放到右层，转顶层让开已有花瓣，再做“上上”，完成四片花瓣。',
      en: 'Put the white edge in the right layer, move the top petals out of the way, then turn the right face twice to complete all four petals.',
    } },
  };
  const result = { ...example, ...adjustments[index] };
  return { ...result, setup: `${DAISY_PRACTICE_TARGET} ${new Alg(result.alg).invert().toString()}`, startSolved: false };
}
