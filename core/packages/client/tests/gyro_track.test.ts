/**
 * 姿态流的录 / 编 / 解 / 放。
 * =========================================================================
 *
 * 这条流最后要落进 **localStorage**,所以「省」不是优化而是正确性:撑爆的时候
 * 丢的是成绩。测试因此把两件事一起钉死 —— **省到什么程度**(每样本字节数、死区
 * 真的能挡住不动的魔方),和**省完之后还剩多少精度**(解回来的角度误差上界)。
 *
 * 还有一条容易漏的:定点化会让四元数模长偏离 1,不归一化的话 slerp 会漂。
 */
import { describe, it, expect } from 'vitest';

import {
  DEADBAND_RAD, GyroRecorder, MAX_SAMPLES,
  decodeGyroTrack, encodeGyroTrack, gyroTrackBytes, sampleGyroAt,
} from '@/app/[lang]/timer/_lib/bluetooth/gyro_track';
import type { Quat } from '@/app/[lang]/timer/_lib/bluetooth/orientation';
import { QUAT_IDENTITY, quatAngleTo, quatNormalize } from '@/app/[lang]/timer/_lib/bluetooth/orientation';

/** 绕 Y 轴转 deg 度。 */
function yaw(deg: number): Quat {
  const h = (deg * Math.PI) / 360;
  return { w: Math.cos(h), x: 0, y: Math.sin(h), z: 0 };
}

describe('GyroRecorder', () => {
  it('第一个样本一定记,之后死区里的一律不记', () => {
    const r = new GyroRecorder();
    expect(r.push(QUAT_IDENTITY, 0)).toBe(true);
    // 2° < 死区 4°
    expect(r.push(yaw(2), 100)).toBe(false);
    expect(r.push(yaw(3.9), 200)).toBe(false);
    expect(r.push(yaw(6), 300)).toBe(true);
    expect(r.length).toBe(2);
  });

  it('魔方放在桌上不动的十秒 = 一个样本(这就是敢默认打开的原因)', () => {
    const r = new GyroRecorder();
    for (let t = 0; t <= 10000; t += 20) r.push(yaw(0.3 * Math.sin(t / 200)), t);
    expect(r.length).toBe(1);
  });

  it('死区是相对**上一个记下的**样本,不是相对上一个来的样本', () => {
    const r = new GyroRecorder();
    r.push(yaw(0), 0);
    // 每次只挪 1.5°,单看相邻两帧都在死区里 —— 但攒到 6° 就必须记。
    r.push(yaw(1.5), 50);
    r.push(yaw(3), 100);
    const kept = r.push(yaw(6), 150);
    expect(kept).toBe(true);
    expect(r.length).toBe(2);
  });

  it('时间倒退的样本丢掉(设备时钟和本地时钟混用的信号)', () => {
    const r = new GyroRecorder();
    r.push(yaw(0), 1000);
    expect(r.push(yaw(90), 500)).toBe(false);
    expect(r.length).toBe(1);
  });

  it('超过上限就停,并且自己说漏了多少', () => {
    const r = new GyroRecorder();
    for (let i = 0; i < MAX_SAMPLES + 50; i++) r.push(yaw(i * 10), i * 10);
    expect(r.length).toBe(MAX_SAMPLES);
    expect(r.droppedCount).toBe(50);
  });

  it('take 之后能接着录下一把', () => {
    const r = new GyroRecorder();
    r.push(yaw(0), 0);
    r.push(yaw(90), 100);
    expect(r.take()).toHaveLength(2);
    expect(r.length).toBe(0);
    expect(r.push(yaw(0), 0)).toBe(true);
  });
});

describe('encode / decode', () => {
  const track = [
    { tMs: 0, q: QUAT_IDENTITY },
    { tMs: 320, q: quatNormalize(yaw(37)) },
    { tMs: 980, q: quatNormalize({ w: 0.5, x: 0.5, y: 0.5, z: 0.5 }) },
  ];

  it('一个样本 8 字节(base64 之后),40 个样本的一把不到 400 字节', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ tMs: i * 300, q: quatNormalize(yaw(i * 9)) }));
    const enc = encodeGyroTrack(many)!;
    expect(gyroTrackBytes(enc)).toBeLessThan(400);
    // 4 字节头 + 40×6 = 244 字节 → base64 ⌈244/3⌉×4 = 328
    expect(gyroTrackBytes(enc)).toBe(328);
  });

  it('转一圈回来:时间精确,角度误差在定点精度之内(<0.5°)', () => {
    const back = decodeGyroTrack(encodeGyroTrack(track));
    expect(back).toHaveLength(3);
    expect(back.map(s => s.tMs)).toEqual([0, 320, 980]);
    for (let i = 0; i < track.length; i++) {
      const err = (quatAngleTo(track[i].q, back[i].q) * 180) / Math.PI;
      expect(err, `sample ${i}`).toBeLessThan(0.5);
    }
  });

  it('解出来的四元数是单位长的(定点化会打偏,不归一化 slerp 会漂)', () => {
    for (const s of decodeGyroTrack(encodeGyroTrack(track))) {
      const len = Math.hypot(s.q.w, s.q.x, s.q.y, s.q.z);
      expect(len).toBeCloseTo(1, 6);
    }
  });

  it('空录像编成 null,不是空串 ——「没录到」和「录了个空的」是两回事', () => {
    expect(encodeGyroTrack([])).toBeNull();
  });

  it('读坏的一律给空数组,不抛也不冒充能播', () => {
    expect(decodeGyroTrack(null)).toEqual([]);
    expect(decodeGyroTrack('')).toEqual([]);
    expect(decodeGyroTrack('!!!not base64!!!')).toEqual([]);
    expect(decodeGyroTrack(btoa('xx'))).toEqual([]);                 // 太短
    expect(decodeGyroTrack(btoa('\x00\x01\x00\x01'))).toEqual([]);   // magic 不对
    expect(decodeGyroTrack(btoa('\x47\x02\x00\x01'))).toEqual([]);   // 版本不对
    expect(decodeGyroTrack(btoa('\x47\x01\x00\x09'))).toEqual([]);   // 说有 9 个,实际没有
  });
});

describe('sampleGyroAt', () => {
  const track = [
    { tMs: 0, q: QUAT_IDENTITY },
    { tMs: 1000, q: quatNormalize(yaw(90)) },
  ];

  it('两个样本之间是 slerp,不是最近邻', () => {
    const mid = sampleGyroAt(track, 500);
    const deg = (quatAngleTo(QUAT_IDENTITY, mid) * 180) / Math.PI;
    expect(deg).toBeCloseTo(45, 1);
  });

  it('两头夹住,不外推', () => {
    expect(sampleGyroAt(track, -5000)).toEqual(track[0].q);
    expect(sampleGyroAt(track, 999999)).toEqual(track[1].q);
  });

  it('空录像给单位四元数(渲染循环不该每帧判空)', () => {
    expect(sampleGyroAt([], 123)).toEqual(QUAT_IDENTITY);
  });

  it('乱序查询也对(拖动会打断单调)', () => {
    const long = Array.from({ length: 200 }, (_, i) => ({ tMs: i * 50, q: quatNormalize(yaw(i)) }));
    for (const t of [9000, 25, 4000, 100, 9999, 0]) {
      const got = sampleGyroAt(long, t);
      const want = sampleGyroAt(long, t);
      expect(got).toEqual(want);
    }
    // 抽一个中点核对角度
    const at = sampleGyroAt(long, 5025);   // 第 100 和 101 个样本之间
    expect((quatAngleTo(QUAT_IDENTITY, at) * 180) / Math.PI).toBeCloseTo(100.5, 1);
  });
});

describe('死区常数本身', () => {
  it('死区比定点精度粗一个数量级 —— 否则存的是量化噪声', () => {
    // int8 定点:每一步 1/127,最坏情况的角度误差 ≈ 2·asin(0.5/127)
    const quantDeg = (2 * Math.asin(0.5 / 127) * 180) / Math.PI;
    const deadDeg = (DEADBAND_RAD * 180) / Math.PI;
    expect(deadDeg / quantDeg).toBeGreaterThan(5);
  });
});
