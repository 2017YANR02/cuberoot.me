import { Alg } from 'cubing/alg';
import { AllFaces, CubeData, Face, parseAlgorithm } from '@cuberoot/visualcube';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { CORNER_POSITION, EDGE_POSITION_LEFT, EDGE_POSITION_RIGHT, LEFT, LEFT_SUNE, LBL_STEPS, MIDDLE_LEFT, MIDDLE_RIGHT, MIDDLE_MISPLACED_SETUP, RIGHT, RIGHT_SUNE } from './content';
import { LBL_LESSON_RUNS, LBL_LESSON_STAGE_IDS, lessonFrame, type LblLessonRun, type LblLessonStageId } from './lesson-runs';
import { buildYellowCrossDemo, YELLOW_CROSS_DEMO_SETUPS, yellowCrossRecognitionStickers } from './yellow-cross-demo-state';
import { getLblAlgGroups } from './alg-cues';
import type { LblExample } from './content';

type Text = { zh: string; en: string };
const t = (zh: string, en: string): Text => ({ zh, en });
export type DemoContent = { text: Text; detail?: Text; alg?: string; caseIndex?: number; outlines?: string[]; touchSticker?: boolean };
export type DemoView = 'home' | 'bottom' | 'left' | 'right' | 'back' | 'slight-left';
export type DemoPhase = { start: number; end: number; observe?: Text; recognize?: DemoContent; act: DemoContent; view?: DemoView; moveView?: DemoView; returnView?: DemoView; frontFaceArrow?: { from: number; to: number }; recognitionDurationMs?: number; recognizeOnly?: boolean };
export type CompleteDemo = { setup: string; alg: string; phases: DemoPhase[]; done: Text };
export const COMPLETE_DEMO_STAGES = ['daisy', 'corners', 'middle', 'yellow-cross', 'yellow-face', 'corner-position', 'edge-position'] as const;
export type CompleteDemoStage = typeof COMPLETE_DEMO_STAGES[number];
const turns = ['', 'U', 'U2', "U'"];
const rotations = ['', 'y', 'y2', "y'"];
const lowerTurns = ['', 'd', 'd2', "d'"];
const sides = [Face.F, Face.R, Face.B, Face.L];
const edgeIndices = [1, 3, 5, 7];
const cornerIndices = [0, 2, 6, 8];
const expand = (alg: string) => new Alg(alg).expand().toString();
const movesOf = (alg: string) => expand(alg).split(/\s+/).filter(Boolean);
const join = (...algs: string[]) => algs.filter(Boolean).join(' ');

// Two bottom-corner cycles leave the cross untouched and all four white corners
// in the bottom layer, but in the wrong slots. This setup is never taught as a move.
const cornerCycle = "x R' U R' D2 R U' R' D2 R2 x'";
// Keep the blue/red corner at DFR while DBR stays solved and visible.
export const BLUE_RED_BOTTOM_CORNER_SETUP = `x2 y (${cornerCycle})' y' x2`;
export const CORNER_DEMO_EXTREME_SETUP = `x2 ${cornerCycle} y ${cornerCycle} y' x2`;
// Twist two bottom corners without changing their slots or the solved cross.
const cornerTwist = "R' D' R D";
const cornerExtremeSetups = ['U', "U'"].map(u =>
  `${CORNER_DEMO_EXTREME_SETUP} x2 (${cornerTwist})2 ${u} (${cornerTwist})4 ${new Alg(u).invert()} x2`);
// Swap each opposite pair of middle slots; all four middle edges are misplaced.
export const MIDDLE_DEMO_EXTREME_SETUP = `${MIDDLE_MISPLACED_SETUP} y2 ${MIDDLE_MISPLACED_SETUP} y2`;

// Sticker identities survive every move, so outlines follow the same pieces as the lesson.
function state(alg: string) {
  const cube = new CubeData(3, Object.fromEntries(AllFaces.map(face =>
    [face, Array.from({ length: 9 }, (_, index) => `${Face[face]}${index}`)])));
  for (const move of parseAlgorithm(expand(alg))) cube.turn(move);
  return cube;
}
type Cube = ReturnType<typeof state>;
export function daisyBlockedStickers(setup: string): string[] {
  const cube = state(setup);
  return [cube.faces[Face.F][5], cube.faces[Face.U][5]];
}
export function rightTopCornerStickers(alg: string): string[] {
  const cube = state(alg);
  return [cube.faces[Face.U][8], cube.faces[Face.U][2], cube.faces[Face.R][0], cube.faces[Face.R][2], cube.faces[Face.F][2], cube.faces[Face.B][0]];
}
export function bottomCornerPreview(alg: string) {
  const cube = state(alg);
  const highlights = [cube.faces[Face.F][8], cube.faces[Face.R][6], cube.faces[Face.D][2]];
  const visible = new Set(highlights);
  sides.forEach((face, index) => {
    const slots = [[face, 8], [sides[(index + 1) % 4], 6], [Face.D, [2, 8, 6, 0][index]]] as const;
    if (slots.every(([face, index]) => matches(cube, face, index))) {
      for (const [face, index] of slots) visible.add(cube.faces[face][index]);
    }
  });
  const hiddenStickers = AllFaces.flatMap(face => cornerIndices.map(index => `${Face[face]}${index}`))
    .filter(id => !visible.has(id));
  return { highlights, hiddenStickers, centers: [cube.faces[Face.F][4], cube.faces[Face.R][4]] };
}
/** Front edge, center and solved bottom row form the middle-layer inverted T. */
export function middleAlignmentStickers(setup: string): string[] {
  const cube = state(setup);
  return [1, 4, 6, 7, 8].map(index => cube.faces[Face.F][index]);
}
export function middleEdgePreview(setup: string) {
  const cube = state(setup);
  return {
    highlights: [cube.faces[Face.F][5], cube.faces[Face.R][3]],
    centers: [cube.faces[Face.F][4], cube.faces[Face.R][4]],
    hiddenStickers: [],
  };
}
export function middleDirectionStickers(setup: string, left: boolean): string[] {
  const cube = state(setup);
  return [
    cube.faces[Face.U][7], cube.faces[Face.F][1],
    cube.faces[Face.F][left ? 3 : 5], cube.faces[left ? Face.L : Face.R][left ? 5 : 3],
  ];
}
/** Keep only the lesson's target middle edge colored, following home sticker identities. */
export function middleLessonHiddenStickers(setup: string): string[] {
  const cube = state(setup);
  const target = new Set([cube.faces[Face.U][7], cube.faces[Face.F][1]]);
  return ['F3', 'F5', 'R3', 'R5', 'B3', 'B5', 'L3', 'L5'].filter(sticker => !target.has(sticker));
}
/** Current home identity at the left-thumb observation position. */
export const yellowFaceTouchSticker = (alg: string) => state(alg).faces[Face.F][0];
export function yellowFaceNonYellowStickers(alg: string, hidden: readonly string[] = []): string[] {
  const cube = state(alg);
  return [0, 2, 6, 8].map(index => cube.faces[Face.U][index]).filter(id => id[0] !== 'U' || hidden.includes(id));
}
export function yellowFishRecognitionStickers(alg: string, left: boolean): string[] {
  const cube = state(alg);
  return [cube.faces[Face.U][left ? 8 : 6], cube.faces[Face.F][left ? 0 : 2]];
}
const color = (cube: Cube, face: Face, i: number) => cube.faces[face][i][0];
const center = (cube: Cube, face: Face) => color(cube, face, 4);
const matches = (cube: Cube, face: Face, i: number) => color(cube, face, i) === center(cube, face);
const petals = (cube: Cube) => edgeIndices.map(i => cube.faces[Face.U][i]).filter(id => id[0] === 'D');
const firstLayer = (cube: Cube) => cube.faces[Face.D].every((_, i) => matches(cube, Face.D, i))
  && sides.every(face => [6, 7, 8].every(i => matches(cube, face, i)));
const firstTwoLayers = (cube: Cube) => firstLayer(cube) && sides.every(face => [3, 5].every(i => matches(cube, face, i)));
const yellowCross = (cube: Cube) => edgeIndices.every(i => matches(cube, Face.U, i));
const yellowFace = (cube: Cube) => cube.faces[Face.U].every((_, i) => matches(cube, Face.U, i));
const topCorners = (cube: Cube) => sides.every(face => [0, 2].every(i => matches(cube, face, i)));
const solved = (cube: Cube) => AllFaces.every(face => cube.faces[face].every((_, i) => matches(cube, face, i)));
const bottomCornerCount = (cube: Cube) => sides.filter((face, i) =>
  matches(cube, face, 8) && matches(cube, sides[(i + 1) % 4], 6)
  && matches(cube, Face.D, [2, 8, 6, 0][i])).length;
const middleEdgeCount = (cube: Cube) => sides.filter((face, i) =>
  matches(cube, face, 5) && matches(cube, sides[(i + 1) % 4], 3)).length;
const grayCount = (cube: Cube) => cornerIndices.filter(i => !matches(cube, Face.U, i)).length;
const yellowCornerSignature = (cube: Cube) => [Face.U, ...sides].flatMap(face =>
  (face === Face.U ? cornerIndices : [0, 2]).map(i => color(cube, face, i) === 'U' ? '1' : '0')).join('');
const eyes = (cube: Cube) => sides.filter(face => color(cube, face, 0) === color(cube, face, 2));
const walls = (cube: Cube) => sides.filter(face => [0, 1, 2].every(i => matches(cube, face, i)));

export function demoGoalReached(stage: string, alg: string): boolean {
  const cube = state(alg);
  switch (stage) {
    case 'daisy': return petals(cube).length === 4;
    case 'cross': return sides.every(face => matches(cube, face, 7)) && edgeIndices.every(i => matches(cube, Face.D, i));
    case 'corners': return firstLayer(cube);
    case 'middle': return firstTwoLayers(cube);
    case 'yellow-cross': return firstTwoLayers(cube) && yellowCross(cube);
    case 'yellow-face': return firstTwoLayers(cube) && yellowFace(cube);
    case 'corner-position': return firstTwoLayers(cube) && yellowFace(cube) && topCorners(cube);
    case 'edge-position': return solved(cube);
    default: return false;
  }
}

const observe: Record<CompleteDemoStage, Text> = {
  daisy: t('先找二楼的白棱。', 'Look for white edges on the middle floor first.'),
  corners: t('先在顶层找白角。', 'Look for white corners in the top layer first.'),
  middle: t('先在顶层找不带黄色的棱。', 'Look on top for an edge without yellow.'),
  'yellow-cross': t('先看顶层四条棱。', 'Look at the four top edges.'),
  'yellow-face': t('数一数顶面的非黄角格。', 'Count the non-yellow top corner stickers.'),
  'corner-position': t('看侧面，找两端同色的“眼”。', 'Look for matching corner stickers: headlights.'),
  'edge-position': t('看侧面，找三个同色格组成的墙。', 'Look for a wall of three matching stickers.'),
};
const done: Record<CompleteDemoStage, Text> = {
  daisy: t('四片白花瓣，小花完成。', 'Four white petals: the daisy is complete.'),
  corners: t('四个白角归位，底层完成。', 'All four white corners are in place. First layer complete.'),
  middle: t('四条中层棱归位，前两层完成。', 'All four middle edges are in place. First two layers complete.'),
  'yellow-cross': t('四条棱朝黄，黄十字完成。', 'Four yellow edges: the cross is complete.'),
  'yellow-face': t('所有黄色朝上，黄面完成。', 'All yellow stickers face up. Yellow face complete.'),
  'corner-position': t('四个顶角与侧面中心对齐。', 'All four top corners match the side centers.'),
  'edge-position': t('六面同色，魔方复原。', 'Every face has one color. Cube solved.'),
};

export function buildFishDemo(left: boolean): CompleteDemo {
  const formula = left ? LEFT_SUNE : RIGHT_SUNE;
  const adjustment = left ? 'U' : 'U U';
  const formulaStart = left ? 1 : 2;
  const setup = join(new Alg(formula).invert().toString(), left ? "U'" : 'U2');
  const alg = join(adjustment, formula);
  const count: DemoContent = {
    text: t('顶面有 3 个非黄角格，是小鱼，继续观察。', 'Three non-yellow corner stickers on top. It is a fish shape. Look closer.'),
    outlines: yellowFaceNonYellowStickers(setup),
  };
  const start = state(setup);
  const head = cornerIndices.map(index => start.faces[Face.U][index]).find(id => id[0] === 'U')!;
  const fish: DemoContent = {
    text: left
      ? t('鱼头朝前，前面左上角有鱼鳍，是左鱼。', 'The head is at the front and the fin is at the top-left of the front face. This is a left fish.')
      : t('鱼头朝前，前面右上角有鱼鳍，是右鱼。', 'The head is at the front and the fin is at the top-right of the front face. This is a right fish.'),
    outlines: yellowFishRecognitionStickers(join(setup, adjustment), left),
  };
  const phases: DemoPhase[] = [
    { start: 0, end: 0, recognize: count, act: count, recognizeOnly: true },
    { start: 0, end: 1, act: { text: t('鱼头朝后，需要调整。', 'The head is at the back. Turn the top layer.'), alg: 'U', outlines: [head] } },
  ];
  if (!left) phases.push({ start: 1, end: 2, act: { text: t('鱼头朝前，但前面没有鱼鳍，继续调整。', 'The head is at the front, but there is no fin on the front face. Turn the top layer again.'), alg: 'U', outlines: [head] } });
  phases.push(
    { start: formulaStart, end: formulaStart, recognize: fish, act: fish, recognizeOnly: true },
    { start: formulaStart, end: movesOf(alg).length, view: left ? 'slight-left' : undefined, act: {
      text: left ? t('左鱼用左手做公式。', 'Do left Sune with your left hand.')
        : t('右鱼用右手做公式。', 'Do right Sune with your right hand.'),
      alg: formula,
    } },
  );
  return {
    setup, alg, phases, done: done['yellow-face'],
  };
}

/** Inspect actual side faces in order, stopping at a visible wall before outlining it. */
export function wallScanPhases(alg: string, start: number, caseIndex: number): DemoPhase[] {
  const cube = state(alg);
  const found = walls(cube);
  const views: DemoView[] = ['home', 'right', 'back', 'left'];
  const labels = [t('看前面，找三个同色格。', 'Check the front for three matching stickers.'), t('转视角，看右面有没有墙。', 'Turn the view to check the right side for a wall.'), t('继续转视角，看背面有没有墙。', 'Keep turning the view to check the back.'), t('再看左面有没有墙。', 'Check the left side as well.')];
  const phases: DemoPhase[] = [];
  let wall: Face | undefined;
  for (const [i, face] of sides.entries()) {
    phases.push({ start, end: start, view: views[i], act: { text: labels[i] } });
    if (found.includes(face)) { wall = face; break; }
  }
  const recognition = wall === undefined ? { text: t('四面都没有墙，先做公式造墙。', 'No wall on any side. Use an algorithm to create one.'), caseIndex }
    : { text: t('找到墙：这三个格颜色相同。', 'Found a wall: these three stickers match.'), caseIndex, outlines: [0, 1, 2].map(i => cube.faces[wall!][i]) };
  phases.push({ start, end: start, recognize: recognition, act: recognition, recognizeOnly: true });
  return phases;
}

function edgeAlgorithmPhases(alg: string, start: number, caseIndex: number): DemoPhase[] {
  return getLblAlgGroups('edge-position', alg).map(group => {
    const first = group[0];
    const body = group.map(move => move.notation).join(' ');
    const text = /^y/.test(first.notation) ? caseIndex === 2 ? t('沿当前朝向起手，先造墙。', 'Start from this orientation and create a wall.') : t('把墙直接放到后面。', 'Move the wall directly to the back.')
      : group.length === 7 ? (first.notation.startsWith('R') ? t('做右鱼公式。', 'Do right Sune.') : t('做左鱼公式。', 'Do left Sune.'))
        : group[group.length - 1].index === movesOf(alg).length - 1 ? t('转顶层对齐。', 'Align the top layer.') : t('转顶层调整。', 'Adjust the top layer.');
    return { start: start + first.index, end: start + group[group.length - 1].index + 1,
      act: { text, alg: /^y/.test(first.notation) ? undefined : body, caseIndex }, moveView: /^y/.test(first.notation) ? 'home' : undefined };
  });
}

export function buildEdgePositionExample(example: LblExample, index: number): CompleteDemo {
  const setup = expand(resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false));
  const alg = expand(example.alg);
  const phases = [...wallScanPhases(setup, 0, index), ...edgeAlgorithmPhases(alg, 0, index)];
  const finished = demoGoalReached('edge-position', join(setup, alg));
  if (!finished) phases.push(...wallScanPhases(join(setup, alg), movesOf(alg).length, index));
  return { setup, alg, phases, done: finished ? done['edge-position']
    : t('已造出墙，选择对应情况继续。', 'A wall is ready. Choose the matching case to continue.') };
}

export function edgeDirectionObservation(setup: string, left: boolean) {
  const cube = state(setup);
  const side = left ? Face.L : Face.R;
  return [0, 1, 2].map(index => cube.faces[side][index]);
}

function yellowCrossDemo(setup: string): CompleteDemo {
  const demo = buildYellowCrossDemo(setup);
  return { setup, alg: demo.alg, done: done['yellow-cross'], phases: demo.phases.map((phase, index) => {
    const caseIndex = { line: 0, elbow: 1, dot: 2 }[phase.kind];
    const recognition = phase.kind === 'dot' ? t('没有黄棱朝上。', 'No yellow edges face up.')
      : phase.kind === 'line' ? t('两条黄棱成直线。', 'Two yellow edges form a line.')
        : t('两条黄棱相邻。', 'Two adjacent yellow edges face up.');
    const next = phase.alignment ? t('需要调整顶面朝向。', 'The top layer needs to be reoriented.')
      : phase.actionKind === 'line' ? t('做横线公式。', 'Do the line algorithm.') : t('做三点半公式。', 'Do the L-shape algorithm.');
    return {
      start: phase.start, end: phase.end,
      observe: !demo.phases[index - 1]?.alignment ? (index === 0 ? observe['yellow-cross'] : t('还没完成，再观察四条棱。', 'Not finished. Check the four edges again.')) : undefined,
      recognize: !demo.phases[index - 1]?.alignment ? { text: recognition, detail: next, caseIndex,
        outlines: yellowCrossRecognitionStickers(join(setup, demo.alg.split(' ').slice(0, phase.start).join(' '))) } : undefined,
      act: phase.alignment ? {
        text: phase.kind === 'line' ? t('转顶层，把线横着放。', 'Turn the top to make the line horizontal.') : t('转顶层，黄棱放前和右。', 'Turn the top: yellow edges at front and right.'),
        detail: phase.kind === 'line' ? t('形成横线。', 'Form a horizontal line.') : t('形成“三点半”。', 'Form the L-shape.'), caseIndex,
      } : { text: phase.actionKind === 'line' ? t('做“压、右公式、提”。', 'Do F, the right trigger, then F′.') : t('做“双压、右公式、双提”。', 'Do f, the right trigger, then f′.'), alg: phase.alg, caseIndex },
    };
  }) };
}

export function buildCompleteDemo(stage: CompleteDemoStage, setup: string, followEjectedCorner = false): CompleteDemo {
  if (stage === 'yellow-cross') return yellowCrossDemo(setup);
  const moves: string[] = [];
  const phases: DemoPhase[] = [];
  const currentAlg = () => join(setup, moves.join(' '));
  const current = () => state(currentAlg());
  const look = (text: Text) => phases.push({
    start: moves.length, end: moves.length, observe: text, act: { text }, recognizeOnly: true,
  });
  const add = (alg: string, act: DemoContent, recognize?: DemoContent, view?: DemoView) => {
    const start = moves.length;
    moves.push(...movesOf(alg));
    const phase: DemoPhase = { start, end: moves.length, act, recognize, observe: recognize && !['daisy', 'corners', 'yellow-face'].includes(stage) ? observe[stage] : undefined, view };
    phases.push(phase);
  };
  const action = (alg: string, text: Text, caseIndex: number, recognize?: DemoContent, showAlg = true) =>
    add(alg, { text, alg: showAlg ? alg : undefined, caseIndex }, recognize);
  const recognize = (text: Text, caseIndex: number, outlines: string[] = []): DemoContent => ({ text, caseIndex, outlines });
  const prepare = (alg: string, text: Text, caseIndex: number, recognition?: DemoContent) => {
    if (alg) action(alg, text, caseIndex, recognition, false);
    return alg ? undefined : recognition;
  };
  const inspectPiece = (ids: string[], caseIndex: number, recognition: DemoContent): DemoContent | undefined => {
    const cube = current();
    const white = ids.find(id => id[0] === 'D');
    const face = white === undefined ? undefined : AllFaces.find(face => cube.faces[face].includes(white));
    const view: DemoView | undefined = face === Face.D ? 'bottom' : face === Face.L ? 'left' : face === Face.B ? 'back' : undefined;
    if (!view) return recognition;
    // Daisy side inspection uses the real working rotation below.
    if (stage === 'daisy' && view !== 'bottom') return recognition;
    const text = stage === 'daisy'
      ? t('翻到能看见底面的角度。', 'Tilt the cube to see the bottom.')
      : view === 'bottom' ? t('看看底层白角的位置和朝向。', 'Check the position and orientation of the bottom white corners.')
        : view === 'left' ? t('换个角度，看看左侧的白角。', 'Change the view to inspect the white corner on the left.') : t('换个角度，看看背面的白角。', 'Change the view to inspect the white corner at the back.');
    add('', { text, caseIndex }, undefined, view);
    phases.push({ start: moves.length, end: moves.length, recognize: recognition, act: recognition, recognizeOnly: true,
      returnView: 'home' });
    return undefined;
  };

  let inspectingHiddenPiece = false;
  let ejectedCornerWhite: string | undefined;
  let middleScanPetalCount = -1;
  for (let round = 0; round < 24 && !demoGoalReached(stage, currentAlg()); round++) {
    const cube = current();
    const base = currentAlg();
    if (!inspectingHiddenPiece && !ejectedCornerWhite && (stage === 'daisy' ? round === 0 : ['corners', 'yellow-face'].includes(stage))) look(observe[stage]);
    const continuingSearch = inspectingHiddenPiece;
    inspectingHiddenPiece = false;
    if (stage === 'daisy') {
      const existing = petals(cube);
      // Side turns select the same right/left viewing angle as the playback timeline.
      const lastSideTurn = moves.findLast(move => /^[RL]/.test(move));
      const visibleSide = lastSideTurn?.startsWith('L') ? Face.L : Face.R;
      const visibleMiddleWhite = [Face.F, visibleSide].some(face =>
        [3, 5].some(index => cube.faces[face][index].startsWith('D')));
      if (!visibleMiddleWhite && middleScanPetalCount !== existing.length) {
        middleScanPetalCount = existing.length;
        action('y2', t('这两面二楼没有白棱，转体看看另外两面。', 'No middle-floor white edges on these two faces. Rotate to check the other two.'), 0, undefined, false);
        continue;
      }
      const candidates: { y: string; u: string; alg: string; id: string; index: number; rank: number }[] = [];
      const halfTurns = ['R2', 'L2', 'F2'];
      const lifts = ['R', "L'", ...turns.flatMap(u => [join('F', u, 'R'), join('F', u, "L'")]), ...halfTurns];
      for (const y of rotations) for (const u of turns) for (const alg of lifts) {
        const after = state(join(base, y, u, alg));
        const next = petals(after);
        if (next.length <= existing.length || !existing.every(id => next.includes(id))) continue;
        const id = next.find(id => !existing.includes(id))!;
        let sourceFace = Face.U, sourceIndex = 0;
        for (const face of AllFaces) {
          const i = cube.faces[face].indexOf(id);
          if (i >= 0) { sourceFace = face; sourceIndex = i; }
        }
        const floor = Math.floor(sourceIndex / 3);
        if (sourceFace === Face.U) continue;
        const withoutTopTurn = petals(state(join(base, y, alg)));
        const blocked = existing.some(id => !withoutTopTurn.includes(id));
        const index = sourceFace === Face.D ? 5 : floor === 1 ? (u && blocked ? 2 : alg === "L'" ? 1 : 0) : floor === 0 ? 3 : 4;
        if ((index === 5 && !halfTurns.includes(alg)) || (index < 3 && !['R', "L'"].includes(alg))
          || ((index === 3 || index === 4) && !alg.startsWith('F '))) continue;
        candidates.push({ y, u, alg, id, index, rank: (index < 3 ? 0 : index === 5 ? 20 : 10) + movesOf(join(y, u, alg)).length });
      }
      const choice = candidates.sort((a, b) => a.rank - b.rank)[0];
      if (!choice) throw new Error('No taught daisy move found');
      if (!continuingSearch && choice.index >= 3) {
        look(t('二楼没有白棱，再找一楼和三楼。', 'No white edges on the middle floor. Check the bottom and top floors next.'));
        if (choice.index === 5) look(t('一楼和三楼也没有，再看地下室。', 'None on those floors either. Check the basement last.'));
      }
      const hiddenFace = [visibleSide === Face.R ? Face.L : Face.R, Face.B].find(face => cube.faces[face].includes(choice.id));
      if (hiddenFace !== undefined) {
        // Inspect with a real rotation, then plan again from the newly visible state.
        const inspection = rotations.find(y => state(join(base, y)).faces[Face.F].includes(choice.id))!;
        action(inspection, hiddenFace === Face.B
          ? t('转过来，看看背面。', 'Rotate the cube to check the back.')
          : hiddenFace === Face.L ? t('转过来，看看左面。', 'Rotate the cube to check the left side.')
            : t('转过来，看看右面。', 'Rotate the cube to check the right side.'), choice.index, undefined, false);
        inspectingHiddenPiece = true;
        continue;
      }
      const labels = [t('白棱在二楼，可以右手上。', 'A white edge is in the middle: lift right.'), t('白棱在二楼，可以左手上。', 'A white edge is in the middle: lift left.'), t('白棱在二楼，顶面的花瓣挡住了。', 'A middle white edge has a petal in its way.'), t('白棱在三楼，先送到二楼。', 'A white edge is on the top floor: bring it to the middle.'), t('白棱在一楼，先送到二楼。', 'A white edge is on the bottom floor: bring it to the middle.'), t('白格朝下，在“地下室”。', 'The white sticker faces down, in the basement.')];
      const placement = choice.alg.startsWith('F')
        ? t('转体，把这条白棱放到前层。', 'Rotate the cube to bring this white edge to the front layer.')
        : choice.alg.startsWith('L')
          ? t('转体，把这条白棱放到左层。', 'Rotate the cube to bring this white edge to the left layer.')
          : t('转体，把这条白棱放到右层。', 'Rotate the cube to bring this white edge to the right layer.');
      let rec: DemoContent | undefined = recognize(choice.index < 3
        ? t('找到二楼白棱。', 'Found a middle-floor white edge.')
        : labels[choice.index], choice.index, [choice.id, cube.faces[Face.U][4]]);
      rec = inspectPiece([choice.id], choice.index, rec);
      rec = prepare(choice.y, placement, choice.index, rec);
      const clearingText = t('转顶层，移开挡住位置的花瓣。', 'Turn the top to move the petal out of the way.');
      const positioningText = t('转顶层，把白棱转到操作位置。', 'Turn the top to position the white edge.');
      const withoutTopTurn = petals(state(join(currentAlg(), choice.alg)));
      const blocked = petals(current()).some(id => !withoutTopTurn.includes(id));
      rec = prepare(choice.u, blocked ? clearingText : positioningText, choice.index, rec);
      if (choice.alg.startsWith('F ')) {
        action('F', t('压前层，把白棱送到二楼。', 'Lower the front to bring the edge to the middle.'), choice.index, rec, false);
        const rest = movesOf(choice.alg).slice(1);
        if (rest.length > 1) {
          const withoutTopTurn = petals(state(join(currentAlg(), rest[rest.length - 1])));
          const blocked = petals(current()).some(id => !withoutTopTurn.includes(id));
          action(rest[0], blocked ? clearingText : positioningText, choice.index, undefined, false);
        }
        action(rest[rest.length - 1], choice.alg.endsWith('R') ? t('右手上，送到黄心旁。', 'Lift right to bring it beside the yellow center.') : t('左手上，送到黄心旁。', 'Lift left to bring it beside the yellow center.'), choice.index, undefined, false);
      } else {
        const liftText = choice.alg === 'R2' ? t('右层转半圈，送到黄心旁。', 'Turn the right face halfway to make a petal.')
          : choice.alg === 'L2' ? t('左层转半圈，送到黄心旁。', 'Turn the left face halfway to make a petal.')
            : choice.alg === 'F2' ? t('前层转半圈，送到黄心旁。', 'Turn the front face halfway to make a petal.')
              : choice.alg === 'R' ? t('右手上，送到黄心旁。', 'Lift right to make a petal.') : t('左手上，送到黄心旁。', 'Lift left to make a petal.');
        action(choice.alg, liftText, choice.index, rec, false);
      }
    } else if (stage === 'corners' || stage === 'middle') {
      const isCorner = stage === 'corners';
      const count = isCorner ? bottomCornerCount : middleEdgeCount;
      const actions = isCorner ? [RIGHT, LEFT, `${RIGHT} ${RIGHT} ${RIGHT}`]
        : [MIDDLE_RIGHT, MIDDLE_LEFT];
      let choice: { u: string; d: string; alg: string; index: number; outlines: string[]; rank: number } | undefined;
      for (const u of turns) for (const d of lowerTurns) for (let index = 0; index < actions.length; index++) {
        const prepared = state(join(base, u, d));
        const valid = isCorner ? index === 0 ? color(prepared, Face.R, 0) === 'D' && matches(prepared, Face.F, 2)
          : index === 1 ? color(prepared, Face.L, 2) === 'D' && matches(prepared, Face.F, 0)
            : color(prepared, Face.U, 8) === 'D' && color(prepared, Face.F, 2) === center(prepared, Face.R) && color(prepared, Face.R, 0) === center(prepared, Face.F)
          : matches(prepared, Face.F, 1) && color(prepared, Face.U, 7) === center(prepared, index === 0 ? Face.R : Face.L) && !['U', 'D'].includes(color(prepared, Face.U, 7));
        if (!valid) continue;
        const result = state(join(base, u, d, actions[index]));
        if (count(result) <= count(cube) || (isCorner ? !demoGoalReached('cross', join(base, u, d, actions[index])) : !firstLayer(result))) continue;
        const outlines = isCorner ? index === 1 ? [prepared.faces[Face.L][2], prepared.faces[Face.F][0], prepared.faces[Face.U][6]] : [prepared.faces[Face.R][0], prepared.faces[Face.F][2], prepared.faces[Face.U][8]] : [prepared.faces[Face.U][7], prepared.faces[Face.F][1]];
        const white = outlines.find(id => id[0] === 'D');
        if (isCorner && ejectedCornerWhite && white !== ejectedCornerWhite) continue;
        const hidden = isCorner && white !== undefined && [Face.L, Face.B].some(face => cube.faces[face].includes(white));
        const rank = isCorner ? (hidden ? 100 : 0) + movesOf(join(u, d)).length : 0;
        if (!choice || rank < choice.rank) choice = { u, d, alg: actions[index], index: isCorner ? [0, 2, 3][index] : index, outlines, rank };
      }
      if (choice) {
        const white = choice.outlines.find(id => id[0] === 'D');
        if (isCorner && white !== undefined && [Face.L, Face.B].some(face => cube.faces[face].includes(white))) {
          const y = rotations.find(y => state(join(base, y)).faces[Face.F].includes(white))!;
          action(y, t('转体，看看刚才看不到的侧面。', 'Rotate the cube to check the sides that were out of view.'), choice.index, undefined, false);
          inspectingHiddenPiece = true;
          continue;
        }
        const text = isCorner ? ejectedCornerWhite ? t('白角已到顶层，观察白格朝向。', 'The corner is now on top. Check which way its white sticker faces.') : choice.index === 3 ? t('找到顶层朝上的白格。', 'Found a white sticker facing up on a top-layer corner.') : t('找到顶层侧面的白格。', 'Found a white sticker on the side of a top-layer corner.')
          : t('找到一条不带黄色的顶层棱。', 'Found a top-layer edge without yellow.');
        let rec: DemoContent | undefined = recognize(text, choice.index, choice.outlines);
        if (isCorner) rec = inspectPiece(choice.outlines, choice.index, rec);
        rec = prepare(choice.u, isCorner ? choice.index === 2
          ? t('转顶层，把白角放到左前上方。', 'Turn the top to put the white corner at top-front-left.')
          : t('转顶层，把白角放到右前上方。', 'Turn the top to put the white corner at top-front-right.')
          : t('转顶层，把这条棱放前。', 'Turn the top to bring the edge to the front.'), choice.index, rec);
        rec = prepare(choice.d, isCorner ? t('转下面两层，让目标位置处于正下方。', 'Turn the lower two layers to put the target slot directly below the corner.') : t('转下面两层，侧色对齐中心，形成倒 T。', 'Turn the lower two layers to match the side color and form an upside-down T.'), choice.index, rec);
        if (isCorner) {
          const alignment = recognize(t('转下面两层，让目标位置处于正下方。', 'Turn the lower two layers to put the target slot directly below the corner.'), choice.index);
          phases.push({ start: moves.length, end: moves.length, recognize: alignment, act: alignment, recognizeOnly: true,
            recognitionDurationMs: 2000, frontFaceArrow: choice.index === 2 ? { from: 0, to: 6 } : { from: 2, to: 8 } });
          rec = undefined;
        }
        if (isCorner && choice.index === 3) {
          rec = recognize(t('白格朝上，用三遍右公式。', 'White faces up. Use the right trigger three times.'), choice.index, choice.outlines);
        }
        if (!isCorner) {
          // Decide left/right only after the visible edge and center form an inverted T.
          if (rec) phases.push({ start: moves.length, end: moves.length, recognize: rec, act: rec, recognizeOnly: true });
          const alignment = recognize(t('侧色对齐中心，形成倒 T。', 'The side color matches its center, forming an upside-down T.'), choice.index, middleAlignmentStickers(currentAlg()));
          phases.push({ start: moves.length, end: moves.length, recognize: alignment, act: alignment, recognizeOnly: true });
          const direction = recognize(choice.index === 0
            ? t('顶面颜色与右侧中心同色，去右。', 'The top sticker matches the right center: insert right.')
            : t('顶面颜色与左侧中心同色，去左。', 'The top sticker matches the left center: insert left.'), choice.index, choice.outlines);
          phases.push({ start: moves.length, end: moves.length, recognize: direction, act: direction, recognizeOnly: true });
          rec = undefined;
        }
        action(choice.alg, isCorner ? choice.index === 3 ? t('做三遍右公式。', 'Do the right trigger three times.') : choice.index === 2 ? t('做左公式。', 'Do the left trigger.') : t('做右公式。', 'Do the right trigger.')
          : choice.index === 0 ? t('右手拨、右公式、左转体、左公式。', 'U, right trigger, rotate left, left trigger.') : t('左手拨、左公式、右转体、右公式。', 'U′, left trigger, rotate right, right trigger.'), choice.index, rec);
        ejectedCornerWhite = undefined;
      } else {
        // No insertable top piece: eject a misplaced piece with the taught action, then reassess.
        if (isCorner) look(t('顶层没有白角，再找底层没归位的白角。', 'No white corners in the top layer. Look for an unsolved white corner in the bottom layer.'));
        const y = rotations.find(y => {
          const c = state(join(base, y));
          return isCorner ? !(matches(c, Face.D, 2) && matches(c, Face.F, 8) && matches(c, Face.R, 6))
            : !(matches(c, Face.F, 5) && matches(c, Face.R, 3));
        });
        if (y === undefined) throw new Error('No misplaced piece to eject');
        const c = state(join(base, y));
        const flipped = color(c, Face.F, 5) === center(c, Face.R) && color(c, Face.R, 3) === center(c, Face.F);
        const index = isCorner ? 1 : flipped ? 2 : 3;
        const outlines = isCorner ? [c.faces[Face.D][2], c.faces[Face.F][8], c.faces[Face.R][6]] : [c.faces[Face.F][5], c.faces[Face.R][3]];
        let rec: DemoContent | undefined = recognize(isCorner ? t('底层有白角放错，先把它拿出来。', 'A bottom white corner is misplaced. Eject it first.') : flipped ? t('棱在原来的槽里，但朝向反了。', 'The edge is in the right slot, but flipped.') : t('棱放进了别的槽，先把它拿出来。', 'The edge is in the wrong slot. Eject it first.'), index, outlines);
        if (isCorner && cornerIndices.every(i => color(cube, Face.D, i) === 'D')) {
          rec.detail = t('白面虽同色，角的侧色还没对齐中心。', 'The white face is one color, but the corner side stickers do not match the centers.');
        }
        if (isCorner && followEjectedCorner) ejectedCornerWhite = outlines.find(id => id.startsWith('D'));
        if (isCorner) rec = inspectPiece(outlines, index, rec);
        rec = prepare(y, t('转体，把放错的块放右前方。', 'Rotate the cube to put the misplaced piece at front-right.'), index, rec);
        action(actions[0], isCorner ? t('做右公式，把白角拿到顶层。', 'Use the right trigger to eject the corner to the top.') : t('假想放入一条顶层棱，原来的棱就会出来。', 'Imagine inserting a top edge. The original edge comes out.'), index, rec);
        if (isCorner) ejectedCornerWhite = outlines.find(id => id[0] === 'D');
      }
    } else if (stage === 'yellow-face') {
      const gray = grayCount(cube);
      let choice: { u: string; alg: string; index: number } | undefined;
      for (const u of turns) for (const [index, alg] of [RIGHT_SUNE, LEFT_SUNE].entries()) {
        const c = state(join(base, u));
        if (gray === 3 ? yellowCornerSignature(c) !== yellowCornerSignature(state(new Alg(alg).invert().toString()))
          : index !== 0 || (gray === 2 ? color(c, Face.F, 0) !== 'U' : color(c, Face.F, 0) === 'U') || grayCount(state(join(base, u, alg))) !== 3) continue;
        choice ??= { u, alg, index: gray === 3 ? index : gray === 2 ? 2 : 3 };
      }
      if (!choice) throw new Error('No taught yellow-face action found');
      let rec: DemoContent | undefined = recognize(gray === 3 ? t('3个非黄格，观察鱼头和侧面鱼鳍。', 'Three non-yellow corners: check the head and side fins.') : gray === 2 ? t('2个非黄格，左拇指放前面左上角，要碰黄。', 'Two non-yellow corners: place your left thumb at front-top-left, touching yellow.') : t('4个非黄格，左拇指放前面左上角，不碰黄。', 'Four non-yellow corners: place your left thumb at front-top-left, away from yellow.'), choice.index,
        cornerIndices.filter(i => color(cube, Face.U, i) !== 'U').map(i => cube.faces[Face.U][i]));
      const alignment = choice.index === 0 ? t('转顶层，把鱼头放左前。', 'Turn the top to put the head at front-left.') : choice.index === 1 ? t('转顶层，把鱼头放右前。', 'Turn the top to put the head at front-right.') : choice.index === 2 ? t('转顶层，让左拇指位置碰黄。', 'Turn the top so yellow reaches the left thumb position.') : t('转顶层，让左拇指位置不碰黄。', 'Turn the top so the left thumb position does not touch yellow.');
      if (gray !== 3) rec.touchSticker = true;
      rec = prepare(choice.u, alignment, choice.index, rec);
      if (gray !== 3 && choice.u) phases[phases.length - 1].act.touchSticker = true;
      if (gray === 3) {
        if (rec) phases.push({ start: moves.length, end: moves.length, recognize: rec, act: rec, recognizeOnly: true });
        const aligned = current();
        const left = choice.index === 1;
        const recognition = recognize(left
          ? t('鱼头在右前，F 面左上有鱼鳍，是左鱼。', 'Head at front-right, fin at front-top-left: left fish.')
          : t('鱼头在左前，F 面右上有鱼鳍，是右鱼。', 'Head at front-left, fin at front-top-right: right fish.'), choice.index,
          [aligned.faces[Face.U][left ? 8 : 6], aligned.faces[Face.F][left ? 0 : 2]]);
        phases.push({ start: moves.length, end: moves.length, recognize: recognition, act: recognition, recognizeOnly: true });
        rec = undefined;
      }
      action(choice.alg, choice.index === 1 ? t('做左鱼公式。', 'Do left Sune.') : t('做右鱼公式。', 'Do right Sune.'), choice.index, rec);
    } else if (stage === 'corner-position') {
      const align = turns.find(u => topCorners(state(join(base, u))));
      if (align !== undefined) {
        add(align, { text: t('顶角位置已对，转顶层对齐侧面中心。', 'The corners are in the right relative positions. Turn the top to match the side centers.') });
      } else {
        // F and R are visible; two quarter-turn inspections expose the other sides.
        let inspected = current();
        let visibleEyes = eyes(inspected).filter(face => face === Face.F || face === Face.R);
        for (let scan = 0; !visibleEyes.length && scan < 2; scan++) {
          action('y', t('转体观察另一侧，找两端同色的眼。', 'Rotate to inspect the next side for matching corner stickers.'), eyes(cube).length ? 0 : 1, undefined, false);
          inspected = current();
          visibleEyes = eyes(inspected).filter(face => face === Face.F || face === Face.R);
        }
        const eyeFaces = eyes(inspected);
        const index = eyeFaces.length ? 0 : 1;
        const outlines = visibleEyes.slice(0, 1).flatMap(face => [inspected.faces[face][0], inspected.faces[face][2]]);
        let rec: DemoContent | undefined = recognize(index === 0 ? t('找到一对眼：两端角格同色。', 'Found headlights: the two corner stickers match.') : t('四面都没有眼，先做一遍J公式造眼。', 'No headlights on any side. Use the J algorithm once to create a pair.'), index, outlines);
        const y = index === 0 ? rotations.find(y => eyes(state(join(currentAlg(), y))).includes(Face.L))! : '';
        rec = prepare(y, t('转体，把眼放左。', 'Rotate the cube to hold the headlights on the left.'), index, rec);
        action(CORNER_POSITION, t('做J公式。', 'Do the J algorithm.'), index, rec);
      }
    } else if (stage === 'edge-position') {
      const align = turns.find(u => topCorners(state(join(base, u))));
      if (align) {
        add(align, { text: t('转顶层，让顶角先对齐侧面中心。', 'Turn the top to match the corners with the side centers.') });
        continue;
      }
      const wallFaces = walls(cube);
      const index = wallFaces.length ? 0 : 2;
      const y = wallFaces.length ? rotations.find(y => walls(state(join(base, y))).includes(Face.B))! : "y'";
      const prepared = state(join(base, y));
      const left = color(prepared, Face.F, 1) === center(prepared, Face.L);
      const caseIndex = index === 2 ? 2 : left ? 0 : 1;
      phases.push(...wallScanPhases(base, moves.length, caseIndex));
      if (y) {
        action(y, index === 2 ? t('沿当前朝向起手，先造墙。', 'Start from this orientation and create a wall.') : t('把墙直接放到后面。', 'Move the wall directly to the back.'), caseIndex, undefined, false);
        phases[phases.length - 1].moveView = 'home';
      } else add('', { text: t('把墙直接放到后面。', 'Move the wall directly to the back.'), caseIndex }, undefined, 'home');
      if (index !== 2) {
        // A separate observation explains the direction only after the wall is actually at the back.
        add('', { text: left ? t('前棱颜色对齐左侧，先右鱼再左鱼。', 'The front edge matches the left: right Sune first.') : t('前棱颜色对齐右侧，先左鱼再右鱼。', 'The front edge matches the right: left Sune first.'), caseIndex });
      }
      const alg = caseIndex === 1 ? EDGE_POSITION_RIGHT : EDGE_POSITION_LEFT;
      phases.push(...edgeAlgorithmPhases(alg, moves.length, caseIndex));
      moves.push(...movesOf(alg));
    }
  }
  if (!demoGoalReached(stage, currentAlg())) throw new Error(`${stage} demonstration did not reach its goal`);
  return { setup, alg: moves.join(' '), phases, done: done[stage] };
}

/** Use the same insertions as the bottom-cross lesson: align, bring right, insert. */
function buildBottomCrossFromDaisy(setup: string): string {
  const moves: string[] = [];
  for (let edge = 0; edge < 4; edge++) {
    const current = join(setup, ...moves);
    if (demoGoalReached('cross', current)) break;
    const alignment = lowerTurns.flatMap(d => rotations.map(y => join(d, y)))
      .sort((a, b) => movesOf(a).length - movesOf(b).length)
      .find(preparation => {
        const cube = state(join(current, preparation));
        return color(cube, Face.U, 5) === 'D' && matches(cube, Face.R, 1);
      });
    if (alignment === undefined) throw new Error('No aligned daisy petal to insert');
    moves.push(...movesOf(alignment), 'R2');
  }
  return moves.join(' ');
}

/** Completed-stage highlights use sticker identities from the actual solved trace. */
export function walkthroughCompletionStickers(stage: LblLessonStageId, alg: string): string[] {
  const cube = state(alg);
  const at = (face: Face, indices: number[]) => indices.map(index => cube.faces[face][index]);
  switch (stage) {
    case 'daisy': return [...at(Face.U, edgeIndices), ...at(Face.U, [4])];
    case 'cross': return [...at(Face.D, [...edgeIndices, 4]), ...sides.flatMap(face => at(face, [7, 4]))];
    case 'corners': return [...at(Face.D, cornerIndices), ...sides.flatMap(face => at(face, [6, 8, 4]))];
    case 'middle': return sides.flatMap(face => at(face, [3, 4, 5]));
    case 'yellow-cross': return at(Face.U, [...edgeIndices, 4]);
    case 'yellow-face': return at(Face.U, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    case 'corner-position': return [...at(Face.U, cornerIndices), ...sides.flatMap(face => at(face, [0, 2, 4]))];
    case 'edge-position': return AllFaces.flatMap(face => at(face, [0, 1, 2, 3, 4, 5, 6, 7, 8]));
  }
}

/** Track the same edge and matching center throughout alignment and insertion. */
export function walkthroughCrossPhases(setup: string, alg: string): DemoPhase[] {
  const moves = movesOf(alg);
  const phases: DemoPhase[] = [];
  let start = 0;
  for (let index = 0; index < moves.length; index++) {
    if (moves[index] !== 'R2') continue;
    const aligned = state(join(setup, ...moves.slice(0, index)));
    const outlines = [aligned.faces[Face.U][5], aligned.faces[Face.R][1], aligned.faces[Face.R][4]];
    if (index > start) phases.push({ start, end: index, act: {
      text: t('对齐：让当前白棱的侧色对齐同色中心。', 'Align the current white edge’s side color with its matching center.'),
      alg: moves.slice(start, index).join(' '), outlines,
    } });
    phases.push({ start: index, end: index + 1, act: {
      text: t('右面转两次，把这条白棱送到底面。', 'Turn the right face twice to insert this white edge into the bottom.'),
      alg: 'R2', outlines,
    } });
    start = index + 1;
  }
  return phases;
}

export function buildWalkthroughRun(scramble: string, followEjectedCorner = false): LblLessonRun {
  let setup = scramble;
  const stages = Object.fromEntries(LBL_LESSON_STAGE_IDS.map(stage => {
    const alg = stage === 'cross' ? buildBottomCrossFromDaisy(setup) : buildCompleteDemo(stage, setup, followEjectedCorner).alg;
    setup = join(setup, alg);
    if (!demoGoalReached(stage, setup)) throw new Error(`Walkthrough did not complete ${stage}`);
    return [stage, alg];
  })) as LblLessonRun['stages'];
  return { scramble, stages };
}

const pools = new Map<CompleteDemoStage, CompleteDemo[]>();
/** Small, prepared legal states; solve with the algorithms taught in this chapter. */
export function completeDemoPool(stage: CompleteDemoStage): CompleteDemo[] {
  const cached = pools.get(stage);
  if (cached) return cached;
  const chapter = LBL_STEPS.find(step => step.id === stage)!;
  const setups = stage === 'yellow-cross' ? YELLOW_CROSS_DEMO_SETUPS
    : stage === 'corners' ? [...LBL_LESSON_RUNS.flatMap((run, index) =>
      turns.slice(0, [2, 1, 2][index]).map(turn => join(lessonFrame(run, 'corners').setup, turn))), ...cornerExtremeSetups]
    : [...(stage === 'middle' ? [] : chapter.examples.flatMap(example => turns.map(turn => join(resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false), turn)))),
      ...LBL_LESSON_RUNS.map(run => stage === 'daisy' ? run.scramble : lessonFrame(run, stage as LblLessonStageId).setup),
      ...(stage === 'middle' ? [MIDDLE_DEMO_EXTREME_SETUP] : [])];
  if (stage === 'yellow-face') {
    setups.push(...turns.flatMap(u => turns.map(v => join(RIGHT_SUNE, u, RIGHT_SUNE, v))));
  }
  let demos = [...new Set(setups)]
    .filter(setup => stage === 'daisy' ? petals(state(setup)).length < 3
      : stage === 'middle' ? middleEdgeCount(state(setup)) < 3 : !demoGoalReached(stage, setup))
    .map(setup => buildCompleteDemo(stage, setup));
  if (stage === 'yellow-face') {
    const counts = [0, 0, 0, 0];
    const seen = new Set<string>();
    demos = demos.filter(demo => {
      const first = demo.phases.find(phase => phase.recognize)!;
      const index = first.recognize!.caseIndex!;
      if (index < 2) {
        if (counts[index] || !/^U/.test(movesOf(demo.alg)[0])) return false;
      } else {
        const shape = turns.map(u => yellowCornerSignature(state(join(demo.setup, u)))).sort()[0];
        if (counts[index] >= 2 || seen.has(shape)) return false;
        seen.add(shape);
      }
      counts[index]++;
      return true;
    });
    demos.sort((a, b) => a.phases.find(phase => phase.recognize)!.recognize!.caseIndex!
      - b.phases.find(phase => phase.recognize)!.recognize!.caseIndex!);
    if (counts.join(',') !== '1,1,2,2') throw new Error('Missing yellow-face demonstration cases');
  }
  if (stage === 'corner-position') {
    const counts = { visible: 0, hidden: 0, none: 0 };
    demos = demos.filter(demo => {
      const faces = eyes(state(demo.setup));
      if (faces.length === 4) return false;
      const kind = !faces.length ? 'none' : faces.some(face => face === Face.F || face === Face.R) ? 'visible' : 'hidden';
      if (counts[kind] >= (kind === 'none' ? 2 : 1)) return false;
      counts[kind]++;
      return true;
    });
    if (counts.visible !== 1 || counts.hidden !== 1 || counts.none !== 2) throw new Error('Missing corner-position demonstration cases');
  }
  if (stage === 'edge-position') {
    const counts = [0, 0, 0];
    demos = demos.filter(demo => {
      const index = demo.phases.find(phase => phase.recognize)?.recognize?.caseIndex;
      if (index === undefined || counts[index] >= (index === 2 ? 2 : 1)) return false;
      counts[index]++;
      return true;
    });
    if (counts.join(',') !== '1,1,2') throw new Error('Missing edge-position demonstration cases');
  }
  if (!demos.length) throw new Error(`No unfinished ${stage} examples`);
  pools.set(stage, demos);
  return demos;
}
