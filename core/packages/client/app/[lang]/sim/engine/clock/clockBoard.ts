/**
 * ClockBoard —— 魔表在 `/sim` 里的「引擎」。
 *
 * 与其它 /sim 引擎唯一的不同:**它不画 3D**。魔表没有立体形态(cubing.js 与 twizzle 都把它
 * 硬编码成 2D),所以这个 Group 里一个 mesh 都没有,画面由 DOM 层的 `_SimClockBoard` →
 * `components/InteractiveClock` 那张 SVG 出。它仍是 THREE.Group、仍住在 world.scene 里,是
 * 为了原样满足引擎契约(world.cube / TweenCube / twister),让播放条那 ~13 处 `corner` 分支
 * 一处都不用改就能驱动它 —— 与「平面图」(_SimCubeNet)把 SVG 盖在画布上是同一套路子。
 *
 * 那 18 个空 Object3D 不是占位:它们是**指针的动画载体**。TweenTwister 按 PieceAnim 逐帧
 * 转它们,SVG 每帧读 `rotation.z` 当指针的额外偏转角 —— 于是魔表的指针真的会扫过去,而且
 * 走的是全站同一个 tweener(速度滑块、mp4 离线导出逐帧 tick 一并白拿)。
 *
 * ── 坐标帧(唯一容易搞错的地方) ────────────────────────────────────────────
 * `@cuberoot/puzzle-solvers/clock` 的约定:`posit[0..8]` 恒为**当前朝己**那一面,`y2` 把两个 9 元块对调。
 * 但 `parseClockMoves` 把 y2 折成了每步招式的绝对 `side`(= 此前 y2 的奇偶),它索引的是
 * **起手帧**的两个半区。两者要同时成立,只能像 `clockStateFromAlg` 那样:整段按起手帧算,
 * 末了再按翻面与否对调一次。
 *
 * 逐步播放的引擎不能"末了再说",所以这里把两个帧分开存:
 *   `raw`     —— 起手帧的 18 个盘位,招式直接作用于它,中途永不对调
 *   `flipped` —— 当前是否翻着面
 *   `state`   —— 对外(渲染 / 求解 / 求打乱)的规范形式,读时才按 `flipped` 对调
 * 于是「先 y2 再拧」与「整段一次算完」逐盘相等,`tests/sim_clock_board.test.ts` 锁这条。
 */
import * as THREE from 'three';
import MoveHistory from '../MoveHistory';
import TweenTwister, { type TweenCube } from '../TweenTwister';
import { makeAnim, type PieceAnim } from '../pieceAnim';
import {
  CLOCK_BACK_CORNER_DIAL, CLOCK_BACK_QUAD, CLOCK_FRONT_CORNER_DIAL, CLOCK_FRONT_QUAD,
  SOLVED_CLOCK, clockMovesToString, parseClockMoves, withClockFlipParity,
  type ClockMove, type ClockState,
} from '@cuberoot/puzzle-solvers/clock';

const mod12 = (x: number) => ((x % 12) + 12) % 12;
const DIALS = 18;
/** 一格 = 30°。 */
const STEP_RAD = Math.PI / 6;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** 播放条的一步:一次拧,或一次翻面。y2 在记号里是独立 token,所以它也得是独立一步。 */
export type ClockStep =
  | { kind: 'move'; move: ClockMove }
  | { kind: 'flip' };

/** 起手帧 ↔ 朝己帧:两个 9 元块对调(自逆)。 */
function swapHalves(p: readonly number[]): number[] {
  return [...p.slice(9), ...p.slice(0, 9)];
}

/**
 * 幅度 → 带符号的扫动格数。`ClockMove.amount` 存的是 mod 12 的余数,方向信息在里面丢了;
 * 按记号本身的写法还原:1..6 写作 `n+`(正扫),7..11 写作 `(12−n)-`(反扫)。这样指针扫的
 * 方向与用户看到的 token 一致。
 */
export function clockSweep(amount: number): number {
  const a = mod12(amount);
  return a <= 6 ? a : a - 12;
}

/** 一步拧在**起手帧**下每个盘的带符号扫动格数(与 `clockMoveDelta` 同结构,但不取模)。 */
export function clockSignedDelta(move: ClockMove): number[] {
  const d = new Array<number>(DIALS).fill(0);
  const s = clockSweep(move.amount);
  const own = move.side === 0 ? CLOCK_FRONT_QUAD : CLOCK_BACK_QUAD;
  const otherCorner = move.side === 0 ? CLOCK_BACK_CORNER_DIAL : CLOCK_FRONT_CORNER_DIAL;
  const touched = new Set<number>();
  for (let c = 0; c < 4; c++) {
    if (!(move.mask & (1 << c))) continue;
    for (const dial of own[c]) touched.add(dial);
    // 联动:另一面的同一个角盘反向等量走。
    d[otherCorner[c]] -= s;
  }
  for (const dial of touched) d[dial] += s;
  return d;
}

/**
 * 一步 → 一个可被 `parseClockMoves` 原样吃回去的 token 串(history 重放用)。
 *
 * history 是把 `init + moves.join(' ')` 整段重放的,所以每个 token 必须**不改变后续 token 的
 * 正反面上下文**:与当前帧同侧的招式直接写名字,异侧的写成成对的 `y2 X y2`(进去、拧、回来)。
 *
 * `frame` 必须传录制那一刻的帧(0 = 正面朝己),不能省 —— 序列里的 `flip` 步会把帧带走,
 * 假设"恒在正面"的成对写法会让 flip 之后的每一招都落错面(`sim_clock_board.test.ts` 锁)。
 * 这串只进 history,不进用户看的解法框。
 */
export function clockStepToken(step: ClockStep, frame: 0 | 1): string {
  if (step.kind === 'flip') return 'y2';
  const text = clockMovesToString([step.move]); // side=1 时形如 "y2 UL2+"
  const bare = step.move.side === 1 ? text.slice(3) : text; // 剥掉那个 y2,只留"在自己那面看到的名字"
  return step.move.side === frame ? bare : `y2 ${bare} y2`;
}

/** 一段算法 → 步骤列表(y2 是独立一步)。坏 token 抛错。 */
export function parseClockSteps(alg: string): ClockStep[] {
  const moves = parseClockMoves(alg);
  const out: ClockStep[] = [];
  let i = 0;
  for (const raw of alg.trim().split(/\s+/).filter(Boolean)) {
    if (raw === 'y2') { out.push({ kind: 'flip' }); continue; }
    if (/^[UDud]{4}$/.test(raw)) continue; // tnoodle 末尾的针脚状态描述
    out.push({ kind: 'move', move: moves[i++] });
  }
  return out;
}

/** 步骤列表 → 规范记号(招式自带绝对 side,按面重新分组;末尾姿势由 `withClockFlipParity` 兜)。 */
export function clockStepsToString(steps: readonly ClockStep[]): string {
  const moves = steps.filter((s): s is { kind: 'move'; move: ClockMove } => s.kind === 'move');
  const endsFlipped = steps.filter((s) => s.kind === 'flip').length % 2 === 1;
  return withClockFlipParity(clockMovesToString(moves.map((s) => s.move)), endsFlipped);
}

/**
 * 手势(在画板上转一次)→ 追加到解法框的 token 串。
 *
 * `InteractiveClock` 给的 `move.side` 是**半区下标**(0 = 左 = 朝己),不是绝对面。解法串是从头
 * 解析的,所以 token 必须写成「相对当前朝己那面」且**不改变后面招式的正反面上下文**:
 *   左半区 → 裸名字(WCA 记号本就相对朝己面,前面有几个 y2 都对)
 *   右半区 → 成对的 `y2 X y2`(进去、转、回来;两个半区同屏,不翻面也能转背面)
 * 与 history 用的 `clockStepToken` 是同一条规则,只是那边的 side 已是绝对面、得显式带帧。
 */
export function clockGestureToken(move: ClockMove): string {
  const text = clockMovesToString([move]); // panel=1 时形如 "y2 UL2+"
  return move.side === 0 ? text : `${text} y2`;
}

/** 步骤列表的逆:倒序 + 每步幅度取反(翻面自逆)。 */
export function invertClockSteps(steps: readonly ClockStep[]): ClockStep[] {
  return steps.slice().reverse().map((s) => (
    s.kind === 'flip' ? s : { kind: 'move' as const, move: { ...s.move, amount: mod12(-s.move.amount) } }
  ));
}

export default class ClockBoard extends THREE.Group implements TweenCube<ClockStep> {
  readonly puzzleType = 'clock' as const;
  /** 引擎契约里的阶数;魔表没有阶 → 0(与 Ivy / SQ1 等非 NxN 引擎一致)。 */
  order = 0;
  dirty = false;
  callbacks: (() => void)[] = [];
  history = new MoveHistory();
  twister: ClockTwister;

  /** 起手帧的 18 个盘位(见文件头「坐标帧」)。 */
  private raw: number[] = new Array<number>(DIALS).fill(0);
  private flipped = false;
  /** 每个盘一个 pivot;`rotation.z` = 该盘当前的**动画中额外偏转**(静止时恒 0)。 */
  readonly pivots: THREE.Object3D[] = [];

  constructor() {
    super();
    for (let i = 0; i < DIALS; i++) {
      const p = new THREE.Object3D();
      this.pivots.push(p);
      this.add(p);
    }
    this.twister = new ClockTwister(this);
  }

  /** 对外的规范状态(`posit[0..8]` = 当前朝己那面)。 */
  get state(): ClockState {
    return {
      posit: this.flipped ? swapHalves(this.raw) : this.raw.slice(),
      rightSideUp: !this.flipped,
    };
  }

  /** 用户在画板上直接改状态(涂色模式)—— 反向换回起手帧存。 */
  setState(next: ClockState): void {
    const p = next.posit.map(mod12);
    this.flipped = !next.rightSideUp;
    this.raw = this.flipped ? swapHalves(p) : p;
    this.history.clear();
    this.dirty = true;
    this.fire();
  }

  /** 某个盘当前的动画偏转(**朝己帧**下标,单位:格)。SVG 每帧读它。 */
  animOffset(displayDial: number): number {
    const dial = this.flipped
      ? (displayDial + 9) % DIALS  // 朝己帧 → 起手帧(半区对调是 +9 的对合)
      : displayDial;
    return this.pivots[dial].rotation.z / STEP_RAD;
  }

  /** 是否有招式正在动(SVG 靠它决定要不要起 rAF)。 */
  get animating(): boolean {
    return this.twister.busy;
  }

  get complete(): boolean {
    return this.raw.every((v) => mod12(v) === 0);
  }

  beginMove(step: ClockStep): PieceAnim[] {
    if (step.kind === 'flip') return []; // 翻面没有指针扫动,瞬时生效
    const d = clockSignedDelta(step.move);
    const anims: PieceAnim[] = [];
    for (let i = 0; i < DIALS; i++) {
      if (d[i] === 0) continue;
      const angle = d[i] * STEP_RAD;
      const delta = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, angle);
      anims.push(makeAnim(this.pivots[i], delta, Z_AXIS, angle));
    }
    return anims;
  }

  finishMove(_anims: PieceAnim[], step: ClockStep): void {
    this.record(step);
  }

  applyMoveInstant(step: ClockStep): void {
    this.record(step);
  }

  applyMoveSilent(step: ClockStep): void {
    this.commit(step);
    this.fire();
  }

  reset(): void {
    this.raw = SOLVED_CLOCK().posit;
    this.flipped = false;
    this.restPivots();
    this.dirty = true;
    this.fire();
  }

  dispose(): void { /* 无 mesh / 无材质 —— 画面在 DOM 层 */ }

  /** 落定一步并记进 history。token 要用**录制那一刻**的帧,所以先取再 commit。 */
  private record(step: ClockStep): void {
    const frame: 0 | 1 = this.flipped ? 1 : 0;
    this.commit(step);
    this.history.record(clockStepToken(step, frame));
    this.fire();
  }

  /** 落定一步:改离散态 + 把 pivot 归零(动画偏转已被并进盘位)。 */
  private commit(step: ClockStep): void {
    if (step.kind === 'flip') {
      this.flipped = !this.flipped;
    } else {
      const d = clockSignedDelta(step.move);
      for (let i = 0; i < DIALS; i++) if (d[i] !== 0) this.raw[i] = mod12(this.raw[i] + d[i]);
    }
    this.restPivots();
    this.dirty = true;
  }

  private restPivots(): void {
    for (const p of this.pivots) {
      p.quaternion.identity();
      p.rotation.set(0, 0, 0);
    }
  }

  private fire(): void {
    for (const cb of this.callbacks) cb();
  }
}

/** 魔表的动画编排:解析交给 `parseClockSteps`,每个 token 统一占一个 TPS 节拍。 */
export class ClockTwister extends TweenTwister<ClockStep> {
  constructor(board: ClockBoard) { super(board); }

  protected parse(alg: string): ClockStep[] { return parseClockSteps(alg); }

  /** SVG 用:是否还有 tween 在跑(含排队中的)。 */
  get busy(): boolean {
    return this.queue.length > 0 || this.activeTween !== null;
  }
}
