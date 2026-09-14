import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { cube3x3x3 } from 'cubing/puzzles';
import {
  DAISY_CHALLENGE_PROMPT,
  DAISY_HINT_INTRO,
  LBL_LESSON_RUNS,
  LBL_STEPS,
} from '@/app/[lang]/tutorial/lbl/content';
import {
  buildDaisyPlayback,
  resolveDaisyScramble,
  selectBestDaisyFace,
  selectWhiteDaisyFace,
} from '@/lib/lbl-daisy';

describe('LBL daisy guided flow', () => {
  it('selects the shortest valid solver orientation and ignores unavailable faces', () => {
    expect(selectBestDaisyFace([11, 4, 0xffffffff, 2, Number.POSITIVE_INFINITY, 7])).toBe(3);
    expect(selectBestDaisyFace([0xffffffff, Number.POSITIVE_INFINITY, null, 0xffffffff, 0xffffffff, 0xffffffff])).toBeNull();
  });

  it('keeps the guided demo on white petals around the yellow center', () => {
    expect(selectWhiteDaisyFace([11, 4, 0xffffffff, 2, 0, 7])).toBe(0);
    expect(selectWhiteDaisyFace([0xffffffff, 11, 2, 0, 0, 7])).toBeNull();
  });

  it('uses a local scramble when the standard generator is unavailable', () => {
    expect(resolveDaisyScramble('', 'R U F')).toBe('R U F');
    expect(resolveDaisyScramble(null, 'R U F')).toBe('R U F');
    expect(resolveDaisyScramble('  U R  ', 'R U F')).toBe('U R');
  });

  it('folds leading whole-cube rotations into the playback setup', () => {
    expect(buildDaisyPlayback('R U F', "z2 y R U'"))
      .toEqual({ setup: 'R U F z2 y', alg: "R U'", displayAlg: "z2 y R U'" });
    expect(buildDaisyPlayback('R U F', "R U'"))
      .toEqual({ setup: 'R U F', alg: "R U'", displayAlg: "R U'" });
  });

  it('uses generator scrambles for the fixed lesson pool', async () => {
    expect(LBL_LESSON_RUNS).toHaveLength(3);
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const lesson of LBL_LESSON_RUNS) {
      const scramble = new Alg(lesson.scramble);
      expect(scramble.experimentalSimplify({ cancel: true }).toString().split(' ').filter(Boolean).length).toBeGreaterThanOrEqual(18);
      const generatedState = kpuzzle.defaultPattern().applyAlg(scramble);
      expect(generatedState.isIdentical(kpuzzle.defaultPattern())).toBe(false);
    }
  });

  it('keeps a solver-generated daisy move sequence for every fixed scramble', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const lesson of LBL_LESSON_RUNS) {
      const edges = kpuzzle.defaultPattern()
        .applyAlg(`${lesson.scramble} ${lesson.stages.daisy}`)
        .toJSON().patternData.EDGES;
      expect([...edges.pieces.slice(0, 4)].sort((a, b) => a - b)).toEqual([4, 5, 6, 7]);
      expect(edges.orientation.slice(0, 4)).toEqual([0, 0, 0, 0]);
    }
  });

  it('teaches the white cross as four align-then-half-turn cycles', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const lesson of LBL_LESSON_RUNS) {
      const tokens = lesson.stages.cross.trim().split(/\s+/).filter(Boolean);
      const halfTurns = tokens.filter(token => /^(?:F|R|B|L)2$/.test(token));
      expect(halfTurns.sort()).toEqual(['B2', 'F2', 'L2', 'R2']);
      let sinceHalfTurn: string[] = [];
      let cycles = 0;
      for (const token of tokens) {
        if (/^(?:F|R|B|L)2$/.test(token)) {
          expect(sinceHalfTurn.every(move => /^U(?:2|'?)$/.test(move))).toBe(true);
          sinceHalfTurn = [];
          cycles += 1;
        } else {
          sinceHalfTurn.push(token);
        }
      }
      expect(cycles).toBe(4);
      expect(sinceHalfTurn).toEqual([]);

      const edges = kpuzzle.defaultPattern()
        .applyAlg(`${lesson.scramble} ${lesson.stages.daisy} ${lesson.stages.cross}`)
        .toJSON().patternData.EDGES;
      expect(edges.pieces.slice(4, 8)).toEqual([4, 5, 6, 7]);
      expect(edges.orientation.slice(4, 8)).toEqual([0, 0, 0, 0]);
    }
  });

  it('solves all white corners with right triggers and whole-cube regrips', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const allowedSetupMoves = new Set(['U', "U'", 'U2', 'y', "y'", 'y2']);
    const rightTriggers = [
      ['R', 'U', "R'", "U'"],
      ['U', 'R', "U'", "R'"],
    ];

    for (const lesson of LBL_LESSON_RUNS) {
      const tokens = lesson.stages.corners.trim().split(/\s+/).filter(Boolean);
      let triggerCount = 0;
      for (let index = 0; index < tokens.length;) {
        const trigger = rightTriggers.find(candidate => candidate.every((move, offset) => tokens[index + offset] === move));
        if (trigger) {
          triggerCount += 1;
          index += trigger.length;
          continue;
        }
        expect(allowedSetupMoves.has(tokens[index])).toBe(true);
        index += 1;
      }
      expect(triggerCount).toBeGreaterThanOrEqual(4);

      const pattern = kpuzzle.defaultPattern()
        .applyAlg(`${lesson.scramble} ${lesson.stages.daisy} ${lesson.stages.cross} ${lesson.stages.corners}`)
        .toJSON().patternData;
      expect(pattern.EDGES.pieces.slice(4, 8)).toEqual([4, 5, 6, 7]);
      expect(pattern.EDGES.orientation.slice(4, 8)).toEqual([0, 0, 0, 0]);
      expect(pattern.CORNERS.pieces.slice(4, 8)).toEqual([4, 5, 6, 7]);
      expect(pattern.CORNERS.orientation.slice(4, 8)).toEqual([0, 0, 0, 0]);
    }
  });

  it('teaches corner insertion with regrips and right triggers only', () => {
    const corners = LBL_STEPS.find(step => step.id === 'corners');
    expect(corners).toBeDefined();
    if (!corners) return;

    const cornerCopy = corners.paragraphs.map(paragraph => paragraph.zh).join('');
    expect(cornerCopy).not.toContain('左公式');
    expect(cornerCopy).toContain('转体');
    expect(corners.examples.some(example => example.alg.split(/\s+/).includes('y'))).toBe(true);
    expect(corners.examples.every(example => !example.alg.split(/\s+/).some(move => move === 'L' || move === "L'" || move === 'L2'))).toBe(true);
  });

  it('solves all middle edges with the two beginner insertion formulas', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const frontMatch = ['U', 'R', "U'", "R'", "U'", "F'", 'U', 'F'];
    const rightMatch = ["R'", "F'", 'R', 'U', 'R', "U'", "R'", 'F'];
    const formulas: Array<[string, string[]]> = [
      ['front', frontMatch],
      ['right', rightMatch],
    ];
    const setupMoves = new Set(['U', "U'", 'U2', 'y', "y'", 'y2']);
    const usedFormulas = new Set<string>();

    for (const lesson of LBL_LESSON_RUNS) {
      const tokens = lesson.stages.middle.trim().split(/\s+/).filter(Boolean);
      let formulaCount = 0;
      for (let index = 0; index < tokens.length;) {
        const formula = formulas.find(([, candidate]) => candidate.every((move, offset) => tokens[index + offset] === move));
        if (formula) {
          usedFormulas.add(formula[0]);
          formulaCount += 1;
          index += formula[1].length;
          continue;
        }
        expect(setupMoves.has(tokens[index])).toBe(true);
        index += 1;
      }

      const beforeMiddle = kpuzzle.defaultPattern()
        .applyAlg(`${lesson.scramble} ${lesson.stages.daisy} ${lesson.stages.cross} ${lesson.stages.corners}`)
        .toJSON().patternData.EDGES;
      const unsolvedMiddleCount = [8, 9, 10, 11].filter(slot => beforeMiddle.pieces[slot] !== slot || beforeMiddle.orientation[slot] !== 0).length;
      expect(formulaCount).toBeGreaterThanOrEqual(unsolvedMiddleCount);

      const pattern = kpuzzle.defaultPattern()
        .applyAlg(`${lesson.scramble} ${lesson.stages.daisy} ${lesson.stages.cross} ${lesson.stages.corners} ${lesson.stages.middle}`)
        .toJSON().patternData;
      expect(pattern.EDGES.pieces.slice(4, 12)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
      expect(pattern.EDGES.orientation.slice(4, 12)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(pattern.CORNERS.pieces.slice(4, 8)).toEqual([4, 5, 6, 7]);
      expect(pattern.CORNERS.orientation.slice(4, 8)).toEqual([0, 0, 0, 0]);
    }

    expect(usedFormulas).toEqual(new Set(['front', 'right']));
  });

  it('teaches the two middle-edge formulas without adding another insertion algorithm', () => {
    const middle = LBL_STEPS.find(step => step.id === 'middle');
    expect(middle).toBeDefined();
    if (!middle) return;

    const copy = middle.paragraphs.map(paragraph => paragraph.zh).join('');
    expect(copy).toContain("U R U' R' U' F' U F");
    expect(copy).toContain("R' F' R U R U' R' F");
    expect(copy).not.toContain('左公式');
    expect(middle.examples.some(example => example.alg === "U R U' R' U' F' U F")).toBe(true);
    expect(middle.examples.some(example => example.alg === "R' F' R U R U' R' F")).toBe(true);
    expect(middle.examples.some(example => example.alg.split(/\s+/).includes('y'))).toBe(true);
  });

  it('builds the yellow cross by repeating the single beginner formula until complete', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const yellowCross = ['F', 'R', 'U', "R'", "U'", "F'"];
    const setupMoves = new Set(['U', "U'", 'U2']);

    for (const lesson of LBL_LESSON_RUNS) {
      const prefix = [lesson.scramble, lesson.stages.daisy, lesson.stages.cross, lesson.stages.corners, lesson.stages.middle].join(' ');
      const before = kpuzzle.defaultPattern().applyAlg(prefix).toJSON().patternData;
      const tokens = lesson.stages['yellow-cross'].trim().split(/\s+/).filter(Boolean);
      let formulaCount = 0;

      for (let index = 0; index < tokens.length;) {
        if (yellowCross.every((move, offset) => tokens[index + offset] === move)) {
          formulaCount += 1;
          index += yellowCross.length;
          continue;
        }
        expect(setupMoves.has(tokens[index])).toBe(true);
        index += 1;
      }

      const after = kpuzzle.defaultPattern()
        .applyAlg(`${prefix} ${lesson.stages['yellow-cross']}`)
        .toJSON().patternData;
      expect(after.EDGES.orientation.slice(0, 4)).toEqual([0, 0, 0, 0]);
      expect(after.EDGES.pieces.slice(4, 12)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
      expect(after.EDGES.orientation.slice(4, 12)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(after.CORNERS.pieces.slice(4, 8)).toEqual([4, 5, 6, 7]);
      expect(after.CORNERS.orientation.slice(4, 8)).toEqual([0, 0, 0, 0]);

      const alreadyCross = before.EDGES.orientation.slice(0, 4).every((orientation: number) => orientation === 0);
      expect(formulaCount > 0 || alreadyCross).toBe(true);
    }
  });

  it('teaches the mirrored L or line case with one yellow-cross formula', () => {
    const yellowCross = LBL_STEPS.find(step => step.id === 'yellow-cross');
    expect(yellowCross).toBeDefined();
    if (!yellowCross) return;

    const copy = yellowCross.paragraphs.map(paragraph => paragraph.zh).join('');
    expect(copy).toContain('镜像 L');
    expect(copy).toContain('一字');
    expect(copy).toContain("F R U R' U' F'");
    expect(copy).not.toContain('小 f');
    expect(yellowCross.examples.every(example => !example.alg.split(/\s+/).includes('f'))).toBe(true);
    expect(yellowCross.examples.some(example => example.alg === "F R U R' U' F'")).toBe(true);
  });

  it('orients all top corners by continuing with the fish-head formula', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const fish = ["R'", "U'", 'R', "U'", "R'", 'U2', 'R'];
    const setupMoves = new Set(['U', "U'", 'U2']);

    for (const lesson of LBL_LESSON_RUNS) {
      const prefix = [
        lesson.scramble,
        lesson.stages.daisy,
        lesson.stages.cross,
        lesson.stages.corners,
        lesson.stages.middle,
        lesson.stages['yellow-cross'],
      ].join(' ');
      const before = kpuzzle.defaultPattern().applyAlg(prefix).toJSON().patternData;
      expect(before.CORNERS.orientation.slice(0, 4).filter((orientation: number) => orientation === 0)).toHaveLength(2);

      const tokens = lesson.stages['yellow-face'].trim().split(/\s+/).filter(Boolean);
      let formulaCount = 0;
      for (let index = 0; index < tokens.length;) {
        if (fish.every((move, offset) => tokens[index + offset] === move)) {
          formulaCount += 1;
          index += fish.length;
          continue;
        }
        expect(setupMoves.has(tokens[index])).toBe(true);
        index += 1;
      }
      expect(formulaCount).toBeGreaterThan(0);
      expect(formulaCount).toBe(3);

      const after = kpuzzle.defaultPattern()
        .applyAlg(`${prefix} ${lesson.stages['yellow-face']}`)
        .toJSON().patternData;
      expect(after.CORNERS.orientation.slice(0, 4).filter((orientation: number) => orientation === 0)).toHaveLength(4);
      expect(after.EDGES.orientation.slice(0, 4)).toEqual([0, 0, 0, 0]);
      expect(after.EDGES.pieces.slice(4, 12)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
      expect(after.EDGES.orientation.slice(4, 12)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(after.CORNERS.pieces.slice(4, 8)).toEqual([4, 5, 6, 7]);
      expect(after.CORNERS.orientation.slice(4, 8)).toEqual([0, 0, 0, 0]);
    }
  });

  it('teaches the left-front fish formula through the full yellow face', () => {
    const yellowFace = LBL_STEPS.find(step => step.id === 'yellow-face');
    expect(yellowFace).toBeDefined();
    if (!yellowFace) return;

    const copy = yellowFace.paragraphs.map(paragraph => paragraph.zh).join('');
    expect(copy).toContain('左前方');
    expect(copy).toContain('朝向前方');
    expect(copy).toContain("R' U' R U' R' U2 R");
    expect(copy).toContain('小鱼');
    expect(copy).toContain('鱼头');
    expect(copy).toContain('顶面四个角的黄色全部朝上');
    expect(copy).not.toContain('右鱼');
    expect(copy).not.toContain('左鱼');
    expect(yellowFace.examples.some(example => example.alg === "R' U' R U' R' U2 R")).toBe(true);
    expect(yellowFace.examples.every(example => example.alg.split(/\s+/).every(move => /^(?:R|R'|U|U'|U2)$/.test(move)))).toBe(true);
  });

  it('positions every top corner with the same eye-left formula', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const cornerPosition = ['R', 'U', "R'", "F'", 'R', 'U', "R'", "U'", "R'", 'F', 'R2', "U'", "R'"];
    const setupMoves = new Set(['U', "U'", 'U2']);

    for (const [lessonIndex, lesson] of LBL_LESSON_RUNS.entries()) {
      const prefix = [
        lesson.scramble,
        lesson.stages.daisy,
        lesson.stages.cross,
        lesson.stages.corners,
        lesson.stages.middle,
        lesson.stages['yellow-cross'],
        lesson.stages['yellow-face'],
      ].filter(Boolean).join(' ');
      const before = kpuzzle.defaultPattern().applyAlg(prefix).toJSON().patternData;
      expect(before.CORNERS.orientation.slice(0, 4)).toEqual([0, 0, 0, 0]);
      expect(before.CORNERS.pieces.slice(4, 8)).toEqual([4, 5, 6, 7]);

      const tokens = lesson.stages['corner-position'].trim().split(/\s+/).filter(Boolean);
      let formulaCount = 0;
      for (let index = 0; index < tokens.length;) {
        if (cornerPosition.every((move, offset) => tokens[index + offset] === move)) {
          formulaCount += 1;
          index += cornerPosition.length;
          continue;
        }
        expect(setupMoves.has(tokens[index])).toBe(true);
        index += 1;
      }
      expect(formulaCount).toBeGreaterThan(0);
      expect(formulaCount).toBe([2, 1, 2][lessonIndex]);

      const after = kpuzzle.defaultPattern()
        .applyAlg(`${prefix} ${lesson.stages['corner-position']}`)
        .toJSON().patternData;
      expect(after.CORNERS.pieces.slice(0, 4)).toEqual([0, 1, 2, 3]);
      expect(after.CORNERS.orientation.slice(0, 4)).toEqual([0, 0, 0, 0]);
      expect(after.CORNERS.pieces.slice(4, 8)).toEqual([4, 5, 6, 7]);
      expect(after.CORNERS.orientation.slice(4, 8)).toEqual([0, 0, 0, 0]);
      expect(after.EDGES.pieces.slice(4, 12)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
      expect(after.EDGES.orientation.slice(4, 12)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    }
  });

  it('explains both eye definitions and repeats the same corner-position formula', () => {
    const cornerPosition = LBL_STEPS.find(step => step.id === 'corner-position');
    expect(cornerPosition).toBeDefined();
    if (!cornerPosition) return;

    const copy = cornerPosition.paragraphs.map(paragraph => paragraph.zh).join('');
    expect(copy).toContain('眼');
    expect(copy).toContain('两侧');
    expect(copy).toContain('三个顶行方块颜色一致');
    expect(copy).toContain('无眼');
    expect(copy).toContain("R U R' F' R U R' U' R' F R2 U' R'");
    expect(cornerPosition.examples.some(example => example.title.zh === '眼放左')).toBe(true);
    expect(cornerPosition.examples.some(example => example.title.zh === '无眼')).toBe(true);
    expect(cornerPosition.examples.every(example => example.alg.split(/\s+/).every(move =>
      /^(?:R|R'|R2|F|F'|U|U'|U2)$/.test(move),
    ))).toBe(true);
  });

  it('finishes the last edges with the eye cases and the M-slice formula', async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const edgePosition = ['M2', 'U', "M'", 'U2', 'M', 'U', 'M2'];
    const setupMoves = new Set(['U', "U'", 'U2']);

    for (const lesson of LBL_LESSON_RUNS) {
      const prefix = [
        lesson.scramble,
        lesson.stages.daisy,
        lesson.stages.cross,
        lesson.stages.corners,
        lesson.stages.middle,
        lesson.stages['yellow-cross'],
        lesson.stages['yellow-face'],
        lesson.stages['corner-position'],
      ].filter(Boolean).join(' ');
      const before = kpuzzle.defaultPattern().applyAlg(prefix).toJSON().patternData;
      expect(before.CORNERS).toEqual(kpuzzle.defaultPattern().toJSON().patternData.CORNERS);
      expect(before.EDGES.pieces.slice(4, 12)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
      expect(before.EDGES.orientation.slice(4, 12)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);

      const tokens = lesson.stages['edge-position'].trim().split(/\s+/).filter(Boolean);
      let formulaCount = 0;
      for (let index = 0; index < tokens.length;) {
        if (edgePosition.every((move, offset) => tokens[index + offset] === move)) {
          formulaCount += 1;
          index += edgePosition.length;
          continue;
        }
        expect(setupMoves.has(tokens[index])).toBe(true);
        index += 1;
      }
      expect(formulaCount).toBeGreaterThan(0);

      const after = kpuzzle.defaultPattern().applyAlg(`${prefix} ${lesson.stages['edge-position']}`);
      expect(after.isIdentical(kpuzzle.defaultPattern())).toBe(true);
    }
  });

  it('teaches the three-eye and four-eye last-step instructions', () => {
    const edgePosition = LBL_STEPS.find(step => step.id === 'edge-position');
    expect(edgePosition).toBeDefined();
    if (!edgePosition) return;

    const copy = edgePosition.paragraphs.map(paragraph => paragraph.zh).join('');
    expect(copy).toContain('四只眼睛');
    expect(copy).toContain('三只眼睛');
    expect(copy).toContain('中间的眼睛');
    expect(copy).toContain('对着自己');
    expect(copy).toContain("M2 U M' U2 M U M2");
    expect(copy).toContain('一次或者两次');
    expect(edgePosition.examples.some(example => example.title.zh === '四只眼睛')).toBe(true);
    expect(edgePosition.examples.some(example => example.title.zh === '三只眼睛')).toBe(true);
    expect(edgePosition.examples.every(example => example.alg.split(/\s+/).every(move =>
      /^(?:M|M'|M2|U|U'|U2)$/.test(move),
    ))).toBe(true);
  });

  it('keeps the daisy challenge copy and state-specific examples available to the lesson', () => {
    const daisy = LBL_STEPS.find(step => step.id === 'daisy');
    expect(DAISY_CHALLENGE_PROMPT.zh).toBe('动用你聪明的脑袋，如何拼成这样一朵小花？');
    expect(DAISY_HINT_INTRO.zh).toContain('白棱');
    expect(daisy?.examples.map(example => example.title.en)).toEqual([
      'Middle: lift right',
      'Middle: top is occupied',
      'Middle: lift left',
      'Top: lower to middle',
      'Bottom: bring to middle',
      'White down: half turn',
    ]);
  });
});
