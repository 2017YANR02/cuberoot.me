import { Alg } from 'cubing/alg';
import type { LocalizedText } from './chapters';
const text = (zh: string, en: string): LocalizedText => ({ zh, en });

export const F2L_TOP_ADJUSTMENTS = ["U'", 'U2', 'U'] as const;

/** Case names follow /alg/3x3/f2l. The teacher retains these four three-move
 * insertions; future cases start with the catalog's first alg and may be curated
 * to pass through a basic case. Keep order and copy editable here. */
export const F2L_CASES = [
  {
    id: 'r-u-r', name: 'B+', alg: "(R) (U) (R')", title: text('B+：顶层顺转', 'B+: U clockwise'),
    observe: text('对照模型，找到带底色的目标角和与它对应的棱。这个标态用 R、U、R′ 三步完成。', 'Find the corner carrying the bottom color and its matching edge in the model. This case finishes with R, U, R′.'),
    stageTitles: [
      text('初始状态 · B+', 'Initial state · B+'),
      text('右面顺时针转，抬起FR槽的同时，恰好组合好了目标棱、角。', 'Turn the right face clockwise to lift the FR slot and pair the target edge and corner at the same time.'),
      text('顶面顺时针转，把棱角对送入槽内。', 'Turn the top face clockwise to move the pair into the slot.'),
      text('右面逆时针归位。', 'Turn the right face back counterclockwise.'),
    ],
  },
  {
    id: 'r-ui-r', name: 'A+', alg: "(R) (U') (R')", title: text('A+：顶层逆转', 'A+: U counterclockwise'),
    observe: text('仍然还原右前槽，但这次顶层要反方向转。先比较模型中角、棱的位置，再看动作。', 'The target is still FR, but the top turns the other way. Compare the corner and edge positions before playing.'),
    stageTitles: [
      text('初始状态 · A+', 'Initial state · A+'),
      text('右面顺时针转，抬起FR槽。', 'Turn the right face clockwise to lift the FR slot.'),
      text('顶面逆时针转，把棱角对送入槽内。', 'Turn the top face counterclockwise to move the pair into the slot.'),
      text('右面逆时针归位。', 'Turn the right face back counterclockwise.'),
    ],
  },
  {
    id: 'fi-ui-f', name: 'B-', alg: "(F') (U') (F)", title: text('B-：顶层逆转', 'B-: U counterclockwise'),
    observe: text('这次从前面打开槽位，目标仍是右前方。对照底色贴纸的位置，观察它与棱的关系。', 'Open the slot from the front, keeping FR as the target. Locate the bottom-color sticker and compare the corner with the edge.'),
    stageTitles: [
      text('初始状态 · B-', 'Initial state · B-'),
      text('前面逆时针转，抬起FR槽的同时，恰好组合好了目标棱、角。', 'Turn the front face counterclockwise to lift the FR slot and pair the target edge and corner at the same time.'),
      text('顶面逆时针转，把棱角对送入槽内。', 'Turn the top face counterclockwise to move the pair into the slot.'),
      text('前面顺时针归位。', 'Turn the front face back clockwise.'),
    ],
  },
  {
    id: 'fi-u-f', name: 'A-', alg: "(F') (U) (F)", title: text('A-：顶层顺转', 'A-: U clockwise'),
    observe: text('与另一种 F 类标态对照：打开和关闭槽位的动作相同，中间改用 U。', 'Compare with the other F case: the opening and closing turns stay the same; the middle move is U.'),
    stageTitles: [
      text('初始状态 · A-', 'Initial state · A-'),
      text('前面逆时针转，抬起FR槽。', 'Turn the front face counterclockwise to lift the FR slot.'),
      text('顶面顺时针转，把棱角对送入槽内。', 'Turn the top face clockwise to move the pair into the slot.'),
      text('前面顺时针归位。', 'Turn the front face back clockwise.'),
    ],
  },
] as const;

/** Practice from solved F2L; only FR is disturbed. Choose randomly after mount or on user action. */
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


/** One display order for recognition, alignment and three-move teaching. */
export const ORDERED_BASIC_CASES = ['A+', 'A-', 'B+', 'B-'].map(name => F2L_CASES.find(item => item.name === name)!);
export type BasicCaseId = typeof F2L_CASES[number]['id'];
