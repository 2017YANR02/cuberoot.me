// Editorial drills adapted from CubeSkills' Beginner's Method, Intermediate
// Cross and F2L, Lookahead Progression Framework and Advanced F2L.
type Copy = { zh: string; en: string };
type Entry = { title: Copy; description: Copy; href: string };
type LearningStage = { id: string; name: Copy; description: Copy; minutes: string; courses: readonly Entry[]; practice: readonly Entry[] };

function exercise(zh: string, en: string, instruction: string, english: string, href: string): Entry {
  return { title: { zh, en }, description: { zh: instruction, en: english }, href };
}

function courses(seconds?: number): Entry[] {
  return [{
    title: { zh: seconds ? `${seconds} 秒阶段课程` : '入门课程', en: seconds ? `Courses for the ${seconds}s stage` : 'Beginner courses' },
    description: { zh: '查看课程列表中符合本阶段的内容。', en: 'Browse the catalog filtered for this stage.' },
    href: seconds ? `/platform/courses?category=speed&q=${seconds}` : '/platform/courses?category=beginner',
  }];
}

export const learningStages: readonly LearningStage[] = [
  { id: 'first-solve', name: { zh: '入门复原', en: 'First solve' }, description: { zh: '学会层先法，独立复原三阶。', en: 'Learn layer-by-layer solving.' }, minutes: '15–20',
    courses: courses(), practice: [
      exercise('跟练层先法', 'Solve layer by layer', '跟着教程做一次，再遮住提示重做最容易忘记的一步。', 'Follow a solve, then repeat the trickiest step without the guide.', '/tutorial/lbl'),
    ] },
  { id: 'sub60', name: { zh: '稳定 60 秒', en: 'Consistent 60s' }, description: { zh: '熟练复原流程，减少停顿。', en: 'Build fluency and reduce pauses.' }, minutes: '15–20',
    courses: courses(60), practice: [
      exercise('底面十字', 'Build the cross on the bottom', '在底面做好十字，检查四条棱的侧色是否对齐中心。', 'Build a bottom cross and check all four side colours against their centres.', '/timer?content=cross'),
      exercise('角棱配对', 'Pair a corner and an edge', '跟着教程配出一组角棱，观察它们怎样一起进入槽位。', 'Follow one pair through setup and insertion.', '/tutorial/f2l'),
    ] },
  { id: 'sub30', name: { zh: '稳定 30 秒', en: 'Consistent 30s' }, description: { zh: '学习十字与 F2L 的高效衔接。', en: 'Connect the cross to the first pair.' }, minutes: '20–30',
    courses: courses(30), practice: [
      exercise('F2L 慢拧', 'Slow F2L solves', '放慢当前一组的插入，在最后几步寻找下一组角棱。', 'Slow down the insertion and look for the next pair during its final moves.', '/timer?content=f2l'),
    ] },
  { id: 'sub20', name: { zh: '稳定 20 秒', en: 'Consistent 20s' }, description: { zh: '系统练习 CFOP 与识别。', en: 'Practise CFOP and recognition.' }, minutes: '20–30',
    courses: courses(20), practice: [
      exercise('整次连续转动', 'Continuous turning', '用能看清下一组的速度完成前两层，记下第一次停顿的位置。', 'Solve F2L at a pace that lets you track the next pair. Note the first pause.', '/timer'),
      exercise('顶层朝向识别', 'Recognise last-layer orientation', '先辨认顶面和侧面的色块，再执行对应的 OLL。', 'Read the top and side stickers before executing the OLL.', '/timer?content=oll'),
    ] },
  { id: 'sub15', name: { zh: '稳定 15 秒', en: 'Consistent 15s' }, description: { zh: '优化预判、指法与节奏。', en: 'Refine lookahead, finger tricks and rhythm.' }, minutes: '25–30',
    courses: courses(15), practice: [
      exercise('顶层排列识别', 'Recognise the permutation', '观察相邻两侧的色块，决定起手方向，再连贯执行 PLL。', 'Read two adjacent sides, choose an angle and execute the PLL smoothly.', '/timer?content=pll'),
    ] },
  { id: 'sub10', name: { zh: '稳定 10 秒', en: 'Consistent 10s' }, description: { zh: '专项分析复盘与失分环节。', en: 'Analyse solves and target weaknesses.' }, minutes: '30–40',
    courses: courses(10), practice: [
      exercise('预判十字与首组', 'Plan cross and first pair', '在一条复盘的打乱上预判十字和首组，再对照原解法的衔接。', 'Plan the cross and first pair on a reconstructed scramble, then compare transitions.', '/recon'),
    ] },
];
