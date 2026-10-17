import { Alg, Grouping } from 'cubing/alg';
import { resolveSimPreviewMoves } from '@/components/AlgPlayer/player-setup';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { FM_REGULAR, FM_IGNORED, stickeringMaskFn, type StickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { CUBE_COLOR_LETTER_FOR_FACE, type CubeFace } from '@/lib/cube-colors';
import { orientedFaceColors } from '@/lib/cube-orientation';

type Text = { zh: string; en: string };
const text = (zh: string, en: string): Text => ({ zh, en });

export const F2L_STEPS = [
  { id: 'intro', title: text('初识 F2L', 'Meet F2L'),
    summary: text('我已经学会层先法复原魔方啦，有没有更厉害的解法？我要进步！', 'I can solve the cube with LBL now. Is there a more advanced method? I want to get better!') },
  { id: 'basic-cases', title: text('F2L 的四种三步标态', 'Four three-move cases'),
    summary: text('前2层竟然可以同时复原？！给我看看要怎么做。', 'The first two layers can be solved together?! Show me how!') },
  { id: 'top-adjustment', title: text('顶面调整', 'Top-layer alignment'),
    summary: text('我的魔方和图案有点像，却又不完全一样。转一下顶层，会不会就是熟悉的标态？', 'My cube looks similar to the picture, but not quite the same. Could a top-layer turn bring it to a familiar case?') },
  { id: 'basic-insertions', title: text('三步标态教学', 'Learn the three-move cases'),
    summary: text('我已经认得这四种图案了！到底是哪三步？我想看看每一步是怎么把棱角送回槽里的。', 'I recognize these four pictures now! What are the three moves? I want to see how each one brings the edge and corner into their slot.') },
  { id: 'lesson-5', title: text('练习三步标态', 'Practice three-move cases'),
    summary: text('我看懂了！可是真拿起魔方，我能认出来、自己做出来吗？我要试一试！', 'I understand it now! But with a real cube in my hands, can I recognize the case and solve it myself? I want to try!') },
  { id: 'lesson-6', title: text('认识其他标态', 'Meet the other standard cases'),
    summary: text('我会这四种了，可其他情况长什么样？我想先认一认，看看还会遇到哪些图案。', 'I know these four cases now, but what do the others look like? I want to get a feel for the other patterns I might encounter.') },
  { id: 'lesson-7', title: text('非标到标态的转化', 'From non-standard to standard cases'),
    summary: text('我现在遇到的情况好像不属于刚刚展示的任何一种，怎么办？', 'My current case doesn’t seem to match any of the ones just shown. What should I do?') },
  { id: 'lesson-8', title: text('学习 F2L 公式（一）', 'Learn F2L algorithms (1)'),
    summary: text('这次不是我熟悉的四种图案了。我能不能把它变成已经会的三步标态，再还原呢？', 'This is not one of the four patterns I know. Can I turn it into a familiar three-move case and solve it from there?') },
  { id: 'lesson-9', title: text('学习 F2L 公式（二）', 'Learn F2L algorithms (2)'),
    summary: text('这个情况好像更复杂了！我能不能先把它变成上一章学过的样子，再接着做下去？', 'This case looks more complicated! Can I first turn it into one from the last chapter, then carry on with what I already know?') },
  { id: 'experiment', title: text('自由练习', 'Free practice'),
    summary: text('我在练习了，快助我一臂之力！', 'I’m practicing now—give me a hand!') },
] as const;

/** Four insertions in successive slots; the final y restores the original frame. */
export const F2L_INTRO_ALG = "(R U R') y (R U' R') y (F' U' F) y (F' U F) y";
// Piece identities in the solved frame: FR → BR → BL → FL under successive y turns.
const INTRO_PAIRS = [[20, 23], [2, 5], [0, 3], [18, 21]];
const introBaseMask = stickeringMaskFn(3, 'F2LPair')!;
export function f2lIntroStickering(step: number): StickeringMaskFn {
  return introStickeringForPairs(Math.min(4, Math.floor(step / 4) + 1));
}
function introStickeringForPairs(count: number): StickeringMaskFn {
  const visible = new Set(INTRO_PAIRS.slice(0, count).flat());
  return (initial, face) => visible.has(initial) ? FM_REGULAR
    : INTRO_PAIRS.flat().includes(initial) ? FM_IGNORED : introBaseMask(initial, face);
}
export const F2L_TOP_ADJUSTMENTS = ["U'", 'U2', 'U'] as const;

/** The shifted case reaches the canonical picture after alignment, without inserting it. */
export function f2lAlignmentSetup(alg: string, alignment: string): string {
  return `${new Alg(alg).invert().expand()} ${new Alg(alignment).invert()}`;
}

/** Use the animation's exact piece mask for the existing SVG renderer too. */
export function f2lDiagramFacelets(setup: string, orientation: string, mask = stickeringMaskFn(3, 'F2LPair')!): string {
  const cube = new Cube(3);
  try {
    cube.twister.setup(setup);
    const masks = cube.serializeStickering(mask);
    const colors = orientedFaceColors(orientation);
    return [...cube.serialize()].map((face, index) => masks[index] === FM_REGULAR
      ? CUBE_COLOR_LETTER_FOR_FACE[colors[face as CubeFace]].toLowerCase() : 'd').join('');
  } finally { cube.dispose(); }
}

export function f2lGoalDiagrams(orientation: string): [string, string, string] {
  const cross = introStickeringForPairs(0);
  const corners = new Set(INTRO_PAIRS.map(([corner]) => corner));
  const bottomLayer: StickeringMaskFn = (initial, face) => corners.has(initial) ? FM_REGULAR : cross(initial, face);
  return [
    f2lDiagramFacelets('', orientation, cross),
    f2lDiagramFacelets('', orientation, bottomLayer),
    f2lDiagramFacelets('', orientation, introStickeringForPairs(4)),
  ];
}

/** Top-level parentheses are lesson sections. Nested groups/repeats retain their alg semantics. */
export function f2lPlaybackSections(alg: string) {
  const sections: { alg: string; start: number; end: number }[] = [];
  let loose: string[] = [];
  let end = 0;
  const append = (source: string) => {
    const count = resolveSimPreviewMoves('3x3', source).length;
    if (count) { sections.push({ alg: source, start: end, end: end + count }); end += count; }
  };
  const flush = () => { append(loose.join(' ')); loose = []; };
  for (const node of new Alg(alg).childAlgNodes()) {
    if (node instanceof Grouping) { flush(); append(node.toString()); }
    else loose.push(node.toString());
  }
  flush();
  return sections;
}

const rightOpen = text('右面顺时针转 90°，打开右前槽。观察目标棱、角的位置变化。', 'Turn R clockwise to open the front-right slot. Watch how the target corner and edge move.');
const rightClose = text('右面转回，把目标棱角放入右前槽。检查底十字恢复，棱角侧色与中心一致。', 'Turn the right face back to bring the target corner and edge into FR. Check that the cross is restored and the side colors match the centers.');
const frontOpen = text('前面逆时针转 90°，打开右前槽。留意目标块与顶层的关系。', 'Turn F counterclockwise to open the front-right slot. Watch the target pieces relative to the top layer.');
const frontClose = text('前面转回，让棱角一起归位。检查右前槽两侧颜色，以及底十字。', 'Restore the front face to solve the pair. Check both sides of the FR slot and the bottom cross.');

/** Case names follow /alg/3x3/f2l. The teacher retains these four three-move
 * insertions; future cases start with the catalog's first alg and may be curated
 * to pass through a basic case. Keep order and copy editable here. */
export const F2L_CASES = [
  {
    id: 'r-u-r', name: 'B+', alg: "(R) (U) (R')", title: text('B+：顶层顺转', 'B+: U clockwise'),
    observe: text('对照模型，找到带底色的目标角和与它对应的棱。这个标态用 R、U、R′ 三步完成。', 'Find the corner carrying the bottom color and its matching edge in the model. This case finishes with R, U, R′.'),
    guidance: [rightOpen, text('从顶面看，顺时针转 U。观察两块的相对位置，为右面转回准备。', 'Looking at the top, turn U clockwise. Watch how the two pieces line up for the closing turn.'), rightClose],
  },
  {
    id: 'r-ui-r', name: 'A+', alg: "(R) (U') (R')", title: text('A+：顶层逆转', 'A+: U counterclockwise'),
    observe: text('仍然还原右前槽，但这次顶层要反方向转。先比较模型中角、棱的位置，再看动作。', 'The target is still FR, but the top turns the other way. Compare the corner and edge positions before playing.'),
    guidance: [rightOpen, text('从顶面看，逆时针转 U′。与上一种标态比较，区别在这一步的方向。', 'Looking at the top, turn U′ counterclockwise. Compare this direction with the other R case.'), rightClose],
  },
  {
    id: 'fi-ui-f', name: 'B-', alg: "(F') (U') (F)", title: text('B-：顶层逆转', 'B-: U counterclockwise'),
    observe: text('这次从前面打开槽位，目标仍是右前方。对照底色贴纸的位置，观察它与棱的关系。', 'Open the slot from the front, keeping FR as the target. Locate the bottom-color sticker and compare the corner with the edge.'),
    guidance: [frontOpen, text('从顶面看，逆时针转 U′。观察目标块怎样来到前面转回能接住的位置。', 'Looking at the top, turn U′ counterclockwise. Watch the target pieces move into position for F.'), frontClose],
  },
  {
    id: 'fi-u-f', name: 'A-', alg: "(F') (U) (F)", title: text('A-：顶层顺转', 'A-: U clockwise'),
    observe: text('与另一种 F 类标态对照：打开和关闭槽位的动作相同，中间改用 U。', 'Compare with the other F case: the opening and closing turns stay the same; the middle move is U.'),
    guidance: [frontOpen, text('从顶面看，顺时针转 U。看清目标块的位置变化，再做最后一步。', 'Looking at the top, turn U clockwise. Observe the new positions before making the final turn.'), frontClose],
  },
] as const;

/** Practice from solved F2L; only FR is disturbed. Random selection happens on user action. */
export const F2L_PRACTICE_CASES = F2L_CASES.flatMap(lesson => ['', 'U', 'U2', "U'"].map(adjustment => {
  const insertion = new Alg(lesson.alg).expand().toString();
  const alg = [adjustment && `(${adjustment})`, `(${insertion})`].filter(Boolean).join(' ');
  return {
    id: lesson.id + ':' + adjustment,
    alg,
    setup: new Alg(alg).invert().expand().toString(),
    boundaries: adjustment ? [1] : [],
  };
}));
