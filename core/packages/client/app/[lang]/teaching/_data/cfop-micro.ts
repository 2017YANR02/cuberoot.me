import { l, microLesson, numberedCaseLessons } from './builders';
import type { LessonKind, LocalizedText, MicroCourse, MicroLesson, Module } from './types';

function lesson(id: string, zhTitle: string, enTitle: string, minutes: number, zhOutcome: string, enOutcome: string, kind: LessonKind = 'concept') {
  return microLesson({ id, title: l(zhTitle, enTitle), minutes, outcome: l(zhOutcome, enOutcome), kind });
}

function module(id: string, zhTitle: string, enTitle: string, zhSummary: string, enSummary: string, lessons: MicroLesson[], resource?: { label: LocalizedText; href: string }): Module {
  return { id, title: l(zhTitle, enTitle), summary: l(zhSummary, enSummary), lessons, resource };
}

function labeledCases(prefix: string, zhTopic: string, enTopic: string, labels: Array<string | number>, minutes = 2): MicroLesson[] {
  return labels.map((label) => lesson(
    `${prefix}-${String(label).toLowerCase()}`,
    `${zhTopic} ${label}`,
    `${enTopic} ${label}`,
    minutes,
    `能从标准角度识别并独立完成${zhTopic} ${label}`,
    `Recognize and solve ${enTopic} ${label} independently from the standard angle`,
    'case',
  ));
}

const algResource = (set: string, zhName = set, enName = set) => ({
  label: l(`打开站内 ${zhName} 公式库`, `Open the ${enName} algorithm library`),
  href: `/alg/3x3/${set}`,
});

const fundamentals = module(
  'cfop-fundamentals', '介绍与基本功', 'Introduction and fundamentals',
  '统一课程路线、拿法和指法，后面每个案例沿用同一套讲解语言。',
  'Establish the course route, grips, and fingertricks used in every later case.',
  [
    lesson('cfop-fundamentals-01', 'CFOP 课程介绍', 'CFOP course introduction', 4, '能说出十字、F2L、OLL、PLL 四个阶段', 'Name the Cross, F2L, OLL, and PLL stages'),
    lesson('cfop-fundamentals-02', '稳定拿法与换手', 'Grip and regrips', 3, '能保持正面和底面方向，减少不必要的换手', 'Keep the front and bottom orientation while reducing unnecessary regrips', 'drill'),
    lesson('cfop-fundamentals-03', '常用指法', 'Fingertricks', 4, '能连贯完成常用 U、U\'、U2、R 和 F 层指法', 'Perform common U, U\', U2, R, and F fingertricks smoothly', 'drill'),
  ],
);

const beginnerCross = module(
  'cfop-beginner-cross', '入门十字', 'Beginner Cross',
  '理解十字目标，并用少量观察代替逐块寻找。', 'Understand the Cross goal and replace piece-by-piece searching with simple planning.',
  [
    lesson('cfop-beginner-cross-01', '入门十字介绍', 'Beginner Cross introduction', 3, '能说出十字完成时底色和四个侧色的检查标准', 'Check the bottom color and all four side colors of a solved Cross'),
    lesson('cfop-beginner-cross-02', '入门十字提示', 'Beginner Cross tips', 4, '能先看棱块方向、相对位置和落点，再开始转动', 'Inspect edge orientation, relative positions, and destinations before turning', 'drill'),
  ],
);

const beginnerF2l = module(
  'cfop-beginner-f2l', '入门 F2L', 'Beginner F2L',
  '先学角棱配对的两条规则，再用三组基础情形完成前两层。',
  'Learn two pairing rules, then solve the first two layers with three basic case groups.',
  [
    lesson('cfop-beginner-f2l-01', 'F2L 介绍', 'F2L introduction', 3, '能在魔方上指出一个角棱对和它的目标槽', 'Point to one corner-edge pair and its target slot'),
    lesson('cfop-beginner-f2l-02', '规则一：先把目标块分开', 'Rule 1: separate the pieces', 3, '能判断角棱是否需要先分离', 'Decide whether the corner and edge must be separated first', 'case'),
    lesson('cfop-beginner-f2l-03', '规则二：把目标块留在顶层', 'Rule 2: keep the pieces on top', 3, '调整顶层时不破坏已经完成的槽', 'Adjust the top without breaking solved slots', 'case'),
    lesson('cfop-beginner-f2l-04', '入门情形一：颜色相配', 'Beginner cases 1: matching colors', 3, '能判断同色关系并完成基础配对', 'Recognize matching colors and create the pair', 'case'),
    lesson('cfop-beginner-f2l-05', '入门情形二：三步配对', 'Beginner cases 2: three-move pairs', 3, '能看出三步配对并放入正确槽', 'Recognize a three-move pair and insert it', 'case'),
    lesson('cfop-beginner-f2l-06', '入门情形三：白色角朝向', 'Beginner cases 3: white corner orientation', 3, '能根据白色朝向选择配对方向', 'Choose the pairing direction from the white sticker orientation', 'case'),
    lesson('cfop-beginner-f2l-07', '入门 F2L 例解', 'Beginner F2L example solves', 5, '能独立完成四组 F2L，并说出每组的判断依据', 'Solve four F2L pairs and explain the clue used for each one', 'example'),
  ],
  algResource('f2l'),
);

const beginnerOll = module(
  'cfop-beginner-oll', '入门 OLL', 'Beginner OLL',
  '把顶层朝向拆成棱块和角块两步，建立少公式的完整流程。',
  'Split last-layer orientation into edges and corners to build a low-algorithm complete route.',
  [
    lesson('cfop-beginner-oll-01', '入门 OLL 介绍', 'Beginner OLL introduction', 3, '能说出朝向和位置的区别', 'Explain the difference between orientation and permutation'),
    lesson('cfop-beginner-oll-02', '翻好四条顶层棱块', 'Orienting the edges', 4, '能从点、拐角或直线做出顶层十字', 'Turn a dot, angle, or line into a top cross', 'case'),
    lesson('cfop-beginner-oll-03', 'Sune 与 Anti-Sune', 'Sune and Anti-Sune', 4, '能区分两种小鱼方向并正确完成', 'Tell Sune and Anti-Sune apart and solve both', 'case'),
    lesson('cfop-beginner-oll-04', '两个角已朝上的情形', 'Two oriented corners', 3, '能识别并完成两个角已朝上的分组', 'Recognize and solve the two-oriented-corner group', 'case'),
    lesson('cfop-beginner-oll-05', '四个角都未朝上的情形', 'No oriented corners', 3, '能识别并完成四角未朝上的分组', 'Recognize and solve the no-oriented-corner group', 'case'),
  ],
  algResource('oll'),
);

const beginnerPll = module(
  'cfop-beginner-pll', '入门 PLL', 'Beginner PLL',
  '用 J-Perm 和 U-Perm 完成两步位置调整。', 'Use J-Perm and U-Perm to complete two-step permutation.',
  [lesson('cfop-beginner-pll-01', 'J-Perm 与 U-Perm 完成两步 PLL', 'Two-step PLL with J-Perm and U-Perm', 5, '能先调整角块、再调整棱块并完成 AUF', 'Permute corners, permute edges, and finish the AUF', 'case')],
  algResource('pll'),
);

const intermediateCross = module(
  'cfop-intermediate-cross', '中级十字', 'Intermediate Cross',
  '从单块处理进阶到相对位置和完整规划。', 'Advance from one-piece solutions to relative positions and full planning.',
  [
    lesson('cfop-intermediate-cross-01', '中级十字介绍', 'Intermediate Cross introduction', 3, '能在观察阶段先规划至少两块十字棱', 'Plan at least two Cross edges during inspection'),
    lesson('cfop-intermediate-cross-02', '十字棱的相对位置', 'Relative edge positions', 4, '能不看中心先判断两条十字棱的相对关系', 'Read the relative position of two Cross edges without checking centers', 'drill'),
    lesson('cfop-intermediate-cross-03', '最后一条十字棱的常见情形', 'Last Cross edge cases', 4, '能减少最后一条棱造成的额外转动', 'Reduce extra moves caused by the last Cross edge', 'case'),
    lesson('cfop-intermediate-cross-04', '中级十字例解', 'Intermediate Cross example solves', 5, '能为三个打乱写出完整十字方案', 'Write a complete Cross solution for three scrambles', 'example'),
  ],
);

const intermediateF2l = module(
  'cfop-intermediate-f2l', '中级 F2L：41 个标准情形', 'Intermediate F2L: 41 standard cases',
  '一节一个案例，固定使用识别、拿法、慢速执行和三次自测。',
  'One case per lesson with a fixed recognition, grip, slow execution, and three-test structure.',
  [
    lesson('cfop-intermediate-f2l-intro', '中级 F2L 介绍', 'Intermediate F2L introduction', 4, '能按角块朝向、棱块方向和相对位置给情形分类', 'Classify cases by corner orientation, edge orientation, and relative position'),
    ...numberedCaseLessons({ prefix: 'cfop-intermediate-f2l', title: l('F2L 情形', 'F2L case'), count: 41 }),
  ],
  algResource('f2l'),
);

const intermediateOll = module(
  'cfop-intermediate-oll', '中级 OLL：五种形状', 'Intermediate OLL: five shapes',
  '在两步 OLL 基础上，按顶层形状逐组补充识别。', 'Add recognition groups by top shape after learning two-step OLL.',
  labeledCases('cfop-intermediate-oll', 'OLL 形状', 'OLL shape', ['L', 'T', 'U', 'Pi', 'H'], 3),
  algResource('oll'),
);

export const PLL_LABELS = ['J', 'Y', 'Ua', 'Ub', 'Z', 'H', 'Aa', 'Ab', 'T', 'L', 'Ra', 'Rb', 'F', 'Ga', 'Gb', 'Gc', 'Gd', 'E', 'Na', 'Nb', 'V'];

const intermediatePll = module(
  'cfop-intermediate-pll', '中级 PLL：21 个标准情形', 'Intermediate PLL: 21 standard cases',
  '把循环关系、名称、识别特征和执行动作连接起来。', 'Connect piece cycles, names, recognition features, and execution.',
  [
    lesson('cfop-intermediate-pll-intro', '完整 PLL 学习方法', 'Learning full PLL', 4, '能按角换位、棱换位和混合换位给 PLL 分类', 'Classify PLL by corner, edge, or mixed permutation'),
    ...labeledCases('cfop-intermediate-pll', 'PLL', 'PLL', PLL_LABELS),
  ],
  algResource('pll'),
);

const advancedCross = module(
  'cfop-advanced-cross', '进阶十字与预判', 'Advanced Cross and prediction',
  '把观察时间用于完整十字，并开始预测第一组 F2L。', 'Use inspection for the whole Cross and begin predicting the first F2L pair.',
  [
    lesson('cfop-advanced-cross-01', '进阶十字介绍', 'Advanced Cross introduction', 3, '能比较两条十字路线并选择停顿更少的一条', 'Compare two Cross routes and select the route with less hesitation'),
    lesson('cfop-advanced-cross-02', '进阶十字例解', 'Advanced Cross example solves', 5, '能复盘三个十字方案的取舍', 'Review the trade-offs in three Cross solutions', 'example'),
    lesson('cfop-advanced-cross-03', '观察阶段预测第一组 F2L', 'Predict first pair during inspection', 4, '完成十字后能立刻指出第一组角棱', 'Point to the first F2L pair immediately after the Cross', 'drill'),
    lesson('cfop-advanced-cross-04', '十字到 F2L 的预判', 'Cross-to-F2L prediction', 4, '连续五次做到十字结束后不停顿寻找第一组', 'Begin the first pair without a pause five times in a row', 'drill'),
  ],
);

const practiceAdvice = module(
  'cfop-practice', '练习方法', 'Practising',
  '把“多练”变成可执行的训练安排。', 'Turn “practise more” into an executable training plan.',
  [
    lesson('cfop-practice-01', '怎样安排日常练习', 'How to structure daily practice', 4, '能写出包含慢拧、专项和完整计时的练习单', 'Write a practice plan containing slow solves, focused drills, and full timed solves'),
    lesson('cfop-practice-02', '怎样学习新公式', 'How to learn new algorithms', 4, '能按理解、分段、连贯、间隔复习四步学习一个公式', 'Learn one algorithm through understanding, chunks, flow, and spaced review', 'drill'),
  ],
);

const advancedF2lExtras = [
  lesson('cfop-advanced-f2l-adjacent', '相邻槽情形', 'Adjacent slots', 3, '能在相邻槽中配对并保留已完成块', 'Pair through adjacent slots while preserving solved pieces', 'case'),
  lesson('cfop-advanced-f2l-opposite', '相对槽情形', 'Opposite slots', 3, '能在相对槽中配对并减少转体', 'Pair through opposite slots with fewer rotations', 'case'),
  lesson('cfop-advanced-f2l-wrong-slots', '目标块都在错误槽里', 'Both pieces in wrong slots', 4, '能规划取出顺序并避免重复破坏', 'Plan the extraction order without repeated damage', 'case'),
  lesson('cfop-pseudo-01', '伪槽入门', 'Pseudo-slotting introduction', 3, '能说出伪槽与标准槽入的区别', 'Explain the difference between pseudo-slotting and standard insertion'),
  lesson('cfop-pseudo-02', '开始使用伪槽', 'Getting started with pseudo-slotting', 4, '能在一个受控情形中完成伪槽配对', 'Complete a pseudo pair in one controlled case', 'case'),
  lesson('cfop-pseudo-03', '伪槽练习一', 'Pseudo-slotting drill 1', 3, '连续五次完成第一组伪槽训练', 'Complete the first pseudo-slotting drill five times in a row', 'drill'),
  lesson('cfop-pseudo-04', '伪槽练习二', 'Pseudo-slotting drill 2', 3, '连续五次完成第二组伪槽训练', 'Complete the second pseudo-slotting drill five times in a row', 'drill'),
  lesson('cfop-pseudo-05', '伪槽例解', 'Pseudo-slotting example solves', 5, '能在例解中指出伪槽带来的实际收益', 'Identify the practical benefit of pseudo-slotting in an example solve', 'example'),
];

const advancedF2l = module(
  'cfop-advanced-f2l', '进阶 F2L', 'Advanced F2L',
  '从标准案例扩展到空槽、多槽关系和伪槽，重点减少转体与停顿。',
  'Extend standard cases into free-slot variations, slot relationships, and pseudo-slotting to reduce rotations and pauses.',
  [
    lesson('cfop-advanced-f2l-intro', '进阶 F2L 介绍', 'Advanced F2L introduction', 4, '能说出进阶 F2L 的三个目标：少转体、少拆对、不断流', 'Name three goals: fewer rotations, less pair breaking, and continuous flow'),
    lesson('cfop-advanced-f2l-eo', 'F2L 中的棱块方向', 'Edge orientation in F2L', 4, '能判断棱块方向并预测可用的无转体解法', 'Read edge orientation and predict rotationless options'),
    ...numberedCaseLessons({ prefix: 'cfop-advanced-f2l', title: l('进阶 F2L 情形', 'Advanced F2L case'), count: 18 }),
    lesson('cfop-advanced-f2l-free-slot', '情形 17 和 18 的空槽变化', 'Case 17 and 18 free-slot variation', 3, '能利用空槽减少一次拆对或换手', 'Use a free slot to avoid a pair break or regrip', 'case'),
    ...numberedCaseLessons({ prefix: 'cfop-advanced-f2l-late', title: l('进阶 F2L 情形', 'Advanced F2L case'), count: 7, outcome: (n) => l(`能从标准角度识别并独立完成进阶 F2L 情形 ${n + 18}`, `Recognize and solve Advanced F2L case ${n + 18} independently from the standard angle`) }).map((item, index) => ({ ...item, id: `cfop-advanced-f2l-${index + 19}`, title: l(`进阶 F2L 情形 ${index + 19}`, `Advanced F2L case ${index + 19}`) })),
    ...advancedF2lExtras,
  ],
  algResource('f2l'),
);

export const OLL_ORDER = [27, 26, 23, 24, 21, 22, 25, 45, 33, 7, 8, 6, 5, 46, 34, 57, 28, 41, 42, 37, 35, 38, 36, 44, 43, 31, 32, 51, 52, 55, 56, 9, 10, 13, 14, 16, 15, 48, 47, 49, 50, 54, 53, 11, 12, 39, 40, 30, 29, 1, 2, 17, 18, 19, 3, 4, 20];

const advancedOll = module(
  'cfop-advanced-oll', '完整 OLL：57 个情形', 'Full OLL: 57 cases',
  '按参考课程的顺序逐个录制；编号沿用标准 OLL 编号。', 'Record every case in the reference-course order using standard OLL numbers.',
  [lesson('cfop-advanced-oll-intro', '完整 OLL 介绍', 'Full OLL introduction', 4, '能使用形状、侧色和朝向三个线索识别 OLL', 'Use shape, side colors, and orientation to recognize OLL'), ...labeledCases('cfop-advanced-oll', 'OLL', 'OLL', OLL_ORDER)],
  algResource('oll'),
);

const advancedPll = module(
  'cfop-advanced-pll', '进阶 PLL', 'Advanced PLL',
  '完整覆盖 21 个情形，并补充多角度识别、执行优化和 AUF 预判。',
  'Cover all 21 cases, multi-angle recognition, execution refinement, and AUF prediction.',
  [
    lesson('cfop-advanced-pll-intro', '进阶 PLL 介绍', 'Advanced PLL introduction', 4, '能从两侧或三侧信息判断 PLL，不必先转到固定正面', 'Recognize PLL from two or three sides without rotating to one fixed front'),
    ...labeledCases('cfop-advanced-pll', '进阶 PLL', 'Advanced PLL', PLL_LABELS),
    lesson('cfop-advanced-pll-auf', 'AUF 识别与预判', 'AUF recognition and prediction', 4, '能在公式结束前判断 U、U\'、U2 或无需 AUF', 'Predict U, U\', U2, or no AUF before the algorithm finishes', 'drill'),
  ],
  algResource('pll'),
);

const COLL_CASES = {
  U: ['2GLL', '两侧同色', '左侧同色', '两侧相对色', '右侧同色', '对角色'],
  T: ['2GLL', '上相对下同色', '右侧同色', '上同色下相对', '左侧同色', '对角色'],
  L: ['2GLL', '上同色靠右', '上同色靠前', '上相对靠右', '上相对靠前', '对角色'],
  H: ['2GLL', '侧面同色', '正面同色', '对角色'],
  Pi: ['2GLL', '左侧同色', '两侧相对色', '右侧同色', '两侧同色', '对角色'],
} as const;

const COLL_CASES_EN = {
  U: ['2GLL', 'Both matching', 'Left matching', 'Both opposite', 'Right matching', 'Diagonal'],
  T: ['2GLL', 'Top opposite, bottom matching', 'Right matching', 'Top matching, bottom opposite', 'Left matching', 'Diagonal'],
  L: ['2GLL', 'Top matching right', 'Top matching front', 'Top opposite right', 'Top opposite front', 'Diagonal'],
  H: ['2GLL', 'Side matching', 'Front matching', 'Diagonal'],
  Pi: ['2GLL', 'Left matching', 'Both opposite', 'Right matching', 'Both matching', 'Diagonal'],
} as const;

function collShapeLessons(shape: keyof typeof COLL_CASES): MicroLesson[] {
  return COLL_CASES[shape].map((zhName, index) => lesson(
    `cfop-coll-${shape.toLowerCase()}-${index + 1}`,
    `COLL ${shape} ${index + 1}：${zhName}`,
    `COLL ${shape} ${index + 1}: ${COLL_CASES_EN[shape][index]}`,
    3,
    `能识别并独立完成 COLL ${shape} 第 ${index + 1} 类`,
    `Recognize and solve COLL ${shape} group ${index + 1} independently`,
    'case',
  ));
}

const coll = module(
  'cfop-coll', 'COLL：28 个情形', 'COLL: 28 cases',
  '按 U、T、L、H、Pi 五种角块形状完整展开。', 'Expand all cases under the U, T, L, H, and Pi corner shapes.',
  [
    lesson('cfop-coll-intro', 'COLL 介绍', 'COLL introduction', 4, '能判断何时适合使用 COLL，以及它解决了什么', 'Explain when COLL applies and what it solves'),
    ...(['U', 'T', 'L', 'H', 'Pi'] as const).flatMap(collShapeLessons),
  ],
  algResource('coll'),
);

export const ZBLL_CASE_COUNTS = { U: [12, 12, 12, 12, 12, 12], T: [12, 12, 12, 12, 12, 12], L: [12, 12, 12, 12, 12, 12], H: [12, 12, 8, 8], Pi: [12, 12, 12, 12, 12, 12] } as const;

function zbllShapeLessons(shape: keyof typeof ZBLL_CASE_COUNTS): MicroLesson[] {
  return ZBLL_CASE_COUNTS[shape].flatMap((count, collIndex) => Array.from({ length: count }, (_, caseIndex) => lesson(
    `cfop-zbll-${shape.toLowerCase()}-${collIndex + 1}-${caseIndex + 1}`,
    `ZBLL ${shape}：COLL ${collIndex + 1}，情形 ${caseIndex + 1}`,
    `ZBLL ${shape}: COLL ${collIndex + 1}, case ${caseIndex + 1}`,
    3,
    `能从标准角度识别并独立完成 ZBLL ${shape} 的 COLL ${collIndex + 1} 第 ${caseIndex + 1} 个情形`,
    `Recognize and solve ZBLL ${shape}, COLL ${collIndex + 1}, case ${caseIndex + 1} independently`,
    'case',
  )));
}

const zbll = module(
  'cfop-zbll', 'ZBLL：328 个情形', 'ZBLL: 328 cases',
  '按顶层角块形状和对应 COLL 子组完整展开，便于逐组录制与复习。',
  'Expand every case by corner shape and COLL subgroup for recording and spaced review.',
  [
    lesson('cfop-zbll-intro', 'ZBLL 介绍', 'ZBLL introduction', 4, '能说明 ZBLL 的前提、收益和学习成本', 'Explain the prerequisite, benefit, and learning cost of ZBLL'),
    ...(['U', 'T', 'L', 'H', 'Pi'] as const).flatMap(zbllShapeLessons),
    lesson('cfop-zbll-setups', 'ZBLL 起始状态与训练设置', 'ZBLL setups', 4, '能生成指定 ZBLL 分组的练习起始状态', 'Generate practice setups for a chosen ZBLL subgroup', 'drill'),
  ],
  algResource('zbll'),
);

const finish = module(
  'cfop-finish', '结课', 'Course finish',
  '总结整条路线，并根据数据选择下一阶段训练重点。', 'Review the full route and use solve data to choose the next training focus.',
  [lesson('cfop-finish-01', '感谢观看与下一阶段', 'Thanks for watching and next steps', 3, '能根据自己的数据选择接下来一个月的训练重点', 'Choose one training focus for the next month from personal solve data', 'milestone')],
);

const resourceLabels = [
  l('中级 F2L 公式表', 'Intermediate F2L algorithm sheet'), l('中级 PLL 公式表', 'Intermediate PLL algorithm sheet'),
  l('进阶 F2L 公式表', 'Advanced F2L algorithm sheet'), l('进阶 PLL 公式表', 'Advanced PLL algorithm sheet'),
  l('OLL 公式表', 'OLL algorithm sheet'), l('COLL 公式表', 'COLL algorithm sheet'),
  l('ZBLL U 组公式表', 'ZBLL U algorithm sheet'), l('ZBLL T 组公式表', 'ZBLL T algorithm sheet'),
  l('ZBLL L 组公式表', 'ZBLL L algorithm sheet'), l('ZBLL H 组公式表', 'ZBLL H algorithm sheet'),
  l('ZBLL Pi 组公式表', 'ZBLL Pi algorithm sheet'),
];

const algorithmSheets = module(
  'cfop-algorithm-sheets', '公式资料表', 'Algorithm sheets',
  '11 张资料表对应参考课程的资料区，用于录前核对、课后复习和打印打卡。',
  'Eleven sheets mirror the reference resource section for recording checks, review, and printable tracking.',
  resourceLabels.map((title, index) => microLesson({
    id: `cfop-sheet-${String(index + 1).padStart(2, '0')}`,
    title,
    minutes: 1,
    outcome: l('能找到当前在学的案例，并完成一次遮挡答案自测', 'Find the current case and complete one closed-answer self-test'),
    kind: 'resource',
  })),
  { label: l('打开站内三阶公式库', 'Open the 3x3 algorithm library'), href: '/alg/3x3' },
);

const exampleSolves = module(
  'cfop-example-solves', '完整例解', 'Full example solves',
  '三个复原分别训练稳定决策、减少转体和连续预判。',
  'Three reconstructions focus on stable decisions, fewer rotations, and continuous prediction.',
  [
    lesson('cfop-example-01', '复原一：稳定决策', 'Reconstruction 1: stable decisions', 5, '能指出每个阶段开始和结束的位置', 'Point to the beginning and end of every stage', 'example'),
    lesson('cfop-example-02', '复原二：减少转体', 'Reconstruction 2: fewer rotations', 5, '能找出例解中避免转体的两个选择', 'Identify two choices that avoided rotations', 'example'),
    lesson('cfop-example-03', '复原三：连续预判', 'Reconstruction 3: continuous prediction', 5, '能复述十字到前三组 F2L 的观察顺序', 'Retell the observation order from Cross through the first three pairs', 'example'),
  ],
);

export const CFOP_MICRO_COURSE: MicroCourse = {
  id: 'cfop',
  label: l('CFOP', 'CFOP'),
  title: l('588 节微课，从入门流程到完整进阶案例', '588 micro-lessons from beginner flow to complete advanced cases'),
  summary: l('完整覆盖十字、F2L、OLL、PLL、COLL、ZBLL、练习方法、11 张资料表与 3 个复原例解；每个标准案例独立成课。', 'Complete coverage of Cross, F2L, OLL, PLL, COLL, ZBLL, practice advice, 11 sheets, and 3 reconstructions, with every standard case as its own lesson.'),
  audience: l('已经能独立复原，准备系统学习 CFOP 并逐步提速的学员', 'Learners who can solve independently and are ready to learn CFOP systematically'),
  stages: [
    { id: 'cfop-stage-fundamentals', title: l('介绍与基本功', 'Introduction and fundamentals'), summary: l('建立统一动作语言。', 'Build a shared movement language.'), modules: [fundamentals] },
    { id: 'cfop-stage-beginner', title: l('入门 CFOP', 'Beginner CFOP'), summary: l('用少量分组案例建立完整 CFOP 流程。', 'Build a complete CFOP route from a few grouped cases.'), modules: [beginnerCross, beginnerF2l, beginnerOll, beginnerPll] },
    { id: 'cfop-stage-intermediate', title: l('中级 CFOP', 'Intermediate CFOP'), summary: l('扩充十字规划、41 个 F2L 情形和完整 PLL。', 'Add Cross planning, 41 F2L cases, and full PLL.'), modules: [intermediateCross, intermediateF2l, intermediateOll, intermediatePll] },
    { id: 'cfop-stage-advanced', title: l('进阶 CFOP', 'Advanced CFOP'), summary: l('完整展开进阶 F2L、OLL、PLL、COLL 与 ZBLL。', 'Expand Advanced F2L, OLL, PLL, COLL, and ZBLL completely.'), modules: [advancedCross, practiceAdvice, advancedF2l, advancedOll, advancedPll, coll, zbll, finish] },
    { id: 'cfop-stage-resources', title: l('资料与例解', 'Resources and example solves'), summary: l('资料表和完整复原示范。', 'Algorithm sheets and full solve demonstrations.'), modules: [algorithmSheets, exampleSolves] },
  ],
};
