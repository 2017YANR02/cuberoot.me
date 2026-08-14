import { l, microLesson } from './builders';
import type { LessonKind, MicroCourse, Module } from './types';

function lesson(id: string, zhTitle: string, enTitle: string, minutes: number, zhOutcome: string, enOutcome: string, kind: LessonKind = 'concept') {
  return microLesson({ id, title: l(zhTitle, enTitle), minutes, outcome: l(zhOutcome, enOutcome), kind });
}

const basics: Module = {
  id: 'beginner-basics',
  title: l('认识三阶魔方与动作语言', 'Meet the 3×3 and learn move language'),
  summary: l('先认识三阶魔方的来历、纪录和结构，再统一拿法、记号与最常用的小手法。', 'Begin with the 3×3’s history, records, and structure, then establish grip, notation, and the most useful short trigger.'),
  lessons: [
    microLesson({
      id: 'beginner-01',
      title: l('魔方是怎样诞生的', 'How the Rubik’s Cube began'),
      minutes: 3,
      outcome: l('能说出魔方的发明者，以及 1974、1980、1982 三个关键年份', 'Name the inventor and explain why 1974, 1980, and 1982 matter'),
      shots: [
        l('正面展示复原与打乱的三阶魔方', 'Show a solved and a scrambled 3×3 to camera'),
        l('时间轴依次出现 1974、1980、1982', 'Reveal 1974, 1980, and 1982 on a timeline'),
        l('结尾用三张年份卡片做口头检查', 'Finish with a spoken check using three year cards'),
      ],
      script: [
        l('欢迎来到层先法课程。正式学习复原之前，我们先用三分钟认识手里的三阶魔方是怎样诞生的。', 'Welcome to the beginner-method course. Before learning the solve, let us spend three minutes on how the 3×3 began.'),
        l('【镜头展示一个复原好的魔方，再展示一个打乱的魔方】', '[Show a solved cube, then a scrambled cube.]'),
        l('1974 年，匈牙利建筑学教授厄尔诺·鲁比克做出了最早的魔方模型。他面对的难题是：怎样让许多小块自由转动，同时又不散开。', 'In 1974, Hungarian architecture professor Ernő Rubik built the first cube prototype. The challenge was to let many small pieces turn freely without falling apart.'),
        l('1975 年，这套转动结构获得了专利。鲁比克也把魔方用于帮助学员理解立体空间和运动。', 'In 1975, the turning mechanism was patented. Rubik also used the cube to help learners understand three-dimensional space and movement.'),
        l('1980 年，它以“鲁比克魔方”这个名字走向世界。越来越多人开始研究怎样复原，以及怎样复原得更快。', 'In 1980, it reached the world under the name Rubik’s Cube. More people began studying how to solve it and how to solve it faster.'),
        l('1982 年，第一届世界魔方锦标赛在布达佩斯举行，三阶项目的冠军成绩是 22.95 秒。', 'In 1982, the first Rubik’s Cube World Championship was held in Budapest, and the winning 3×3 time was 22.95 seconds.'),
        l('从一个研究空间运动的模型，到今天全世界共同挑战的智力运动，魔方一直在做同一件事：把复杂问题拆成看得懂的小步骤。', 'From a model for exploring spatial movement to a worldwide mind sport, the cube has always rewarded the same skill: breaking a complex problem into understandable steps.'),
        l('现在请暂停一下，用自己的话说出三个年份：1974 年发生了什么，1980 年发生了什么，1982 年又发生了什么。能说清楚，就进入下一课。', 'Pause and explain the three years in your own words: what happened in 1974, 1980, and 1982? Once you can answer, continue to the next lesson.'),
      ],
    }),
    microLesson({
      id: 'beginner-02',
      title: l('认识三阶世界纪录', 'Meet the 3×3 world records'),
      minutes: 3,
      outcome: l('能分清单次与平均纪录，并说出截至 2026 年 8 月 13 日的纪录成绩', 'Distinguish single and average records and name the records current on August 13, 2026'),
      shots: [
        l('屏幕注明“纪录数据截至 2026 年 8 月 13 日”', 'Show “Record data as of August 13, 2026” on screen'),
        l('分别展示单次 2.76 秒与平均 3.71 秒纪录卡', 'Show separate cards for the 2.76 single and 3.71 average records'),
        l('结尾并排展示“和自己比”练习记录表', 'End with a side-by-side personal progress sheet'),
      ],
      script: [
        l('学魔方时，我们经常听到“世界纪录”。不过三阶速拧有两项最常见的纪录：单次和平均。', 'When learning the cube, we often hear “world record.” In 3×3 speedsolving, the two records mentioned most often are the single and the average.'),
        l('单次纪录看的是一次复原有多快。截至 2026 年 8 月 13 日，世界魔方协会认可的三阶单次世界纪录是 2.76 秒，由波兰选手 Teodor Zajder 创造。', 'The single record measures one solve. As of August 13, 2026, the WCA-recognized 3×3 single world record is 2.76 seconds, set by Poland’s Teodor Zajder.'),
        l('平均纪录看的是一组复原能不能一直保持很快，它比偶然的一次快成绩更能体现稳定性。', 'The average record asks whether a solver can stay fast across a set of solves, so it reflects consistency better than one exceptional attempt.'),
        l('截至同一天，三阶平均世界纪录是 3.71 秒，由中国选手耿暄一创造。', 'As of the same date, the 3×3 average world record is 3.71 seconds, set by China’s Xuanyi Geng.'),
        l('【画面并排显示两项纪录，并突出“单次”和“平均”】', '[Show both records side by side and highlight “single” and “average.”]'),
        l('世界纪录会继续变化，所以录制和发布前要再次核对世界魔方协会的最新纪录页，画面上也要保留数据日期。', 'World records keep changing, so check the latest WCA records again before recording and publishing, and keep the data date visible on screen.'),
        l('这些数字不是要求你现在追上的目标。第一阶段更重要的纪录，是今天比昨天少看一次提示，或者能独立完成一个步骤。', 'These numbers are not a target you must chase now. At this stage, the more useful record is needing one fewer hint than yesterday or completing one step independently.'),
        l('现在请回答：2.76 秒是哪一种纪录，3.71 秒是哪一种纪录？分清以后，我们来看看魔方里面有哪些不同的块。', 'Now answer this: which kind of record is 2.76 seconds, and which is 3.71 seconds? Once they are clear, let us examine the different pieces in the cube.'),
      ],
    }),
    microLesson({
      id: 'beginner-03',
      title: l('魔方的结构：中心块、棱块和角块', 'Cube structure: centers, edges, and corners'),
      minutes: 4,
      outcome: l('能说出中心块、棱块和角块的数量、颜色数与作用', 'State the count, number of colors, and role of centers, edges, and corners'),
      shots: [
        l('俯拍依次指向中心块、棱块和角块', 'Point to centers, edges, and corners in sequence from above'),
        l('屏幕分别显示 6、12、8 和对应颜色数', 'Show 6, 12, and 8 with their color counts on screen'),
        l('随机指三块，让学员暂停并判断名称', 'Point to three random pieces for a pause-and-name check'),
      ],
      script: [
        l('三阶魔方表面看起来有很多小方格，但学习复原时，我们只需要分清三类块：中心块、棱块和角块。', 'A 3×3 appears to have many small squares, but solving begins with only three piece types: centers, edges, and corners.'),
        l('先看每一面的正中间。中心块只有一种颜色，一共有六块。中心块之间的相对位置不会改变，所以它决定这一面最后应该是什么颜色。', 'Start at the middle of each face. A center has one color, and there are six centers. Their relative positions do not change, so each center defines the final color of its face.'),
        l('再看两面交界的位置。棱块有两种颜色，一共有十二块。判断一条棱块的家，要同时看它的两种颜色对应哪两个中心。', 'Now look where two faces meet. An edge has two colors, and there are twelve edges. To find an edge’s home, match both colors to their centers.'),
        l('最后看三个面交会的位置。角块有三种颜色，一共有八块。判断一个角块的家，也要同时看它的三种颜色。', 'Finally, look where three faces meet. A corner has three colors, and there are eight corners. Find a corner’s home by matching all three colors.'),
        l('【屏幕总结：中心块 6 个、每块 1 色；棱块 12 个、每块 2 色；角块 8 个、每块 3 色】', '[Summarize on screen: 6 centers with 1 color each, 12 edges with 2 colors each, and 8 corners with 3 colors each.]'),
        l('转动魔方时，棱块和角块会去到不同位置；中心块会跟着那一面转，但六个中心之间的相对关系保持不变。', 'As the cube turns, edges and corners travel to different positions. A center turns with its face, but the relative arrangement of all six centers stays fixed.'),
        l('现在我随机指一块，请先数它有几种颜色，再说它是中心块、棱块还是角块。不要看位置猜，要用颜色数判断。', 'I will point to a random piece. Count its colors first, then name it as a center, edge, or corner. Use the color count instead of guessing from position.'),
        l('过关检查：中心块、棱块、角块各有多少？每一类分别有几种颜色？能全部答对，就进入六个面的学习。', 'Checkpoint: how many centers, edges, and corners are there, and how many colors does each type have? Answer all six facts correctly before moving on to the six faces.'),
      ],
    }),
    lesson('beginner-04', '上、下、左、右、前、后', 'Up, down, left, right, front, and back', 3, '保持拿法不变，准确指出六个面', 'Keep one grip and point to all six faces correctly'),
    lesson('beginner-05', '读懂 R、U 和撇号', 'Read R, U, and prime marks', 4, '能独立读出并完成 R、R\'、U、U\'', 'Read and perform R, R\', U, and U\' independently'),
    microLesson({
      id: 'beginner-06',
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
    lesson('beginner-07', '做出白色小花', 'Build the white daisy', 4, '能把四块白色棱块送到黄色中心旁', 'Move all four white edges beside the yellow center', 'drill'),
    lesson('beginner-08', '花瓣侧色对准中心', 'Match each petal to its side center', 3, '能判断一片花瓣应该对准哪个侧面中心', 'Choose the correct side center for any petal'),
    lesson('beginner-09', '把四片花瓣落到底层', 'Lower all four petals', 4, '能完成白色十字，并让四个侧色同时对齐', 'Complete the white cross with all four side colors matched', 'milestone'),
    lesson('beginner-10', '十字常见错误检查', 'Check common cross mistakes', 3, '能发现棱块翻色或侧面没有对齐的问题', 'Spot a flipped edge or a mismatched side color', 'drill'),
  ],
};

const firstLayer: Module = {
  id: 'beginner-first-layer',
  title: l('白色底层角块', 'White first-layer corners'),
  summary: l('先找角块的家，再用同一个基础动作把它送进去。', 'Find each corner home, then insert it with the same short trigger.'),
  lessons: [
    lesson('beginner-11', '找到角块的家', 'Find a corner home', 3, '能根据两个侧色找到白色角块的目标槽', 'Use the two side colors to find a white corner target slot'),
    lesson('beginner-12', '白色朝右的角块', 'White sticker facing right', 3, '能把白色朝右的目标角正确放入', 'Insert a target corner whose white sticker faces right', 'case'),
    lesson('beginner-13', '白色朝前的角块', 'White sticker facing front', 3, '能把白色朝前的目标角正确放入', 'Insert a target corner whose white sticker faces front', 'case'),
    lesson('beginner-14', '白色朝上的角块与卡住情形', 'White on top and trapped corners', 4, '能先调整角块方向，再正确放入目标槽', 'Reorient a corner before inserting it into the target slot', 'case'),
  ],
};

const secondLayer: Module = {
  id: 'beginner-second-layer',
  title: l('中间一层', 'Middle layer'),
  summary: l('只处理不带黄色的棱块，先对准，再根据目标在左或右选择动作。', 'Use only edges without yellow, match the front color, then insert left or right.'),
  lessons: [
    lesson('beginner-15', '找到不带黄色的棱块', 'Find an edge without yellow', 3, '能排除顶层带黄色的棱块并找到练习目标', 'Ignore yellow edges and select a valid target'),
    lesson('beginner-16', '棱块送到右边', 'Insert the edge to the right', 4, '能判断目标在右并完成右插入', 'Recognize a right target and complete the right insertion', 'case'),
    lesson('beginner-17', '棱块送到左边', 'Insert the edge to the left', 4, '能判断目标在左并完成左插入', 'Recognize a left target and complete the left insertion', 'case'),
    lesson('beginner-18', '中层棱块卡住或翻反', 'A trapped or flipped middle edge', 4, '能先把错误棱块取出，再按正确方向插回', 'Remove an incorrect edge and insert it in the correct direction', 'case'),
    lesson('beginner-19', '前两层检查关', 'First-two-layers checkpoint', 3, '连续两次完成底层和中层且侧色全部对齐', 'Complete the first two layers twice with every side color aligned', 'milestone'),
  ],
};

const lastLayer: Module = {
  id: 'beginner-last-layer',
  title: l('最后一层', 'Last layer'),
  summary: l('按黄色十字、黄色面、角块位置、棱块位置的固定顺序收尾。', 'Finish in a fixed order: yellow cross, yellow face, corner positions, then edge positions.'),
  lessons: [
    lesson('beginner-20', '黄色十字：点、拐角和直线', 'Yellow cross: dot, angle, and line', 4, '能认出三种形状并把它们变成黄色十字', 'Recognize all three shapes and make a yellow cross', 'case'),
    lesson('beginner-21', '小鱼形状与拿法', 'Sune shape and grip', 3, '能从黄色角块方向确定小鱼的正确拿法', 'Use the yellow corner directions to choose the correct grip', 'case'),
    lesson('beginner-22', '把黄色全部翻到上面', 'Orient the full yellow face', 4, '能重复判断并完成完整黄色面', 'Repeat the recognition process and complete the yellow face', 'drill'),
    lesson('beginner-23', '让四个黄色角块回到正确位置', 'Place all four yellow corners', 4, '能找到位置正确的角块并完成角块换位', 'Find a correctly placed corner and permute the corners', 'case'),
    lesson('beginner-24', '让最后四条棱块回家', 'Send the last four edges home', 4, '能判断棱块循环方向并完成最后换位', 'Recognize the edge cycle and complete the final permutation', 'case'),
    lesson('beginner-25', '最后一步 AUF', 'Final AUF', 2, '能用 U、U\' 或 U2 对齐六面', 'Use U, U\', or U2 to align all six faces'),
    lesson('beginner-26', '第一次独立完整复原', 'First independent full solve', 5, '不看提示独立复原一次，并记录最容易卡住的阶段', 'Complete one solve without prompts and record the stage with the longest pause', 'milestone'),
  ],
};

export const BEGINNER_MICRO_COURSE: MicroCourse = {
  id: 'beginner',
  label: l('层先法', 'Beginner method'),
  title: l('26 个关卡，从认识魔方到独立复原', '26 checkpoints from meeting the cube to an independent solve'),
  summary: l('把完整复原拆成五个模块。每节只新增一个判断或动作，学员可以看完立刻练，家长也能按编号检查进度。', 'A full solve split into five modules. Each lesson adds one decision or action so learners can practise immediately and parents can follow progress by number.'),
  audience: l('能分辨颜色并愿意暂停跟练的零基础学员', 'Beginners who can distinguish colors and pause to practise'),
  stages: [{
    id: 'beginner-full-solve',
    title: l('零基础完整复原', 'Complete beginner solve'),
    summary: l('先准确，再连贯；每个模块都有一个明确检查点。', 'Accuracy first, then flow, with a clear checkpoint in every module.'),
    modules: [basics, cross, firstLayer, secondLayer, lastLayer],
  }],
};
