type Text = { zh: string; en: string };
export type InstructionPhase = { text: Text; moves: number[] };

// Excerpts of the existing instructions, bound to one-based playback moves.
// Setup poses and observation/next-case instructions have no playback range.
const phase = (zh: string, en: string, first: number, last = first): InstructionPhase => ({
  text: { zh, en }, moves: Array.from({ length: last - first + 1 }, (_, i) => first + i),
});
export const INSTRUCTION_PHASES: Record<string, InstructionPhase[][]> = {
  daisy: [
    [phase('转体，把标出的白格放到前面右侧', 'Rotate the cube to put the outlined white sticker on the right side of the front face', 1), phase('右手上', 'lift with the right face', 2)],
    [phase('转体，把标出的白格放到前面左侧', 'Rotate the cube to put the outlined white sticker on the left side of the front face', 1), phase('左手上', 'lift with the left face', 2)],
    [phase('转顶层移开挡路的花瓣', 'Turn the top layer to move the blocking petal out of the way', 1), phase('右手上', 'lift with the right face', 2)],
    [phase('压前层送到二楼', 'Lower the front to bring it to the middle', 1), phase('右手上', 'lift with the right face', 2)],
    [phase('压前层送到二楼', 'Lower the front to bring it to the middle', 1), phase('左手上', 'lift with the left face', 2)],
    [phase('把这条白棱放到右层', 'Put this edge in the right layer', 1), phase('做“上上”', 'turn the right face twice', 2)],
  ],
  cross: [[
    phase('同时转下面两层，让白棱侧面的颜色对齐同色中心', 'Turn the lower two layers together to match the white edge’s side color with its center', 1),
    phase('做“上上”', 'Turn the right face twice', 2),
    phase('用同样的方法处理其余三条白棱，完成白十字', 'Use the same method for the remaining three white edges to complete the white cross', 3, 10),
  ], [
    phase('转顶层，让白棱侧面的颜色对齐同色中心', 'Turn the top to match the white edge’s side color with its center', 1),
    phase('做“上上”归位', 'Turn the right face twice to insert it', 2),
  ]],
  corners: [
    [phase('转顶层，把这个角另一侧的非白色格朝前', 'Turn the top to face the corner’s other side sticker forward', 1), phase('同时转下面两层，让它与同色中心对齐', 'Turn the lower two layers together to match it with its center', 2), phase('做右公式', 'do the right trigger', 3, 6)],
    [phase('先转体把它放右前方', 'Rotate the whole cube to put it at bottom-front-right', 1), phase('做右公式取出', 'eject it with the right trigger', 2, 5)],
    [phase('转顶层，把这个角另一侧的非白色格朝前', 'Turn the top to face the corner’s other side sticker forward', 1), phase('同时转下面两层，让它与同色中心对齐', 'Turn the lower two layers together to match it with its center', 2), phase('做左公式', 'do the left trigger', 3, 6)],
    [phase('转顶层把白角放右前上方', 'Turn the top to put the corner at top-front-right', 1), phase('转下面两层，让角心交叉对齐', 'Turn the lower two layers together to cross-match the colors', 2), phase('做三遍右公式', 'Do the right trigger three times', 3, 14)],
  ],
  middle: [
    [], // Arrow-separated insert flows use the existing alg groups directly.
    [],
    [phase('做“去右”把它放入，原来的棱就会被取到顶层', 'Do the right insertion to eject the flipped edge', 1, 10)],
    [phase('先转体把它放右前方', 'Rotate it to front-right', 1), phase('做“去右”把原来的棱取出', 'Use the right insertion to eject it', 2, 11)],
  ],
  'yellow-cross': [
    [phase('转顶层，把两条黄色棱左右横放', 'Turn the top to hold the two yellow edges left to right', 1), phase('做压', 'Do F', 2), phase('做右公式', 'do the right trigger', 3, 6), phase('做提', 'then do F′', 7)],
    [phase('转顶层，让两条黄色棱在前和右', 'Turn the top so the yellow edges are at front and right', 1), phase('做双压', 'Do f', 2), phase('做右公式', 'do the right trigger', 3, 6), phase('做双提', 'then do f′', 7)],
    [phase('先做双压', 'First do f', 1), phase('做右公式', 'do the right trigger', 2, 5), phase('做双提', 'then do f′', 6)],
  ],
  'yellow-face': [
    [phase('转顶层把鱼头放左前，F面鱼鳍朝右', 'Turn the top to put the head at front-left, with the fin on the right of the F face', 1), phase('做右鱼公式', 'do right Sune', 2, 8)],
    [phase('转顶层把鱼头放右前，F面鱼鳍朝左', 'Turn the top to put the head at front-right, with the fin on the left of the F face', 1), phase('做左鱼公式', 'do left Sune', 2, 8)],
    [phase('转顶层让拇指碰黄', 'Turn the top until it touches yellow', 1), phase('做右鱼公式', 'do right Sune', 2, 8)],
    [phase('转顶层让拇指不碰黄', 'Turn the top so it does not touch yellow', 1), phase('做右鱼公式', 'do right Sune', 2, 8)],
  ],
  'corner-position': [
    [phase('转体把眼放左', 'Rotate the whole cube to put the headlights on the left', 1), phase('做J公式', 'do the J algorithm', 2, 15)],
    [phase('做一遍J公式', 'Do the J algorithm once', 1, 14)],
  ],
  'edge-position': [
    [phase('转体把墙放后', 'Rotate the cube to put the wall at the back', 1), phase('右鱼', 'Right Sune', 2, 8), phase('顶层 U', 'U', 9), phase('左鱼', 'Left Sune', 10, 16), phase('转顶层对齐', 'Align the top', 17)],
    [phase('转体把墙放后', 'Rotate the cube to put the wall at the back', 1), phase('左鱼', 'Left Sune', 2, 8), phase('顶层 U′', 'U′', 9), phase('右鱼', 'Right Sune', 10, 16), phase('转顶层对齐', 'Align the top', 17)],
    [phase('右鱼', 'Right Sune', 1, 7), phase('顶层 U', 'U', 8), phase('左鱼', 'Left Sune', 9, 15), phase('转顶层对齐', 'Align the top', 16)],
  ],
};

// Search forward in sentence order: repeated definitions later in the copy
// stay plain, and short notation such as f cannot match an earlier word.
export function splitInstruction(instruction: string, phases: InstructionPhase[], localize: (text: Text) => string) {
  const parts: { text: string; moves?: number[] }[] = [];
  let cursor = 0;
  for (const phase of phases) {
    const excerpt = localize(phase.text);
    const start = instruction.indexOf(excerpt, cursor);
    if (start < 0) continue;
    if (start > cursor) parts.push({ text: instruction.slice(cursor, start) });
    parts.push({ text: excerpt, moves: phase.moves });
    cursor = start + excerpt.length;
  }
  if (cursor < instruction.length) parts.push({ text: instruction.slice(cursor) });
  return parts;
}
