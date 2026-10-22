/**
 * Source index for 蛋小泽's public Ivy 3Y series.
 * Timestamps refer to the video, not a machine transcript. The author's
 * “fewest moves” is a planning goal, not a proof of global optimality.
 */
export type IvyTutorialText = { zh: string; en: string };

export const IVY_3Y_SOURCES = {
  method: {
    bvid: 'BV1DhtT6GESn',
    title: { zh: '3Y 法思路讲解', en: '3Y method explained' },
    duration: '6:50',
    description: { zh: '1Y、2Y 与 3Y 的关系，以及全预判的选底思路。', en: 'How 1Y, 2Y and 3Y relate, and how to plan the whole solve.' },
  },
  algorithms: {
    bvid: 'BV152Yr6ZE8B',
    title: { zh: '3Y 法公式集', en: '3Y algorithm collection' },
    duration: '17:15',
    description: { zh: '从三心换、四心换到按连色识别的收尾情况。', en: 'Center cycles and finishing cases recognized by matching color blocks.' },
  },
  supplement: {
    bvid: 'BV11hpw6uExy',
    title: { zh: '补录一条公式', en: 'Supplementary algorithm' },
    duration: '0:18',
    description: { zh: '补充 1Y 中“三步拼好顶面”的一个情况。', en: 'An additional 1Y case that builds the top face in three moves.' },
  },
  examples: {
    bvid: 'BV1Pepw6MEP8',
    title: { zh: '3Y 法的实例和应用', en: '3Y examples and applications' },
    duration: '8:22',
    description: { zh: '在具体打乱中比较不同开局，并把后续公式一起预判。', en: 'Compare openings on real scrambles and plan the finishing sequence in advance.' },
  },
} as const;

export type Ivy3YSource = keyof typeof IVY_3Y_SOURCES;

export function ivyVideoUrl(source: Ivy3YSource, seconds = 0): string {
  const base = `https://www.bilibili.com/video/${IVY_3Y_SOURCES[source].bvid}/`;
  return seconds > 0 ? `${base}?t=${seconds}` : base;
}

export function ivyTimestamp(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const IVY_METHOD_STAGES = [
  {
    name: '1Y',
    preparation: { zh: '先拼出两到三个完整面', en: 'Build two or three complete faces' },
    finish: { zh: '识别剩余情况，接一条收尾公式。', en: 'Recognize the remaining case and finish with one algorithm.' },
    practice: { zh: '先把中心循环与基本收尾做熟。', en: 'Become fluent with center cycles and basic finishes.' },
    seconds: 31,
  },
  {
    name: '2Y',
    preparation: { zh: '先拼出一个完整面', en: 'Build one complete face' },
    finish: { zh: '按连色块的位置、朝向和相互关系识别，再接公式。', en: 'Recognize the position, direction and relationship of matching blocks, then apply an algorithm.' },
    practice: { zh: '减少准备步骤，同时扩大能够直接识别的情况。', en: 'Shorten the setup while learning to recognize more finishing cases.' },
    seconds: 107,
  },
  {
    name: '3Y',
    preparation: { zh: '把整个复原过程一起规划', en: 'Plan the entire solve together' },
    finish: { zh: '在 1Y、2Y 的基础上全预判，比较整条解法的步数与执行。', en: 'Build on 1Y and 2Y to predict the full solve and compare complete solutions.' },
    practice: { zh: '选择总解法更短、衔接顺畅的开局；可以用熟悉公式，也可以直接规划短解。', en: 'Choose an opening that leads to a shorter, smoother solve, using familiar algorithms or a directly planned short solution.' },
    seconds: 211,
  },
] satisfies Array<{
  name: string;
  preparation: IvyTutorialText;
  finish: IvyTutorialText;
  practice: IvyTutorialText;
  seconds: number;
}>;

export const IVY_3Y_RECOGNITION = [
  {
    title: { zh: '完整面', en: 'Complete face' },
    text: { zh: '一个面的中心与两片角块颜色都一致，才算拼好一面。只看到两片角块同色，中心仍是异色，不满足 1Y / 2Y 的阶段条件。', en: 'A face is complete only when its center and both corner stickers match. Two matching corner stickers with a different center do not meet the 1Y / 2Y setup condition.' },
  },
  {
    title: { zh: '连色块', en: 'Matching block' },
    text: { zh: '把已经相连的同色中心和角块当作一个整体观察。记住它位于哪里、朝哪个方向，以及能否在插入另一块时保留下来。', en: 'Track an adjacent matching center and corner sticker as a block: where it is, which way it points, and whether it survives the next insertion.' },
  },
  {
    title: { zh: '相对位置', en: 'Relative position' },
    text: { zh: '不要只背“黄色在上面”。先对齐完整面和连色块，再判断其余中心的位置；换配色或换底色后，同一结构仍是同一类情况。', en: 'Do not memorize only a color such as yellow on top. Align the complete face and matching blocks, then inspect the remaining centers. The same structure can use different colors.' },
  },
  {
    title: { zh: '整条解法', en: 'Complete solution' },
    text: { zh: '先估计开局，再追踪开局后的连色与收尾。眼前一步能拼好底面，不代表这条路线总步数最少；多一步准备也可能换来更短的后续。', en: 'Estimate the opening, then track the blocks and finish it produces. A one-move first face need not give the shortest total solution; an extra setup move can lead to a shorter finish.' },
  },
] satisfies Array<{ title: IvyTutorialText; text: IvyTutorialText }>;

/** Original on-screen scrambles; visible face patterns match the site's RLUB model. */
export const IVY_3Y_EXAMPLES = [
  {
    id: 'example-1',
    title: { zh: '实例一：换底色，并提前组好下一条连色', en: 'Example 1: change the first face and build the next block early' },
    scramble: "B' U B U' R' B' L U R'",
    seconds: 13,
    routes: [
      { method: '1Y', seconds: 13, text: { zh: '以黄色为底，同时处理橙色，准备好两个面后接四心换。预判时追踪红色中心的位置，提前知道后半程是哪一种互换。', en: 'Use yellow as the first face and prepare orange as well, then finish with a four-center exchange. Track the red center to predict the finishing case.' } },
      { method: '2Y', seconds: 121, text: { zh: '改用蓝底。作者已经预判到黄底会留下不顺手的 2Y 情况，因此换底后先拼一面，再接更容易执行的收尾。', en: 'Switch to blue. The predicted yellow-first 2Y finish is awkward, so the author chooses a different first face with a more comfortable finish.' } },
      { method: '3Y', seconds: 178, text: { zh: '仍可选黄底，但先组绿色，再组黄色；放入黄、绿时，让橙色与红色也一起接好。观察的是多个连色块的联动，而非只看底面。', en: 'Yellow can still work, but build green before yellow. Inserting those blocks also connects orange and red. Track several blocks together instead of focusing only on the first face.' } },
    ],
    lesson: { zh: '这一把作者更推荐 3Y 或 2Y；15 秒内看不清 3Y 时，可以选择已经预判清楚的 2Y。', en: 'For this scramble the author prefers 3Y or 2Y. If 3Y is unclear within the 15-second inspection, use the fully predicted 2Y route.' },
  },
  {
    id: 'example-2',
    title: { zh: '实例二：2Y 不一定比 1Y 更快', en: 'Example 2: 2Y need not beat 1Y' },
    scramble: "R' L' R' B R' U B' L'",
    seconds: 264,
    routes: [
      { method: '1Y', seconds: 264, text: { zh: '以红色为底，同时把白面做好；追踪蓝色连色，接上蓝色后用三心换收尾。多做一个面，换来的是容易预判的后半程。', en: 'Build red and white together, track the blue block, insert blue and finish with a three-center cycle. Preparing the extra face gives an easy-to-predict finish.' } },
      { method: '2Y', seconds: 350, text: { zh: '同样用红底，却不顺手处理白面，结果留下较长的收尾公式。准备阶段少做一些，并没有让整条解法更高效。', en: 'Use red again but leave white unfinished. The resulting finishing algorithm is long: less setup work does not produce a better complete solution.' } },
      { method: '3Y', seconds: 392, text: { zh: '改选白底，放白后先组橙色，让橙色和黄色随后一起归位。把原本要留给收尾处理的工作，提前并入开局。', en: 'Switch to white, then build orange so orange and yellow can be placed together. Work that would otherwise remain for the finish is absorbed into the opening.' } },
    ],
    lesson: { zh: '这一把作者更推荐 3Y 或 1Y。三条路线应按具体打乱选择，名称中的数字不代表每把都更快。', en: 'For this scramble the author prefers 3Y or 1Y. Choose according to the scramble; the number in the method name is not a ranking for every solve.' },
  },
] satisfies Array<{
  id: string;
  title: IvyTutorialText;
  scramble: string;
  seconds: number;
  routes: Array<{ method: string; seconds: number; text: IvyTutorialText }>;
  lesson: IvyTutorialText;
}>;

/**
 * CubeRoot teaching examples in the site's standard RLDB notation, not a
 * purported transcription of the author's hand-only algorithm demonstrations.
 * Independent expected states make verification stronger than alg + inverse.
 * Face order: U R F B L D. All four corners are oriented in these setups.
 */
export const IVY_CENTER_PRACTICE = [
  {
    id: 'three-center-forward',
    title: { zh: '三心换：U → F → B', en: 'Three centers: U → F → B' },
    recognition: { zh: 'R、L、D 三面已经复原；剩下 U、F、B 三个中心需要循环。', en: 'R, L and D are complete; the U, F and B centers need a cycle.' },
    alg: "R' L' R L",
    setup: "L' R' L R",
    expectedCenters: [2, 1, 3, 0, 4, 5],
    solvedFaces: [1, 4, 5],
  },
  {
    id: 'three-center-reverse',
    title: { zh: '三心换：U → B → F', en: 'Three centers: U → B → F' },
    recognition: { zh: '需要循环的还是 U、F、B 三个中心，但移动方向与上一例相反。', en: 'The same U, F and B centers are displaced, in the opposite direction.' },
    alg: "L' R' L R",
    setup: "R' L' R L",
    expectedCenters: [3, 1, 0, 2, 4, 5],
    solvedFaces: [1, 4, 5],
  },
  {
    id: 'three-center-adjacent',
    title: { zh: '三心换：U → F → R', en: 'Three centers: U → F → R' },
    recognition: { zh: 'B、L、D 三面已经复原；待换中心是彼此相邻的 U、F、R。', en: 'B, L and D are complete; the adjacent U, F and R centers need cycling.' },
    alg: "R L' R' L",
    setup: "L' R L R'",
    expectedCenters: [2, 0, 1, 3, 4, 5],
    solvedFaces: [3, 4, 5],
  },
  {
    id: 'three-center-adjacent-reverse',
    title: { zh: '三心换：U → R → F', en: 'Three centers: U → R → F' },
    recognition: { zh: '与上一例相同的三个相邻中心，循环方向相反。识别位置之后还要检查方向。', en: 'The same three adjacent centers cycle in reverse. Check the direction as well as the locations.' },
    alg: "L' R L R'",
    setup: "R L' R' L",
    expectedCenters: [1, 2, 0, 3, 4, 5],
    solvedFaces: [3, 4, 5],
  },
  {
    id: 'four-center-exchange',
    title: { zh: '四心换：U ↔ B、F ↔ D', en: 'Four centers: U ↔ B, F ↔ D' },
    recognition: { zh: 'R、L 两面已经复原；U 与 B、F 与 D 两对中心互换。前四步先改变待换结构，后四步完成收尾。', en: 'R and L are complete; swap U with B and F with D. The first four moves change the remaining center pattern; the last four finish it.' },
    alg: "R' L' R L B' D' B D",
    setup: "D' B' D B L' R' L R",
    expectedCenters: [3, 1, 5, 0, 4, 2],
    solvedFaces: [1, 4],
  },
] satisfies Array<{
  id: string;
  title: IvyTutorialText;
  recognition: IvyTutorialText;
  alg: string;
  setup: string;
  expectedCenters: number[];
  solvedFaces: number[];
}>;

/**
 * Reconstructed from the supplement's eight physical turns, not from a printed
 * algorithm (the source has none). Independently checked against all nine top
 * face frames. Video scheme URFBLD = yellow/orange/green/blue/red/white;
 * the site's default scheme differs, while the piece structure is identical.
 */
export const IVY_3Y_SUPPLEMENT = {
  alg: "L' R L R' L' R' L R'",
  setup: "R L' R L R L' R' L",
  topFaceSteps: 3,
  expectedCenters: [0, 3, 1, 2, 4, 5],
  expectedCorners: [2, 0, 0, 0],
} as const;
