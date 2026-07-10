"""debug_lattice.py — 晶格语义目检: 把 (r,c) 索引画上帧 + 打带位移序列。

用法: uv run python debug_lattice.py [视频前缀=1]
输出: ../.tmp/png/hands/lat-<face>-seg<idx>-f<bin>.png
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np

from flow_features import ROWS, COLS, seg_flow_features
from train_classifier import load_quads

ROOT = Path(__file__).resolve().parent
PNG = ROOT.parent / ".tmp" / "png" / "hands"


def main() -> None:
    prefix = sys.argv[1] if len(sys.argv) > 1 else "1"
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

    picked: dict[str, dict] = {}
    for seg in v["segments"]:
        if seg["face"] in ("U", "R") and seg["face"] not in picked and seg["endBin"] - seg["startBin"] >= 5:
            picked[seg["face"]] = seg

    for face, seg in sorted(picked.items()):
        a, b = seg["startBin"], seg["endBin"]
        print(f"=== {face} 段#{seg['idx']} token={seg['token']} bins[{a},{b}] ===")
        f = seg_flow_features(mm, centers, ms, minv, a - 1, b + 1, w, h, False)
        for bn in [f"row{r}" for r in ROWS] + [f"col{c}" for c in COLS]:
            print(
                f"  {bn:>6}: exc {f[f'fl_{bn}_exc']:+.2f}  excc {f[f'fl_{bn}_excc']:+.2f}"
                f"  pos {f[f'fl_{bn}_pos']:+.2f} neg {f[f'fl_{bn}_neg']:+.2f}  q {f[f'fl_{bn}_q']:.2f}"
            )
        for i in (a, (a + b) // 2, b):
            img = cv2.cvtColor(np.array(mm[i]), cv2.COLOR_RGB2BGR)
            for r in range(3):
                for c in range(3):
                    p = centers[i] + ms[i] @ [c - 1.0, r - 1.0]
                    cv2.circle(img, (int(p[0]), int(p[1])), 3, (0, 255, 0), -1)
                    cv2.putText(
                        img, f"{r}{c}", (int(p[0]) + 4, int(p[1]) - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1,
                    )
            # row-1 (U 面斜条) 采样点
            for c in range(3):
                p = centers[i] + ms[i] @ [c - 1.0, -2.0]
                cv2.circle(img, (int(p[0]), int(p[1])), 3, (0, 200, 255), -1)
            cv2.imwrite(str(PNG / f"lat-{face}-seg{seg['idx']}-f{i}.png"), img)


if __name__ == "__main__":
    main()
