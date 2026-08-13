import { l, microLesson } from './builders';
import type { LessonKind, MicroCourse, Module } from './types';

function lesson(id: string, zhTitle: string, enTitle: string, minutes: number, zhOutcome: string, enOutcome: string, kind: LessonKind = 'concept') {
  return microLesson({ id, title: l(zhTitle, enTitle), minutes, outcome: l(zhOutcome, enOutcome), kind });
}

const basics: Module = {
  id: 'beginner-basics',
  title: l('准备与动作语言', 'Preparation and move language'),
  summary: l('先统一拿法、记号和最常用的小手法，后面讲解不再反复停下来补基础。', 'Establish grip, notation, and the most useful short trigger before beginning the solve.'),
  lessons: [
    lesson('beginner-01', '中心、棱和角', 'Centers, edges, and corners', 3, '看到一块就能说出它是中心、棱还是角', 'Name any visible piece as a center, edge, or corner'),
    lesson('beginner-02', '上、下、左、右、前、后', 'Up, down, left, right, front, and back', 3, '保持拿法不变，准确指出六个面', 'Keep one grip and point to all six faces correctly'),
    lesson('beginner-03', '读懂 R、U 和撇号', 'Read R, U, and prime marks', 4, '能独立读出并完成 R、R\'、U、U\'', 'Read and perform R, R\', U, and U\' independently'),
    microLesson({
      id: 'beginner-04',
      title: l('右手基础动作', 'Right-hand trigger'),
      minutes: 4,
      outcome: l('连续五次正确完成 R U R\' U\'', 'Perform R U R\' U\' correctly five times in a row'),
      kind: 'drill',
      formulas: [{ name: l('右手基础动作', 'Right-hand trigger'), alg: "R U R' U'", note: l('先保证方向正确，再追求连贯。', 'Make every direction correct before adding speed.') }],
    }),
  ],
};

const cross: Module = {
  id: 'beginner-cross',
  title: l('白色十字', 'White cross'),
  summary: l('先做小花，再让侧面颜色对准中心，避免只看白色一面。', 'Build a daisy first, then match every side color before lowering the edges.'),
  lessons: [
    lesson('beginner-05', '做出白色小花', 'Build the white daisy', 4, '能把四块白色棱块送到黄色中心旁', 'Move all four white edges beside the yellow center', 'drill'),
    lesson('beginner-06', '花瓣侧色对准中心', 'Match each petal to its side center', 3, '能判断一片花瓣应该对准哪个侧面中心', 'Choose the correct side center for any petal'),
    lesson('beginner-07', '把四片花瓣落到底层', 'Lower all four petals', 4, '能完成白色十字，并让四个侧色同时对齐', 'Complete the white cross with all four side colors matched', 'milestone'),
    lesson('beginner-08', '十字常见错误检查', 'Check common cross mistakes', 3, '能发现棱块翻色或侧面没有对齐的问题', 'Spot a flipped edge or a mismatched side color', 'drill'),
  ],
};

const firstLayer: Module = {
  id: 'beginner-first-layer',
  title: l('白色底层角块', 'White first-layer corners'),
  summary: l('先找角块的家，再用同一个基础动作把它送进去。', 'Find each corner home, then insert it with the same short trigger.'),
  lessons: [
    lesson('beginner-09', '找到角块的家', 'Find a corner home', 3, '能根据两个侧色找到白色角块的目标槽', 'Use the two side colors to find a white corner target slot'),
    lesson('beginner-10', '白色朝右的角块', 'White sticker facing right', 3, '能把白色朝右的目标角正确放入', 'Insert a target corner whose white sticker faces right', 'case'),
    lesson('beginner-11', '白色朝前的角块', 'White sticker facing front', 3, '能把白色朝前的目标角正确放入', 'Insert a target corner whose white sticker faces front', 'case'),
    lesson('beginner-12', '白色朝上的角块与卡住情形', 'White on top and trapped corners', 4, '能先调整角块方向，再正确放入目标槽', 'Reorient a corner before inserting it into the target slot', 'case'),
  ],
};

const secondLayer: Module = {
  id: 'beginner-second-layer',
  title: l('中间一层', 'Middle layer'),
  summary: l('只处理不带黄色的棱块，先对准，再根据目标在左或右选择动作。', 'Use only edges without yellow, match the front color, then insert left or right.'),
  lessons: [
    lesson('beginner-13', '找到不带黄色的棱块', 'Find an edge without yellow', 3, '能排除顶层带黄色的棱块并找到练习目标', 'Ignore yellow edges and select a valid target'),
    lesson('beginner-14', '棱块送到右边', 'Insert the edge to the right', 4, '能判断目标在右并完成右插入', 'Recognize a right target and complete the right insertion', 'case'),
    lesson('beginner-15', '棱块送到左边', 'Insert the edge to the left', 4, '能判断目标在左并完成左插入', 'Recognize a left target and complete the left insertion', 'case'),
    lesson('beginner-16', '中层棱块卡住或翻反', 'A trapped or flipped middle edge', 4, '能先把错误棱块取出，再按正确方向插回', 'Remove an incorrect edge and insert it in the correct direction', 'case'),
    lesson('beginner-17', '前两层检查关', 'First-two-layers checkpoint', 3, '连续两次完成底层和中层且侧色全部对齐', 'Complete the first two layers twice with every side color aligned', 'milestone'),
  ],
};

const lastLayer: Module = {
  id: 'beginner-last-layer',
  title: l('最后一层', 'Last layer'),
  summary: l('按黄色十字、黄色面、角块位置、棱块位置的固定顺序收尾。', 'Finish in a fixed order: yellow cross, yellow face, corner positions, then edge positions.'),
  lessons: [
    lesson('beginner-18', '黄色十字：点、拐角和直线', 'Yellow cross: dot, angle, and line', 4, '能认出三种形状并把它们变成黄色十字', 'Recognize all three shapes and make a yellow cross', 'case'),
    lesson('beginner-19', '小鱼形状与拿法', 'Sune shape and grip', 3, '能从黄色角块方向确定小鱼的正确拿法', 'Use the yellow corner directions to choose the correct grip', 'case'),
    lesson('beginner-20', '把黄色全部翻到上面', 'Orient the full yellow face', 4, '能重复判断并完成完整黄色面', 'Repeat the recognition process and complete the yellow face', 'drill'),
    lesson('beginner-21', '让四个黄色角块回到正确位置', 'Place all four yellow corners', 4, '能找到位置正确的角块并完成角块换位', 'Find a correctly placed corner and permute the corners', 'case'),
    lesson('beginner-22', '让最后四条棱块回家', 'Send the last four edges home', 4, '能判断棱块循环方向并完成最后换位', 'Recognize the edge cycle and complete the final permutation', 'case'),
    lesson('beginner-23', '最后一步 AUF', 'Final AUF', 2, '能用 U、U\' 或 U2 对齐六面', 'Use U, U\', or U2 to align all six faces'),
    lesson('beginner-24', '第一次独立完整复原', 'First independent full solve', 5, '不看提示独立复原一次，并记录最容易卡住的阶段', 'Complete one solve without prompts and record the stage with the longest pause', 'milestone'),
  ],
};

export const BEGINNER_MICRO_COURSE: MicroCourse = {
  id: 'beginner',
  label: l('层先法', 'Beginner method'),
  title: l('24 个关卡，从零到独立复原', '24 checkpoints from zero to an independent solve'),
  summary: l('把完整复原拆成五个模块。每节只新增一个判断或动作，孩子可以看完立刻练，家长也能按编号检查进度。', 'A full solve split into five modules. Each lesson adds one decision or action so children can practise immediately and parents can follow progress by number.'),
  audience: l('约 7 岁以上、能分辨颜色并愿意暂停跟练的零基础孩子', 'Beginners around age seven or older who can distinguish colors and pause to practise'),
  stages: [{
    id: 'beginner-full-solve',
    title: l('零基础完整复原', 'Complete beginner solve'),
    summary: l('先准确，再连贯；每个模块都有一个明确检查点。', 'Accuracy first, then flow, with a clear checkpoint in every module.'),
    modules: [basics, cross, firstLayer, secondLayer, lastLayer],
  }],
};
