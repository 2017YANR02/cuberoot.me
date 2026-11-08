import type { LblExample, LBL_STEPS } from './content';

const text = (zh: string, en: string) => ({ zh, en });

/** Describe the exercise endpoint rather than the moves used to reach it. */
export function practiceObjective(step: typeof LBL_STEPS[number], example: LblExample) {
  const index = step.examples.indexOf(example);
  switch (step.id) {
    case 'daisy': return text('完成小花。', 'Complete the daisy.');
    case 'cross': return index < 0
      ? text('把目标白棱移到底面，侧面颜色与对应中心对齐。', 'Move the target white edge to the bottom, matching its side color to the center.')
      : text('把四条白棱移到底面组成白十字，四条棱的侧面颜色分别与中心对齐。', 'Make the bottom white cross, matching each edge’s side color to its center.');
    case 'corners': return text('完成底层。', 'Complete the first layer.');
    case 'middle': return text('保持底层复原，把目标棱放入正确的中层槽位，两面颜色都与中心对齐。', 'Keep the bottom layer solved. Insert the target edge into its middle-layer slot, matching both colors to the centers.');
    case 'yellow-cross': return index === 2
      ? text('保持下两层复原，让顶面两条朝黄的棱组成一条直线。', 'Keep the first two layers solved and form a line with two yellow-facing top edges.')
      : text('保持下两层复原，让四条顶棱的黄色都朝上，组成黄色十字。', 'Keep the first two layers solved and turn all four top edges yellow-up to form a yellow cross.');
    case 'yellow-face': return text('保持下两层复原，让顶面九格全部朝黄。', 'Keep the first two layers solved and make all nine top stickers yellow.');
    case 'corner-position': return index === 1
      ? text('保持下两层复原、顶面全黄，让顶层侧面出现一对眼。', 'Keep the first two layers solved and the top yellow. Create a pair of headlights on a top-layer side.')
      : text('保持下两层复原、顶面全黄，让四个顶角的侧面颜色与对应中心对齐。', 'Keep the first two layers solved and the top yellow. Align all four top corners with their side centers.');
    case 'edge-position': return index === 2
      ? text('保持下两层复原、顶面全黄，让顶层侧面出现一面墙。', 'Keep the first two layers solved and the top yellow. Form a solid wall on one top-layer side.')
      : text('保持下两层复原、顶面全黄，将顶棱归位，完成六面还原。', 'Keep the first two layers solved and the top yellow. Position the top edges to solve all six faces.');
    default: return step.goal;
  }
}
