"""debug_strips.py — 带条带目检: 段两端矫直条带并排存图 + 打印匹配结果。

用法: uv run python debug_strips.py [视频前缀=1] [段号=2]
输出: ../.tmp/png/hands/strip-seg<idx>-<band>.png (上=段前, 下=段后, 3x 放大)
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np

from flow_features import ROWS, COLS, _strip_maps, _band_match
from train_classifier import load_quads

ROOT = Path(__file__).resolve().parent
PNG = ROOT.parent / ".tmp" / "png" / "hands"


def main() -> None:
    prefix = sys.argv[1] if len(sys.argv) > 1 else "1"
    seg_idx = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    videos = json.loads((ROOT / "data" / "segments.json").read_text(encoding="utf8"))
    quads_all = json.loads((ROOT / "data" / "quads.json").read_text(encoding="utf8"))
    v = next(x for x in videos if x["video"].startswith(prefix))
    npz = np.load(ROOT / "data" / "keypoints" / f"{v['video']}.npz")
    w, h = int(npz["w"]), int(npz["h"])
    n = v["nBinFrames"]
    centers, ms, minv = load_quads(quads_all[v["video"]], n)
    mm = np.memmap(
        ROOT.parent / "videos" / f"{v['video']}.framedump.bin",
        dtype=np.uint8, mode="r", shape=(n, h, w, 3),
    )
    PNG.mkdir(parents=True, exist_ok=True)
    seg = v["segments"][seg_idx]
    a, b = seg["startBin"], seg["endBin"]
    print(f"{v['video']} 段#{seg_idx} token={seg['token']} face={seg['face']} bins[{a},{b}]")

    bands = [("row", float(r)) for r in ROWS] + [("col", float(c)) for c in COLS]
    names = [f"row{r}" for r in ROWS] + [f"col{c}" for c in COLS]
    for band, bn in zip(bands, names):
        mxa, mya = _strip_maps(centers[a], ms[a], band)
        mxb, myb = _strip_maps(centers[b], ms[b], band)
        sa = cv2.remap(np.ascontiguousarray(mm[a]), mxa, mya, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        sb = cv2.remap(np.ascontiguousarray(mm[b]), mxb, myb, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        d, q, q0 = _band_match(sa, sb)
        print(f"  {bn:>6}: d {d:+.2f}  q {q:.2f}  q0 {q0:.2f}")
        gap = np.full((4, sa.shape[1], 3), 255, dtype=np.uint8)
        img = np.vstack([sa, gap, sb])
        img = cv2.resize(img, (img.shape[1] * 3, img.shape[0] * 3), interpolation=cv2.INTER_NEAREST)
        cv2.imwrite(str(PNG / f"strip-seg{seg_idx}-{bn}.png"), cv2.cvtColor(img, cv2.COLOR_RGB2BGR))


if __name__ == "__main__":
    main()
