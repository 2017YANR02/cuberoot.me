/**
 * Movecount Coefficient (MCC) — trangium 的 3x3 公式执行速度指标。
 *
 * Faithful TypeScript port of algSpeed.js + the index.html helpers from
 * https://github.com/trangium/trangium.github.io (MIT, © 2021 trangium).
 * 算法逻辑刻意保持与上游逐分支一致(含各种怪癖),禁止顺手"清理";
 * 等价性由 tests/mcc.test.ts 的 golden fixture 锁定(fixture 由上游
 * algSpeed.js 原文生成,另做过 5000 例随机模糊对拍)。
 */

/** 已知步记号白名单(小写比对;含宽层/中层/整体转)。 */
export const MCC_KNOWN_MOVES = [
  'r', 'r2', "r'", 'u', "u'", 'u2', 'f', 'f2', "f'", 'd', 'd2', "d'",
  'l', 'l2', "l'", 'b', 'b2', "b'", 'm', 'm2', "m'", 's', 's2', "s'",
  'e', 'e2', "e'", 'x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2',
] as const;

export interface MccParams {
  /** Wrist Turn Multiplier(R/L 手腕转) */
  wristMult: number;
  /** Push Turn Multiplier(推转) */
  pushMult: number;
  /** Ring Turn Multiplier(无名指拨) */
  ringMult: number;
  /** Destabilize Penalty(失稳惩罚) */
  destabilize: number;
  /** Soft Regrip Penalty(软换手惩罚) */
  addRegrip: number;
  /** Half Turn Multiplier(180° 转) */
  double: number;
  /** S/E Slice Multiplier(S/E 中层) */
  sesliceMult: number;
  /** Overwork Penalty(手指过劳惩罚) */
  overWorkMult: number;
  /** Move Block Penalty(前步阻挡惩罚) */
  moveblock: number;
  /** y/z Rotation(整体转身代价) */
  rotation: number;
}

export const MCC_DEFAULTS: MccParams = {
  wristMult: 0.8,
  pushMult: 1.3,
  ringMult: 1.4,
  destabilize: 0.5,
  addRegrip: 1,
  double: 1.65,
  sesliceMult: 1.25,
  overWorkMult: 2.25,
  moveblock: 0.8,
  rotation: 3.5,
};

export interface EsqParams {
  /** Wrist Quarter Turns(手腕 90°) */
  wristQuarter: number;
  /** Flick Quarter Turns(手指 90°) */
  flickQuarter: number;
  /** Wrist Half Turns(手腕 180°) */
  wristHalf: number;
  /** Flick Half Turns(手指 180°) */
  flickHalf: number;
}

export const ESQ_DEFAULTS: EsqParams = {
  wristQuarter: 1,
  flickQuarter: 2,
  wristHalf: 2,
  flickHalf: 3,
};

/* 手指状态:[最后动作时刻, 位置];test() 的返回值沿用上游的混合约定:
 * 数组 = [卡住的步下标(-1=走完), speed, lWrist, rWrist, 左手最后动作时刻, 右手最后动作时刻],
 * 字符串 = "Unknown move: X"(外层靠 [0]=="U" 识别,与上游一致)。 */
type Finger = [number, string];
type TestResult = number[] | string;

function testRun(
  splitSeqIn: string[], lGrip: number, rGrip: number, speedIn: number, p: MccParams,
): TestResult {
  const { wristMult, pushMult, ringMult, destabilize, double: dbl, sesliceMult, overWorkMult, moveblock, rotation } = p;
  const splitSeq = splitSeqIn;
  let speed = speedIn;
  let lThumb: Finger = [-1, 'home']; // -1:AUF 期间可以预摆手指
  let lIndex: Finger = [-1, 'home'];
  let lMiddle: Finger = [-1, 'home'];
  let lRing: Finger = [-1, 'home'];
  let rThumb: Finger = [-1, 'home'];
  let rIndex: Finger = [-1, 'home'];
  let rMiddle: Finger = [-1, 'home'];
  let rRing: Finger = [-1, 'home'];
  let lOhCool = -1;
  let rOhCool = -1;
  let lWrist = lGrip;
  let rWrist = rGrip;
  let grip = 1;
  let udgrip = -1;
  let prevSpeed: number | null = null;
  let firstMoveSpeed: number | null = null;

  function overwork(finger: Finger, locationPrefer: string, penalty = overWorkMult): number {
    if (finger[1] != locationPrefer) {
      if (speed - finger[0] < penalty) {
        return penalty - speed + finger[0];
      }
    }
    return 0;
  }
  const lMax = () => Math.max(lThumb[0], lIndex[0], lMiddle[0], lRing[0]);
  const rMax = () => Math.max(rThumb[0], rIndex[0], rMiddle[0], rRing[0]);

  for (let j = 0; j < splitSeq.length; j++) {
    const move = splitSeq[j];
    const normalMove = move.toUpperCase();
    const prevMove = (j == 0 ? ' ' : splitSeq[j - 1]).toUpperCase();
    if (prevSpeed !== null) {
      firstMoveSpeed = speed;
      speed = prevSpeed;
    }
    if (j < splitSeq.length - 1) {
      if ((move[0] == 'U' && splitSeq[j + 1][0] == 'D') || (move[0] == 'D' && splitSeq[j + 1][0] == 'U')) {
        prevSpeed = speed;
      }
    }
    switch (normalMove) {
      case "R'":
        if (rWrist == 2) { rWrist = 0; } else if (rWrist > -1 && !(lWrist >= 1 && rWrist <= 0)) { rWrist--; } else { return [j, speed, lWrist, rWrist - 1, lMax(), rMax()]; }
        speed += wristMult;
        break;
      case 'R':
        if (rWrist < 2 && !(lWrist <= -1 && rWrist >= 0)) { rWrist++; } else { return [j, speed, lWrist, rWrist + 1, lMax(), rMax()]; }
        speed += wristMult;
        break;
      case 'R2':
        if (rWrist >= 1 && lWrist < 1) { rWrist = -1; } else if (lWrist > -1) { rWrist += 2; } else { return [j, speed, lWrist, (rWrist > 0) ? rWrist - 2 : rWrist + 2, lMax(), rMax()]; }
        speed += dbl * wristMult;
        break;
      case 'U':
        if (rWrist == 0 && (rThumb[0] + overWorkMult <= speed || rThumb[1] != 'top') && rIndex[1] != 'm') {
          if (overwork(rIndex, 'home') <= overwork(rMiddle, 'home')) {
            speed += overwork(rIndex, 'home');
            speed++;
            rIndex = [speed, 'uflick'];
          } else {
            speed += overwork(rMiddle, 'home');
            speed++;
            rIndex = [speed, 'uflick'];
            rMiddle = [speed, 'uflick'];
          }
        } else if (rWrist == 1 && lWrist == 0) {
          speed += overwork(lIndex, 'uflick');
          if (prevMove == "B'") { speed += moveblock + pushMult; } else if (prevMove[0] == "B'") { speed += moveblock * 0.5 + pushMult; } else { speed += pushMult; }
          lIndex = [speed, 'home'];
        } else if (lWrist == 0 && prevMove[0] != 'F' && prevMove[0] != 'B') {
          if (lIndex[1] == 'uflick') {
            speed += overwork(lIndex, 'eido', 0.75 * overWorkMult);
            speed = Math.max(speed, lOhCool + 2.5);
          } else {
            speed += overwork(lIndex, 'eido', 1.25 * overWorkMult);
          }
          speed += 1.15 * pushMult;
          lIndex = [speed, 'uflick'];
          lOhCool = speed;
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case "U'":
        if (lWrist == 0 && (lThumb[0] + overWorkMult <= speed || lThumb[1] != 'top') && lIndex[1] != 'm') {
          if (overwork(lIndex, 'home') <= overwork(lMiddle, 'home')) {
            speed += overwork(lIndex, 'home');
            speed++;
            lIndex = [speed, 'uflick'];
          } else {
            speed += overwork(lMiddle, 'home');
            speed++;
            lIndex = [speed, 'uflick'];
            lMiddle = [speed, 'uflick'];
          }
        } else if (lWrist == 1 && rWrist == 0) {
          speed += overwork(rIndex, 'uflick');
          if (prevMove == 'B') { speed += moveblock + pushMult; } else if (prevMove[0] == "B'") { speed += moveblock * 0.5 + pushMult; } else { speed += pushMult; }
          rIndex = [speed, 'home'];
        } else if (rWrist == 0 && prevMove[0] != 'F' && prevMove[0] != 'B') {
          if (rIndex[1] == 'uflick') {
            speed += overwork(rIndex, 'eido', 0.75 * overWorkMult);
            speed = Math.max(speed, rOhCool + 2.5);
          } else {
            speed += overwork(rIndex, 'eido', 1.25 * overWorkMult);
          }
          speed += 1.15 * pushMult;
          rIndex = [speed, 'uflick'];
          rOhCool = speed;
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'U2':
        if (rWrist == 0 && (lIndex[1] == 'm' || lWrist != 0 || (Math.max(overwork(rIndex, 'home'), overwork(rMiddle, 'home'), overwork(rRing, 'u2grip')) <= Math.max(overwork(lIndex, 'home'), overwork(lMiddle, 'home'), overwork(lRing, 'u2grip'))))) {
          speed += overwork(rIndex, 'home');
          speed += overwork(rMiddle, 'home');
          speed += overwork(rRing, 'u2grip', moveblock * overWorkMult);
          speed += dbl;
          rIndex = [speed, 'uflick'];
          rMiddle = [speed, 'uflick'];
        } else if (lWrist == 0) {
          speed += overwork(lIndex, 'home');
          speed += overwork(lMiddle, 'home');
          speed += overwork(lRing, 'u2grip', moveblock * overWorkMult);
          speed += dbl;
          lIndex = [speed, 'uflick'];
          lMiddle = [speed, 'uflick'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'D':
        if (lWrist == 0 && (rWrist != 0 || (Math.max(overwork(lRing, 'home'), overwork(lMiddle, 'home')) <= Math.max(overwork(rRing, 'dflick'), overwork(rMiddle, 'home'))))) {
          speed += overwork(lRing, 'home');
          speed += overwork(lMiddle, 'home');
          if (prevMove[0] == 'B') { speed += moveblock * 0.5 + ringMult; } else { speed += ringMult; }
          lRing = [speed, 'dflick'];
        } else if (rWrist == 0 && prevMove[0] != 'B') {
          speed += overwork(rRing, 'dflick');
          speed += overwork(rMiddle, 'home');
          speed += ringMult * pushMult;
          rRing = [speed, 'home'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case "D'":
        if (rWrist == 0 && (lWrist != 0 || (Math.max(overwork(rRing, 'home'), overwork(rMiddle, 'home')) <= Math.max(overwork(lRing, 'dflick'), overwork(lMiddle, 'home'))))) {
          speed += overwork(rRing, 'home');
          speed += overwork(rMiddle, 'home');
          if (prevMove[0] == 'B') { speed += moveblock * 0.5 + ringMult; } else { speed += ringMult; }
          rRing = [speed, 'dflick'];
        } else if (lWrist == 0 && prevMove[0] != 'B') {
          speed += overwork(lRing, 'dflick');
          speed += overwork(lMiddle, 'home');
          speed += ringMult * pushMult;
          lRing = [speed, 'home'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'D2':
        if (rWrist == 0 && (lWrist != 0 || (Math.max(overwork(rMiddle, 'home'), overwork(rRing, 'home')) <= Math.max(overwork(lMiddle, 'home'), overwork(lRing, 'home'))))) {
          speed += overwork(rMiddle, 'home');
          speed += overwork(rRing, 'home');
          if (prevMove[0] == 'B') { speed += moveblock * 0.5 + dbl * ringMult; } else { speed += dbl * ringMult; }
          rRing = [speed, 'dflick'];
        } else if (lWrist == 0) {
          speed += overwork(lMiddle, 'home');
          speed += overwork(lRing, 'home');
          if (prevMove[0] == 'B') { speed += moveblock * 0.5 + dbl * ringMult; } else { speed += dbl * ringMult; }
          lRing = [speed, 'dflick'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'F':
        if (rWrist == -1) {
          speed += overwork(rIndex, 'home');
          speed += 1;
          rIndex = [speed, 'uflick'];
        } else if (lWrist == 1 && move != 'f') {
          speed += overwork(lRing, 'home');
          if (prevMove[0] == 'D') { speed += moveblock * 0.5 + ringMult; } else { speed += 1; }
          lRing = [speed, 'dflick'];
        } else if (rWrist == 1 && prevMove[0] != 'D' && move != 'f') {
          speed += overwork(rRing, 'dflick');
          speed += ringMult * pushMult;
          rRing = [speed, 'home'];
        } else if (lWrist == -1 && rWrist == 0 && overwork(rIndex, 'uflick') == 0) {
          speed += 1;
          rIndex = [speed, 'fflick'];
        } else if (lWrist == -1 && overwork(lIndex, 'uflick') == 0 && prevMove[0] != 'U') {
          speed += pushMult;
          lIndex = [speed, 'home'];
        } else if (lWrist == -1 && grip == -1) {
          speed += overwork(lThumb, 'top', 0.9 * overWorkMult);
          speed += overwork(lIndex, 'top');
          if (prevMove[0] == 'D') { speed += 1.8; } else { speed += 1; }
          lWrist++;
          lThumb = [speed, 'leftu'];
          lIndex = [speed, 'top'];
        } else if (lWrist == 0 && grip == -1) {
          speed += overwork(lThumb, 'bottom');
          speed += overwork(lIndex, 'top');
          if (prevMove[0] == 'D') { speed += 2.05; } else { speed += 1.25; }
          lThumb = [speed, 'top'];
          lIndex = [speed, 'top'];
        } else if (rWrist == 0 && lWrist == 0 && move == 'f') {
          speed += overwork(rIndex, 'uflick');
          speed += overwork(rMiddle, 'home');
          speed += 1;
          rIndex = [speed, 'fflick'];
        } else if (j == 0 && rWrist == 0 && lWrist == 0) {
          speed += overwork(rThumb, 'top');
          speed += 1;
          rThumb = [speed, 'rdown'];
          rMiddle = [speed, 'uflick'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case "F'":
        if (lWrist == -1) {
          speed += overwork(lIndex, 'home');
          speed += 1;
          lIndex = [speed, 'uflick'];
        } else if (rWrist == 1 && move != 'f') {
          speed += overwork(rRing, 'home');
          if (prevMove[0] == 'D') { speed += moveblock * 0.5 + ringMult; } else { speed += 1; }
          rRing = [speed, 'dflick'];
        } else if (lWrist == 1 && prevMove[0] != 'D' && move != 'f') {
          speed += overwork(lRing, 'dflick');
          speed += ringMult * pushMult;
          lRing = [speed, 'home'];
        } else if (rWrist == -1 && lWrist == 0 && overwork(lIndex, 'uflick') == 0) {
          speed += 1;
          lIndex = [speed, 'fflick'];
        } else if (rWrist == -1 && overwork(rIndex, 'uflick') == 0 && prevMove[0] != 'U') {
          speed += pushMult;
          rIndex = [speed, 'home'];
        } else if (rWrist == -1 && grip == 1) {
          speed += overwork(rThumb, 'top', 0.9 * overWorkMult);
          speed += overwork(rIndex, 'top');
          if (prevMove[0] == 'D') { speed += 1.8; } else { speed += 1; }
          rWrist++;
          rThumb = [speed, 'rightu'];
          rIndex = [speed, 'top'];
        } else if (rWrist == 0 && grip == 1) {
          speed += overwork(rThumb, 'bottom');
          speed += overwork(rIndex, 'top');
          if (prevMove[0] == 'D') { speed += 2.05; } else { speed += 1.25; }
          rThumb = [speed, 'top'];
          rIndex = [speed, 'top'];
        } else if (lWrist == 0 && rWrist == 0 && move == "f'") {
          speed += overwork(lIndex, 'uflick');
          speed += overwork(lMiddle, 'home');
          speed += 1;
          lIndex = [speed, 'fflick'];
        } else if (j == 0 && rWrist == 0 && lWrist == 0) {
          speed += overwork(lThumb, 'top');
          speed += 1;
          lThumb = [speed, 'rdown'];
          lMiddle = [speed, 'uflick'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'F2':
        if (rWrist == -1 && (lWrist != -1 || (Math.max(overwork(rIndex, 'home'), overwork(rMiddle, 'home'), overwork(rRing, 'u2grip')) <= Math.max(overwork(lIndex, 'home'), overwork(lMiddle, 'home'), overwork(lRing, 'u2grip'))))) {
          speed += overwork(rIndex, 'home');
          speed += overwork(rMiddle, 'home');
          speed += overwork(rRing, 'u2grip');
          speed += dbl;
          rIndex = [speed, 'uflick'];
          rMiddle = [speed, 'uflick'];
        } else if (lWrist == -1) {
          speed += overwork(lIndex, 'home');
          speed += overwork(lMiddle, 'home');
          speed += overwork(lRing, 'u2grip');
          speed += dbl;
          lIndex = [speed, 'uflick'];
          lMiddle = [speed, 'uflick'];
        } else if (rWrist == 1 && (lWrist != 1 || (Math.max(overwork(rMiddle, 'home'), overwork(rRing, 'home')) <= Math.max(overwork(lMiddle, 'home'), overwork(lRing, 'home'))))) {
          speed += overwork(rMiddle, 'home');
          speed += overwork(rRing, 'home');
          if (prevMove[0] == 'D') { speed += dbl * ringMult + moveblock * 0.5; } else { speed += dbl * ringMult; }
          rRing = [speed, 'dflick'];
        } else if (lWrist == 1) {
          speed += overwork(lMiddle, 'home');
          speed += overwork(lRing, 'home');
          if (prevMove[0] == 'D') { speed += dbl * ringMult + moveblock * 0.5; } else { speed += dbl * ringMult; }
          lRing = [speed, 'dflick'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'L':
        if (lWrist == 2) { lWrist = 0; } else if (lWrist > -1 && !(rWrist >= 1 && lWrist <= 0)) { lWrist--; } else { return [j, speed, lWrist - 1, rWrist, lMax(), rMax()]; }
        speed += wristMult;
        break;
      case "L'":
        if (lWrist < 2 && !(rWrist <= -1 && lWrist >= 0)) { lWrist++; } else { return [j, speed, lWrist + 1, rWrist, lMax(), rMax()]; }
        speed += wristMult;
        break;
      case 'L2':
        if (lWrist >= 1 && rWrist < 1) { lWrist = -1; } else if (rWrist > -1) { lWrist += 2; } else { return [j, speed, (lWrist > 0) ? lWrist - 2 : lWrist + 2, rWrist, lMax(), rMax()]; }
        speed += dbl * wristMult;
        break;
      case 'B':
        if (rWrist == 1) {
          speed += overwork(rIndex, 'home');
          speed++;
          rIndex = [speed, 'uflick'];
        } else if (lWrist == -1) {
          speed += overwork(lRing, 'home');
          speed += overwork(lMiddle, 'home');
          if (prevMove[0] == 'U') { speed += moveblock * 0.5 + ringMult; } else { speed += ringMult; }
          lRing = [speed, 'dflick'];
        } else if (lWrist == 1 && prevMove[0] != 'U' && prevMove[0] != 'D') {
          if (lIndex[1] == 'uflick') {
            speed += overwork(lIndex, 'eido', 0.75 * overWorkMult);
            speed = Math.max(speed, lOhCool + 2.5);
          } else {
            speed += overwork(lIndex, 'eido', 1.25 * overWorkMult);
          }
          speed += 1.15 * pushMult;
          lIndex = [speed, 'uflick'];
          lOhCool = speed;
        } else if (lWrist == 0 && (rWrist == 1 || rWrist == -1)) {
          speed += overwork(lIndex, 'top', 0.9 * overWorkMult);
          if (prevMove[0] == 'U') { speed += 1.45; } else { speed += 1; }
          lIndex = [speed, 'leftdb'];
        } else if (rWrist == -1 && prevMove[0] != 'U') {
          speed += overwork(rRing, 'dflick');
          speed += overwork(rMiddle, 'home');
          speed += ringMult * pushMult;
          rRing = [speed, 'home'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case "B'":
        if (lWrist == 1) {
          speed += overwork(lIndex, 'home');
          speed++;
          lIndex = [speed, 'uflick'];
        } else if (rWrist == -1) {
          speed += overwork(rRing, 'home');
          speed += overwork(rMiddle, 'home');
          if (prevMove[0] == 'U') { speed += moveblock * 0.5 + ringMult; } else { speed += ringMult; }
          rRing = [speed, 'dflick'];
        } else if (rWrist == 1 && prevMove[0] != 'U' && prevMove[0] != 'D') {
          if (rIndex[1] == 'uflick') {
            speed += overwork(rIndex, 'eido', 0.75 * overWorkMult);
            speed = Math.max(speed, rOhCool + 2.5);
          } else {
            speed += overwork(rIndex, 'eido', 1.25 * overWorkMult);
          }
          speed += 1.15 * pushMult;
          rIndex = [speed, 'uflick'];
          rOhCool = speed;
        } else if (rWrist == 0 && (lWrist == 1 || lWrist == -1)) {
          speed += overwork(rIndex, 'top', 0.9 * overWorkMult);
          if (prevMove[0] == 'U') { speed += 1.45; } else { speed += 1; }
          rIndex = [speed, 'rightdb'];
        } else if (lWrist == -1 && prevMove[0] != 'U') {
          speed += overwork(lRing, 'dflick');
          speed += overwork(lMiddle, 'home');
          speed += ringMult * pushMult;
          lRing = [speed, 'home'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'B2':
        if (rWrist == 1 && (lWrist != 1 || (Math.max(overwork(rIndex, 'home'), overwork(rMiddle, 'home'), overwork(rRing, 'u2grip')) <= Math.max(overwork(lIndex, 'home'), overwork(lMiddle, 'home'), overwork(lRing, 'u2grip'))))) {
          speed += overwork(rIndex, 'home');
          speed += overwork(rMiddle, 'home');
          speed += overwork(rRing, 'u2grip');
          speed += dbl;
          rIndex = [speed, 'uflick'];
          rMiddle = [speed, 'uflick'];
        } else if (lWrist == 1) {
          speed += overwork(lIndex, 'home');
          speed += overwork(lMiddle, 'home');
          speed += overwork(lRing, 'u2grip');
          speed += dbl;
          lIndex = [speed, 'uflick'];
          lMiddle = [speed, 'uflick'];
        } else if (lWrist == -1 && (rWrist != -1 || (Math.max(overwork(rMiddle, 'home'), overwork(rRing, 'home')) > Math.max(overwork(lMiddle, 'home'), overwork(lRing, 'home'))))) {
          speed += overwork(lMiddle, 'home');
          speed += overwork(lRing, 'home');
          if (prevMove[0] == 'U') { speed += moveblock * 0.5 + dbl * ringMult; } else { speed += dbl * ringMult; }
          lRing = [speed, 'dflick'];
        } else if (rWrist == -1) {
          speed += overwork(rMiddle, 'home');
          speed += overwork(rRing, 'home');
          if (prevMove[0] == 'U') { speed += moveblock * 0.5 + dbl * ringMult; } else { speed += dbl * ringMult; }
          rRing = [speed, 'dflick'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'S':
        if (rWrist == 0 && (lWrist != 0 || overwork(rIndex, 'top', 1.25 * overWorkMult) <= (moveblock * 0.5 + pushMult - 1) * sesliceMult)) {
          speed += overwork(rIndex, 'top', 1.25 * overWorkMult);
          speed += sesliceMult;
          rIndex = [speed, 'sflick'];
        } else if (lWrist == 0 && rWrist == -1) {
          speed += overwork(rIndex, 'home', 1.25 * overWorkMult);
          speed += overwork(rThumb, 'top', 1.25 * overWorkMult);
          speed += overwork(rMiddle, 'home', 1.25 * overWorkMult);
          speed += sesliceMult;
          rThumb = [speed, 'top'];
          rMiddle = [speed, 'eflick'];
        } else if (lWrist == 0 && (rWrist == 0 || (rWrist == 1 && (prevMove == 'R' || prevMove == 'L')))) {
          speed += overwork(lIndex, 'uflick', 1.25 * overWorkMult);
          if (prevMove[0] == 'U') { speed += moveblock * 0.5 + pushMult * sesliceMult; } else { speed += pushMult * sesliceMult; }
          lIndex = [speed, 'top'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case "S'":
        if (lWrist == 0 && (rWrist != 0 || overwork(lIndex, 'top', 1.25 * overWorkMult) <= (moveblock * 0.5 + pushMult - 1) * sesliceMult)) {
          speed += overwork(lIndex, 'top', 1.25 * overWorkMult);
          speed += sesliceMult;
          lIndex = [speed, 'sflick'];
        } else if (rWrist == 0 && lWrist == -1) {
          speed += overwork(lIndex, 'home', 1.25 * overWorkMult);
          speed += overwork(lThumb, 'bottom', 1.25 * overWorkMult);
          speed += overwork(lMiddle, 'home', 1.25 * overWorkMult);
          speed += sesliceMult;
          lThumb = [speed, 'top'];
          lMiddle = [speed, 'eflick'];
        } else if (rWrist == 0 && (lWrist == 0 || (lWrist == 1 && (prevMove == 'R' || prevMove == 'L')))) {
          speed += overwork(rIndex, 'uflick', 1.25 * overWorkMult);
          if (prevMove[0] == 'U') { speed += moveblock * 0.5 + pushMult * sesliceMult; } else { speed += pushMult * sesliceMult; }
          rIndex = [speed, 'top'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'S2':
        if ((rWrist == -1 || rWrist == 1) && lWrist == 0) {
          speed += overwork(rThumb, 'home');
          speed += overwork(rIndex, 'home');
          speed += overwork(rMiddle, 'home');
          speed += overwork(rRing, 'u2grip');
          speed += sesliceMult * dbl;
          rMiddle = [speed, 'e'];
          rIndex = [speed, 'e'];
        } else if ((lWrist == -1 || lWrist == 1) && rWrist == 0) {
          speed += overwork(lThumb, 'home');
          speed += overwork(lIndex, 'home');
          speed += overwork(lMiddle, 'home');
          speed += overwork(lRing, 'u2grip');
          speed += sesliceMult * dbl;
          // 上游此分支写回的是右手手指(疑似笔误),保持一致
          rMiddle = [speed, 'e'];
          rIndex = [speed, 'e'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'E':
        if ((rWrist == 1 || rWrist == -1) && lWrist == 0) {
          speed += overwork(lIndex, 'home');
          speed += sesliceMult;
          lIndex = [speed, 'e'];
        } else if ((lWrist == 1 || lWrist == -1) && rWrist == 0 && prevMove[0] != 'B') {
          speed += overwork(rIndex, 'e');
          speed += sesliceMult * pushMult;
          rIndex = [speed, 'home'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case "E'":
        if ((lWrist == 1 || lWrist == -1) && rWrist == 0) {
          speed += overwork(rIndex, 'home');
          speed += sesliceMult;
          rIndex = [speed, 'e'];
        } else if ((rWrist == 1 || rWrist == -1) && lWrist == 0 && prevMove[0] != 'B') {
          speed += overwork(lIndex, 'e');
          speed += sesliceMult * pushMult;
          lIndex = [speed, 'home'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'E2':
        if ((lWrist == 1 || lWrist == -1) && rWrist == 0) {
          speed += overwork(rIndex, 'home');
          speed += overwork(rMiddle, 'home');
          speed += overwork(rRing, 'u2grip');
          speed += sesliceMult * dbl;
          rIndex = [speed, 'e'];
          rMiddle = [speed, 'e'];
        } else if ((rWrist == 1 || rWrist == -1) && lWrist == 0) {
          speed += overwork(lIndex, 'home');
          speed += overwork(lMiddle, 'home');
          speed += overwork(lRing, 'u2grip');
          speed += sesliceMult * dbl;
          lIndex = [speed, 'e'];
          lMiddle = [speed, 'e'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case "M'":
        if (lWrist == 0) {
          speed += overwork(lThumb, 'home');
          speed += overwork(lIndex, 'm');
          speed += overwork(lMiddle, 'm');
          speed += overwork(lRing, 'm');
          if (prevMove[0] == 'B') { speed += 1.8; } else { speed += 1; }
          lThumb = [speed, 'home'];
          lIndex = [speed, 'm'];
          lMiddle = [speed, 'mflick'];
          lRing = [speed, 'm'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'M':
        if (lWrist == 0 && prevMove[0] != 'B') {
          speed += overwork(lThumb, 'home');
          speed += overwork(lIndex, 'm');
          speed += overwork(lMiddle, 'mflick', 1.25 * overWorkMult);
          speed += overwork(lRing, 'm');
          speed += pushMult;
          lThumb = [speed, 'home'];
          lIndex = [speed, 'm'];
          lMiddle = [speed, 'm'];
          lRing = [speed, 'm'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'M2':
        if (lWrist == 0) {
          speed += overwork(lThumb, 'home');
          speed += overwork(lIndex, 'm');
          speed += overwork(lMiddle, 'm');
          speed += overwork(lRing, 'm');
          if (prevMove[0] == 'B') { speed += moveblock + dbl; } else { speed += dbl; }
          lThumb = [speed, 'home'];
          lIndex = [speed, 'm'];
          lMiddle = [speed, 'mflick'];
          lRing = [speed, 'm'];
        } else {
          return [j, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'X':
        lWrist += 1;
        rWrist += 1;
        if (lWrist > 1 || rWrist > 1) {
          return [j + 1, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case "X'":
        lWrist -= 1;
        rWrist -= 1;
        if (lWrist < -1 || rWrist < -1) {
          return [j + 1, speed, lWrist, rWrist, lMax(), rMax()];
        }
        break;
      case 'X2':
        if (lWrist >= 1 && rWrist >= 1) {
          lWrist -= 2;
          rWrist -= 2;
        } else if (lWrist <= -1 && rWrist <= -1) {
          lWrist += 2;
          rWrist += 2;
        } else if (lWrist + rWrist > 0) {
          return [j, speed, lWrist - 2, rWrist - 2, lMax(), rMax()];
        } else {
          return [j, speed, lWrist + 2, rWrist + 2, lMax(), rMax()];
        }
        break;
      case 'Y': case "Y'": case 'Z': case "Z'":
        speed += rotation;
        return [j + 1, speed, 0, 0, lMax(), rMax()];
      case 'Y2': case 'Z2':
        speed += rotation * dbl;
        return [j + 1, speed, 0, 0, lMax(), rMax()];
      default:
        return 'Unknown move: ' + move;
    }
    if (firstMoveSpeed !== null) {
      speed = Math.max(firstMoveSpeed, speed) + 0.5;
      prevSpeed = null;
      firstMoveSpeed = null;
    }
    if ((move[0] == 'R' || move[0] == 'l') && grip == -1) {
      grip = 1;
      speed += 0.65;
    } else if ((move[0] == 'r' || move[0] == 'L') && grip == 1) {
      grip = -1;
      speed += 0.65;
    }
    if ((move[0] == 'd') && udgrip == -1) {
      udgrip = 1;
      speed += 2.25;
    } else if ((move[0] == 'U' || move[0] == 'u') && udgrip == 1) {
      udgrip = -1;
      speed += 2.25;
    }
    if (j >= 2) {
      if ((normalMove == 'R' && move == splitSeq[j - 2] && splitSeq[j - 1].toUpperCase() == "U'") || (normalMove == "R'" && move == splitSeq[j - 2] && splitSeq[j - 1].toUpperCase() == 'U')) {
        speed -= 0.5;
      } else if ((normalMove == 'R' && move == splitSeq[j - 2] && splitSeq[j - 1].toUpperCase() == "D'" && rWrist == 1) || (normalMove == "R'" && move == splitSeq[j - 2] && splitSeq[j - 1].toUpperCase() == 'D')) {
        speed -= 0.3;
      }
    }
    if (normalMove == 'U' && (lWrist == -1 || rWrist == -1)) {
      speed += destabilize;
    }
    if (normalMove == 'B' && (lWrist == 0 || rWrist == 0)) {
      speed += destabilize;
    }
    if (normalMove == 'D' && (lWrist == 1 || rWrist == 1)) {
      speed += destabilize;
    }
    if (normalMove == 'S' && (lWrist == 1 || rWrist == 1 || lWrist == -1 || rWrist == -1)) {
      speed += destabilize;
    }
    if (normalMove == 'E' && (lWrist == 0 || rWrist == 0)) {
      speed += destabilize;
    }
  }
  return [-1, speed, lGrip, rGrip];
}

/** 去首尾 U(AUF):首尾的大写 U 步剔除;"D U …" 形态把 U 吃掉留 D。原地改传入数组。 */
function stripAuf(splitSeq: string[]): string[] {
  if (splitSeq.length >= 1) {
    if (splitSeq[0][0] == 'U') {
      splitSeq.shift();
    } else if (splitSeq.length >= 2) {
      if (splitSeq[0][0].toLowerCase() == 'd' && splitSeq[1][0] == 'U') {
        splitSeq[1] = splitSeq[0];
        splitSeq.shift();
      }
    }
  }
  if (splitSeq.length >= 1) {
    if (splitSeq[splitSeq.length - 1][0] == 'U') {
      splitSeq.pop();
    } else if (splitSeq.length >= 2) {
      if (splitSeq[splitSeq.length - 1][0].toLowerCase() == 'd' && splitSeq[splitSeq.length - 2][0] == 'U') {
        splitSeq[splitSeq.length - 2] = splitSeq[splitSeq.length - 1];
        splitSeq.pop();
      }
    }
  }
  return splitSeq;
}

/**
 * 单条公式的 MCC。返回数字(保留 1 位小数),或 "Unknown move: X" 错误串
 * (ignoreErrors=false 且含未知步时)。
 */
export function algSpeed(
  sequence: string,
  ignoreErrors = false,
  ignoreauf = false,
  p: MccParams = MCC_DEFAULTS,
): number | string {
  const { addRegrip, double: dbl, rotation } = p;
  let splitSeq: string[] = [];
  for (const seg of sequence.split(' ')) {
    if (ignoreErrors) {
      if ((MCC_KNOWN_MOVES as readonly string[]).includes(seg.toLowerCase())) splitSeq.push(seg);
    } else if (seg != '') {
      splitSeq.push(seg);
    }
  }
  if (ignoreauf) stripAuf(splitSeq);

  let tests: TestResult[] = [
    testRun(splitSeq, 0, 0, 0, p),
    testRun(splitSeq, 0, -1, 1 + addRegrip, p),
    testRun(splitSeq, 0, 1, 1 + addRegrip, p),
    testRun(splitSeq, -1, 0, 1 + addRegrip, p),
    testRun(splitSeq, 1, 0, 1 + addRegrip, p),
  ];
  while (true) {
    for (const t of tests) {
      if (t[0] == 'U') { // 字符串 "Unknown move: …" 的首字符;上游同款判法
        return t as string;
      }
    }
    let bestTest = tests[0] as number[];
    for (let i = 1; i < tests.length; i++) {
      const compTest = tests[i] as number[];
      if (compTest[0] == -1 && (bestTest[0] != -1 || bestTest[1] > compTest[1])) { bestTest = compTest; }
      else if (compTest[0] > bestTest[0] && bestTest[0] != -1) { bestTest = compTest; }
      else if (compTest[0] == bestTest[0] && compTest[1] < bestTest[1] && bestTest[0] != -1) { bestTest = compTest; }
    }
    if (bestTest[0] == -1) { return Math.round(bestTest[1] * 10) / 10; }
    tests = [];

    const prevMoveType = bestTest[0] >= 1 ? splitSeq[bestTest[0] - 1][0] : ' ';
    const prev2Type = bestTest[0] >= 2 ? splitSeq[bestTest[0] - 2][0] : ' ';
    let doubleRegrip = false;

    if ((bestTest[2] > 1 || bestTest[2] < -1) && (bestTest[3] > 1 || bestTest[3] < -1)) {
      doubleRegrip = true;
    }

    for (let leftWrist = -1; leftWrist < 2; leftWrist++) {
      for (let rightWrist = -1; rightWrist < 2; rightWrist++) {
        const leftMatch = (bestTest[2] == leftWrist);
        const rightMatch = (bestTest[3] == rightWrist);
        if (['X', 'x', 'Y', 'y', 'Z', 'z'].includes(prevMoveType)) { // 整体转后手位任意重摆
          tests.push(testRun(splitSeq.slice(bestTest[0]), leftWrist, rightWrist, bestTest[1], p));
        } else {
          let penalty = doubleRegrip ? (rotation * dbl) : 2; // 双手同时 regrip 极罕见,penalty 几乎总是 2
          const rMoveLatency = (prevMoveType == 'R' || prev2Type == 'R' || prevMoveType == 'r' || prev2Type == 'r') ? 1 : 0;
          const lMoveLatency = (prevMoveType == 'L' || prev2Type == 'L' || prevMoveType == 'l' || prev2Type == 'l') ? 1 : 0;
          if (leftMatch || doubleRegrip) {
            const rHandLatency = Math.max(0, 2 - (bestTest[1] - bestTest[5])); // 右手最后动作距今
            penalty = Math.max(rHandLatency, rMoveLatency, lMoveLatency * 2);
            tests.push(testRun(splitSeq.slice(bestTest[0]), leftWrist, rightWrist, bestTest[1] + penalty + addRegrip, p));
          } else if (rightMatch || doubleRegrip) {
            const lHandLatency = Math.max(0, 2 - (bestTest[1] - bestTest[4])); // 左手最后动作距今
            penalty = Math.max(lHandLatency, lMoveLatency, rMoveLatency * 2);
            tests.push(testRun(splitSeq.slice(bestTest[0]), leftWrist, rightWrist, bestTest[1] + penalty + addRegrip, p));
          }
        }
      }
    }
    splitSeq = splitSeq.slice(bestTest[0]);
  }
}

/** 相邻同步合并为 180°("R R"→"R2","U' U'"→"U2"),与上游 UI 预处理一致。 */
export function replaceDouble(str: string): string {
  const segs = str.split(' ');
  for (let i = 1; i < segs.length; i++) {
    if (segs[i] === segs[i - 1] && (segs[i].length === 1 || (segs[i].length === 2 && segs[i][1] === "'"))) {
      segs.splice(i - 1, 2, segs[i][0] + '2');
    }
  }
  return segs.join(' ');
}

/** 白名单过滤(未知步始终丢弃)+ 可选去首尾 U;STM / ESQ 共用。 */
export function processAlg(str: string, ignoreAuf: boolean): string[] {
  const splitSeq: string[] = [];
  for (const seg of str.split(' ')) {
    if ((MCC_KNOWN_MOVES as readonly string[]).includes(seg.toLowerCase())) splitSeq.push(seg);
  }
  if (ignoreAuf) stripAuf(splitSeq);
  return splitSeq;
}

/** STM(照上游口径:整体转 x/y/z 也计 1 步;未知步不计)。 */
export function getSTM(str: string, ignoreAuf: boolean): number {
  return processAlg(str, ignoreAuf).length;
}

/** Enhanced SQTM:R/L 系按手腕档计,其余(含 x/y/z)按手指档计。 */
export function getESQ(str: string, ignoreAuf: boolean, p: EsqParams = ESQ_DEFAULTS): number {
  const algArr = processAlg(str, ignoreAuf);
  let esq = 0;
  for (const move of algArr) {
    if (move[0].toLowerCase() === 'r' || move[0].toLowerCase() === 'l') {
      esq += move[move.length - 1] === '2' ? p.wristHalf : p.wristQuarter;
    } else {
      esq += move[move.length - 1] === '2' ? p.flickHalf : p.flickQuarter;
    }
  }
  return esq;
}

/** 上游 calc() 的单行预处理:合并相邻同步 + "2'"→"2"。 */
export function normalizeLine(line: string): string {
  return replaceDouble(line).replaceAll("2'", '2');
}
