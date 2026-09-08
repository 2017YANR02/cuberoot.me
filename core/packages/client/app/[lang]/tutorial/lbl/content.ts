type Text = { zh: string; en: string };
export type LblExample = { title: Text; hint: Text; alg: string; setup?: string; startSolved?: boolean };
type Step = { id: string; title: Text; goal: Text; paragraphs: Text[]; examples: LblExample[] };
const text = (zh: string, en: string): Text => ({ zh, en });
const example = (zh: string, en: string, alg: string, hintZh: string, hintEn: string, setup?: string): LblExample => ({ title: text(zh, en), hint: text(hintZh, hintEn), alg, setup });
export const RIGHT = "R U R' U'";
export const LEFT = "L' U' L U";
export const RIGHT_SUNE = "R U R' U R U2 R'";
export const LEFT_SUNE = "L' U' L U' L' U2 L";
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
      text('找顶层带白色的角，观察另外两种颜色，把它放在对应两个中心之间的上方。白格朝右用右公式，朝左用左公式。', 'Find a white corner in the top layer. Use its other two colors to place it above the slot between the matching centers. Use the right trigger for white facing right, or the left trigger for white facing left.'),
      text('白格朝上时，把目标槽放在右前方，连续做三遍右公式。若白角已在底层但位置或方向错误，把它放右前方，先做右公式取出，再重新对色插入。', 'If white faces up, put its destination at front-right and perform the right trigger three times. If a corner is trapped incorrectly in the bottom, bring it to front-right, use the right trigger to eject it, then realign and insert.'),
    ],
    examples: [
      example('白朝右', 'White faces right', RIGHT, '角的另外两色对齐右前方两个中心。', 'Match the corner’s other colors to the front and right centers.'),
      example('底层白角放右', 'Eject a bottom corner', RIGHT, '先把错误角放在右前下方；本例播放后角被取出，下一次再按顶层情况处理。', 'Place the incorrect corner at bottom-front-right. This demo ejects it; then solve it as a top-layer case.', `${RIGHT} ${RIGHT}`),
      example('白朝左', 'White faces left', LEFT, '目标槽在左前方，另外两色分别对应前、左中心。', 'The destination is front-left; match the other colors to the front and left centers.'),
      example('白朝上', 'White faces up', `${RIGHT} ${RIGHT} ${RIGHT}`, '目标槽放右前方，完整做三遍，中途不要转体。', 'Keep the target at front-right and do all three triggers without rotating the cube.'),
    ],
  },
  {
    id: 'middle', title: text('中层（棱）', 'Middle-layer edges'), goal: text('把不带黄色的棱放进中层。', 'Insert edges without yellow into the middle layer.'),
    paragraphs: [
      text('在顶层找不含黄色的棱，让前面的颜色对齐同色中心，形成倒 T。看棱的顶色对应左边还是右边中心，选择相应公式。', 'Find a top-layer edge without yellow. Match its front color with the front center to make an upside-down T. Its top color determines whether it belongs on the left or right.'),
      text('去右：右手拨、右公式、左转体、左公式。去左：左手拨、左公式、右转体、右公式。中层若卡着错误棱，把它放右前方，做一次去右公式取出，再对色归位。', 'To the right: U, right trigger, y′, left trigger. To the left: U′, left trigger, y, right trigger. If an incorrect edge is stuck in the middle, place it at front-right and eject it with the right insertion, then align and solve it.'),
    ],
    examples: [
      example('去右', 'Insert right', `U ${RIGHT} y' ${LEFT}`, '前色对中心，顶色对应右中心。', 'Match the front color; the top color belongs on the right.'),
      example('中层非黄棱放右', 'Eject a middle edge', `U ${RIGHT} y' ${LEFT}`, '本例从错误中层棱开始；播放后重新找顶层不带黄的棱。', 'This starts with a misplaced middle edge. After playing, find a top edge without yellow again.', `U ${RIGHT} y' ${LEFT}`),
      example('去左', 'Insert left', `U' ${LEFT} y ${RIGHT}`, '前色对中心，顶色对应左中心。', 'Match the front color; the top color belongs on the left.'),
    ],
  },
  {
    id: 'yellow-cross', title: text('黄十字（棱色向）', 'Yellow cross'), goal: text('只看顶层四条棱的黄色，不管角块。', 'Look only at the four yellow edge stickers, ignoring the corners.'),
    paragraphs: [
      text('横线：把两条黄色棱摆成左右横线。三点半：把黄色棱摆在后方和左方。点：四条棱都不朝黄，先做大 F 公式，再观察转成三点半拿方，做小 f 公式。', 'Line: hold the yellow edges left and right. L shape: put the yellow edges at the back and left. Dot: no edge faces yellow up; use the F sequence, then inspect and hold the resulting L correctly before using the f sequence.'),
      text('大 F：压前层、右公式、提回。小 f：同时压前面两层、右公式、双层提回。已经是黄十字就跳过。合法状态不会只出现一条或三条朝黄的顶棱。', 'F sequence: lower the front, right trigger, restore the front. The f sequence uses the front two layers. Skip if the cross is already formed. A legal state cannot have exactly one or three yellow-up top edges.'),
    ],
    examples: [
      example('横线', 'Line', `F ${RIGHT} F'`, '两条黄色棱左右横放。', 'Hold the two yellow edges horizontally, left and right.'),
      example('三点半', 'L shape', `f ${RIGHT} f'`, '黄色棱在后和左；f 是前面两层一起转。', 'Yellow edges are at back and left; f turns two layers.'),
      example('点', 'Dot', `F ${RIGHT} F' f ${RIGHT} f'`, '演示为两段连做；拿真实魔方时，第一段后重新看三点半的位置。', 'The demo combines both sequences; on your cube, inspect the L position after the first sequence.'),
    ],
  },
  {
    id: 'yellow-face', title: text('黄面（角色向）', 'Yellow face'), goal: text('让四个顶角的黄色都朝上。', 'Turn all four yellow corner stickers upward.'),
    paragraphs: [
      text('数顶面还没有朝黄的角。三个时为鱼形：右鱼把鱼头放左前方，左鱼放右前方。鱼头是唯一黄色朝上的顶角。根据下面动画选择右鱼或左鱼公式。', 'Count corners that are not yellow up. Three means a fish: hold the right Sune’s head at front-left, or the left Sune’s head at front-right. The head is the only yellow-up corner. Match the animation to choose the correct Sune.'),
      text('两个时转 U，让左手拇指放在前面左上角时碰到黄色；四个时转 U，让这个位置不是黄色，再做右鱼公式。做完重新数角、重新拿方，必要时重复。', 'With two unsolved corners, turn U until a left thumb at the front face’s upper-left corner touches yellow. With four, turn U until that position is not yellow, then do right Sune. Recount and reposition after each sequence; repeat as needed.'),
      text('黄十字和前两层应一直保留。只有一个顶角方向错误不属于正常转动可达的情况；先检查是否装错或被单独拧角。', 'The yellow cross and first two layers should remain solved. A single twisted corner is not reachable through legal turns; check for a twisted or incorrectly assembled corner.'),
    ],
    examples: [
      example('右鱼', 'Right Sune', RIGHT_SUNE, '三个角未朝黄，鱼头在左前方；前面右上角是黄色。', 'Three corners are not yellow up. Head at front-left; yellow faces front at upper-right.'),
      example('左鱼', 'Left Sune', LEFT_SUNE, '三个角未朝黄，鱼头在右前方；前面左上角是黄色。', 'Three corners are not yellow up. Head at front-right; yellow faces front at upper-left.'),
      example('两角未朝黄', 'Two unsolved corners', RIGHT_SUNE, '左拇指碰黄，做一次右鱼变成鱼形，再重新拿方。', 'Touch yellow with the left thumb; one right Sune makes a fish. Reposition afterward.', `(${LEFT_SUNE} U2 ${RIGHT_SUNE})'`),
      example('四角未朝黄', 'Four unsolved corners', RIGHT_SUNE, '左拇指不碰黄，先转成鱼形，再选择对应鱼公式。', 'The left thumb does not touch yellow. Make a fish first, then choose the matching Sune.', `(${RIGHT_SUNE} U ${RIGHT_SUNE})'`),
    ],
  },
  {
    id: 'corner-position', title: text('角位置', 'Position the corners'), goal: text('让顶层每个角回到正确的位置。', 'Put every top-layer corner in its correct position.'),
    paragraphs: [
      text('看四个侧面顶行的两个角：同色的一对叫眼睛。有眼睛就把它放在左侧，做下面的公式；没有眼睛就任选一面先做一次，再找眼睛放左重做。', 'Inspect the two top corner stickers on each side. A matching pair forms headlights. Put headlights on the left and use the sequence below. With no headlights, do it once from any side, then put the new pair on the left and repeat.'),
      text('原图把它叫作 L 公式。做完转 U 对齐角与侧面中心；四个角都已在正确位置时直接跳过。', 'The source calls this the L algorithm. Afterward, turn U to align the corners with their side centers. Skip this step if all corners are already correctly placed.'),
    ],
    examples: [
      example('眼放左', 'Headlights on the left', "R U R' F' R U R' U' R' F R2 U' R'", '左侧两个顶角的侧贴纸同色，完整播放后再对齐 U。', 'The left-side top corner stickers match. Complete the sequence, then align U.'),
      example('无眼', 'No headlights', "R U R' F' R U R' U' R' F R2 U' R'", '先做一次制造眼睛；不是做一次就一定复原。', 'First create headlights; this case is not expected to solve in one pass.', "(R U R' F' R U R' U' R' F R2 U' R' U R U R' F' R U R' U' R' F R2 U' R')'"),
    ],
  },
  {
    id: 'edge-position', title: text('棱位置', 'Position the edges'), goal: text('完成最后三条或四条棱，复原整颗魔方。', 'Solve the final three or four edges to finish the cube.'),
    paragraphs: [
      text('先对齐顶角，寻找顶行三个色块同色的一面，叫作墙。把墙放后面，看前面顶棱应去左还是去右，选择下面的组合。', 'Align the top corners first. Find a side whose three top stickers match: the solved wall. Hold it at the back. Check whether the front top edge belongs on the left or right, then choose the corresponding combination.'),
      text('前棱去左：右鱼公式、U、左鱼公式，最后 U′ 对齐。前棱去右：左鱼公式、U′、右鱼公式，最后 U 对齐。两次鱼公式之间不要转体，只转指定的 U 或 U′。', 'Front edge goes left: right Sune, U, left Sune, then U′ to align. Front edge goes right: left Sune, U′, right Sune, then U to align. Keep the same grip between the Sunes; make only the indicated U or U′ adjustment.'),
      text('没有墙时先任选一面，完整做一次任意组合；再把出现的墙放后面重做。最后转 U 对齐四个侧面，检查六面全部复原。', 'With no wall, do either complete combination from any side. Then hold the new wall at the back and solve again. Finish with U alignment if needed, and check all six faces.'),
    ],
    examples: [
      example('右鱼 → U → 左鱼', 'Right Sune → U → left Sune', `${RIGHT_SUNE} U ${LEFT_SUNE} U'`, '墙在后面，前面的顶棱去左边；最后 U′ 对齐。', 'Wall at the back; the front top edge belongs on the left. Finish with U′.'),
      example('左鱼 → U′ → 右鱼', 'Left Sune → U′ → right Sune', `${LEFT_SUNE} U' ${RIGHT_SUNE} U`, '墙在后面，前面的顶棱去右边；最后 U 对齐。', 'Wall at the back; the front top edge belongs on the right. Finish with U.'),
    ],
  },
];
