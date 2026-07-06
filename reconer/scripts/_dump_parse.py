"""差分测试辅助: 用原始 greedy_reverse 的 parseGT/parseSplitFrames 解析全部
splits.txt, 输出 JSON。仅依赖 cv2 (greedy_reverse 顶层 import), 无需 torch。
"""
import sys, os, json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from greedy_reverse import parseGT, parseSplitFrames  # noqa: E402

FILES = [
    "videos/1 4.448.MP4.splits.txt",
    "videos/2 4.369.MP4.splits.txt",
    "videos/3 4.375.MP4.splits.txt",
    "videos/4 4.610.MP4.splits.txt",
    "videos/5 4.067.MP4.splits.txt",
]

out = {}
for f in FILES:
    tokens, tail = parseGT(f)
    frames = parseSplitFrames(f)
    out[f] = {"tokens": tokens, "tail": tail, "frames": frames}

print(json.dumps(out, ensure_ascii=False))
