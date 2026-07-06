"""差分测试辅助: 用原始 greedy_reverse.extract_b_face_colors (cv2) 对指定视频的
前 N 段, 在 splitFrames[t]+3 帧提取 B 面 3x3 网格, 输出 JSON。

用法: python scripts/_dump_bface.py "videos/3 4.375.MP4.splits.txt" [N]
仅依赖 cv2 (已装)。
"""
import sys, os, json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import cv2  # noqa: E402
from greedy_reverse import extract_b_face_colors, parseSplitFrames, ROI_B_FACE  # noqa: E402

splits_path = sys.argv[1]
n = int(sys.argv[2]) if len(sys.argv) > 2 else 8
video_path = splits_path.replace(".splits.txt", "")

frames = parseSplitFrames(splits_path)
cap = cv2.VideoCapture(video_path)

OFFSET = 3
out = {"roi": list(ROI_B_FACE), "segments": []}
n = min(n, len(frames) - 1)
for t in range(n):
    idx = frames[t] + OFFSET
    cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
    ret, frame = cap.read()
    if not ret:
        out["segments"].append({"frame": idx, "grid": None})
        continue
    grid = extract_b_face_colors(frame)  # length 9, {colorName: score}
    dominant = [max(d, key=d.get) if d else "?" for d in grid]
    out["segments"].append({"frame": idx, "dominant": dominant,
                            "grid": [{k: round(v, 4) for k, v in d.items()} for d in grid]})

cap.release()
print(json.dumps(out, ensure_ascii=False))
