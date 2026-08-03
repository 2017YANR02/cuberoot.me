/**
 * 中心核的轨迹 —— 姿态流回答的那一个问题:「核心转了没有」。
 * ==========================================================================
 *
 * 陀螺仪装在**中心核**里。这一句话决定了三件事,而这三件事正好是谱子里所有写不
 * 出来的东西的来源:
 *
 *   - **面转**(R / U / …):核心不动,姿态流一动不动。
 *   - **转体**(x / y / z):人把整颗魔方转了,核心跟着转 —— 但一手也不报。
 *   - **中层**(M / E / S):手按住两侧、把中间那层拧过去,**实际是核心转了**;
 *     于是两侧相对核心各转了一下,魔方报成一对相对面(见 `humanize.ts`)。
 *
 * 所以「核心在这一小段里换格了没有」这一个布尔量,恰好把两处一直只能靠猜的地方
 * 钉死。
 *
 * ## 一、这一对相对面,是中层还是两手真转?
 *
 * `humanize.ts` 原来只能靠时间猜(两手挨得够近就当一个动作)。那条判据没法做对:
 * 挨得近的两手和一个中层在动作流里**逐字相同**,阈值往哪边挪都会错一类。
 *
 * 而它们在姿态流里天差地别:中层**必然**伴随核心换格,两手真转**必然**不伴随。
 * 这不是相关性,是同一件事的两个面 —— 中层的定义就是核心转过去。所以录了姿态的
 * 把不再猜;没录姿态的把才退回时间那条。
 *
 * ## 二、哪些是人做的转体?
 *
 * `rotation_detect.ts` 把姿态流里每一次核心换格都认下来 —— 它分不出这一次是手转的
 * 还是中层带的。分开它们的是动作流:落在某一对相对面**时间窗**里的那一次,是那个
 * 中层带的,已经写成 `M` 了,不能再写一个 `x'`;剩下的才是人做的转体。
 *
 * 减法做在**时间窗**上而不是记号上,是故意的:记号的轴向要靠 `BRAND_SENSOR_BASIS`
 * (至今全表 UNVERIFIED),而「有没有换格」不要。标定哪天错了,顶多把 `x` 写成 `z`,
 * 不会把一个中层错认成转体、也不会漏掉一个。
 *
 * ## 时间窗为什么两头都要放宽
 *
 * 两个时刻量的不是同一件事:动作的时刻是**编码器跨过卡位**的那一下(一次转动快
 * 结束了),而转体的时刻是**新朝向第一次被采到**的那一下(转过六十来度就到了,见
 * `rotation_detect` 的 `ENTER_RAD`)。同一个中层,姿态那边通常比动作那边早一点点。
 * 所以窗口前后各放宽 `CORE_EVENT_SLACK_MS`,量的是「同一个手势」而不是「同一毫秒」。
 *
 * ## 一次换格可以给相邻两对同时背书
 *
 * `M2` 是一个手势,核心一次转 180°,姿态流那边多半只认下来**一次**(`x2`)。而动作
 * 流那边它可能报成 `R L' R L'` 四手 —— 两对。所以「背书」不是独占的:窗口里有换格
 * 就够,两对可以指同一次。反过来,**划掉**是独占的(每次换格只该抵掉一次),否则
 * 中层带的那次会漏出来,在谱子里多长出一个 `x'`。
 */

import type { GyroSample } from '../bluetooth/gyro_track';

import { detectRotations } from './rotation_detect';
import type { RotationEvent } from './rotation_detect';
import { conjugateToken } from './orient';
import type { FacePerm } from './orient';

/** 时间窗前后各放宽这么多毫秒,见文件头。 */
export const CORE_EVENT_SLACK_MS = 250;

export interface CoreTrack {
  /** 姿态流里认下来的每一次核心换格,按时刻。中层带的那些也在里面。 */
  events: readonly RotationEvent[];
}

export interface BuildCoreTrackOptions {
  /** 录这条流的魔方牌子。只影响记号的轴向,不影响「换没换格」,见文件头。 */
  brand?: string | null;
}

/**
 * 从一条姿态流建一条核心轨迹。空录像 → `null`。
 *
 * 「没录」和「录了个一动不动的」必须分开:前者要退回时间判据去猜中层,后者是真的
 * 一次核心都没转,那些相对面就都是两手真转。
 */
export function buildCoreTrack(
  samples: readonly GyroSample[],
  opts: BuildCoreTrackOptions = {},
): CoreTrack | null {
  if (samples.length === 0) return null;
  return { events: detectRotations(samples, { brand: opts.brand ?? null }) };
}

/**
 * 落在 `[fromMs, toMs]`(两头已放宽)里的核心换格,返回下标。空数组 = 这段时间里
 * 核心没动过。
 */
export function coreTurnsIn(track: CoreTrack, fromMs: number, toMs: number): number[] {
  const lo = fromMs - CORE_EVENT_SLACK_MS;
  const hi = toMs + CORE_EVENT_SLACK_MS;
  const out: number[] = [];
  for (let i = 0; i < track.events.length; i++) {
    const t = track.events[i].tMs;
    if (t >= lo && t <= hi) out.push(i);
  }
  return out;
}

/**
 * 把整条轨迹的记号搬到另一个视角。
 *
 * 姿态流是魔方**自己的配色系**里的,而谱子写在 `orient.ts` 转过的「十字朝下」视角
 * 里 —— 动作流已经逐记号换过名,转体不跟着换就会和它旁边那些动作对不上(谱子里
 * 出现一个 `x`,后面的动作却还按没转之前写)。
 *
 * 只换记号,不碰时刻和角度:换视角是换个角度看同一把。认不出来的记号原样留着,
 * 和 `conjugateToken` 的失败方式一致。
 */
export function conjugateCoreTrack(track: CoreTrack, perm: FacePerm): CoreTrack {
  return {
    events: track.events.map(e => ({ ...e, token: conjugateToken(e.token, perm) ?? e.token })),
  };
}
