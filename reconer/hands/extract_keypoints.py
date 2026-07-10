"""extract_keypoints.py — framedump.bin → MediaPipe HandLandmarker 双手 21 点逐帧 → NPZ。

手部通道第一步: 不看贴纸看手。framedump 是 960×540 RGB 原始帧 (TS 管线同款),
VIDEO 模式逐帧检测 (时间戳 = 帧号×10ms, 100fps), 槽位按腕部 x 排序 (0=画面左手
1=画面右手; 固定机位下比模型 handedness 标签稳, 速拧双手极少交叉)。

用法: uv run python extract_keypoints.py [视频名前缀过滤]
输出: data/keypoints/<video>.npz
  kp    (n,2,21,3) float32 图像归一化坐标 (x,y,z), 未检出 NaN
  world (n,2,21,3) float32 手心系米制坐标
  conf  (n,2) float32 handedness 置信度 (未检出 0)
叠加图: ../.tmp/png/hands/ (每视频 6 张, 目检用)
"""

import json
import sys
import time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

ROOT = Path(__file__).resolve().parent
VIDEOS = ROOT.parent / "videos"
OUT = ROOT / "data" / "keypoints"
PNG = ROOT.parent / ".tmp" / "png" / "hands"
MODEL = ROOT / "models" / "hand_landmarker.task"

# 骨架连线 (目检叠加图用)
CONNS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]


def make_landmarker() -> vision.HandLandmarker:
    return vision.HandLandmarker.create_from_options(
        vision.HandLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=str(MODEL)),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=0.3,
            min_hand_presence_confidence=0.3,
            min_tracking_confidence=0.3,
        )
    )


def slot_of(wrists: list[float], prev: list[float | None]) -> list[int]:
    """腕 x 列表 → 槽位列表。双手按 x 排序; 单手贴上帧最近槽, 无上帧按 x<0.5。"""
    if len(wrists) == 2:
        return [0, 1] if wrists[0] <= wrists[1] else [1, 0]
    x = wrists[0]
    if prev[0] is not None or prev[1] is not None:
        d0 = abs(x - prev[0]) if prev[0] is not None else 9e9
        d1 = abs(x - prev[1]) if prev[1] is not None else 9e9
        return [0 if d0 <= d1 else 1]
    return [0 if x < 0.5 else 1]


def process_video(dump_json: Path, only: str | None) -> None:
    meta = json.loads(dump_json.read_text(encoding="utf8"))
    video = meta["video"]
    if only and not video.startswith(only):
        return
    w, h = meta["w"], meta["h"]
    frames = meta["frames"]
    n = len(frames)
    bin_path = dump_json.with_name(dump_json.name.replace(".framedump.json", ".framedump.bin"))
    mm = np.memmap(bin_path, dtype=np.uint8, mode="r", shape=(n, h, w, 3))

    kp = np.full((n, 2, 21, 3), np.nan, dtype=np.float32)
    world = np.full((n, 2, 21, 3), np.nan, dtype=np.float32)
    conf = np.zeros((n, 2), dtype=np.float32)

    lm = make_landmarker()
    t0 = time.time()
    prev_x: list[float | None] = [None, None]
    for i in range(n):
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(mm[i]))
        r = lm.detect_for_video(img, i * 10)
        if r.hand_landmarks:
            wrists = [hl[0].x for hl in r.hand_landmarks]
            slots = slot_of(wrists, prev_x)
            for k, s in enumerate(slots):
                kp[i, s] = [(p.x, p.y, p.z) for p in r.hand_landmarks[k]]
                world[i, s] = [(p.x, p.y, p.z) for p in r.hand_world_landmarks[k]]
                conf[i, s] = r.handedness[k][0].score
            prev_x = [None, None]
            for k, s in enumerate(slots):
                prev_x[s] = wrists[k]
    lm.close()

    OUT.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        OUT / f"{video}.npz", kp=kp, world=world, conf=conf,
        frame0=meta["frames"][0], w=w, h=h,
    )

    det = (~np.isnan(kp[:, :, 0, 0])).sum(axis=1)
    n2, n1, n0 = int((det == 2).sum()), int((det == 1).sum()), int((det == 0).sum())
    print(
        f"{video}: {n} 帧 {time.time() - t0:.0f}s | 双手 {n2} ({n2 / n:.0%}) 单手 {n1} 无手 {n0}"
    )

    # 目检叠加图: 均匀取 6 帧
    PNG.mkdir(parents=True, exist_ok=True)
    for i in np.linspace(0, n - 1, 6).astype(int):
        img = cv2.cvtColor(np.array(mm[i]), cv2.COLOR_RGB2BGR)
        for s, color in ((0, (0, 200, 255)), (1, (255, 160, 0))):  # 槽0黄 槽1蓝(BGR)
            if np.isnan(kp[i, s, 0, 0]):
                continue
            pts = (kp[i, s, :, :2] * [w, h]).astype(int)
            for a, b in CONNS:
                cv2.line(img, tuple(pts[a]), tuple(pts[b]), color, 1)
            for p in pts:
                cv2.circle(img, tuple(p), 2, color, -1)
        cv2.imwrite(str(PNG / f"{video.replace(' ', '_')}-f{frames[i]}.png"), img)


def main() -> None:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for dump_json in sorted(VIDEOS.glob("*.framedump.json")):
        process_video(dump_json, only)


if __name__ == "__main__":
    main()
