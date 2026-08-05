/**
 * 转体计数 —— 从姿态流里把 `x` `y'` `z2` 读出来。
 * ==========================================================================
 *
 * 这条一直挂着「可行性未验」。魔方**不报转体**:面转有通知,整体转没有 —— 陀螺仪
 * 装在中心核里,转体只改朝向、不改状态字节。所以转体只能从**姿态流**推,而姿态流
 * 是 Sprint 26 才存下来的,现在才有得推。
 *
 * ## 判据:一切都相对「上一次认下来的姿态」算
 *
 * 转体 = 魔方**整体朝向**换了一格,而整体朝向的变化量只有 24 种(魔方的旋转群)。
 * 注意是**变化量**,不是朝向本身:
 *
 *   1. 记一个基准姿态 `ref`(上一次认下来的那一格);
 *   2. 每个样本算相对量 `rel = ref⁻¹ · q`,把 `rel` 吸附到最近的那一格;
 *   3. `rel` 稳定落在**非单位**的一格上 = 一次转体,名字就是那一格;
 *   4. 认下来之后 `ref` 乘上那一格(见 `closeCandidate` 里的长注释 —— 用量到的
 *      姿态当新基准会滚雪球,两个方向都试过)。
 *
 * ## 相对量消掉什么、消不掉什么(这里返过一次工,而且第一版把结论写反了)
 *
 * 最早是把**绝对**姿态吸附到 24 格里、格子变了就算一次。测试当场证伪:给整条录像
 * 左乘一个任意固定旋转,一次都数不出来 —— 一般的姿态根本不落在那 24 格附近,全被
 * 「离哪一格都远」挡掉。改成相对量之后这条就通了。
 *
 * 但**相对量能救什么、不能救什么必须分清**。魔方报的四元数和我们要的量之间隔着
 * 两个未知量:
 *
 *     q = W · C · M
 *
 *   `W` 传感器自己的世界系(开机那一刻朝哪边、有没有对齐重力),**左**因子;
 *   `C` 魔方真正的朝向 —— 要的就是它;
 *   `M` 传感器**装在魔方里的姿态**(它把哪根物理轴叫做 +Y),**右**因子。
 *       这正是 `BRAND_SENSOR_BASIS` 那张表要记的东西,而它至今**全表 UNVERIFIED**。
 *
 * 一次转体是绕**魔方自己**的轴转,即 `C₂ = C₁ · R`,于是
 *
 *     rel = q₁⁻¹ · q₂ = M⁻¹ · C₁⁻¹ · W⁻¹ · W · C₁ · R · M = M⁻¹ · R · M
 *
 *   - `W` **被消掉了** —— 开机朝哪边完全不影响结论;
 *   - `M` **没被消掉**,它把 `R` 做了一次**相似变换**。相似变换保角不保轴,所以:
 *
 *         转了几次、每次是四分之一还是半圈  →  不需要标定就是对的;
 *         是绕哪根轴(x/y/z)、朝哪个方向    →  要知道 M 才算得准。
 *
 * 第一版这里写的是 `(B·q₁)⁻¹·(B·q₂) = q₁⁻¹·q₂`,并据此宣称「绕哪根轴也不需要标定」。
 * 那条恒等式本身没错,错在它算的是 **W**(左因子),而 `BRAND_SENSOR_BASIS` 记的是
 * **M**(右因子,而且按相似变换作用 —— `orientation.ts` 的 `applyOrientation` 就是
 * 这么用的)。拿左边的证明去给右边的结论背书,于是测试里那条「左乘任意 B 结论不变」
 * 只证了 W 那一半,却顶着「立身之本」的名头。现在两条分开各证各的。
 *
 * 所以记号这一路不再假装不需要标定:样本先过一遍 `sensorBasisForBrand` /
 * `mirrorForBrand`(那张表是 M 的唯一落点),表里哪天填了真机验过的值,记号自动跟着
 * 变对。今天全表 identity,等于**假定传感器正装** —— 这是个明写出来的假设。
 *
 * 手性(`BRAND_MIRROR`)同理:镜像不是旋转,更消不掉;标错时计数仍对,`y` 读成 `y'`。
 *
 * ## 噪声怎么挡
 *
 * 人拧的时候魔方一直在手里晃 —— 二三十度的倾斜是常态,那不是转体。两道:
 *
 *   - **进格阈值**:新格子要近到 `ENTER_RAD` 才认(默认 35°,而相邻格差 90°);
 *   - **保持时长**:新格子要待够 `HOLD_MS` 才认(默认 120ms)。转体是**持续**的
 *     状态改变,而转的路上那些中间姿态是一闪而过的 —— 这一条把两者分开。
 *
 * 两道都不改样本本身:判定失败就当没换过格,不会把中间态记成一次转体。
 *
 * ## 「待够」是拿**下一个样本的时刻**量的(这里返过第二次工)
 *
 * 姿态流是**死区压缩**过的(见 `gyro_track.ts`):朝向没动到 4° 就不记,所以魔方
 * 停在一个朝向上的那一整段,在录像里只有**一个**样本。第一版按「同一格连着采到
 * 好几个样本」算保持时长 —— 单元测试里的合成录像每个姿态给了十几个样本,过了;
 * 拿真录下来的一把一跑,整条流一共 3 个样本(起始 + 两次转体),一个转体都数不出来。
 *
 * 所以保持时长必须按「这个样本管到下一个样本」算:
 *
 *     holdUntil = samples[i+1]?.tMs ?? Infinity
 *
 * 最后一个样本管到无穷 —— 那正是录像的语义:拧完之后魔方就停在那个朝向上。
 * 回归测试用的是**每个姿态只给一个样本**的录像,和真编码器产出的形状一致。
 */

import {
  CUBE_ORIENTATIONS, QUAT_IDENTITY, applyOrientation, mirrorForBrand,
  nearestCubeOrientation, quatAngleTo, quatConjugate, quatMul, quatNormalize,
  sensorBasisForBrand, type Quat,
} from '../bluetooth/orientation';
import type { GyroSample } from '../bluetooth/gyro_track';

/** 新格子要近到这个角度才认。相邻格差 90°,35° 能容纳真机握持漂移。 */
export const ENTER_RAD = (35 * Math.PI) / 180;
/** 新格子要连续保持这么久才算一次转体(毫秒)。 */
export const HOLD_MS = 120;

export interface RotationEvent {
  /** 核心开始离开上一格的时刻。记谱位置用它,避免把转体晚插到后面几手。 */
  startMs?: number;
  /** 转体**完成**的时刻(相对起表),即新朝向第一次被采到的那个样本的时刻。 */
  tMs: number;
  /** 记号,如 `y` / `x'` / `z2`。认不出来(复合转体)时是 `?`。 */
  token: string;
  /** 这次转体本身的角度(弧度),90° 或 180°。 */
  angleRad: number;
}

export interface DetectRotationsOptions {
  enterRad?: number;
  holdMs?: number;
  /**
   * 录这条流的魔方是什么牌子(`solve.device.model`)。用来查 `BRAND_SENSOR_BASIS` /
   * `BRAND_MIRROR` —— 也就是上面那个 `M`。不给 = 按正装算。
   *
   * 只影响**记号**(哪根轴、哪个方向);转体的**个数和角度**跟它无关,见文件头。
   */
  brand?: string | null;
}

/* ------------------------------------------------------------------ */
/*  记号表                                                             */
/* ------------------------------------------------------------------ */

/** 绕轴 `axis` 转 `deg` 度的四元数。 */
function axisQuat(axis: 'x' | 'y' | 'z', deg: number): Quat {
  const h = (deg * Math.PI) / 360;
  const s = Math.sin(h);
  return {
    w: Math.cos(h),
    x: axis === 'x' ? s : 0,
    y: axis === 'y' ? s : 0,
    z: axis === 'z' ? s : 0,
  };
}

/**
 * 九个基本转体的相对旋转。轴向按魔方的记号:`x` 绕 R 面法线(+X)、`y` 绕 U 面法线
 * (+Y)、`z` 绕 F 面法线(+Z),都按右手定则,和 `SENSOR_BASES.rotX90/rotY90`
 * (`CUBE_ORIENTATIONS` 的生成元)同一套轴。
 */
const ROTATION_TOKENS: ReadonlyArray<{ token: string; quat: Quat }> = Object.freeze([
  { token: 'x', quat: axisQuat('x', 90) },
  { token: "x'", quat: axisQuat('x', -90) },
  { token: 'x2', quat: axisQuat('x', 180) },
  { token: 'y', quat: axisQuat('y', 90) },
  { token: "y'", quat: axisQuat('y', -90) },
  { token: 'y2', quat: axisQuat('y', 180) },
  { token: 'z', quat: axisQuat('z', 90) },
  { token: "z'", quat: axisQuat('z', -90) },
  { token: 'z2', quat: axisQuat('z', 180) },
]);

/**
 * 把一个相对旋转翻译成记号。认不出来的返回 `null` —— 那是复合转体(两次转体挨太近
 * 被并成一步),硬塞一个名字比说不知道更糟。
 */
export function tokenForRelative(rel: Quat): string | null {
  const n = quatNormalize(rel);
  for (const { token, quat } of ROTATION_TOKENS) {
    if (quatAngleTo(n, quat) < 1e-3) return token;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  检测                                                               */
/* ------------------------------------------------------------------ */

/** 这一格在 24 个里的下标;当身份用 —— 四元数有 ±q 两种写法,不能直接比。 */
function latticeIndex(q: Quat): number {
  let bestI = 0;
  let bestA = Infinity;
  for (let i = 0; i < CUBE_ORIENTATIONS.length; i++) {
    const a = quatAngleTo(q, CUBE_ORIENTATIONS[i]);
    if (a < bestA) { bestA = a; bestI = i; }
  }
  return bestI;
}

/**
 * 从姿态流里数转体。
 *
 * 起始姿态不算一次转体 —— 「魔方一开始朝哪边」是握持,不是动作。它只是第一个基准。
 */
export function detectRotations(
  samples: readonly GyroSample[],
  opts: DetectRotationsOptions = {},
): RotationEvent[] {
  const enterRad = opts.enterRad ?? ENTER_RAD;
  const holdMs = opts.holdMs ?? HOLD_MS;
  if (samples.length === 0) return [];

  // 先把传感器装配姿态(M)折掉,再谈记号。存下来的流是**原始**四元数
  // (`gyro_track` 有意不含校准、不含品牌基),所以折算只能在这儿做。
  // 没给牌子就按正装算(见 `brand` 的注释)。这和 `sensorBasisForBrand(null)` 不是
  // 一回事:那个函数答的是「不认识的魔方按什么算」,而这里的「没给」意思是调用方
  // 拿的本来就是已经在屏幕系里的样本 —— 别替它加一层它没要的换基。
  const basis = opts.brand ? sensorBasisForBrand(opts.brand) : 'identity';
  const mirror = opts.brand ? mirrorForBrand(opts.brand) : false;
  const stream: readonly GyroSample[] = basis === 'identity' && !mirror
    ? samples
    : samples.map(s => ({ tMs: s.tMs, q: applyOrientation(s.q, null, { basis, mirror }) }));

  const out: RotationEvent[] = [];
  /** 上一次认下来时魔方实际在的姿态。一切相对它算。 */
  let ref = quatNormalize(stream[0].q);
  const identityIdx = latticeIndex(QUAT_IDENTITY);
  /** 正在观察的候选。`idx < 0` = 没有候选。 */
  let candIdx = -1;
  let candFirstMs = 0;
  let candRel: Quat = QUAT_IDENTITY;
  /** 从上一格出发的第一条样本。候选落格前的过渡样本也算。 */
  let motionStartMs: number | null = null;

  /** 这个样本相对当前基准落在哪一格;落在两格之间(离最近的一格也超过阈值)给 -1。 */
  const cellOf = (q: Quat): { idx: number; rel: Quat } => {
    const rel = quatNormalize(quatMul(quatConjugate(ref), q));
    const near = nearestCubeOrientation(rel);
    if (near.angleRad > enterRad) return { idx: -1, rel: near.quat };
    return { idx: latticeIndex(near.quat), rel: near.quat };
  };

  /** 候选的持续段在 `untilMs` 结束了 —— 够长就记一次转体。返回记没记。 */
  const closeCandidate = (untilMs: number): boolean => {
    if (candIdx < 0 || candIdx === identityIdx) { candIdx = -1; return false; }
    if (untilMs - candFirstMs < holdMs) { candIdx = -1; return false; }
    out.push({
      startMs: motionStartMs ?? candFirstMs,
      tMs: candFirstMs,
      token: tokenForRelative(candRel) ?? '?',
      angleRad: quatAngleTo(QUAT_IDENTITY, candRel),
    });
    /**
     * 新基准 = 老基准**乘上刚认下来的那一格**,而不是某个量到的姿态。
     *
     * 这里返过第三次工,两个方向都试过、都会滚雪球:
     *
     *   - 用**刚进格**那一下(第一版):进格阈值是 35°,所以那一刻手还差着二三十度
     *     没转到位,基准就落后一截;下一次转体相对这个落后的基准算,于是更早认下来、
     *     基准更落后。实测四个连着的 y 数出**五**次 —— 一次转体被劈成两次。
     *   - 用这一格里**最后**看到的那一下:死区压缩过的流里,停住的那段根本不发样本,
     *     所以「最后一下」往往已经是下一次转体转出去 35° 的地方,基准反过来超前一截,
     *     一样滚。实测四个 y 只数出**三**次 —— 这回是漏。
     *
     * 两头都不对,是因为拿**测量值**当基准就一定带着当时的偏差。而我们刚刚已经断定
     * 「这一段就是某一格」了,那就直接按那一格走:基准始终精确落在格点上,偏差不进位。
     * 手上的慢漂由 35° 进格阈值兜着,本来也不需要基准去追。
     */
    ref = quatNormalize(quatMul(ref, candRel));
    candIdx = -1;
    motionStartMs = null;
    return true;
  };

  for (const s of stream) {
    const q = quatNormalize(s.q);
    let { idx, rel } = cellOf(q);
    if (idx === identityIdx) motionStartMs = null;
    else if (motionStartMs === null) motionStartMs = s.tMs;
    if (idx === candIdx) continue;              // 还停在候选那一格上,继续攒时长
    // 换格了(或者晃进了两格之间)—— 候选这一段到此为止。
    // **任何**不落在候选格上的样本都算打断:在两格之间恰恰说明魔方没停在那儿,
    // 不打断的话「65° 晃两下」会被两次之间的时间差凑够时长,变成一次假转体。
    if (closeCandidate(s.tMs)) {
      // 基准换了,这个样本要按新基准重算一次。
      ({ idx, rel } = cellOf(q));
      if (idx !== identityIdx) motionStartMs = s.tMs;
    }
    if (idx < 0 || idx === identityIdx) { candIdx = -1; continue; }
    candIdx = idx;
    candFirstMs = s.tMs;
    candRel = rel;
  }
  // 录像结束 = 最后一个姿态一直管到最后(拧完之后魔方就停在那儿了)。
  closeCandidate(Infinity);
  return out;
}

/**
 * 把「每一步最后一手的**下标**」翻译成 `rotationsByStep` 要的**时刻**界。
 *
 * 两条规矩,两处调用方(文字复盘和分步分析表)都得一样,所以只写一遍:
 *
 *   - **最后一步管到 `Infinity`**。拧完最后一手之后往往还要把魔方摆正,那一次转体
 *     的时刻比任何一手都晚 —— 按最后一手的时刻切就把它丢了。
 *   - **`endIdx` 是 null 的一步沿用上一界**(零宽,分不到东西)。那是「白给的那一对」
 *     或者压根没走到的一步:它没发生过,不该从邻居那儿偷转体。
 */
export function stepTimeBounds(
  endIdxs: readonly (number | null)[],
  moves: readonly { ts: number }[],
): number[] {
  let prev = 0;
  return endIdxs.map((endIdx, i) => {
    if (i === endIdxs.length - 1) return Infinity;
    if (endIdx === null) return prev;                       // 没发生过的一步:零宽
    if (endIdx >= moves.length - 1) return Infinity;         // 收尾在最后一手上
    const t = moves[endIdx]?.ts;
    if (t === undefined) return prev;
    prev = t;
    return t;
  });
}

/**
 * 把转体按时刻分配到各步。`bounds[i]` 是第 i 步的结束时刻;落在
 * `(bounds[i-1], bounds[i]]` 里的转体算第 i 步的。
 *
 * 用时刻而不是动作下标分,因为转体**没有动作下标** —— 它压根不在动作流里。
 */
export function rotationsByStep<T extends { tMs: number }>(
  events: readonly T[],
  bounds: readonly number[],
): T[][] {
  const out: T[][] = bounds.map(() => []);
  for (const ev of events) {
    let i = bounds.findIndex((b) => ev.tMs <= b);
    if (i < 0) i = bounds.length - 1;      // 最后一步之后(收尾的转体)归最后一步
    if (i >= 0) out[i].push(ev);
  }
  return out;
}
