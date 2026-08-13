import { microLesson } from './builders';
import type { MicroCourse, Module } from './types';

const basics: Module = {
  id: 'beginner-basics',
  title: '准备与动作语言',
  summary: '先统一拿法、记号和最常用的小手法，后面讲解不再反复停下来补基础。',
  lessons: [
    microLesson({ id: 'beginner-01', title: '中心、棱和角', minutes: 3, outcome: '看到一块就能说出它是中心、棱还是角' }),
    microLesson({ id: 'beginner-02', title: '上、下、左、右、前、后', minutes: 3, outcome: '保持拿法不变，准确指出六个面' }),
    microLesson({ id: 'beginner-03', title: '读懂 R、U 和撇号', minutes: 4, outcome: '能独立读出并完成 R、R\'、U、U\'' }),
    microLesson({ id: 'beginner-04', title: '右手小鱼动作', minutes: 4, outcome: '连续五次正确完成 R U R\' U\'', kind: 'drill', formulas: [{ name: '右手基础动作', alg: "R U R' U'", note: '先保证方向正确，再追求连贯。' }] }),
  ],
};

const cross: Module = {
  id: 'beginner-cross',
  title: '白色十字',
  summary: '先做小花，再让侧面颜色对准中心，避免只看白色一面。',
  lessons: [
    microLesson({ id: 'beginner-05', title: '做出白色小花', minutes: 4, outcome: '能把四块白色棱块送到黄色中心旁', kind: 'drill' }),
    microLesson({ id: 'beginner-06', title: '花瓣侧色对准中心', minutes: 3, outcome: '能判断一片花瓣应该对准哪个侧面中心' }),
    microLesson({ id: 'beginner-07', title: '把四片花瓣落到底层', minutes: 4, outcome: '能完成白色十字，并让四个侧色同时对齐', kind: 'milestone' }),
    microLesson({ id: 'beginner-08', title: '十字常见错误检查', minutes: 3, outcome: '能发现棱块翻色或侧面没有对齐的问题', kind: 'drill' }),
  ],
};

const firstLayer: Module = {
  id: 'beginner-first-layer',
  title: '白色底层角块',
  summary: '先找角块的家，再用同一个基础动作把它送进去。',
  lessons: [
    microLesson({ id: 'beginner-09', title: '找到角块的家', minutes: 3, outcome: '能根据两个侧色找到白色角块的目标槽' }),
    microLesson({ id: 'beginner-10', title: '白色朝右的角块', minutes: 3, outcome: '能把白色朝右的目标角正确放入', kind: 'case' }),
    microLesson({ id: 'beginner-11', title: '白色朝前的角块', minutes: 3, outcome: '能把白色朝前的目标角正确放入', kind: 'case' }),
    microLesson({ id: 'beginner-12', title: '白色朝上的角块与卡住情形', minutes: 4, outcome: '能先调整角块方向，再正确放入目标槽', kind: 'case' }),
  ],
};

const secondLayer: Module = {
  id: 'beginner-second-layer',
  title: '中间一层',
  summary: '只处理不带黄色的棱块，先对准，再根据目标在左或右选择动作。',
  lessons: [
    microLesson({ id: 'beginner-13', title: '找到不带黄色的棱块', minutes: 3, outcome: '能排除顶层带黄色的棱块并找到练习目标' }),
    microLesson({ id: 'beginner-14', title: '棱块送到右边', minutes: 4, outcome: '能判断目标在右并完成右插入', kind: 'case' }),
    microLesson({ id: 'beginner-15', title: '棱块送到左边', minutes: 4, outcome: '能判断目标在左并完成左插入', kind: 'case' }),
    microLesson({ id: 'beginner-16', title: '中层棱块卡住或翻反', minutes: 4, outcome: '能先把错误棱块取出，再按正确方向插回', kind: 'case' }),
    microLesson({ id: 'beginner-17', title: '前两层检查关', minutes: 3, outcome: '连续两次完成底层和中层且侧色全部对齐', kind: 'milestone' }),
  ],
};

const lastLayer: Module = {
  id: 'beginner-last-layer',
  title: '最后一层',
  summary: '按黄色十字、黄色面、角块位置、棱块位置的固定顺序收尾。',
  lessons: [
    microLesson({ id: 'beginner-18', title: '黄色十字：点、拐角和直线', minutes: 4, outcome: '能认出三种形状并把它们变成黄色十字', kind: 'case' }),
    microLesson({ id: 'beginner-19', title: '小鱼形状与拿法', minutes: 3, outcome: '能从黄色角块方向确定小鱼的正确拿法', kind: 'case' }),
    microLesson({ id: 'beginner-20', title: '把黄色全部翻到上面', minutes: 4, outcome: '能重复判断并完成完整黄色面', kind: 'drill' }),
    microLesson({ id: 'beginner-21', title: '让四个黄色角块回到正确位置', minutes: 4, outcome: '能找到位置正确的角块并完成角块换位', kind: 'case' }),
    microLesson({ id: 'beginner-22', title: '让最后四条棱块回家', minutes: 4, outcome: '能判断棱块循环方向并完成最后换位', kind: 'case' }),
    microLesson({ id: 'beginner-23', title: '最后一步 AUF', minutes: 2, outcome: '能用 U、U\' 或 U2 对齐六面' }),
    microLesson({ id: 'beginner-24', title: '第一次独立完整复原', minutes: 5, outcome: '不看提示独立复原一次，并记录最容易卡住的阶段', kind: 'milestone' }),
  ],
};

export const BEGINNER_MICRO_COURSE: MicroCourse = {
  id: 'beginner',
  label: '层先法',
  title: '24 个关卡，从零到独立复原',
  summary: '把完整复原拆成五个模块。每节只新增一个判断或动作，孩子可以看完立刻练，家长也能按编号检查进度。',
  audience: '约 7 岁以上、能分辨颜色并愿意暂停跟练的零基础孩子',
  stages: [
    {
      id: 'beginner-full-solve',
      title: '零基础完整复原',
      summary: '先准确，再连贯；每个模块都有一个明确检查点。',
      modules: [basics, cross, firstLayer, secondLayer, lastLayer],
    },
  ],
};
