import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { cubeMove, SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { quatAngleTo, quatInverse, quatMul, SENSOR_BASES } from '@cuberoot/shared/smart-cube/orientation';
import { notationQuaternion } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { createSmartCubeGuidanceController } from '@cuberoot/shared/smart-cube/scramble-guidance';
import { orientedFaceColors } from '@cuberoot/shared/timer';
import { LBL_LESSON_RUNS, LBL_LESSON_STAGE_IDS } from '@/app/[lang]/tutorial/lbl/lesson-runs';
import { buildLessonGuide, lessonCanStart, lessonFormulaHint, lessonGoalReached, lessonMiddleEdgesSolved, lessonMoveHint, lessonRotationPending, lessonStart, matchesLessonAction, observeLessonTurn, PRACTICE_GRIP, type LessonProgress } from '@/app/[lang]/tutorial/lbl/smart-practice/lesson-guide';
import { firstLessonSetupStart, planDirectYellowCrossSetup, planLessonSetup, type LessonSetupRequest } from '@/app/[lang]/tutorial/lbl/smart-practice/lesson-setup';
import { LessonRotationTracker } from '@/app/[lang]/tutorial/lbl/smart-practice/lesson-rotation';
import { demoGoalReached } from '@/app/[lang]/tutorial/lbl/complete-demo-state';
import { yellowCrossPattern } from '@/app/[lang]/tutorial/lbl/yellow-cross-demo-state';
import { initSync, Min2Phase } from '@/wasm/m2p/m2p_wasm';

it.each(LBL_LESSON_STAGE_IDS)('reaches the real cube goal for %s from each course setup', stage => {
  for (const [variant] of LBL_LESSON_RUNS.entries()) {
    const start = lessonStart(stage, variant);
    expect(lessonCanStart(stage, start.facelets)).toBe(true);
    expect(smartCubeTargetFacelets(start.scramble, PRACTICE_GRIP)).toBe(start.facelets);
    const guide = buildLessonGuide(stage, start.facelets, start.deviceAlg.split(' '));
    let facelets = start.facelets;
    let progress: LessonProgress = { index: 0, facelets, wrongTurns: [] };
    for (const action of guide.actions) {
      expect(action.before).toBe(facelets);
      expect(action.deviceAlg).not.toBe('');
      const centers = orientedFaceColors(action.pose);
      expect(centers.U).toBe(normalizeWcaScramble(`${action.pose} U`));
      expect(centers.F).toBe(normalizeWcaScramble(`${action.pose} F`));
      for (const token of action.deviceAlg.split(' ')) {
        const turns = token.endsWith('2') ? [token[0], token[0]] : [token];
        for (const turn of turns) {
          facelets = cubeMove(facelets, turn);
          if (progress.index < guide.actions.length) {
            progress = observeLessonTurn(guide, progress, facelets, turn);
            expect(progress.wrongTurns).toEqual([]);
          }
        }
      }
      expect(facelets).toBe(action.after);
    }
    expect(lessonGoalReached(stage, facelets)).toBe(true);
    expect(progress.index).toBe(guide.actions.length);
  }
});

it('starts an arbitrary cube at the first stage and reverses verified wrong turns', () => {
  const start = lessonStart('cross', 0);
  expect(lessonCanStart('daisy', cubeMove(SOLVED_3X3, 'R'))).toBe(true);
  expect(lessonCanStart('cross', SOLVED_3X3)).toBe(false);
  const guide = buildLessonGuide('cross', start.facelets, start.deviceAlg.split(' '));
  const index = guide.actions.findIndex(action => action.rotation.startsWith('y'));
  const action = guide.actions[index];
  expect(action?.rotation).toMatch(/^y[2']?$/);
  const wrong = ['R', 'U', 'F', 'D', 'L', 'B'].find(turn => {
    const state = cubeMove(action.before, turn);
    return !matchesLessonAction(action, state) && !lessonGoalReached('cross', state);
  })!;
  const offPath = cubeMove(action.before, wrong);
  const progress = observeLessonTurn(guide, { index, facelets: action.before, wrongTurns: [] }, offPath, wrong);
  expect(progress.index).toBe(index);
  const undo = lessonMoveHint(action, progress)!;
  const deviceUndo = normalizeWcaScramble(`${action.pose} ${undo}`)!;
  const restored = cubeMove(offPath, deviceUndo);
  expect(restored).toBe(action.before);
  expect(observeLessonTurn(guide, progress, restored, deviceUndo).wrongTurns).toEqual([]);
  expect(observeLessonTurn(guide, { index, facelets: action.before, wrongTurns: [] }, action.after).index).toBeGreaterThan(index);
});

it('keeps the middle-layer y-prime in the formula, followed by the layer turn', () => {
  const actions = LBL_LESSON_RUNS.flatMap((_, variant) => {
    const start = lessonStart('middle', variant);
    return buildLessonGuide('middle', start.facelets, start.deviceAlg.split(' ')).actions;
  });
  const action = actions.find(step => step.rotation === "y'" && step.move === 'R' && step.group.rotationIndex > 0)!;
  expect(action).toBeDefined();
  const progress = { index: 0, facelets: action.before, wrongTurns: [] };
  const before = lessonFormulaHint(action, lessonRotationPending(action, progress, false));
  expect(before.current).toBe("y'");
  expect(before.pending[0]).toBe('R');
  const after = lessonFormulaHint(action, lessonRotationPending(action, progress, true));
  expect(after.done).toEqual([...before.done, "y'"]);
  expect(after.current).toBe('R');
  expect(after.pending).toEqual(before.pending.slice(1));
});

// With yellow up, the clockwise viewer yaw maps to +Z in the GAN sensor frame.
// Start with a non-identity heading to exercise calibration as well as the frame conversion.
const gyroHome = quatMul(SENSOR_BASES.rotX90, SENSOR_BASES.rotZ90);
const ganYaw = (degrees: number) => quatMul(gyroHome, {
  w: Math.cos(degrees * Math.PI / 360), x: 0, y: 0, z: Math.sin(degrees * Math.PI / 360),
});

it('mirrors a partial turn as soon as gyro samples arrive, even before teaching starts', () => {
  const tracker = new LessonRotationTracker();
  expect(tracker.liveOrientation.current).toBeNull();
  tracker.observe(ganYaw(0), 0, undefined, 'gan-v4');
  const initial = tracker.liveOrientation.current!;
  expect(quatAngleTo(initial, notationQuaternion(PRACTICE_GRIP))).toBeCloseTo(0);
  tracker.observe(ganYaw(45), 60, undefined, 'gan-v4');
  expect(quatAngleTo(tracker.liveOrientation.current!, initial)).toBeCloseTo(Math.PI / 4);
  tracker.observe(ganYaw(90), 120, undefined, 'gan-v4');
  expect(quatAngleTo(tracker.liveOrientation.current!, notationQuaternion(`${PRACTICE_GRIP} y`))).toBeCloseTo(0);
});

it('keeps an explicit grip calibration across practice starts until the connection resets', () => {
  const tracker = new LessonRotationTracker();
  expect(tracker.calibrateGrip(0)).toBe(false);
  tracker.observe(ganYaw(90), 10, undefined, 'gan-v4');
  expect(tracker.calibrateGrip(2000)).toBe(false);
  tracker.observe(ganYaw(90), 2100, undefined, 'gan-v4');
  expect(tracker.calibrateGrip(3100)).toBe(true);
  expect(quatAngleTo(tracker.liveOrientation.current!, notationQuaternion(PRACTICE_GRIP))).toBeCloseTo(0);

  tracker.observe(ganYaw(180), 3200, undefined, 'gan-v4');
  tracker.start(3220);
  const step = { pose: `${PRACTICE_GRIP} y`, rotation: 'y' };
  expect(quatAngleTo(tracker.liveOrientation.current!, notationQuaternion(step.pose))).toBeCloseTo(0);
  expect(tracker.observe(ganYaw(180), 3240, step, 'gan-v4')).toBe(false);
  expect(tracker.observe(ganYaw(180), 3320, step, 'gan-v4')).toBe(false);
  expect(tracker.observe(ganYaw(180), 3380, step, 'gan-v4')).toBe(true);

  tracker.reset();
  expect(tracker.calibrateGrip(3390)).toBe(false);
  expect(tracker.liveOrientation.current).toBeNull();
});

it.each([['y', 90], ["y'", -90], ['y2', 180], ['y2', -180]] as const)(
  'confirms %s only after the correct white-bottom gyro heading (%s°) settles', (rotation, yaw) => {
    const tracker = new LessonRotationTracker();
    const step = { pose: `${PRACTICE_GRIP} ${rotation}`, rotation };
    tracker.observe(gyroHome, 0, undefined, 'gan-v4');
    tracker.start(20);
    const report = (degrees: number, at: number) => tracker.observe(ganYaw(degrees), at, step, 'gan-v4');
    expect(report(yaw === 90 ? -90 : 90, 30)).toBe(false);
    expect(report(yaw === 90 ? -90 : 90, 110)).toBe(false);
    expect(report(yaw === 90 ? -90 : 90, 180)).toBe(false);
    expect(report(yaw - Math.sign(yaw) * 12, 220)).toBe(false);
    expect(report(yaw, 270)).toBe(false);
    expect(report(yaw, 350)).toBe(false);
    expect(report(yaw, 420)).toBe(true);
    expect(report(yaw, 500)).toBe(false);
  },
);

it('does not confirm a rotation with stale calibration, a sample gap, or a tilted target', () => {
  const tracker = new LessonRotationTracker();
  const step = { pose: `${PRACTICE_GRIP} y'`, rotation: "y'" };
  const report = (at: number) => tracker.observe(ganYaw(-90), at, step, 'gan-v4');
  tracker.observe(gyroHome, 0, undefined, 'gan-v4');
  tracker.start(700);
  expect(report(720)).toBe(false);
  expect(report(860)).toBe(false);

  tracker.observe(gyroHome, 900, undefined, 'gan-v4');
  tracker.start(920);
  expect(report(950)).toBe(false);
  expect(report(1300)).toBe(false);
  const tilted = quatMul(ganYaw(-90), SENSOR_BASES.rotX90);
  for (const at of [1360, 1450, 1540]) expect(tracker.observe(tilted, at, step, 'gan-v4')).toBe(false);
  expect(report(1570)).toBe(false);
  expect(report(1650)).toBe(false);
  expect(report(1720)).toBe(true);
});

it('recognizes a correct yaw while the cube is naturally tilted', () => {
  const tracker = new LessonRotationTracker();
  const step = { pose: `${PRACTICE_GRIP} y'`, rotation: "y'" };
  tracker.observe(gyroHome, 0, undefined, 'gan-v4');
  tracker.start(20);
  const tilt = { w: Math.cos(Math.PI / 12), x: Math.sin(Math.PI / 12), y: 0, z: 0 };
  const wrong = quatMul(ganYaw(90), tilt);
  for (const at of [30, 100, 170]) expect(tracker.observe(wrong, at, step, 'gan-v4')).toBe(false);
  const correct = quatMul(ganYaw(-90), tilt);
  expect(tracker.observe(correct, 200, step, 'gan-v4')).toBe(false);
  expect(tracker.observe(correct, 270, step, 'gan-v4')).toBe(false);
  expect(tracker.observe(correct, 340, step, 'gan-v4')).toBe(true);
});

it('recognizes the target front center while pitch and roll change', () => {
  const tracker = new LessonRotationTracker();
  const step = { pose: `${PRACTICE_GRIP} y'`, rotation: "y'" };
  tracker.observe(gyroHome, 0, undefined, 'gan-v4');
  tracker.start(20);
  // In the calibrated frame, roll about the front normal, then pitch about X.
  // The front center stays horizontally aligned even with both tilts present.
  const tilted = (pitchDegrees: number, rollDegrees: number) => {
    const pitch = pitchDegrees * Math.PI / 360;
    const roll = rollDegrees * Math.PI / 360;
    const sensorTilt = quatMul(
      { w: Math.cos(pitch), x: Math.sin(pitch), y: 0, z: 0 },
      { w: Math.cos(roll), x: 0, y: -Math.sin(roll), z: 0 },
    );
    return quatMul(quatMul(gyroHome, sensorTilt), quatMul(quatInverse(gyroHome), ganYaw(-90)));
  };
  expect(tracker.observe(tilted(43, 44), 200, step, 'gan-v4')).toBe(false);
  expect(tracker.observe(tilted(35, 39), 270, step, 'gan-v4')).toBe(false);
  expect(tracker.observe(tilted(45, 40), 340, step, 'gan-v4')).toBe(true);
});

it('confirms after two stable packets even if no more arrive, unless the cube leaves the target', () => {
  const tracker = new LessonRotationTracker();
  const step = { pose: `${PRACTICE_GRIP} y'`, rotation: "y'" };
  tracker.observe(gyroHome, 0, undefined, 'gan-v4');
  tracker.start(20);
  const report = (yaw: number, at: number) => tracker.observe(ganYaw(yaw), at, step, 'gan-v4');
  expect(report(-90, 100)).toBe(false);
  expect(tracker.confirmationAt(step)).toBeUndefined();
  expect(report(-90, 160)).toBe(false);
  expect(tracker.confirmationAt(step)).toBe(240);
  expect(tracker.confirm(step, 239)).toBe(false);
  expect(report(-180, 239)).toBe(false);
  expect(tracker.confirm(step, 240)).toBe(false);
  expect(report(-90, 300)).toBe(false);
  expect(report(-90, 360)).toBe(false);
  expect(tracker.confirm({ ...step }, 440)).toBe(false);
  expect(tracker.confirm(step, 440)).toBe(true);
  expect(tracker.confirm(step, 441)).toBe(false);
});

it('guides a setup in the white-bottom grip and completes it from reported facelets', () => {
  const preset = lessonStart('cross', 0);
  const controller = createSmartCubeGuidanceController({ solve: async () => null });
  controller.setConnected(true);
  controller.setContext({ id: 'cross', scramble: preset.scramble, orientation: PRACTICE_GRIP, targetFacelets: preset.facelets });
  let state = SOLVED_3X3;
  controller.syncFacelets(state);
  for (const move of preset.deviceAlg.split(' ')) {
    expect(controller.snapshot().hint?.current).toBe(normalizeWcaScramble(`${PRACTICE_GRIP} ${move}`));
    state = cubeMove(state, move);
    controller.observe(state, move);
  }
  expect(state).toBe(preset.facelets);
  expect(controller.snapshot().match).toBe(true);
  controller.dispose();
});

it('accepts arbitrary daisy starts and finds a one-turn change to a completed daisy', () => {
  const scrambled = lessonStart('daisy', 0);
  expect(planLessonSetup({ stage: 'daisy', source: scrambled.facelets, opening: scrambled.deviceAlg.split(' ') })?.deviceAlg).toBe('');
  const daisy = lessonStart('cross', 0);
  const plan = planLessonSetup({ stage: 'daisy', source: daisy.facelets, opening: daisy.deviceAlg.split(' ') })!;
  expect(plan.deviceAlg?.split(' ')).toHaveLength(1);
  expect(lessonCanStart('daisy', plan.facelets)).toBe(true);
});

it('truncates a setup at its first valid state, including a quarter turn within a half turn', () => {
  const source = lessonStart('cross', 0).facelets;
  const eligible = (state: string) => lessonCanStart('daisy', state);
  expect(eligible(source)).toBe(false);
  expect(firstLessonSetupStart(source, 'F2 U R', eligible)).toEqual({
    source, facelets: cubeMove(source, 'F'), deviceAlg: 'F',
  });
});

it('sets up middle-layer replay with one unsolved edge and no moves past the first valid state', () => {
  const source = SOLVED_3X3;
  const plan = planLessonSetup({ stage: 'middle', source, opening: [] })!;
  const turns = plan.deviceAlg!.split(' ');
  expect(turns.length).toBeLessThanOrEqual(9);
  let state = source;
  for (const move of turns) {
    expect(lessonCanStart('middle', state)).toBe(false);
    state = cubeMove(state, move);
  }
  expect(state).toBe(plan.facelets);
  expect(lessonCanStart('middle', state)).toBe(true);
  expect(lessonMiddleEdgesSolved(state)).toBe(3);
  expect(buildLessonGuide('middle', state, turns).actions.length).toBeGreaterThan(0);
});

it('reverses the line algorithm from a non-solved yellow cross, preserving both lower layers', () => {
  const source = lessonStart('yellow-face', 0);
  const opening = source.deviceAlg.split(' ');
  const plan = planLessonSetup({ stage: 'yellow-cross', requestedCase: 'line', source: source.facelets, opening })!;
  expect(plan.deviceAlg?.split(' ')).toHaveLength(6);
  const local = normalizeWcaScramble(`${PRACTICE_GRIP} ${source.deviceAlg} ${plan.deviceAlg}`)!;
  expect(yellowCrossPattern(local)).toBe('0110');
  expect(demoGoalReached('middle', local)).toBe(true);
  expect(lessonCanStart('yellow-cross', plan.facelets, 'line')).toBe(true);
  expect(lessonCanStart('yellow-cross', plan.facelets, 'elbow')).toBe(false);
  expect(lessonStart('yellow-cross', 0, 'line').facelets).not.toBe(plan.facelets);
  expect(buildLessonGuide('yellow-cross', plan.facelets, [...opening, ...plan.deviceAlg!.split(' ')]).actions).toHaveLength(6);
});

it('finds a nearby practice position and plans the missing prerequisite for a distant one', () => {
  const line = lessonStart('yellow-cross', 0, 'line');
  const fromLine = cubeMove(line.facelets, 'F');
  const nearby = planLessonSetup({ stage: 'yellow-cross', requestedCase: 'line', source: fromLine, opening: [...line.deviceAlg.split(' '), 'F'] })!;
  expect(nearby.deviceAlg?.split(' ')).toHaveLength(1);
  expect(lessonCanStart('yellow-cross', nearby.facelets, 'line')).toBe(true);

  const random = lessonStart('daisy', 0);
  const distant = planLessonSetup({ stage: 'middle', source: random.facelets, opening: random.deviceAlg.split(' ') })!;
  expect(distant.prerequisite).toBe('daisy');
  const local = normalizeWcaScramble(`${PRACTICE_GRIP} ${random.deviceAlg} ${distant.deviceAlg}`)!;
  expect(demoGoalReached('daisy', local)).toBe(true);
});

it('takes a scrambled cube directly to a valid top-cross case under a bounded solve budget', async () => {
  initSync({ module: new Uint8Array(readFileSync(new URL('../wasm/m2p/m2p_wasm_bg.wasm', import.meta.url))) });
  const solver = new Min2Phase();
  try {
    const random = lessonStart('daisy', 0);
    const request = { stage: 'yellow-cross', source: random.facelets, opening: random.deviceAlg.split(' ') } as const;
    expect(planLessonSetup(request)).toBeUndefined();
    for (const requestedCase of [undefined, 'line', 'elbow', 'dot'] satisfies LessonSetupRequest['requestedCase'][]) {
      const plan = await planDirectYellowCrossSetup({ ...request, requestedCase }, async (facelets, budget) =>
        solver.solveEx(facelets, budget.maxDepth, budget.probeMax, 0, 2));
      const moves = plan?.deviceAlg?.split(' ') ?? [];
      expect(moves.length).toBeGreaterThan(4);
      expect(moves.length).toBeLessThanOrEqual(21);
      expect(plan?.prerequisite).toBeUndefined();
      const final = moves.reduce(cubeMove, random.facelets);
      expect(lessonCanStart('yellow-cross', final, requestedCase)).toBe(true);
      const local = normalizeWcaScramble(`${PRACTICE_GRIP} ${random.deviceAlg} ${moves.join(' ')}`)!;
      expect(demoGoalReached('middle', local)).toBe(true);
      expect(yellowCrossPattern(local)).not.toBe('1111');
    }
  } finally {
    solver.free();
  }
});
