type Text = { zh: string; en: string };
export type LblExample = { title: Text; hint: Text; alg: string; setup?: string; startSolved?: boolean };
type Step = { id: string; title: Text; goal: Text; paragraphs: Text[]; examples: LblExample[] };
const text = (zh: string, en: string): Text => ({ zh, en });
const example = (zh: string, en: string, alg: string, hintZh: string, hintEn: string, setup?: string): LblExample => ({ title: text(zh, en), hint: text(hintZh, hintEn), alg, setup });
export const RIGHT = "R U R' U'";
export const LEFT = "L' U' L U";
export const MIDDLE_FRONT_MATCH = "U R U' R' U' F' U F";
export const MIDDLE_RIGHT_MATCH = "R' F' R U R U' R' F";
export const YELLOW_CROSS = "F R U R' U' F'";
export const YELLOW_FACE_FISH = "R' U' R U' R' U2 R";
export const CORNER_POSITION = "R U R' F' R U R' U' R' F R2 U' R'";
export const EDGE_POSITION = "M2 U M' U2 M U M2";
export const DAISY_CHALLENGE_PROMPT = text('动用你聪明的脑袋，如何拼成这样一朵小花？', 'Put your clever brain to work: how would you make a daisy like this?');
export const DAISY_HINT_INTRO = text('先观察白棱的位置和白色朝向，再选择对应的处理方法。', 'First inspect where the white edge is and which way the white sticker faces, then choose the matching move.');
export const LBL_LESSON_STAGE_IDS = [
  'daisy',
  'cross',
  'corners',
  'middle',
  'yellow-cross',
  'yellow-face',
  'corner-position',
  'edge-position',
] as const;
export type LblLessonStageId = typeof LBL_LESSON_STAGE_IDS[number];
export type LblLessonRun = {
  scramble: string;
  stages: Readonly<Record<LblLessonStageId, string>>;
};

// These source scrambles were generated offline with cubing's standard 3x3 random-state
// generator. Keep the small pool in the lesson so the selected scramble can stay fixed
// while the learner moves between steps; the later stage algorithms can be revised
// independently without adding a server-side solve request.
// Each `daisy` entry below is the offline `DaisySolverWasm` result for its scramble.
// Each `cross` entry below is a fixed beginner trace generated and validated offline
// from that daisy state: align with U, then turn the matching side 180 degrees.
const repeatAlg = (alg: string, count: number): string => Array.from({ length: count }, () => alg).join(' ');
type Regrip = '' | 'y' | 'y2' | "y'";
const regripAlg = (regrip: Regrip, alg: string): string => {
  const inverse = regrip === 'y' ? "y'" : regrip === "y'" ? 'y' : regrip;
  return [regrip, alg, inverse].filter(Boolean).join(' ');
};
const rightCornerCycle = (regrip: Regrip, count: number): string => regripAlg(regrip, repeatAlg(RIGHT, count));
export const LBL_LESSON_RUNS: readonly LblLessonRun[] = [
  {
    scramble: "U R' B2 U B L' U F' R' U L2 D' L2 B2 R2 B2 D2 F2 L2 R",
    stages: {
      daisy: "U F' L' F B R'",
      cross: 'U L2 F2 R2 B2',
      corners: [
        rightCornerCycle("y'", 1),
        "U'",
        repeatAlg(RIGHT, 3),
        "U'",
        rightCornerCycle("y'", 5),
        rightCornerCycle('y2', 5),
      ].join(' '),
      middle: [
        regripAlg("y'", MIDDLE_RIGHT_MATCH),
        regripAlg('y', MIDDLE_RIGHT_MATCH),
        regripAlg('y2', MIDDLE_RIGHT_MATCH),
      ].join(' '),
      'yellow-cross': ["U'", YELLOW_CROSS, YELLOW_CROSS].join(' '),
      'yellow-face': ['U2', YELLOW_FACE_FISH, "U'", YELLOW_FACE_FISH, 'U2', YELLOW_FACE_FISH].join(' '),
      'corner-position': ['U', CORNER_POSITION, 'U', CORNER_POSITION].join(' '),
      'edge-position': ['U', EDGE_POSITION, "U'"].join(' '),
    },
  },
  {
    scramble: "B R' U' F' L2 F' U' L' D L U2 F' L2 F' R2 B U2 F2 R2 U2 F2",
    stages: {
      daisy: 'U2 L2 R F B',
      cross: "U L2 U' R2 B2 U' F2",
      corners: [
        rightCornerCycle('y', 1),
        'U',
        repeatAlg(RIGHT, 5),
        'U2',
        rightCornerCycle("y'", 1),
        rightCornerCycle('y2', 1),
        "U'",
        rightCornerCycle('y', 5),
      ].join(' '),
      middle: [
        'U2',
        MIDDLE_RIGHT_MATCH,
        regripAlg("y'", MIDDLE_FRONT_MATCH),
        regripAlg('y', MIDDLE_FRONT_MATCH),
        "U'",
        regripAlg('y2', MIDDLE_FRONT_MATCH),
      ].join(' '),
      'yellow-cross': '',
      'yellow-face': [YELLOW_FACE_FISH, 'U', YELLOW_FACE_FISH, 'U2', YELLOW_FACE_FISH].join(' '),
      'corner-position': ['U2', CORNER_POSITION].join(' '),
      'edge-position': ['U', EDGE_POSITION, "U'"].join(' '),
    },
  },
  {
    scramble: "L2 D' R' D' R F2 B2 D F D2 R2 D2 B' R2 L2 B2 D2 R2 L U",
    stages: {
      daisy: "U D F' B R",
      cross: "U' R2 U L2 U' B2 U' F2",
      corners: [
        'U',
        repeatAlg(RIGHT, 3),
        rightCornerCycle('y2', 1),
        "U'",
        rightCornerCycle("y'", 5),
        rightCornerCycle('y', 1),
        "U'",
        rightCornerCycle('y2', 5),
        rightCornerCycle('y', 1),
      ].join(' '),
      middle: [
        regripAlg('y2', MIDDLE_FRONT_MATCH),
        "U'",
        MIDDLE_RIGHT_MATCH,
        'U2',
        regripAlg("y'", MIDDLE_FRONT_MATCH),
        "U'",
        regripAlg('y', MIDDLE_RIGHT_MATCH),
        'U2',
        regripAlg('y2', MIDDLE_FRONT_MATCH),
      ].join(' '),
      'yellow-cross': ['U2', YELLOW_CROSS, YELLOW_CROSS].join(' '),
      'yellow-face': ['U', YELLOW_FACE_FISH, "U'", YELLOW_FACE_FISH, 'U2', YELLOW_FACE_FISH].join(' '),
      'corner-position': ['U', CORNER_POSITION, CORNER_POSITION].join(' '),
      'edge-position': ["U'", EDGE_POSITION, 'U'].join(' '),
    },
  },
];
export const LBL_STEPS: Step[] = [
  {
    id: 'structure', title: text('结构与记号', 'Structure and notation'),
    goal: text('认识中心、棱块和角块，再开始复原。', 'Meet the centers, edges and corners before solving.'),
    paragraphs: [
      text('三阶魔方由鲁比克于 1974 年发明。六个中心各有一种颜色，由内部轴连接；十二个棱块各有两种颜色；八个角块各有三种颜色。中心的相对位置不变，决定每一面的颜色。', 'Invented by Ernő Rubik in 1974, the 3×3 has six one-color centers connected by an internal mechanism, twelve two-color edges and eight three-color corners. The relative positions of the centers determine each face’s color.'),
      text('本教程使用白对黄、红对橙、蓝对绿的配色。黄心朝上、白心朝下。小花完成后，始终以白色为底层。', 'This guide uses white opposite yellow, red opposite orange and blue opposite green. Hold yellow up and white down. After making the daisy, keep white as the bottom layer.'),
      text('R 右、L 左、U 上、D 下、F 前、B 后。正对所转的面看，单个字母表示顺时针 90°，撇号表示逆时针，2 表示 180°。小写 f 表示前面两层一起转；y 表示整颗魔方沿 U 的方向转体。', 'R = right, L = left, U = up, D = down, F = front, B = back. Looking directly at that face, a letter means 90° clockwise, a prime means counterclockwise, and 2 means 180°. Lowercase f turns the front two layers together; y rotates the whole cube in the U direction.'),
      text('右公式：右手上钩下回。左公式：左手上钩下回。先看动画模仿动作，不必一次记住全部字母。', 'Right trigger: lift, hook, lower, return with the right hand. The left trigger mirrors it. Follow the animation first; there is no need to memorize every letter at once.'),
    ],
    examples: [
      { ...example('认识转动', 'Explore the moves', "R R' U U' F F' y y'", '播放观察每个动作；拖动空白处可以查看背面和底面。', 'Play to inspect each move; drag the background to see the back and bottom.'), startSolved: true },
      { ...example('右公式', 'Right trigger', RIGHT, '观察右手的四步动作。', 'Watch the four right-hand moves.'), startSolved: true },
      { ...example('左公式', 'Left trigger', LEFT, '观察左手的四步动作。', 'Watch the four left-hand moves.'), startSolved: true },
    ],
  },
  {
    id: 'daisy', title: text('小花', 'Daisy'), goal: text('把四个白棱放到黄心周围。', 'Place four white edge stickers around the yellow center.'),
    paragraphs: [
      text('黄心始终朝上，可以暂时把魔方放在桌上。先找中层的白棱，转体把白格放在前面，再用左手上或右手上送到顶层。', 'Keep yellow up; you can rest the cube on a table. Find a white edge in the middle layer, rotate the cube to put its white sticker in front, then lift it with the left or right face.'),
      text('如果顶层已有白棱挡住目标位置，先转 U 挪开，再上升。图中的 U* 表示按实际情况转动顶层，并非固定的一步。', 'If a white petal already occupies the target, turn U to move it away before lifting the new edge. U* in the sheet means an appropriate top-layer adjustment, not a fixed move.'),
      text('中层没有白棱时，把顶层或底层侧面朝白的棱转到前面，压前层送入中层，再按前一种情况处理。白格若朝底面，把它放在右边，用 R2 一次翻上来。', 'If no white edge is in the middle, bring a top- or bottom-layer edge with white on its side to the front. Turn F to lower it into the middle, then lift it as above. If white faces down, put that edge on the right and use R2.'),
    ],
    examples: [
      example('二楼：右手上', 'Middle: lift right', 'R', '白格在前面右侧，右上方没有白棱挡住。', 'White is at front-right, with a free top-right petal position.', "F2 R2 B2 L2 R'"),
      example('二楼：顶面挡住', 'Middle: top is occupied', 'U R', '本例先转 U 挪开白棱，再做 R；实际可用 U、U′ 或 U2。', 'This example clears the petal with U, then lifts with R; other cases may need U′ or U2.', "F2 R2 B2 L2 R' U'"),
      example('二楼：左手上', 'Middle: lift left', "L'", '白格在前面左侧，先确认左上方空着。', 'White is at front-left; first make sure the top-left position is free.', 'F2 R2 B2 L2 L'),
      example('三楼：压到二楼', 'Top: lower to middle', 'F', '先压前层，把侧面朝白的棱送入中层，然后重新观察。', 'Lower the front face to put the side-facing white edge in the middle, then inspect again.', "F2 R2 B2 L2 R' F'"),
      example('一楼：压到二楼', 'Bottom: bring to middle', 'F', '底层侧面朝白的棱同样先进入中层；后续选择左手上或右手上。', 'Bring a bottom edge with white on its side into the middle, then choose the left or right lift.', "F2 R2 B2 L2 L F'"),
      example('地下室：上上', 'White down: half turn', 'R2', '把朝下的白棱放在右侧，空出右上方，再转 180°。', 'Put the downward-facing white edge on the right, clear the top-right position, then turn 180°.', 'F2 R2 B2 L2 R2'),
    ],
  },
  {
    id: 'cross', title: text('十字（棱）', 'White cross'), goal: text('白十字在底面，四条侧面颜色也对齐中心。', 'Make a bottom white cross with all four side colors matching their centers.'),
    paragraphs: [
      text('左手拿住顶层，右手同时转下面两层，直到一片白花瓣的侧面颜色对齐同色中心。把这条棱所在的侧面转 180°，白棱就到底面了。', 'Hold the top layer with the left hand and turn the lower two layers until a petal’s side color matches its center. Turn that side face 180° to send the white edge to the bottom.'),
      text('也可以直接转 U 来对齐。处理好的一条留在底面，重复四次。最后检查四个侧面都是同色的小竖线，不能只看底面是白色。', 'You can also align the edge by turning U. Leave each solved edge on the bottom and repeat four times. Check that each side forms a matching vertical pair; a white bottom alone is not enough.'),
    ],
    examples: [example('四片花瓣依次归位', 'Send all four petals home', 'L2 B2 R2 F2', '演示中侧色已对齐，依次把左、后、右、前的白棱翻到底层。自己的魔方先对色，再转两下。', 'Here the side colors are already aligned. Send the left, back, right and front petals down. On your cube, match the side color before each half turn.', 'F2 R2 B2 L2')],
  },
  {
    id: 'corners', title: text('底层（角）', 'First-layer corners'), goal: text('复原白色底层和侧面第一行。', 'Solve the white layer and the bottom row of each side.'),
    paragraphs: [
      text('找顶层带白色的角，观察另外两种颜色，把它放在对应两个中心之间的上方。先转体，把目标槽放到右前下，再把白色角块放到右前上；只用右公式反复插入。', 'Find a white corner in the top layer. Use its other two colors to place it above the matching slot. First rotate the whole cube so the target slot is bottom-front-right, then put the white corner at top-front-right and repeatedly use only the right trigger.'),
      text('白格朝上时，把目标槽放到右前下，白色角块放到右前上，连续做三遍右公式。白格朝向不同，就选择 R U R\' U\' 或 U R U\' R\' 重复，直到白色贴纸朝下、两侧颜色也对齐。若白角已在底层但位置或方向错误，把它所在的槽转到右前下，先做一次右公式取出，再重新对色插入；已经正确归位的角直接跳过。', 'If white faces up, put the target slot at bottom-front-right, place the white corner at top-front-right, and do the right trigger three times. For another white orientation, repeat either R U R\' U\' or U R U\' R\' until the white sticker faces down and both side colors match. If a white corner is trapped incorrectly in the bottom, rotate its slot to bottom-front-right, use one right trigger to eject it, then realign and insert it; skip a corner that is already solved.'),
    ],
    examples: [
      example('白朝右', 'White faces right', RIGHT, '角的另外两色对齐右前方两个中心。', 'Match the corner’s other colors to the front and right centers.'),
      example('底层白角放右', 'Eject a bottom corner', RIGHT, '先把错误角放在右前下方；本例播放后角被取出，下一次再按顶层情况处理。', 'Place the incorrect corner at bottom-front-right. This demo ejects it; then solve it as a top-layer case.', `${RIGHT} ${RIGHT}`),
      example('转体到右前', 'Regrip to front-right', `y ${RIGHT} y'`, '先把目标槽转到右前下，仍然只做右公式。', 'Turn the target slot to bottom-front-right, then use only the right trigger.'),
      example('白朝上', 'White faces up', `${RIGHT} ${RIGHT} ${RIGHT}`, '目标槽放右前下，完整做三遍右公式。', 'Put the target slot at bottom-front-right and do all three right triggers.'),
    ],
  },
  {
    id: 'middle', title: text('中层（棱）', 'Middle-layer edges'), goal: text('把不带黄色的棱放进中层。', 'Insert edges without yellow into the middle layer.'),
    paragraphs: [
      text('在顶层找不含黄色的棱，先让一侧颜色对齐同色中心，形成倒 T。若正面颜色已经匹配，棱块应去右侧，使用第一公式：U R U\' R\' U\' F\' U F。若右侧颜色已经匹配，棱块应去左侧，使用第二公式：R\' F\' R U R U\' R\' F。', 'Find a top-layer edge without yellow and match one side with its center to make an upside-down T. If the front color matches, the edge belongs on the right: use the first sequence, U R U\' R\' U\' F\' U F. If the right color matches, the edge belongs on the left: use the second sequence, R\' F\' R U R U\' R\' F.'),
      text('用 U、U\' 或 U2 把目标棱放到正确的上层位置；遇到后面或左面的情况，先用 y、y\' 或 y2 转体，再按同样的两套公式处理。中层若卡着错误棱，把它转到右前方，用任意一套公式先取出，再重新对色归位。', 'Use U, U\' or U2 to place the target edge in the correct top-layer position. For a back- or left-side case, first use y, y\' or y2 to regrip, then use the same two sequences. If a wrong edge is stuck in the middle, bring it to front-right, eject it with either sequence, then realign and insert it.'),
    ],
    examples: [
      example('正面颜色匹配', 'Front color matches', MIDDLE_FRONT_MATCH, '正面颜色对中心，棱块去右侧。', 'The front color matches its center; insert the edge to the right.'),
      example('右侧颜色匹配', 'Right-side color matches', MIDDLE_RIGHT_MATCH, '右侧颜色对中心，棱块去左侧。', 'The right-side color matches its center; insert the edge to the left.'),
      example('转体适配其他方向', 'Regrip for other sides', `y ${MIDDLE_FRONT_MATCH} y'`, '后面、左面的情况先转体，再使用同一套公式。', 'For back- or left-side cases, regrip first, then use the same sequence.'),
    ],
  },
  {
    id: 'yellow-cross', title: text('黄十字（棱色向）', 'Yellow cross'), goal: text('只看顶层四条棱的黄色，不管角块。', 'Look only at the four yellow edge stickers, ignoring the corners.'),
    paragraphs: [
      text('先观察顶层黄色棱块：如果是镜像 L，就把两条黄色棱放在左侧和后侧；如果是一字形，就把两条黄色棱摆成左右横线。已经是黄色十字时直接跳过。', 'First inspect the yellow top edges. For the mirrored L, put the two yellow edges at the left and back. For the line, hold the two yellow edges horizontally, left and right. If the yellow cross is already complete, skip this step.'),
      text('做一遍固定公式：F R U R\' U\' F\'。然后观察黄色面的形状：变成一字形时把一字横放，变成镜像 L 时重新把 L 放到左后方，再做一遍。重复“观察—调整—公式”，直到出现黄色十字。', 'Use the fixed sequence once: F R U R\' U\' F\'. Then inspect the yellow face. If it becomes a line, hold the line horizontally; if it becomes the mirrored L, put the L back at the upper-left of the yellow face. Repeat “inspect, adjust, sequence” until the yellow cross appears.'),
    ],
    examples: [
      example('镜像 L', 'Mirrored L', YELLOW_CROSS, '两条黄色棱在左侧和后侧，做一次后重新观察。', 'Put the yellow edges at the left and back, then inspect again after one sequence.'),
      example('一字形', 'Line', YELLOW_CROSS, '两条黄色棱左右横放，做一次。', 'Hold the two yellow edges horizontally, left and right, then do one sequence.'),
      example('重复观察', 'Repeat and inspect', `${YELLOW_CROSS} U ${YELLOW_CROSS}`, '第一遍后重新拿方；一字横放或镜像 L 放左后，再做公式。', 'After the first sequence, regrip: hold the line horizontally or the mirrored L at the upper-left, then repeat.'),
    ],
  },
  {
    id: 'yellow-face', title: text('黄面（小鱼公式）', 'Yellow face: fish sequence'), goal: text('让顶面四个角的黄色全部朝上。', 'Turn all four top-layer corner stickers yellow-side up.'),
    paragraphs: [
      text('先找一个黄色没有朝上的顶层角块，把这个角块的黄色贴纸放到左前方，并让黄色贴纸朝向前方。', 'Find a top-layer corner whose yellow sticker is not facing up. Put that yellow sticker at the front-left and face it toward the front.'),
      text('先做小鱼公式：R\' U\' R U\' R\' U2 R。做完观察顶面，直到出现小鱼。小鱼形状是顶面只有一个黄色角朝上。', 'First use the small-fish sequence: R\' U\' R U\' R\' U2 R. Inspect the top face until the small fish appears. The small-fish pattern has exactly one yellow corner facing up.'),
      text('出现小鱼后，把“鱼头”（顶面唯一朝上的黄色角）朝向左前方，再做同一个公式。每做完一次，都重新把鱼头朝向左前方并重复公式，直到顶面四个角的黄色全部朝上。黄十字和前两层应保持不变。', 'Once the fish appears, point its “head”—the only yellow corner facing up—toward the front-left and do the same sequence again. After each sequence, put the fish head at the front-left again and repeat until all four top-layer corners are yellow-side up. Keep the yellow cross and first two layers solved.'),
    ],
    examples: [
      example('黄色贴纸放左前', 'Yellow sticker at front-left', YELLOW_FACE_FISH, '未归位角的黄色贴纸朝向前方，并位于左前方。', 'Face the unsolved corner’s yellow sticker toward the front at the front-left.'),
      example('出现小鱼', 'Small fish appears', YELLOW_FACE_FISH, '小鱼出现后，把鱼头朝向左前方，再做同一个公式。', 'After the small fish appears, point its head toward the front-left and do the same sequence.'),
      example('重复直到顶面全黄', 'Repeat until the top is yellow', `${YELLOW_FACE_FISH} U ${YELLOW_FACE_FISH} U2 ${YELLOW_FACE_FISH}`, '每次都把鱼头重新朝向左前方，直到顶面全部为黄色。', 'Point the fish head toward the front-left each time until the whole top is yellow.'),
    ],
  },
  {
    id: 'corner-position', title: text('角位置', 'Position the corners'), goal: text('让顶层每个角回到正确的位置。', 'Put every top-layer corner in its correct position.'),
    paragraphs: [
      text('观察四个侧面的顶行。一个面两侧的角块颜色一致，像一只眼睛，这就叫“眼”；如果这个面的三个顶行方块颜色一致，也算一只眼。', 'Inspect the top row on each side. Matching colors on the two corner blocks look like an eye; if all three stickers in that top row match, that also counts as an eye.'),
      text("有眼时把眼放在左边，做公式：R U R' F' R U R' U' R' F R2 U' R'。无眼时任选一面先做一次；出现眼后把眼放在左边，再做同一个公式。", "When there is an eye, put it on the left and use R U R' F' R U R' U' R' F R2 U' R'. With no eye, use the same formula once from any side; when an eye appears, put it on the left and use the formula again."),
      text('每做完一次都重新观察，按“无眼先做一次、有眼放左边”的方法继续，直到四个顶层角块的位置全部正确。角块归位后，黄色面和前两层应保持不变；顶层侧面的颜色需要时最后用 U 对齐。', 'Inspect again after every sequence. Continue with “use it once with no eye, then put the eye on the left” until all four top-layer corners are in the correct positions. Keep the yellow face and first two layers solved; use U at the end to align the side colors if needed.'),
    ],
    examples: [
      example('眼放左', 'Eye on the left', CORNER_POSITION, '一个面两侧的角块颜色一致像一只眼睛；三个顶行方块颜色一致也算眼。把眼放左后做公式。', 'Matching colors on the two corner blocks look like an eye; a full three-sticker top row also counts. Put the eye on the left, then use the sequence.'),
      example('无眼', 'No eye', CORNER_POSITION, '没有眼时任选一面先做一次；出现眼后把眼放左，再重复同一公式。', 'With no eye, use the sequence once from any side. When an eye appears, put it on the left and repeat the same sequence.'),
      example('重复直到角块归位', 'Repeat until corners are positioned', `${CORNER_POSITION} U ${CORNER_POSITION}`, '每次重新找眼并放左，直到四个角块的位置都正确。', 'Find the eye and put it on the left again each time until all four corners are positioned.'),
    ],
  },
  {
    id: 'edge-position', title: text('棱位置', 'Position the edges'), goal: text('完成最后四条棱，复原整颗魔方。', 'Solve the final four edges to finish the cube.'),
    paragraphs: [
      text('最后一步有两种情况：四只眼睛和三只眼睛。先观察四个侧面的顶行，确认眼睛的数量。', 'There are two cases in the last step: four eyes and three eyes. First inspect the top row on all four sides and count the eyes.'),
      text("三只眼睛时，把中间的眼睛对着自己，然后做公式：M2 U M' U2 M U M2。做一次或者两次；每次做完都重新观察，直到完全复原。", "With three eyes, face the middle eye toward you and use M2 U M' U2 M U M2. Do it once or twice, inspecting the cube after each sequence until it is fully solved."),
      text('如果有四只眼睛，先做一遍同一个公式，进入三只眼睛的状态；然后按上面的方法，把中间的眼睛对着自己继续做。M2 是中间层 180°，M′ 和 M 是中间层的反、正转，U 是顶层转动。', 'With four eyes, first use the same sequence once to reach the three-eye case. Then follow the method above: face the middle eye toward you and continue. M2 turns the middle layer 180°, M′ and M turn the middle layer in opposite directions, and U turns the top layer.'),
    ],
    examples: [
      example('四只眼睛', 'Four eyes', EDGE_POSITION, '先做一遍公式，进入三只眼睛状态。', 'Use the sequence once to reach the three-eye case.'),
      example('三只眼睛', 'Three eyes', EDGE_POSITION, '把中间的眼睛对着自己，做一次或者两次，直到完全复原。', 'Face the middle eye toward you and use the sequence once or twice until solved.'),
      example('三只眼睛重复', 'Repeat the three-eye case', `${EDGE_POSITION} ${EDGE_POSITION}`, '两次公式之间重新观察；完全复原后停止。', 'Inspect between the two sequences and stop when the cube is fully solved.'),
    ],
  },
];
