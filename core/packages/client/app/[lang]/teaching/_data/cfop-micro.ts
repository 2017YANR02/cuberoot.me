import { microLesson, numberedCaseLessons } from './builders';
import type { MicroCourse, MicroLesson, Module } from './types';

function labeledCases(prefix: string, topic: string, labels: Array<string | number>, minutes = 2): MicroLesson[] {
  return labels.map((label) => microLesson({
    id: `${prefix}-${String(label).toLowerCase()}`,
    title: `${topic} ${label}`,
    minutes,
    kind: 'case',
    outcome: `能从标准角度识别并独立完成${topic} ${label}`,
  }));
}

const fundamentals: Module = {
  id: 'cfop-fundamentals',
  title: '介绍与基本功',
  summary: '先统一路线、拿法和指法，后面每个案例都沿用同一套讲解语言。',
  lessons: [
    microLesson({ id: 'cfop-fundamentals-01', title: 'CFOP 课程地图', minutes: 4, outcome: '能说出十字、F2L、OLL、PLL 四个阶段' }),
    microLesson({ id: 'cfop-fundamentals-02', title: '稳定拿法与换手', minutes: 3, outcome: '能保持正面和底面方向，减少不必要的换手', kind: 'drill' }),
    microLesson({ id: 'cfop-fundamentals-03', title: '常用指法', minutes: 4, outcome: '能连贯完成常用 U、U\'、U2、R 和 F 层指法', kind: 'drill' }),
  ],
};

const beginnerCross: Module = {
  id: 'cfop-beginner-cross',
  title: '入门十字',
  summary: '理解十字目标，并用少量观察代替逐块寻找。',
  lessons: [
    microLesson({ id: 'cfop-beginner-cross-01', title: '入门十字介绍', minutes: 3, outcome: '能说出十字完成时底色和四个侧色的检查标准' }),
    microLesson({ id: 'cfop-beginner-cross-02', title: '入门十字的三个提示', minutes: 4, outcome: '能先看棱块方向、相对位置和落点，再开始转动', kind: 'drill' }),
  ],
};

const beginnerF2l: Module = {
  id: 'cfop-beginner-f2l',
  title: '入门 F2L',
  summary: '先学角棱配对的基本规则，再用少量分组情形完成前两层。',
  lessons: [
    microLesson({ id: 'cfop-beginner-f2l-01', title: 'F2L 是什么', minutes: 3, outcome: '能在魔方上指出一个角棱对和它的目标槽' }),
    microLesson({ id: 'cfop-beginner-f2l-02', title: '规则一：先把错误配对拆开', minutes: 3, outcome: '能判断角棱是否需要先分离', kind: 'case' }),
    microLesson({ id: 'cfop-beginner-f2l-03', title: '规则二：把目标块留在顶层', minutes: 3, outcome: '调整顶层时不破坏已经完成的槽', kind: 'case' }),
    microLesson({ id: 'cfop-beginner-f2l-04', title: '同色朝上的基础情形', minutes: 3, outcome: '能判断同色关系并完成基础配对', kind: 'case' }),
    microLesson({ id: 'cfop-beginner-f2l-05', title: '三步完成的基础配对', minutes: 3, outcome: '能看出三步配对并放入正确槽', kind: 'case' }),
    microLesson({ id: 'cfop-beginner-f2l-06', title: '白色角在顶层的基础情形', minutes: 3, outcome: '能根据白色朝向选择配对方向', kind: 'case' }),
    microLesson({ id: 'cfop-beginner-f2l-07', title: '入门 F2L 例解', minutes: 5, outcome: '能独立完成四组 F2L，并说出每组的判断依据', kind: 'example' }),
  ],
  resource: { label: '打开站内 F2L 公式库', href: '/alg/3x3/f2l' },
};

const beginnerOll: Module = {
  id: 'cfop-beginner-oll',
  title: '入门 OLL',
  summary: '把顶层朝向拆成棱块和角块两步，先建立少公式的完整流程。',
  lessons: [
    microLesson({ id: 'cfop-beginner-oll-01', title: '入门 OLL 介绍', minutes: 3, outcome: '能说出朝向和位置的区别' }),
    microLesson({ id: 'cfop-beginner-oll-02', title: '先翻好四条顶层棱块', minutes: 4, outcome: '能从点、拐角或直线做出顶层十字', kind: 'case' }),
    microLesson({ id: 'cfop-beginner-oll-03', title: 'Sune 与 Anti-Sune', minutes: 4, outcome: '能区分两种小鱼方向并正确完成', kind: 'case' }),
    microLesson({ id: 'cfop-beginner-oll-04', title: '两个角已朝上的情形', minutes: 3, outcome: '能识别并完成两个角已朝上的分组', kind: 'case' }),
    microLesson({ id: 'cfop-beginner-oll-05', title: '四个角都未朝上的情形', minutes: 3, outcome: '能识别并完成四角未朝上的分组', kind: 'case' }),
  ],
  resource: { label: '打开站内 OLL 公式库', href: '/alg/3x3/oll' },
};

const beginnerPll: Module = {
  id: 'cfop-beginner-pll',
  title: '入门 PLL',
  summary: '用 J-Perm 和 U-Perm 完成两步位置调整。',
  lessons: [
    microLesson({ id: 'cfop-beginner-pll-01', title: 'J-Perm 与 U-Perm 完成两步 PLL', minutes: 5, outcome: '能先调整角块、再调整棱块并完成 AUF', kind: 'case' }),
  ],
  resource: { label: '打开站内 PLL 公式库', href: '/alg/3x3/pll' },
};

const intermediateCross: Module = {
  id: 'cfop-intermediate-cross',
  title: '中级十字',
  summary: '从单块处理进阶到相对位置和整段规划。',
  lessons: [
    microLesson({ id: 'cfop-intermediate-cross-01', title: '中级十字介绍', minutes: 3, outcome: '能在观察阶段先规划至少两块十字棱' }),
    microLesson({ id: 'cfop-intermediate-cross-02', title: '十字棱的相对位置', minutes: 4, outcome: '能不看中心先判断两条十字棱的相对关系', kind: 'drill' }),
    microLesson({ id: 'cfop-intermediate-cross-03', title: '最后一条十字棱的常见情形', minutes: 4, outcome: '能减少最后一条棱造成的额外转动', kind: 'case' }),
    microLesson({ id: 'cfop-intermediate-cross-04', title: '中级十字例解', minutes: 5, outcome: '能为三个打乱写出完整十字方案', kind: 'example' }),
  ],
};

const intermediateF2l: Module = {
  id: 'cfop-intermediate-f2l',
  title: '中级 F2L：41 个标准情形',
  summary: '一节一个案例；每节都按识别、拿法、慢速执行和三次自测的固定结构录制。',
  lessons: [
    microLesson({ id: 'cfop-intermediate-f2l-intro', title: '中级 F2L 介绍', minutes: 4, outcome: '能按角块朝向、棱块方向和相对位置给情形分类' }),
    ...numberedCaseLessons({ prefix: 'cfop-intermediate-f2l', title: 'F2L 情形', count: 41 }),
  ],
  resource: { label: '打开站内 F2L 公式库', href: '/alg/3x3/f2l' },
};

const intermediateOll: Module = {
  id: 'cfop-intermediate-oll',
  title: '中级 OLL：五种形状',
  summary: '在两步 OLL 基础上，按顶层形状逐组补充识别。',
  lessons: labeledCases('cfop-intermediate-oll', 'OLL 形状', ['L', 'T', 'U', 'Pi', 'H'], 3),
  resource: { label: '打开站内 OLL 公式库', href: '/alg/3x3/oll' },
};

const PLL_LABELS = ['J', 'Y', 'Ua', 'Ub', 'Z', 'H', 'Aa', 'Ab', 'T', 'L', 'Ra', 'Rb', 'F', 'Ga', 'Gb', 'Gc', 'Gd', 'E', 'Na', 'Nb', 'V'];

const intermediatePll: Module = {
  id: 'cfop-intermediate-pll',
  title: '中级 PLL：21 个标准情形',
  summary: '先看块的循环关系，再把名称、识别特征和执行动作连接起来。',
  lessons: [
    microLesson({ id: 'cfop-intermediate-pll-intro', title: '完整 PLL 学习方法', minutes: 4, outcome: '能按角换位、棱换位和混合换位给 PLL 分类' }),
    ...labeledCases('cfop-intermediate-pll', 'PLL', PLL_LABELS),
  ],
  resource: { label: '打开站内 PLL 公式库', href: '/alg/3x3/pll' },
};

const advancedCross: Module = {
  id: 'cfop-advanced-cross',
  title: '进阶十字与预判',
  summary: '把观察时间用于完整十字，并开始预测第一组 F2L。',
  lessons: [
    microLesson({ id: 'cfop-advanced-cross-01', title: '进阶十字介绍', minutes: 3, outcome: '能比较两条十字路线并选择更少停顿的一条' }),
    microLesson({ id: 'cfop-advanced-cross-02', title: '进阶十字例解', minutes: 5, outcome: '能复盘三个十字方案的取舍', kind: 'example' }),
    microLesson({ id: 'cfop-advanced-cross-03', title: '观察阶段预测第一组 F2L', minutes: 4, outcome: '完成十字后能立刻指出第一组角棱', kind: 'drill' }),
    microLesson({ id: 'cfop-advanced-cross-04', title: '十字到 F2L 的预判', minutes: 4, outcome: '连续五次做到十字结束后不停顿寻找第一组', kind: 'drill' }),
  ],
};

const practiceAdvice: Module = {
  id: 'cfop-practice',
  title: '练习方法',
  summary: '把“多练”变成可执行的训练安排。',
  lessons: [
    microLesson({ id: 'cfop-practice-01', title: '怎样安排日常练习', minutes: 4, outcome: '能写出包含慢拧、专项和完整计时的练习单' }),
    microLesson({ id: 'cfop-practice-02', title: '怎样学习新公式', minutes: 4, outcome: '能按理解、分段、连贯、间隔复习四步学习一个公式', kind: 'drill' }),
  ],
};

const advancedF2lExtras = [
  microLesson({ id: 'cfop-advanced-f2l-free-slot', title: '空槽变化', minutes: 3, outcome: '能利用空槽减少一次拆对或换手', kind: 'case' }),
  microLesson({ id: 'cfop-advanced-f2l-adjacent', title: '相邻槽情形', minutes: 3, outcome: '能在相邻槽中配对并保留已完成块', kind: 'case' }),
  microLesson({ id: 'cfop-advanced-f2l-opposite', title: '相对槽情形', minutes: 3, outcome: '能在相对槽中配对并减少转体', kind: 'case' }),
  microLesson({ id: 'cfop-advanced-f2l-wrong-slots', title: '目标块都在错误槽里', minutes: 4, outcome: '能规划取出顺序并避免重复破坏', kind: 'case' }),
  microLesson({ id: 'cfop-pseudo-01', title: '伪槽入门', minutes: 3, outcome: '能说出伪槽与标准槽入的区别' }),
  microLesson({ id: 'cfop-pseudo-02', title: '开始使用伪槽', minutes: 4, outcome: '能在一个受控情形中完成伪槽配对', kind: 'case' }),
  microLesson({ id: 'cfop-pseudo-03', title: '伪槽练习一', minutes: 3, outcome: '连续五次完成第一组伪槽训练', kind: 'drill' }),
  microLesson({ id: 'cfop-pseudo-04', title: '伪槽练习二', minutes: 3, outcome: '连续五次完成第二组伪槽训练', kind: 'drill' }),
  microLesson({ id: 'cfop-pseudo-05', title: '伪槽例解', minutes: 5, outcome: '能在例解中指出伪槽带来的实际收益', kind: 'example' }),
];

const advancedF2l: Module = {
  id: 'cfop-advanced-f2l',
  title: '进阶 F2L',
  summary: '从标准案例扩展到空槽、多槽关系和伪槽，重点减少转体与停顿。',
  lessons: [
    microLesson({ id: 'cfop-advanced-f2l-intro', title: '进阶 F2L 介绍', minutes: 4, outcome: '能说出进阶 F2L 的三个目标：少转体、少拆对、不断流' }),
    microLesson({ id: 'cfop-advanced-f2l-eo', title: 'F2L 中的棱块方向', minutes: 4, outcome: '能判断棱块方向并预测可用的无转体解法' }),
    ...numberedCaseLessons({ prefix: 'cfop-advanced-f2l', title: '进阶 F2L 情形', count: 25 }),
    ...advancedF2lExtras,
  ],
  resource: { label: '打开站内 F2L 公式库', href: '/alg/3x3/f2l' },
};

const OLL_ORDER = [27, 26, 23, 24, 21, 22, 25, 45, 33, 7, 8, 6, 5, 46, 34, 57, 28, 41, 42, 37, 35, 38, 36, 44, 43, 31, 32, 51, 52, 55, 56, 9, 10, 13, 14, 16, 15, 48, 47, 49, 50, 54, 53, 11, 12, 39, 40, 30, 29, 1, 2, 17, 18, 19, 3, 4, 20];

const advancedOll: Module = {
  id: 'cfop-advanced-oll',
  title: '完整 OLL：57 个情形',
  summary: '按形状和相似案例组织学习顺序；编号沿用标准 OLL 编号，方便与公式库对应。',
  lessons: [
    microLesson({ id: 'cfop-advanced-oll-intro', title: '完整 OLL 介绍', minutes: 4, outcome: '能使用形状、侧色和朝向三个线索识别 OLL' }),
    ...labeledCases('cfop-advanced-oll', 'OLL', OLL_ORDER),
  ],
  resource: { label: '打开站内 OLL 公式库', href: '/alg/3x3/oll' },
};

const advancedPll: Module = {
  id: 'cfop-advanced-pll',
  title: '进阶 PLL',
  summary: '在完整 21 个情形上补充多角度识别、执行优化和 AUF 预判。',
  lessons: [
    microLesson({ id: 'cfop-advanced-pll-intro', title: '进阶 PLL 介绍', minutes: 4, outcome: '能从两侧或三侧信息判断 PLL，不必先转到固定正面' }),
    ...labeledCases('cfop-advanced-pll', '进阶 PLL', PLL_LABELS),
    microLesson({ id: 'cfop-advanced-pll-auf', title: 'AUF 识别与预判', minutes: 4, outcome: '能在公式结束前判断 U、U\'、U2 或无需 AUF', kind: 'drill' }),
  ],
  resource: { label: '打开站内 PLL 公式库', href: '/alg/3x3/pll' },
};

const COLL_GROUPS = ['U', 'T', 'L', 'H', 'Pi'];

const coll: Module = {
  id: 'cfop-coll',
  title: 'COLL',
  summary: '在顶层棱方向已完成时，同时处理角块朝向和位置。',
  lessons: [
    microLesson({ id: 'cfop-coll-intro', title: 'COLL 介绍', minutes: 4, outcome: '能判断何时适合使用 COLL，以及它解决了什么' }),
    ...labeledCases('cfop-coll', 'COLL', COLL_GROUPS, 4),
  ],
  resource: { label: '打开站内 COLL 公式库', href: '/alg/3x3/coll' },
};

const zbll: Module = {
  id: 'cfop-zbll',
  title: 'ZBLL',
  summary: '按顶层角块形状分组建立路线，不把大量公式一次推给学习者。',
  lessons: [
    microLesson({ id: 'cfop-zbll-intro', title: 'ZBLL 介绍', minutes: 4, outcome: '能说明 ZBLL 的前提、收益和学习成本' }),
    ...labeledCases('cfop-zbll', 'ZBLL', COLL_GROUPS, 5),
    microLesson({ id: 'cfop-zbll-setups', title: '把 OLL 情形转换为 ZBLL 训练', minutes: 4, outcome: '能生成指定 ZBLL 分组的练习起始状态', kind: 'drill' }),
  ],
  resource: { label: '打开站内 ZBLL 公式库', href: '/alg/3x3/zbll' },
};

const resourceLabels = [
  '中级 F2L 公式表', '中级 PLL 公式表', '进阶 F2L 公式表', '进阶 PLL 公式表', 'OLL 公式表', 'COLL 公式表',
  'ZBLL U 组公式表', 'ZBLL T 组公式表', 'ZBLL L 组公式表', 'ZBLL H 组公式表', 'ZBLL Pi 组公式表',
];

const algorithmSheets: Module = {
  id: 'cfop-algorithm-sheets',
  title: '公式资料表',
  summary: '每张资料表对应一个课程模块，用于录制前核对、课后复习和打印打卡。',
  lessons: resourceLabels.map((title, index) => microLesson({
    id: `cfop-sheet-${String(index + 1).padStart(2, '0')}`,
    title,
    minutes: 1,
    outcome: '能找到当前在学的案例，并完成一次遮挡答案自测',
    kind: 'resource',
  })),
  resource: { label: '打开站内三阶公式库', href: '/alg/3x3' },
};

const exampleSolves: Module = {
  id: 'cfop-example-solves',
  title: '完整例解',
  summary: '用三个不同侧重点的完整复原，把独立微课重新连接成真实流程。',
  lessons: [
    microLesson({ id: 'cfop-example-01', title: '例解一：稳定决策', minutes: 5, outcome: '能指出每个阶段开始和结束的位置', kind: 'example' }),
    microLesson({ id: 'cfop-example-02', title: '例解二：减少转体', minutes: 5, outcome: '能找出例解中避免转体的两个选择', kind: 'example' }),
    microLesson({ id: 'cfop-example-03', title: '例解三：连续预判', minutes: 5, outcome: '能复述十字到前三组 F2L 的观察顺序', kind: 'example' }),
    microLesson({ id: 'cfop-finish', title: '结课与下一阶段', minutes: 3, outcome: '能根据自己的数据选择接下来一个月的训练重点', kind: 'milestone' }),
  ],
};

export const CFOP_MICRO_COURSE: MicroCourse = {
  id: 'cfop',
  label: 'CFOP',
  title: '242 节微课，从入门流程到进阶案例',
  summary: '课程树覆盖十字、F2L、OLL、PLL、COLL、ZBLL、练习方法、资料表与完整例解。每个标准案例独立成课，便于录制、复习和后续替换。',
  audience: '已经能独立复原，准备系统学习 CFOP 并逐步提速的孩子',
  stages: [
    { id: 'cfop-stage-fundamentals', title: '介绍与基本功', summary: '建立统一动作语言。', modules: [fundamentals] },
    { id: 'cfop-stage-beginner', title: '入门 CFOP', summary: '用少量分组案例建立完整 CFOP 流程。', modules: [beginnerCross, beginnerF2l, beginnerOll, beginnerPll] },
    { id: 'cfop-stage-intermediate', title: '中级 CFOP', summary: '扩充十字规划、41 个 F2L 情形和完整 PLL。', modules: [intermediateCross, intermediateF2l, intermediateOll, intermediatePll] },
    { id: 'cfop-stage-advanced', title: '进阶 CFOP', summary: '强化预判、进阶 F2L、完整 OLL，并延伸到 COLL 与 ZBLL。', modules: [advancedCross, practiceAdvice, advancedF2l, advancedOll, advancedPll, coll, zbll] },
    { id: 'cfop-stage-resources', title: '资料与例解', summary: '把课程内容整理为可打印资料和完整复原示范。', modules: [algorithmSheets, exampleSolves] },
  ],
};
