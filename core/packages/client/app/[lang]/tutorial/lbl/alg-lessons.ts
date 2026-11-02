import { LBL_STEPS, LEFT, RIGHT, LEFT_SUNE, RIGHT_SUNE, CORNER_POSITION } from './content';

type Text = { zh: string; en: string };
export type AlgLesson = { id: string; after: string; title: Text; usage: Text; algs: { title: Text; alg: string; left: boolean; naming: Text }[] };
export const ALG_LESSONS: AlgLesson[] = [
  { id: 'trigger-learning', after: 'cross', title: { zh: '公式学习：左公式和右公式', en: 'Learn the left and right triggers' },
    usage: { zh: '后面章节会反复出现，组合成其他长公式', en: 'It appears throughout later chapters as part of longer algorithms.' },
    algs: [
    { title: { zh: '左公式', en: 'Left trigger' }, alg: LEFT, left: true,
      naming: { zh: '简单的四步公式，左手起手，称为左公式', en: 'A simple four-move algorithm starting with the left hand, called the left trigger.' } },
    { title: { zh: '右公式', en: 'Right trigger' }, alg: RIGHT, left: false,
      naming: { zh: '简单的四步公式，右手起手，称为右公式', en: 'A simple four-move algorithm starting with the right hand, called the right trigger.' } },
  ] },
  { id: 'sune-learning', after: 'yellow-cross', title: { zh: '公式学习：左鱼和右鱼', en: 'Learn left and right Sune' },
    usage: { zh: '复原顶层会多次用到，请牢记。', en: 'It is used many times to finish the top layer — learn it well.' },
    algs: [
    { title: { zh: '左鱼公式', en: 'Left Sune' }, alg: LEFT_SUNE, left: true,
      naming: { zh: '左鱼：鱼头放右前，前（F）面左上角有鱼鳍，左手起手', en: 'Left fish: head at front-right, a fin at the top-left corner of the front (F) face; start with the left hand.' } },
    { title: { zh: '右鱼公式', en: 'Right Sune' }, alg: RIGHT_SUNE, left: false,
      naming: { zh: '右鱼：鱼头放左前，前（F）面右上角有鱼鳍，右手起手', en: 'Right fish: head at front-left, a fin at the top-right corner of the front (F) face; start with the right hand.' } },
  ] },
  { id: 'l-alg-learning', after: 'yellow-face', title: { zh: '公式学习：L公式', en: 'Learn the L algorithm' },
    usage: { zh: '', en: '' },
    algs: [
      { title: { zh: 'L公式', en: 'L algorithm' }, alg: CORNER_POSITION, left: false,
        naming: { zh: 'L公式交换了右侧两个角块的位置', en: 'The L algorithm swaps the two corners on the right.' } },
    ] },
];

// Learning interludes are navigation entries; the nine numbered stages stay intact.
export const LBL_COURSE_ENTRIES = LBL_STEPS.flatMap((step, index) => [
  { id: step.id, title: step.title, number: index + 1 },
  ...ALG_LESSONS.filter(lesson => lesson.after === step.id).map(lesson => ({ id: lesson.id, title: lesson.title, number: null })),
]);
