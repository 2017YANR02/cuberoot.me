/**
 * 姿态流:把一把还原里魔方的朝向存下来,好在复盘里重放。
 * ==========================================================================
 *
 * 动作流回答「拧了什么」,姿态流回答「**怎么**拧的」—— 转体在哪儿发生、握持怎么
 * 换、末层前有没有把魔方翻过来看一眼。这些动作流里一个字都没有。
 *
 * ## 为什么要压
 *
 * 成绩存在 **localStorage** 里(`cuberoot-timer.v3`,上限一般 5MB)。陀螺仪 20-50Hz,
 * 一把 15 秒就是 300-750 个样本;每个样本存成 JSON 的四个 double 是 ~90 字节,
 * 一把 30-70KB —— **几百把就把整个计时器的存储撑爆**,而且撑爆的时候丢的是成绩。
 *
 * 所以这里做三件事,每一件都换来一个数量级:
 *
 * 1. **死区**:朝向没动到 `DEADBAND_RAD`(≈4°)就不记。魔方在桌上不动的那几秒
 *    本来就该是零字节。真人拧一把通常只留下几十个样本。
 * 2. **定点**:四元数每个分量是 [-1,1],乘 127 存成 int8 —— 精度 ≈0.45°,比
 *    死区细一个数量级,肉眼看不出来。时间差存 uint16 毫秒(上限 65 秒/段)。
 *    一个样本 6 字节。
 * 3. **base64**:localStorage 存的是字符串,存二进制得先编码;base64 涨 4/3,
 *    一个样本落到 8 字节。
 *
 * 一把 40 个样本 ≈ 340 字节,和一条打乱一个量级 —— 这才敢默认打开的成本。
 * 上面还有一道 `MAX_SAMPLES` 硬闸,防的是「传感器抽风狂报」把一条成绩撑成 1MB。
 *
 * ## 为什么存**原始**四元数
 *
 * 存的是魔方报上来的原始朝向,**不含校准、不含品牌传感器基**。因为那两样都还没
 * 验过(`BRAND_SENSOR_BASIS` / `BRAND_MIRROR` 全表 UNVERIFIED),而它们是**显示**
 * 的事:哪天标定对了,历史录像跟着一起变对。反过来,把当时那套没验过的变换烤进
 * 数据里,就永远是错的了。
 *
 * ## 格式
 *
 *   byte 0        magic 'G' (0x47)
 *   byte 1        version = 1
 *   byte 2..3     样本数 (uint16, 大端)
 *   之后每 6 字节 一个样本:
 *     byte 0..1   距上一个样本的毫秒 (uint16, 大端);第一个样本是距起表
 *     byte 2..5   w,x,y,z 各 int8 = round(分量 × 127)
 *
 * 归一化在解码时做 —— 定点化会让模长偏离 1,不归一化的话 slerp 会漂。
 */

import type { Quat } from './orientation';
import { QUAT_IDENTITY, quatAngleTo, quatNormalize, quatSlerp } from './orientation';

/** 朝向变化小于这个角度就不记。≈4°,比定点精度粗一个数量级。 */
export const DEADBAND_RAD = (4 * Math.PI) / 180;

/** 一条成绩最多存这么多样本。传感器抽风时的硬闸,不是正常路径。 */
export const MAX_SAMPLES = 4000;

/** 两个样本之间最多隔这么久;uint16 存不下更长的间隔。超了就补一个样本。 */
export const MAX_GAP_MS = 65535;

const MAGIC = 0x47;
const VERSION = 1;
const HEADER_BYTES = 4;
const SAMPLE_BYTES = 6;

export interface GyroSample {
  /** 距起表的毫秒。 */
  tMs: number;
  q: Quat;
}

/* ────────────────────────── 录制 ────────────────────────── */

/**
 * 录制器。每来一个样本调一次 `push`,`take` 拿走整条。
 *
 * 有意做成类而不是纯函数:调用方是 BLE 回调,一秒几十次,每次重建一个数组是
 * 白扔的垃圾。状态全在实例里,`take` 之后可以接着录下一把。
 */
export class GyroRecorder {
  private samples: GyroSample[] = [];
  private last: Quat | null = null;
  private lastT = 0;
  private dropped = 0;

  /**
   * 记一个样本。返回是否真的记下了(死区里的、超闸的都不记)。
   *
   * `tMs` 必须是**距起表**的毫秒且单调不减 —— 倒退的时间戳直接丢,因为那说明
   * 上游把设备时钟和本地时钟混着用了,存下来只会让回放跳。
   */
  push(q: Quat, tMs: number): boolean {
    if (!Number.isFinite(tMs) || tMs < 0) return false;
    if (this.samples.length > 0 && tMs < this.lastT) return false;
    if (this.samples.length >= MAX_SAMPLES) { this.dropped++; return false; }
    if (this.last !== null) {
      const moved = quatAngleTo(this.last, q);
      const gap = tMs - this.lastT;
      // 死区里的样本不记 —— 除非离上一个太久,uint16 的间隔存不下。
      if (moved < DEADBAND_RAD && gap < MAX_GAP_MS) return false;
    }
    const norm = quatNormalize(q);
    this.samples.push({ tMs, q: norm });
    this.last = norm;
    this.lastT = tMs;
    return true;
  }

  /** 目前记了几个。 */
  get length(): number { return this.samples.length; }

  /** 因为超闸被丢掉的个数。>0 说明这条录像不完整。 */
  get droppedCount(): number { return this.dropped; }

  /** 拿走并清空。 */
  take(): GyroSample[] {
    const out = this.samples;
    this.samples = [];
    this.last = null;
    this.lastT = 0;
    this.dropped = 0;
    return out;
  }

  reset(): void { this.take(); }
}

/* ────────────────────────── 编解码 ────────────────────────── */

const clampI8 = (v: number): number => Math.max(-127, Math.min(127, Math.round(v * 127)));

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  // 分块:一次 spread 十万个参数会爆调用栈。
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 编码成 base64。空数组 → `null`(「没录到」和「录了个空的」是两回事)。 */
export function encodeGyroTrack(samples: GyroSample[]): string | null {
  if (samples.length === 0) return null;
  const n = Math.min(samples.length, MAX_SAMPLES);
  const buf = new Uint8Array(HEADER_BYTES + n * SAMPLE_BYTES);
  buf[0] = MAGIC;
  buf[1] = VERSION;
  buf[2] = (n >> 8) & 0xff;
  buf[3] = n & 0xff;
  let prevT = 0;
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const dt = Math.max(0, Math.min(MAX_GAP_MS, Math.round(s.tMs - prevT)));
    prevT += dt;
    const o = HEADER_BYTES + i * SAMPLE_BYTES;
    buf[o] = (dt >> 8) & 0xff;
    buf[o + 1] = dt & 0xff;
    buf[o + 2] = clampI8(s.q.w) & 0xff;
    buf[o + 3] = clampI8(s.q.x) & 0xff;
    buf[o + 4] = clampI8(s.q.y) & 0xff;
    buf[o + 5] = clampI8(s.q.z) & 0xff;
  }
  return bytesToBase64(buf);
}

/**
 * 解码。任何一处对不上就返回 `[]` —— 一条读坏的录像不该把复盘整页拖垮,
 * 也不该冒充成一条能播的。
 */
export function decodeGyroTrack(encoded: string | null | undefined): GyroSample[] {
  if (!encoded) return [];
  let buf: Uint8Array;
  try { buf = base64ToBytes(encoded); } catch { return []; }
  if (buf.length < HEADER_BYTES) return [];
  if (buf[0] !== MAGIC || buf[1] !== VERSION) return [];
  const n = (buf[2] << 8) | buf[3];
  if (n <= 0 || buf.length < HEADER_BYTES + n * SAMPLE_BYTES) return [];
  const out: GyroSample[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const o = HEADER_BYTES + i * SAMPLE_BYTES;
    t += (buf[o] << 8) | buf[o + 1];
    const i8 = (b: number) => (b > 127 ? b - 256 : b) / 127;
    const q = { w: i8(buf[o + 2]), x: i8(buf[o + 3]), y: i8(buf[o + 4]), z: i8(buf[o + 5]) };
    // 定点化把模长打偏了,不归一化 slerp 会漂。
    out.push({ tMs: t, q: quatNormalize(q) });
  }
  return out;
}

/* ────────────────────────── 回放 ────────────────────────── */

/**
 * 回放到 `tMs` 时刻的朝向。两个样本之间 slerp —— 死区意味着样本本来就稀,
 * 直接取最近的那个会一跳一跳。
 *
 * 空录像给单位四元数(而不是 null):调用方是渲染循环,给它一个「正着放」的
 * 姿态比让它每帧判空更诚实。
 */
export function sampleGyroAt(samples: GyroSample[], tMs: number): Quat {
  if (samples.length === 0) return QUAT_IDENTITY;
  if (tMs <= samples[0].tMs) return samples[0].q;
  const last = samples[samples.length - 1];
  if (tMs >= last.tMs) return last.q;
  // 二分:回放会按时间顺序问,但也会被拖动打断,不能假设单调。
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].tMs <= tMs) lo = mid; else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const span = b.tMs - a.tMs;
  if (span <= 0) return a.q;
  return quatSlerp(a.q, b.q, (tMs - a.tMs) / span);
}

/** 这条录像存成字符串有多少字节(排查存储占用用)。 */
export function gyroTrackBytes(encoded: string | null | undefined): number {
  return encoded ? encoded.length : 0;
}
