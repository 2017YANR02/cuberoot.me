import type { IvyTutorialText } from './_ivy3y-data';

/**
 * Chapter index for BV152Yr6ZE8B, checked against the author's demonstrations.
 * These are viewing references, not a transcription of letter algorithms.
 */
export const IVY_VIDEO_CHAPTERS = [
  {
    seconds: 0,
    endSeconds: 143,
    title: { zh: '三心换基础与左右手做法', en: 'Three-center cycles and both-hand finger tricks' },
    description: { zh: '观察三个中心的循环方向，并比较不同持握下的左右手做法。', en: 'Track the direction of the three-center cycle and compare finger tricks for different grips.' },
  },
  {
    seconds: 143,
    endSeconds: 254,
    title: { zh: '三心换变式', en: 'Three-center cycle variations' },
    description: { zh: '从基本循环扩展到不同初态；先对齐待换中心和持握，再执行对应手法。', en: 'Extend the basic cycle to different starting states. Match the displaced centers and grip before applying the finger tricks.' },
  },
  {
    seconds: 254,
    endSeconds: 323,
    title: { zh: '四心换变式', en: 'Four-center exchange variations' },
    description: { zh: '观察四个待换中心的关系，与只涉及三个中心的情况区分。', en: 'Inspect the relationship between four displaced centers and distinguish it from a three-center case.' },
  },
  {
    seconds: 323,
    endSeconds: 378,
    title: { zh: '三步拼好顶面的情况', en: 'Cases that build the top face in three moves' },
    description: { zh: '按顶面的准备过程分组。18 秒补录补充了这一类的一个 1Y 情况；三步拼好顶面不等于三步完成整解。', en: 'Cases grouped by their top-face setup. The 18-second supplement adds a 1Y case in this group; building the top in three moves does not mean solving the whole puzzle in three moves.' },
  },
  {
    seconds: 378,
    endSeconds: 451,
    title: { zh: '四心换：另一组手法', en: 'More four-center exchange finger tricks' },
    description: { zh: '继续比较四心换的初态与执行，留意每次示范开始时的持握。', en: 'Compare further four-center starting states and executions, checking the grip at the start of each demonstration.' },
  },
  {
    seconds: 451,
    endSeconds: 620,
    title: { zh: '1Y：三心换与方向分型', en: '1Y: three-center cycles and direction' },
    description: { zh: '在 1Y 的准备条件下，分别观察中心循环方向与对应收尾。', en: 'With the 1Y setup prepared, distinguish the center-cycle directions and their corresponding finishes.' },
  },
  {
    seconds: 620,
    endSeconds: 686,
    title: { zh: '1Y：四心换的相对位置', en: '1Y: relative positions in four-center exchanges' },
    description: { zh: '按待换中心的相对位置区分四心换情况，并对照原片持握。', en: 'Distinguish four-center cases by the relative positions of the displaced centers, using the grip shown in the video.' },
  },
  {
    seconds: 686,
    endSeconds: 725,
    title: { zh: '1Y：更多四心换', en: '1Y: further four-center exchanges' },
    description: { zh: '补充另一组 1Y 四心换，比较初态与前一组的不同。', en: 'Another group of 1Y four-center exchanges; compare its starting states with the preceding group.' },
  },
  {
    seconds: 725,
    endSeconds: 827,
    title: { zh: '2Y：按连色位置识别', en: '2Y: recognize matching-block positions' },
    description: { zh: '按前、后、左、右、上的连色组合分类。方向均相对于视频当下的持握；还要核对其余块的状态。', en: 'Group cases by matching blocks at the front, back, left, right and top. Directions refer to the current video grip; check the other pieces as well.' },
  },
  {
    seconds: 827,
    endSeconds: 850,
    title: { zh: '2Y：上右、上前连色的其他情况', en: '2Y: other top-right and top-front block cases' },
    description: { zh: '相同的简短连色标签可能对应不同完整状态，不能只看两个连色位置就套用同一公式。', en: 'The same short block label can describe different complete states. Two matching-block locations alone do not determine the algorithm.' },
  },
  {
    seconds: 850,
    endSeconds: 918,
    title: { zh: '2Y：眼睛与连色组合', en: '2Y: eyes and matching-block combinations' },
    description: { zh: '结合左侧、后侧眼睛和前侧等连色关系，观察剩余情况。', en: 'Recognize the remaining case using combinations of eyes on the left or back and matching blocks on other faces.' },
  },
  {
    seconds: 918,
    endSeconds: 954,
    title: { zh: '2Y：单角翻情况', en: '2Y: single-corner-twist cases' },
    description: { zh: '观察作者归为“单角翻”的这一组情况，同时追踪中心在执行中的变化。', en: 'Study the group the author calls single-corner-twist cases while also tracking the centers during execution.' },
  },
  {
    seconds: 954,
    endSeconds: 1035,
    title: { zh: '2Y：更多连色、眼睛与角朝向', en: '2Y: further blocks, eyes and corner orientations' },
    description: { zh: '最后两例都有左眼睛和后眼睛，但角的翻转方向不同；把角朝向一起纳入识别。', en: 'The last two cases both have left and back eyes, but their corner-twist directions differ. Include corner orientation in recognition.' },
  },
] satisfies Array<{
  seconds: number;
  endSeconds: number;
  title: IvyTutorialText;
  description: IvyTutorialText;
}>;

/**
 * Directions are relative to the author's current grip, not fixed face colors.
 * A short recognition label locates a demonstration; it does not identify a
 * complete case on its own. Repeated labels intentionally retain separate cases.
 */
export const IVY_2Y_RECOGNITION_INDEX = [
  { seconds: 725, label: { zh: '前、左、右三连色', en: 'Front, left and right matching blocks' } },
  { seconds: 750, label: { zh: '前、右、后三连色', en: 'Front, right and back matching blocks' } },
  { seconds: 768, label: { zh: '上、右连色', en: 'Top and right matching blocks' } },
  { seconds: 780, label: { zh: '上、前连色', en: 'Top and front matching blocks' } },
  { seconds: 795, label: { zh: '后、前连色', en: 'Back and front matching blocks' } },
  { seconds: 813, label: { zh: '左、后、右三连色', en: 'Left, back and right matching blocks' } },
  { seconds: 827, label: { zh: '上、右连色：另一情况', en: 'Top and right blocks: another case' } },
  { seconds: 841, label: { zh: '上、前连色：另一情况', en: 'Top and front blocks: another case' } },
  { seconds: 850, label: { zh: '左眼睛、后眼睛', en: 'Left eyes and back eyes' } },
  { seconds: 864, label: { zh: '前连色、后眼睛', en: 'Front matching block and back eyes' } },
  { seconds: 881, label: { zh: '上、前连色：后续情况', en: 'Top and front blocks: a later case' } },
  { seconds: 896, label: { zh: '右、前连色', en: 'Right and front matching blocks' } },
  { seconds: 918, label: { zh: '单角翻的一组情况', en: 'Single-corner-twist cases' } },
  { seconds: 954, label: { zh: '前连色、后眼睛：另一情况', en: 'Front block and back eyes: another case' } },
  { seconds: 967, label: { zh: '左、右连色', en: 'Left and right matching blocks' } },
  { seconds: 986, label: { zh: '后眼睛、右眼睛', en: 'Back eyes and right eyes' } },
  { seconds: 1003, label: { zh: '左眼睛、后眼睛：第一种角朝向', en: 'Left and back eyes: first corner orientation' } },
  { seconds: 1022, label: { zh: '左眼睛、后眼睛：第二种角朝向', en: 'Left and back eyes: second corner orientation' } },
] satisfies Array<{ seconds: number; label: IvyTutorialText }>;
