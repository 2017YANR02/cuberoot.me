"""_dump_motion.py — 供 parity-motion.ts 用: 在真实视频上跑 motion_detect,
只往 stdout 吐 JSON {fps, totalFrames, diffs, segments} (模块自身的打印重定向到 stderr)。

用法: python scripts/_dump_motion.py "videos/3 4.375.MP4"
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import motion_detect as md  # noqa: E402

video = sys.argv[1] if len(sys.argv) > 1 else "videos/3 4.375.MP4"

# motion_detect 会往 stdout 打诊断信息, 重定向到 stderr 保持 stdout 纯 JSON
_real = sys.stdout
sys.stdout = sys.stderr
segments, diffs, fps, total = md.detectMotionSegments(video)
sys.stdout = _real

json.dump({
    "fps": fps,
    "totalFrames": total,
    "diffs": [float(d) for d in diffs],
    "segments": [
        {"type": s["type"], "startFrame": s["startFrame"], "endFrame": s["endFrame"]}
        for s in segments
    ],
}, sys.stdout)
