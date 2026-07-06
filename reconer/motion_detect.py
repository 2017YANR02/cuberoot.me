"""
运动检测模块 — 从魔方视频中切分出 静止/转动 片段。

原理：
  对魔方 ROI 区域计算相邻帧的灰度绝对差的均值。
  当差值超过阈值时视为"运动帧"，低于阈值时视为"静止帧"。
  通过状态机将连续帧聚合为运动片段。
"""

import cv2
import numpy as np
import sys
import os


# ============================================================
# 配置参数
# ============================================================

# 魔方 ROI 区域 (归一化坐标, 相对于整帧)
# NOTE: 从截图观察, 魔方大约在画面中央偏上
ROI_X1, ROI_Y1 = 0.25, 0.15  # 左上角
ROI_X2, ROI_Y2 = 0.75, 0.85  # 右下角

# 运动检测阈值
MOTION_THRESHOLD = 5.0    # 高于此值 → 运动帧
STATIC_THRESHOLD = 3.0    # 低于此值 → 静止帧 (有回滞, 防抖动)

# 最短运动片段长度 (帧数), 过短的视为噪声
MIN_MOVE_FRAMES = 3

# 最短静止间隔 (帧数), 过短的静止视为同一个动作的一部分
MIN_STATIC_FRAMES = 5


def getRoi(frame, h, w):
    """从帧中截取 ROI 区域。"""
    x1 = int(w * ROI_X1)
    y1 = int(h * ROI_Y1)
    x2 = int(w * ROI_X2)
    y2 = int(h * ROI_Y2)
    return frame[y1:y2, x1:x2]


def computeFrameDiff(prevGray, currGray, h, w):
    """计算两帧 ROI 区域的灰度绝对差均值。"""
    prevRoi = getRoi(prevGray, h, w)
    currRoi = getRoi(currGray, h, w)
    diff = cv2.absdiff(prevRoi, currRoi)
    return np.mean(diff)


def detectMotionSegments(videoPath):
    """
    检测视频中的运动片段。

    返回:
        segments: list of dict, 每个元素:
            {
                'type': 'STATIC' | 'MOVING',
                'startFrame': int,
                'endFrame': int,
                'startTime': float,
                'endTime': float,
            }
        fps: float
        totalFrames: int
    """
    cap = cv2.VideoCapture(videoPath)
    if not cap.isOpened():
        print(f"Error: cannot open {videoPath}")
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS)
    totalFrames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))

    print(f"Video: {w}x{h}, {fps:.2f} fps, {totalFrames} frames, {totalFrames/fps:.2f}s")

    # 逐帧计算帧间差
    ret, prevFrame = cap.read()
    if not ret:
        print("Error: cannot read first frame")
        sys.exit(1)

    prevGray = cv2.cvtColor(prevFrame, cv2.COLOR_BGR2GRAY)
    # 轻度模糊去噪
    prevGray = cv2.GaussianBlur(prevGray, (5, 5), 0)

    diffs = []  # 每帧的差值

    frameIdx = 1
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)

        diff = computeFrameDiff(prevGray, gray, h, w)
        diffs.append(diff)

        prevGray = gray
        frameIdx += 1

    cap.release()
    print(f"Computed {len(diffs)} frame diffs")

    # 用状态机将帧分为 STATIC / MOVING
    states = []  # 每帧的状态标签
    state = "STATIC"

    for diff in diffs:
        if state == "STATIC":
            if diff > MOTION_THRESHOLD:
                state = "MOVING"
        else:  # MOVING
            if diff < STATIC_THRESHOLD:
                state = "STATIC"
        states.append(state)

    # 聚合为片段
    rawSegments = []
    if states:
        currState = states[0]
        startIdx = 0
        for i in range(1, len(states)):
            if states[i] != currState:
                rawSegments.append({
                    'type': currState,
                    'startFrame': startIdx + 1,  # +1 因为 diffs 从第1帧开始
                    'endFrame': i,
                })
                currState = states[i]
                startIdx = i
        # 最后一段
        rawSegments.append({
            'type': currState,
            'startFrame': startIdx + 1,
            'endFrame': len(states),
        })

    # 过滤：移除过短的运动片段 (视为噪声)
    filtered = []
    for seg in rawSegments:
        duration = seg['endFrame'] - seg['startFrame']
        if seg['type'] == 'MOVING' and duration < MIN_MOVE_FRAMES:
            # 把过短的运动片段变为静止
            seg['type'] = 'STATIC'
        filtered.append(seg)

    # 合并相邻的同类型片段
    merged = [filtered[0]]
    for seg in filtered[1:]:
        if seg['type'] == merged[-1]['type']:
            merged[-1]['endFrame'] = seg['endFrame']
        else:
            merged.append(seg)

    # 过滤：移除过短的静止间隔 (合并为一个连续运动)
    filtered2 = []
    for seg in merged:
        duration = seg['endFrame'] - seg['startFrame']
        if seg['type'] == 'STATIC' and duration < MIN_STATIC_FRAMES and filtered2:
            # 把过短的静止间隔变为运动
            seg['type'] = 'MOVING'
        filtered2.append(seg)

    # 再次合并
    final = [filtered2[0]]
    for seg in filtered2[1:]:
        if seg['type'] == final[-1]['type']:
            final[-1]['endFrame'] = seg['endFrame']
        else:
            final.append(seg)

    # 添加时间信息
    for seg in final:
        seg['startTime'] = seg['startFrame'] / fps
        seg['endTime'] = seg['endFrame'] / fps

    return final, diffs, fps, totalFrames


def printTimeline(segments, fps):
    """打印运动时间线。"""
    moveCount = 0
    print("\n" + "=" * 70)
    print("Motion Timeline")
    print("=" * 70)

    for seg in segments:
        duration = seg['endTime'] - seg['startTime']
        frameCount = seg['endFrame'] - seg['startFrame']

        if seg['type'] == 'MOVING':
            moveCount += 1
            label = f"  MOVE #{moveCount:2d}"
        else:
            label = "  STATIC   "

        print(f"{label}  [{seg['startTime']:6.2f}s - {seg['endTime']:6.2f}s]"
              f"  ({duration:.2f}s, {frameCount} frames)")

    print("=" * 70)
    print(f"Total moves detected: {moveCount}")
    print(f"Total segments: {len(segments)}")


def saveDiffPlot(diffs, fps, outputPath):
    """将帧间差值曲线保存为图片 (纯 OpenCV 实现, 无需 matplotlib)。"""
    plotW, plotH = 1200, 400
    img = np.ones((plotH, plotW, 3), dtype=np.uint8) * 255

    n = len(diffs)
    if n == 0:
        return

    maxDiff = max(diffs) * 1.1 if max(diffs) > 0 else 1.0

    # 绘制阈值线
    threshY = int(plotH - (MOTION_THRESHOLD / maxDiff) * (plotH - 40) - 20)
    cv2.line(img, (0, threshY), (plotW, threshY), (0, 0, 255), 1)
    cv2.putText(img, f"threshold={MOTION_THRESHOLD}", (plotW - 200, threshY - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)

    # 绘制差值曲线
    points = []
    for i, d in enumerate(diffs):
        x = int(i / n * plotW)
        y = int(plotH - (d / maxDiff) * (plotH - 40) - 20)
        points.append((x, y))

    for i in range(1, len(points)):
        color = (0, 0, 200) if diffs[i] > MOTION_THRESHOLD else (200, 200, 200)
        cv2.line(img, points[i-1], points[i], color, 1)

    # X 轴时间标注
    for sec in range(0, int(n / fps) + 1, 2):
        x = int(sec * fps / n * plotW)
        cv2.putText(img, f"{sec}s", (x, plotH - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (100, 100, 100), 1)

    cv2.imwrite(outputPath, img)
    print(f"\nDiff plot saved to: {outputPath}")


def saveStableFrames(videoPath, segments, outputDir):
    """
    提取每个运动片段前后的静止帧。
    保存为 move_N_before.png / move_N_after.png。
    """
    os.makedirs(outputDir, exist_ok=True)
    cap = cv2.VideoCapture(videoPath)
    fps = cap.get(cv2.CAP_PROP_FPS)

    moveIdx = 0
    for i, seg in enumerate(segments):
        if seg['type'] != 'MOVING':
            continue
        moveIdx += 1

        # before: 取前一个静止片段的最后一帧
        if i > 0 and segments[i-1]['type'] == 'STATIC':
            beforeFrame = segments[i-1]['endFrame'] - 1
        else:
            beforeFrame = seg['startFrame']

        # after: 取后一个静止片段的第一帧 + 几帧偏移 (等手稳定)
        if i + 1 < len(segments) and segments[i+1]['type'] == 'STATIC':
            afterFrame = segments[i+1]['startFrame'] + 3
        else:
            afterFrame = seg['endFrame']

        for label, fnum in [('before', beforeFrame), ('after', afterFrame)]:
            cap.set(cv2.CAP_PROP_POS_FRAMES, fnum)
            ret, frame = cap.read()
            if ret:
                path = os.path.join(outputDir, f"move_{moveIdx:02d}_{label}.png")
                cv2.imwrite(path, frame)

    cap.release()
    print(f"\nStable frames saved to: {outputDir}/ ({moveIdx} moves)")


if __name__ == "__main__":
    videoPath = sys.argv[1] if len(sys.argv) > 1 else "test.mp4"

    print(f"Analyzing: {videoPath}")
    segments, diffs, fps, totalFrames = detectMotionSegments(videoPath)

    printTimeline(segments, fps)
    saveDiffPlot(diffs, fps, "diff_plot.png")
    saveStableFrames(videoPath, segments, "stable_frames")
