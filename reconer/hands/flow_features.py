"""flow_features.py — 静止对静止的晶格带位移: 每段"哪条带滑了几格 + 方向"。

optical_flow.md 路线 B 的最终形态。前两版 (Farneback 稠密光流 / 相邻帧对块
匹配) 都死于同一对问题: 拧转中帧严重运动模糊 (糊带 NCC 孔径问题 → 自信的
乱位移) + 快转中晶格跟踪滑脱。解: **不在拧转中测** — splits 即状态完成瞬间,
段两端都是静止清晰帧、晶格可靠; 两端带条带 (按各自晶格矫直) 直接 NCC 匹配:

  90° 转 = 该带恰滑 ±1 格, 180° = ±2 格; U/U'→row0, D→row2, R/L→侧列;
  B/B'→四边带切向反向滑 (curl); F→全带 0 位移+高质量 (不可见面, 独特空签名);
  y 转体→全面内容更换 (全带低质量, 亦独特)。位移符号 = 方向 (颜色通道给不了)。

颜色盲: 只用灰度纹理, 不碰贴纸分类 — 不在负结果⑤⑥⑦封杀范围内。
"""

import cv2
import numpy as np

# 采样行: -1 = B 面上方的 U 面斜条; 0..2 = B 面三行
ROWS = (-1, 0, 1, 2)
COLS = (0, 1, 2)
STEP = 0.06  # 条带采样步长 (格)
HALF_W = 0.33  # 带半宽 (格)
STRIP_EXT = 3.0  # 条带半长 (格)
TMPL_EXT = 1.2  # 模板半长 (格)
SHIFT_MAX = 2.4  # 位移搜索范围 (格) — 覆盖 ±2 (180°)
END_OFFS = (0, 1, 2)  # 端点候选偏移 (帧): 静止瞬间可能差 1-2 帧


def _strip_maps(center: np.ndarray, m: np.ndarray, band: tuple[str, float]) -> tuple[np.ndarray, np.ndarray]:
    """带 → 双线性采样 map (cv2.remap 用)。row 带沿 v1 (列向) 矫直, col 带沿 v2。"""
    kind, pos = band
    along = np.arange(-STRIP_EXT, STRIP_EXT + 1e-9, STEP)
    across = np.arange(-HALF_W, HALF_W + 1e-9, STEP)
    if kind == "row":
        cc, rr = np.meshgrid(along, pos - 1.0 + across)
    else:
        rr, cc = np.meshgrid(along, pos - 1.0 + across)
    px = center[0] + cc * m[0, 0] + rr * m[0, 1]
    py = center[1] + cc * m[1, 0] + rr * m[1, 1]
    return px.astype(np.float32), py.astype(np.float32)


def _band_match(before: np.ndarray, after: np.ndarray) -> tuple[float, float, float]:
    """条带 NCC 匹配 → (位移格, 峰质量, 零位移质量)。模板=before 中央, 滑 after。"""
    n = before.shape[1]
    ext = int(round(TMPL_EXT / STEP))
    mid = n // 2
    tmpl = before[:, mid - ext : mid + ext + 1]
    res = cv2.matchTemplate(after, tmpl, cv2.TM_CCOEFF_NORMED)[0]
    zero = mid - ext
    lim = int(round(SHIFT_MAX / STEP))
    lo = max(0, zero - lim)
    hi = min(len(res), zero + lim + 1)
    k = lo + int(res[lo:hi].argmax())
    return (k - zero) * STEP, float(res[k]), float(res[zero])


def seg_flow_features(
    mm: np.ndarray,
    centers: np.ndarray,
    ms: np.ndarray,
    minv: np.ndarray,
    a: int,
    b: int,
    w: int,
    h: int,
    flip: bool,
    ckp: np.ndarray | None = None,
) -> dict[str, float]:
    """段静止端点 [a..] vs [..b] 的带位移特征。mm: (n,h,w,3) memmap; flip=True 用
    水平镜像帧 (centers/ms/minv 须已是镜像晶格)。每带在端点候选偏移组合中取
    质量最高的一对 (残余运动/手指遮挡时挪 1-2 帧常能救)。"""
    bands = [("row", float(r)) for r in ROWS] + [("col", float(c)) for c in COLS]
    band_names = [f"row{r}" for r in ROWS] + [f"col{c}" for c in COLS]
    keys = [f"fl_{bn}_{k}" for bn in band_names for k in ("d", "q", "q0")] + [
        "fl_curl", "fl_meanq", "fl_minq", "fl_nmoved",
    ]
    nan = {k: np.nan for k in keys}
    n = len(mm)
    if b - a < 1:
        return nan

    # RGB 条带 (非灰度!): 炫彩贴纸灰度近同亮 → 条带只剩黑缝 = 1 格周期图案,
    # NCC 在 0/±1/±2 格处同优 (结构性孔径问题); 色彩打破周期性
    def rgb(i: int) -> np.ndarray:
        f = mm[i][:, ::-1] if flip else mm[i]
        return np.ascontiguousarray(f)

    starts = [a + o for o in END_OFFS if a + o < b and 0 <= a + o < n]
    ends = [b - o for o in END_OFFS if b - o > a and 0 <= b - o < n]
    gs = {i: rgb(i) for i in {*starts, *ends}}

    f = dict(nan)
    ds: list[float] = []
    qs: list[float] = []
    for band, bn in zip(bands, band_names):
        best: tuple[float, float, float] | None = None
        for i in starts:
            mxi, myi = _strip_maps(centers[i], ms[i], band)
            sb = cv2.remap(gs[i], mxi, myi, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            for j in ends:
                if j <= i:
                    continue
                mxj, myj = _strip_maps(centers[j], ms[j], band)
                sa = cv2.remap(gs[j], mxj, myj, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
                d, q, q0 = _band_match(sb, sa)
                if best is None or q > best[1]:
                    best = (d, q, q0)
        if best is None:
            continue
        f[f"fl_{bn}_d"] = best[0]
        f[f"fl_{bn}_q"] = best[1]
        f[f"fl_{bn}_q0"] = best[2]
        ds.append(best[0])
        qs.append(best[1])

    if not qs:
        return nan
    # curl 代理: B 面对边带切向反向滑
    dmap = {bn: f[f"fl_{bn}_d"] for bn in band_names}
    if not any(np.isnan(dmap[k]) for k in ("row0", "row2", "col0", "col2")):
        f["fl_curl"] = (dmap["row2"] - dmap["row0"]) + (dmap["col2"] - dmap["col0"])
    f["fl_meanq"] = float(np.mean(qs))
    f["fl_minq"] = float(np.min(qs))
    f["fl_nmoved"] = float(sum(abs(d) >= 0.5 for d in ds))
    return f
