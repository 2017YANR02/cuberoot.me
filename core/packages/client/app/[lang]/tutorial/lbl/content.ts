type Text = { zh: string; en: string };
export type LblExample = { title: Text; caption?: Text; hint: Text; alg: string; setup?: string; startSolved?: boolean; sceneRot?: { x: number; y: number; z: number } };
type Step = { id: string; title: Text; goal: Text; paragraphs: Text[]; examples: LblExample[] };
const text = (zh: string, en: string): Text => ({ zh, en });
// Face the learner squarely, tilted enough to read the top-face pattern.
export const LBL_INITIAL_VIEW = { x: Math.PI / 8, y: 0, z: 0 };
// Match the document: front/right views for right-hand cases, mirrored for left-hand cases.
const DOCUMENT_RIGHT_VIEW = { x: Math.PI / 6, y: -Math.PI / 6, z: 0 };
const DOCUMENT_LEFT_VIEW = { x: Math.PI / 6, y: Math.PI / 6, z: 0 };
export const LESSON_STICKERING: Record<string, string> = {
  daisy: 'Daisy', cross: 'Cross', corners: 'fl', middle: 'f2l',
  'yellow-cross': 'oell', 'yellow-face': 'sim:oll',
  'corner-position': 'sim:coll', 'edge-position': 'll',
};
const example = (zh: string, en: string, alg: string, hintZh: string, hintEn: string, setup?: string): LblExample => ({ title: text(zh, en), hint: text(hintZh, hintEn), alg, setup });
export const RIGHT = "R U R' U'";
export const LEFT = "L' U' L U";
const MIDDLE_RIGHT = `U ${RIGHT} y ${LEFT}`;
const MIDDLE_LEFT = `U' ${LEFT} y' ${RIGHT}`;
export const RIGHT_SUNE = "R U R' U R U2' R'";
export const LEFT_SUNE = "L' U' L U' L' U2 L";
export const CORNER_POSITION = "R U R' F' R U R' U' R' F R2 U' R'";
export const EDGE_POSITION_LEFT = `${RIGHT_SUNE} U ${LEFT_SUNE} U'`;
export const EDGE_POSITION_RIGHT = `${LEFT_SUNE} U' ${RIGHT_SUNE} U`;
export const LBL_STAGE_GOALS: Record<string, { before: Text; after: Text; summary?: Text }> = {
  structure: { before: text('认识魔方的结构', 'Learn the cube’s structure'), after: text('整体目标：六面各自同色', 'Overall goal: one color on each face') },
  daisy: {
    before: text('黄心朝上', 'Yellow center facing up'), after: text('黄心周围四片白花瓣', 'Four white petals around yellow'),
    summary: text('黄心朝上，将四个白棱移到黄心周围。', 'Hold the yellow center up and move the four white edges around it.'),
  },
  cross: {
    before: text('黄心周围的小花', 'Daisy around the yellow center'), after: text('底面白十字，侧面颜色与同色中心对齐', 'White cross below; side colors match their centers'),
    summary: text('将小花的四个白棱翻到底面，组成白十字，侧面颜色与同色中心对齐。', 'Move the daisy’s four white edges to the bottom to form a white cross with side colors matching the centers.'),
  },
  corners: {
    before: text('白十字已好，白角未归位', 'White cross solved; corners unfinished'), after: text('白色底层及侧面第一行复原', 'White layer and bottom side rows solved'),
    summary: text('保持白十字，将四个白角归位，复原底层。', 'Keep the white cross and solve the four white corners to complete the first layer.'),
  },
  middle: {
    before: text('白色底层已好，中层棱未归位', 'First layer solved; middle edges unfinished'), after: text('底层和中层全部复原', 'First two layers solved'),
    summary: text('保持底层，将四条中层棱归位，复原前两层。', 'Keep the first layer solved and insert the four middle-layer edges to complete the first two layers.'),
  },
  'yellow-cross': {
    before: text('前两层已好，顶棱未全朝黄', 'First two layers solved; yellow edges unfinished'), after: text('顶面形成黄十字', 'Yellow cross on top'),
    summary: text('保持前两层，将顶层四条棱翻至黄色朝上，形成黄十字。', 'Keep the first two layers solved and orient the four top edges with yellow facing up to form a yellow cross.'),
  },
  'yellow-face': {
    before: text('黄十字已好，顶角未全朝黄', 'Yellow cross solved; yellow corners unfinished'), after: text('顶面九格全部朝黄', 'All nine top stickers yellow'),
    summary: text('保持黄十字，将四个顶角翻至黄色朝上。', 'Keep the yellow cross and orient all four top corners with yellow facing up.'),
  },
  'corner-position': {
    before: text('顶面全黄，顶角位置未对齐', 'Yellow face solved; corner positions unfinished'), after: text('四个顶角与侧面中心对齐', 'All four top corners match side centers'),
    summary: text('保持黄面，将四个顶角移到与侧面中心对齐的位置。', 'Keep the yellow face and position all four top corners to match the side centers.'),
  },
  'edge-position': {
    before: text('顶角已归位，顶棱未归位', 'Top corners solved; top edges unfinished'), after: text('六面全部复原', 'All six faces solved'),
    summary: text('保持顶角归位，将顶层棱归位，完成六面还原。', 'Keep the top corners in place and position the top edges to finish all six faces.'),
  },
};
export const LBL_BASICS = [
  {
    id: 'centers', mask: 'centers-only', setup: '', alg: 'y y y y x x x x', title: text('中心块', 'Centers'),
    headline: text('6 个中心块，每个有 1 格。', '6 centers, each with 1 facelet.'),
    hint: text('中心相对位置始终不变：白黄相对、红橙相对、蓝绿相对。', 'The centers keep their relative positions: white opposite yellow, red opposite orange, and blue opposite green.'),
    next: text('认识角块', 'Meet the corners'),
  },
  {
    id: 'corners', mask: 'corners-only', setup: '', alg: "R R' U U'", title: text('角块', 'Corners'),
    headline: text('8 个角块，每个有 3 格。', '8 corners, each with 3 facelets.'),
    next: text('认识棱块', 'Meet the edges'),
  },
  {
    id: 'edges', mask: 'edges-only', setup: '', alg: "R R' U U'", title: text('棱块', 'Edges'),
    headline: text('12 个棱块，每个有 2 格。', '12 edges, each with 2 facelets.'),
    hint: text('带白色的棱块，就是做小花用的白棱。', 'White edges are the pieces used to make the daisy.'),
    next: text('开始做小花', 'Make the daisy'),
  },
];
export const LBL_STEPS: Step[] = [
  {
    id: 'structure', title: text('魔方基础', 'Cube basics'),
    goal: text('先认识中心、棱块和角块，再开始做小花。', 'Meet the centers, edges and corners before making the daisy.'),
    paragraphs: [
      text("中心的颜色决定这一面复原后的颜色；复原后，每面九格同色。", "Each center determines its face’s solved color. A solved face has nine stickers of the same color."),
      text("接下来黄心朝上、白心朝下。一楼是底层，二楼是中层，三楼是顶层；地下室指底面。", "Hold yellow up and white down. The first, second and third floors mean the bottom, middle and top layers; the basement means the bottom face."),
      text("可以先跟中文口诀做，不必先背英文记号。R＝右层，L＝左层，U＝顶层，F＝前层；正对该面看，字母表示顺时针转一下，撇号表示逆时针，2 表示转两下。", "You can follow the word cues without memorizing notation first. R means right, L left, U top and F front. Viewed directly from that face, a letter means a clockwise quarter-turn, a prime means counterclockwise, and 2 means a half-turn."),
      text("y／y′＝左／右转体；f／f′＝前面两层一起压／提。", "y / y′ rotates the whole cube left / right; f / f′ lowers / lifts the front two layers together."),
    ],
    examples: [
      { ...example('认识转动', 'Explore the moves', "R R' U U' F F' y y'", '口诀：转一下，再转回来，观察哪些块一起动。初始魔方已还原，黄心朝上、白心朝下、绿心朝前。播放观察动作，用步进逐步看，用回到起点恢复初始状态；拖动空白处可以查看背面和底面。', 'Turn once, then turn back, and watch which pieces move together. Start solved, with yellow up, white down and green in front. Play or step through the moves, return to the start to reset, and drag the background to inspect the back and bottom.'), startSolved: true },
    ],
  },
  {
    id: 'daisy', title: text('做小花', 'Make the daisy'), goal: text('把四个白棱放到黄心周围，侧面暂时不用对齐。', 'Place four white edge stickers around the yellow center; the side colors do not need to match yet.'),
    paragraphs: [],
    examples: [
      example('二楼：右手上', 'Middle: lift right', "y' R", '转体，把标出的白格放到前面右侧，再右手上。', 'Rotate the cube to put the outlined white sticker on the right side of the front face, then lift with the right face.', "F2 R2 B2 L2 R' y"),
      example('二楼：顶面挡住', 'Middle: top is occupied', 'U R', '转顶层移开挡路的花瓣，再右手上。', 'Turn the top layer to move the blocking petal out of the way, then lift with the right face.', "F2 R2 B2 L2 R' U'"),
      example('二楼：左手上', 'Middle: lift left', "y L'", '转体，把标出的白格放到前面左侧，再左手上。', 'Rotate the cube to put the outlined white sticker on the left side of the front face, then lift with the left face.', "F2 R2 B2 L2 L y'"),
      example('三楼：压到二楼', 'Top: lower to middle', 'F R', '压前层送到二楼，再右手上。', 'Lower the front to bring it to the middle, then lift with the right face.', "F R F'"),
      example('一楼：压到二楼', 'Bottom: bring to middle', "F L'", '压前层送到二楼，再左手上。', 'Lower the front to bring it to the middle, then lift with the left face.', 'F R F U2'),
      example('地下室：上上', 'White down: half turn', "y' R2", '把这条白棱放到右层，做“上上”。', 'Put this edge in the right layer and turn the right face twice.', 'F2 R2 B2 L2 R2 y'),
    ],
  },
  {
    id: 'cross', title: text('十字（棱）', 'White cross'), goal: text('白十字在底面，四条侧面颜色也对齐中心。', 'Make a bottom white cross with all four side colors matching their centers.'),
    paragraphs: [
      text("左手拿住顶层，右手同时转下面两层，让白棱侧面的颜色对齐同色中心。转体把它放到右手边，做“上上”。用同样的方法处理其余三条白棱，完成白十字。", "Hold the top layer with your left hand and turn the lower two layers until the white edge’s side color matches its center. Rotate the cube to put this edge on the right, then turn the right face twice. Use the same method for the remaining three white edges to complete the white cross."),
    ],
    // Both demo and practice complete all four petals. d turns the lower two layers while keeping U fixed;
    // y' puts the aligned front edge on the right, then R2 sends it to the bottom.
    examples: [example('对齐 → 转体 → 上上', 'Match colors → rotate → turn twice', "d y' R2 d y' R2 d2 y' R2 d y' R2", '每条白棱都先对齐，再转体放到右手边，做“上上”。', 'For each white edge, match its side color first, rotate it to the right, then turn the right face twice.', "F2 U R2 U2 B2 U L2 U'")],
  },
  {
    id: 'corners', title: text('底层（角）', 'First-layer corners'), goal: text('复原白色底层和侧面第一行。', 'Solve the white layer and the bottom row of each side.'),
    paragraphs: [],
    examples: [
      { ...example('白朝右', 'White faces right', `U' d ${RIGHT}`, '转顶层，把这个角另一侧的非白色格朝前；同时转下面两层，让它与同色中心对齐，再做右公式。', 'Turn the top to face the corner’s other side sticker forward. Turn the lower two layers together to match it with its center, then do the right trigger.'), sceneRot: DOCUMENT_RIGHT_VIEW },
      { ...example('底层白角放错', 'Misplaced bottom white corner', `y' ${RIGHT}`, '先转体把它放右前方，再做右公式取出，最后根据白色朝向选择对应情况。', 'Rotate the whole cube to put it at bottom-front-right, then eject it with the right trigger. Choose the matching case based on which way the white sticker faces.', `${RIGHT} ${RIGHT} ${RIGHT} ${RIGHT} y`), sceneRot: DOCUMENT_RIGHT_VIEW },
      { ...example('白朝左', 'White faces left', `U d ${LEFT}`, '转顶层，把这个角另一侧的非白色格朝前；同时转下面两层，让它与同色中心对齐，再做左公式。', 'Turn the top to face the corner’s other side sticker forward. Turn the lower two layers together to match it with its center, then do the left trigger.'), sceneRot: DOCUMENT_LEFT_VIEW },
      { ...example('白朝上', 'White faces up', `U d ${RIGHT} ${RIGHT} ${RIGHT}`, '先转顶层把白角放右前上方，再转下面两层，让角心交叉对齐，做三遍右公式。', 'Turn the top to put the corner at top-front-right. Turn the lower two layers together to cross-match the colors: the front sticker matches the right center, and the right sticker matches the front center. Do the right trigger three times.'), sceneRot: DOCUMENT_RIGHT_VIEW },
    ],
  },
  {
    id: 'middle', title: text('中层（棱）', 'Middle-layer edges'), goal: text('把不带黄色的棱放进中层。', 'Insert edges without yellow into the middle layer.'),
    paragraphs: [
      text("顶层找非黄棱，放前，同时转下面两层将侧面颜色与中心对齐（形成倒 T），做公式。", "Find a top-layer edge without yellow and bring it to the front. Turn the lower two layers together to match its side color with the center (forming an upside-down T), then do the algorithm."),
    ],
    examples: [
      { ...example('去右', 'Insert right', `U d ${MIDDLE_RIGHT}`, '转顶层放前 → 转下面两层对齐 → 右手拨 → 右公式 → 左转体 → 左公式', 'Bring the edge to the front → match colors with the lower two layers → U → right trigger → rotate left → left trigger'), sceneRot: DOCUMENT_RIGHT_VIEW, caption: text('棱心对齐', 'Match edge and center') },
      { ...example('去左', 'Insert left', `U' d' ${MIDDLE_LEFT}`, '转顶层放前 → 转下面两层对齐 → 左手拨 → 左公式 → 右转体 → 右公式', 'Bring the edge to the front → match colors with the lower two layers → U′ → left trigger → rotate right → right trigger'), sceneRot: DOCUMENT_LEFT_VIEW, caption: text('棱心对齐', 'Match edge and center') },
      { ...example('中层非黄棱', 'Non-yellow middle edge', `y' ${MIDDLE_RIGHT}`, '转体把它放右前方，再做本次公式取出，再根据棱块的去向选择“去右”或“去左”。', 'Rotate the cube to put it at front-right, then use this algorithm to eject it. Then choose “Insert right” or “Insert left” according to where the edge belongs.', `${MIDDLE_RIGHT} y' U ${MIDDLE_RIGHT} y' y`), sceneRot: DOCUMENT_RIGHT_VIEW, caption: text('放错或翻转', 'Misplaced or flipped') },
    ],
  },
  {
    id: 'yellow-cross', title: text('黄十字（棱色向）', 'Yellow cross'), goal: text('只看顶层四条棱的黄色，不管角块。', 'Look only at the four yellow edge stickers, ignoring the corners.'),
    paragraphs: [
      text("只看顶层四条棱的黄色，不管角块。", "Look only at the four yellow edge stickers, ignoring the corners."),
      text("双压、双提是前面两层一起转。", "Both f and f′ turn the front two layers together."),
    ],
    examples: [
      example('横线', 'Line', `U F ${RIGHT} F'`, '转顶层，把两条黄色棱左右横放，做“压、右公式、提”。', 'Turn the top to hold the two yellow edges left to right, then do F, the right trigger, and F′.'),
      example('三点半', 'L shape', `U f ${RIGHT} f'`, '转顶层，让两条黄色棱在前和右，做“双压、右公式、双提”。', 'Turn the top so the yellow edges are at front and right, then do f, the right trigger, and f′.'),
      example('点', 'Dot', `f ${RIGHT} f'`, '先做“双压、右公式、双提”，变成竖线后，再选择“横线”继续。', 'Do f, the right trigger, and f′ to form a vertical line, then select “Line” to continue.', `(f ${RIGHT} f' U F ${RIGHT} F')'`),
    ],
  },
  {
    id: 'yellow-face', title: text('黄面', 'Yellow face'), goal: text('保留黄色十字，观察顶角的灰格和侧面的黄色鱼鳍。', 'Keep the yellow cross and inspect the gray top corners and yellow side fins.'),
    paragraphs: [
      text("保留黄色十字。数自己魔方顶面的灰格个数（即非黄格）。", "Keep the yellow cross. Count the gray squares (the non-yellow stickers) on your cube’s top face."),
      text("鱼头是顶面唯一朝黄的角；鱼鳍是侧面朝黄的角贴纸。", "The fish head is the only yellow-up corner; fins are yellow corner stickers on the sides."),
    ],
    examples: [
      example('3灰 · 右鱼', '3 gray · Right Sune', `U ${RIGHT_SUNE}`, '三个鱼鳍朝右，先转顶层把鱼头放左前，再做右鱼公式。', 'With three fins pointing right, turn the top to put the head at front-left, then do right Sune.'),
      example('3灰 · 左鱼', '3 gray · Left Sune', `U' ${LEFT_SUNE}`, '三个鱼鳍朝左，先转顶层把鱼头放右前，再做左鱼公式。', 'With three fins pointing left, turn the top to put the head at front-right, then do left Sune.'),
      example('2灰 · 二碰', '2 gray · Touch yellow', `U ${RIGHT_SUNE}`, '左拇指放在前面左上角，转顶层让拇指碰黄，做右鱼公式。变成鱼形后，重新数非黄格，再选择对应鱼公式。', 'Place your left thumb at the front face’s upper-left corner. Turn the top until it touches yellow, then do right Sune. Recount the non-yellow squares, then choose the matching Sune.', `(${LEFT_SUNE} U2 ${RIGHT_SUNE})' U'`),
      example('4灰 · 四不碰', '4 gray · Avoid yellow', `U' ${RIGHT_SUNE}`, '左拇指放在前面左上角，转顶层让拇指不碰黄，做右鱼公式。变成鱼形后，重新数非黄格，再选择对应鱼公式。', 'Place your left thumb at the front face’s upper-left corner. Turn the top so it does not touch yellow, then do right Sune. Recount the non-yellow squares, then choose the matching Sune.', `(${RIGHT_SUNE} U ${RIGHT_SUNE})' U`),
    ],
  },
  {
    id: 'corner-position', title: text('角位置', 'Position the corners'), goal: text('顶面保持全黄，让四个顶角归位。', 'Keep the top yellow and put all four top corners in place.'),
    paragraphs: [
      text("先找眼", "First look for headlights"),
    ],
    examples: [
      example('有眼 · 眼放左', 'Headlights · Hold on the left', `y ${CORNER_POSITION} U`, '先转体把眼放左，再做公式。做完转顶层，让四个角与侧面中心对齐。', 'Rotate the whole cube to put the headlights on the left, then do the algorithm. Finish by turning the top to match all four corners with the side centers.'),
      example('无眼 · 先造眼', 'No headlights · Create a pair', CORNER_POSITION, '先做一遍公式，产生眼后，再选择“有眼 · 眼放左”继续。', 'Do the algorithm once to create headlights, then select “Headlights · Hold on the left” to continue.', `(${CORNER_POSITION} U ${CORNER_POSITION} U)'`),
    ],
  },
  {
    id: 'edge-position', title: text('棱位置', 'Position the edges'), goal: text('完成最后三条或四条棱，复原整颗魔方。', 'Solve the final three or four edges to finish the cube.'),
    paragraphs: [
      text("有墙", "If there is a wall"),
    ],
    examples: [
      { ...example('对齐左侧', 'Matching color on the left', `y' ${EDGE_POSITION_LEFT}`, '转体把墙放后 → 右鱼 → 顶层 U → 左鱼 → 转顶层对齐', 'Rotate the cube to put the wall at the back → Right Sune → U → Left Sune → Align the top'), caption: text('右鱼 → U → 左鱼', 'Right Sune → U → left Sune') },
      { ...example('对齐右侧', 'Matching color on the right', `y' ${EDGE_POSITION_RIGHT}`, '转体把墙放后 → 左鱼 → 顶层 U′ → 右鱼 → 转顶层对齐', 'Rotate the cube to put the wall at the back → Left Sune → U′ → Right Sune → Align the top'), caption: text('左鱼 → U′ → 右鱼', 'Left Sune → U′ → right Sune') },
      example('无墙 · 先造墙', 'No wall · Create a wall', EDGE_POSITION_LEFT, '右鱼 → 顶层 U → 左鱼 → 转顶层对齐\n出现墙后，选择对应情况继续。', 'Right Sune → U → Left Sune → Align the top\nOnce a wall appears, choose the matching case to continue.', `(${EDGE_POSITION_LEFT} y' ${EDGE_POSITION_LEFT} y)'`),
    ],
  },
];
