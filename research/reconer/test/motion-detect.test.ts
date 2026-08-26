import { describe, it, expect } from "vitest";
import { segmentFromDiffs, roiCrop, type Segment } from "../src/motion-detect.ts";

/** 断言辅助: 只比 type/startFrame/endFrame (忽略浮点 time)。 */
function shape(segs: Segment[]) {
  return segs.map((s) => ({ type: s.type, startFrame: s.startFrame, endFrame: s.endFrame }));
}

describe("segmentFromDiffs (Step 1 状态机)", () => {
  it("空输入返回 [] (修 Python IndexError)", () => {
    expect(segmentFromDiffs([], 100)).toEqual([]);
  });

  it("全静止 → 单个 STATIC 段, time = frame/fps", () => {
    const out = segmentFromDiffs([1, 1, 1, 1, 1], 10);
    expect(shape(out)).toEqual([{ type: "STATIC", startFrame: 1, endFrame: 5 }]);
    expect(out[0].startTime).toBeCloseTo(0.1);
    expect(out[0].endTime).toBeCloseTo(0.5);
  });

  it("清晰单动作 → STATIC / MOVING / STATIC", () => {
    // 帧 0-2 静, 3-7 动, 8-15 静
    const diffs = [1, 1, 1, 10, 10, 10, 10, 10, 1, 1, 1, 1, 1, 1, 1, 1];
    expect(shape(segmentFromDiffs(diffs, 10))).toEqual([
      { type: "STATIC", startFrame: 1, endFrame: 3 },
      { type: "MOVING", startFrame: 4, endFrame: 8 },
      { type: "STATIC", startFrame: 9, endFrame: 16 },
    ]);
  });

  it("过短运动 (<MIN_MOVE_FRAMES) 被吞成静止, 全程合并为一段", () => {
    const diffs = [1, 1, 1, 10, 10, 1, 1, 1, 1, 1, 1]; // 动只 2 帧
    expect(shape(segmentFromDiffs(diffs, 10))).toEqual([
      { type: "STATIC", startFrame: 1, endFrame: 11 },
    ]);
  });

  it("过短静止间隔 (<MIN_STATIC_FRAMES) 使两动作合并为一段", () => {
    // 动1 (4帧) — 静止间隔 3帧 — 动2 (4帧), 间隔 <5 → 合并
    const diffs = [
      1, 1, 1, 10, 10, 10, 10, 1, 1, 1, 10, 10, 10, 10, 1, 1, 1, 1, 1, 1,
    ];
    expect(shape(segmentFromDiffs(diffs, 10))).toEqual([
      { type: "STATIC", startFrame: 1, endFrame: 3 },
      { type: "MOVING", startFrame: 4, endFrame: 14 },
      { type: "STATIC", startFrame: 15, endFrame: 20 },
    ]);
  });

  it("回滞: 处于 STATIC/MOTION 阈值之间维持当前状态", () => {
    // 4 (>3 <5): 静止时不触发运动; 运动时不回静止
    const diffs = [4, 4, 4, 4, 4];
    expect(shape(segmentFromDiffs(diffs, 10))).toEqual([
      { type: "STATIC", startFrame: 1, endFrame: 5 },
    ]);
    // 先拉到运动, 再维持在 4 → 保持 MOVING
    const diffs2 = [10, 10, 10, 4, 4, 4];
    expect(shape(segmentFromDiffs(diffs2, 10))).toEqual([
      { type: "MOVING", startFrame: 1, endFrame: 6 },
    ]);
  });
});

describe("roiCrop", () => {
  it("4K int 截断", () => {
    expect(roiCrop(3840, 2160)).toEqual({ x: 960, y: 324, w: 1920, h: 1512 });
  });
  it("1080p int 截断", () => {
    expect(roiCrop(1920, 1080)).toEqual({ x: 480, y: 162, w: 960, h: 756 });
  });
});
