"""train_classifier.py — 每段手部运动特征 → 动作面分类, 留一视频交叉验证 (生死判)。

判据: 多数类基线 ~38% (U)。LOVO 池化精度显著高于基线 = 通道有信号,
值得做方向分类 + 融合进锚定搜索; 贴着基线 = 负结果, 归档。

特征 (每段, 端点 ±PAD 帧): 每手 {存在率, 掌心净位移/路径长/峰值速度,
朝向角净旋转/累计旋转, 开合度 首末/极值, 食指/无名指/拇指 相对掌心路径长,
掌心均位, 腕 z 变化} × 2 + 跨手 {运动能量占比, 双掌距离变化, 段长}。
HistGradientBoosting 原生吃 NaN (整段缺手 → 该手特征全 NaN)。

用法: uv run python train_classifier.py
"""

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import confusion_matrix

from flow_features import seg_flow_features

ROOT = Path(__file__).resolve().parent
PAD = 2

PALM_IDX = [0, 5, 9, 13, 17]
TIP_IDX = [4, 8, 12, 16, 20]


def kabsch_axis_angle(a: np.ndarray, b: np.ndarray) -> tuple[float, np.ndarray]:
    """两帧 21 点 (中心化) 最优旋转 → (角度 rad, 单位轴)。"""
    a = a - a.mean(axis=0)
    b = b - b.mean(axis=0)
    u, _, vt = np.linalg.svd(a.T @ b)
    d = np.sign(np.linalg.det(u @ vt))
    r = (u @ np.diag([1.0, 1.0, d]) @ vt).T
    cos = np.clip((np.trace(r) - 1) / 2, -1, 1)
    ang = float(np.arccos(cos))
    axis = np.array([r[2, 1] - r[1, 2], r[0, 2] - r[2, 0], r[1, 0] - r[0, 1]])
    n = np.linalg.norm(axis)
    return ang, (axis / n if n > 1e-9 else np.zeros(3))


def rot3d_features(world: np.ndarray, prefix: str) -> dict[str, float]:
    """world: (T,21,3) 手心系序列 → 3D 旋转特征 (逐帧 Kabsch 链)。

    出平面旋转是 R/L (绕x) vs U (绕y) vs F (绕z) 的直接判据,
    图像平面朝向角看不见它。轴取逐帧角度加权均值。
    """
    keys = ["rot3d_total", "rot3d_net", "rot3d_ax", "rot3d_ay", "rot3d_az"]
    present = ~np.isnan(world[:, 0, 0])
    if present.sum() < 2:
        return {f"{prefix}_{k}": np.nan for k in keys}
    p = world[present]
    total = 0.0
    wax = np.zeros(3)
    for i in range(1, len(p)):
        ang, axis = kabsch_axis_angle(p[i - 1], p[i])
        total += ang
        wax += ang * axis
    net, _ = kabsch_axis_angle(p[0], p[-1])
    n = np.linalg.norm(wax)
    ax = wax / n if n > 1e-9 else np.zeros(3)
    return {
        f"{prefix}_rot3d_total": total,
        f"{prefix}_rot3d_net": net,
        f"{prefix}_rot3d_ax": float(ax[0]),
        f"{prefix}_rot3d_ay": float(ax[1]),
        f"{prefix}_rot3d_az": float(ax[2]),
    }


def hand_features(kp: np.ndarray, prefix: str) -> dict[str, float]:
    """kp: (T,21,3) 单手段内序列 (缺帧 NaN)。返回命名特征 (缺手全 NaN)。"""
    present = ~np.isnan(kp[:, 0, 0])
    nan = {f"{prefix}_{k}": np.nan for k in [
        "presence", "net_dx", "net_dy", "path", "vmax", "net_rot", "abs_rot",
        "open_first", "open_last", "open_min", "open_max",
        "idx_path", "ring_path", "thumb_path", "mean_x", "mean_y", "dz",
    ]}
    if present.sum() < 2:
        nan[f"{prefix}_presence"] = float(present.mean())
        return nan
    p = kp[present]  # (t,21,3)
    palm = p[:, PALM_IDX, :2].mean(axis=1)  # (t,2)
    scale = np.linalg.norm(p[:, 9, :2] - p[:, 0, :2], axis=1)
    scale = np.maximum(scale, 1e-3)
    theta = np.unwrap(np.arctan2(p[:, 9, 1] - p[:, 0, 1], p[:, 9, 0] - p[:, 0, 0]))
    tips = p[:, TIP_IDX, :2]  # (t,5,2)
    openness = (np.linalg.norm(tips - palm[:, None, :], axis=2) / scale[:, None]).mean(axis=1)
    step = np.linalg.norm(np.diff(palm, axis=0), axis=1)

    def rel_path(tip_i: int) -> float:
        rel = p[:, tip_i, :2] - palm
        return float(np.linalg.norm(np.diff(rel, axis=0), axis=1).sum())

    return {
        f"{prefix}_presence": float(present.mean()),
        f"{prefix}_net_dx": float(palm[-1, 0] - palm[0, 0]),
        f"{prefix}_net_dy": float(palm[-1, 1] - palm[0, 1]),
        f"{prefix}_path": float(step.sum()),
        f"{prefix}_vmax": float(step.max()) if len(step) else np.nan,
        f"{prefix}_net_rot": float(theta[-1] - theta[0]),
        f"{prefix}_abs_rot": float(np.abs(np.diff(theta)).sum()),
        f"{prefix}_open_first": float(openness[0]),
        f"{prefix}_open_last": float(openness[-1]),
        f"{prefix}_open_min": float(openness.min()),
        f"{prefix}_open_max": float(openness.max()),
        f"{prefix}_idx_path": rel_path(8),
        f"{prefix}_ring_path": rel_path(16),
        f"{prefix}_thumb_path": rel_path(4),
        f"{prefix}_mean_x": float(palm[:, 0].mean()),
        f"{prefix}_mean_y": float(palm[:, 1].mean()),
        f"{prefix}_dz": float(p[-1, 0, 2] - p[0, 0, 2]),
    }


def load_quads(raw: list[list[float] | None], n: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """每帧晶格 → (centers (n,2) 像素, Ms (n,2,2) 格→像素, Minv 像素→格)。

    基向量在 4 个 90° 变体中取 v1 最向右 + v2 最向下者 (跨 span/视频正则化,
    reorient 只保证 span 内一致); 格 (1,1) 中心对旋转不变。缺帧最近填充。"""
    centers = np.full((n, 2), np.nan)
    Ms = np.full((n, 2, 2), np.nan)
    for i, q in enumerate(raw):
        if q is None:
            continue
        ox, oy, v1x, v1y, v2x, v2y = q
        centers[i] = (ox + v1x + v2x, oy + v1y + v2y)
        variants = [
            (v1x, v1y, v2x, v2y),
            (v2x, v2y, -v1x, -v1y),
            (-v1x, -v1y, -v2x, -v2y),
            (-v2x, -v2y, v1x, v1y),
        ]
        a1x, a1y, a2x, a2y = max(variants, key=lambda v: v[0] + v[3])
        Ms[i] = [[a1x, a2x], [a1y, a2y]]
    ok = ~np.isnan(centers[:, 0])
    if not ok.any():
        raise ValueError("无任何晶格帧")
    idx = np.arange(n)
    nearest = idx[ok][np.abs(idx[:, None] - idx[ok][None, :]).argmin(axis=1)]
    ms = Ms[nearest]
    return centers[nearest], ms, np.linalg.inv(ms)


def mirror_quads(raw: list[list[float] | None], w: int) -> list[list[float] | None]:
    """水平镜像晶格: x → w-x (origin), 基向量 x 分量取反。"""
    return [None if q is None else [w - q[0], q[1], -q[2], q[3], -q[4], q[5]] for q in raw]


def to_cube_all(kp: np.ndarray, centers: np.ndarray, minv: np.ndarray, w: int, h: int) -> np.ndarray:
    """全部关键点 → 魔方格坐标 (n,2,21,2); 格心原点, 格边为单位, 面域 ±1.5。"""
    px = kp[..., :2] * [w, h]
    rel = px - centers[:, None, None, :]
    return np.einsum("nij,nskj->nski", minv, rel)


def cube_hand_features(cwin: np.ndarray, s: int, prefix: str) -> dict[str, float]:
    """格坐标系特征: 指尖/掌心 相对魔方的位置与净位移 — U 层在上沿, R/L 在侧列。"""
    keys = [
        "c_idx_mx", "c_idx_my", "c_idx_ndx", "c_idx_ndy", "c_idx_x0", "c_idx_y0",
        "c_idx_x1", "c_idx_y1", "c_thumb_mx", "c_thumb_my", "c_thumb_ndx", "c_thumb_ndy",
        "c_palm_mx", "c_palm_my",
    ]
    hand = cwin[:, s]  # (T,21,2)
    present = ~np.isnan(hand[:, 0, 0])
    if present.sum() < 2:
        return {f"{prefix}_{k}": np.nan for k in keys}
    p = hand[present]
    tip = p[:, 8]
    thumb = p[:, 4]
    palm = p[:, PALM_IDX].mean(axis=1)
    return {
        f"{prefix}_c_idx_mx": float(tip[:, 0].mean()),
        f"{prefix}_c_idx_my": float(tip[:, 1].mean()),
        f"{prefix}_c_idx_ndx": float(tip[-1, 0] - tip[0, 0]),
        f"{prefix}_c_idx_ndy": float(tip[-1, 1] - tip[0, 1]),
        f"{prefix}_c_idx_x0": float(tip[0, 0]),
        f"{prefix}_c_idx_y0": float(tip[0, 1]),
        f"{prefix}_c_idx_x1": float(tip[-1, 0]),
        f"{prefix}_c_idx_y1": float(tip[-1, 1]),
        f"{prefix}_c_thumb_mx": float(thumb[:, 0].mean()),
        f"{prefix}_c_thumb_my": float(thumb[:, 1].mean()),
        f"{prefix}_c_thumb_ndx": float(thumb[-1, 0] - thumb[0, 0]),
        f"{prefix}_c_thumb_ndy": float(thumb[-1, 1] - thumb[0, 1]),
        f"{prefix}_c_palm_mx": float(palm[:, 0].mean()),
        f"{prefix}_c_palm_my": float(palm[:, 1].mean()),
    }


def video_norm(kp: np.ndarray) -> tuple[np.ndarray, float]:
    """每视频归一化参数: 魔方中心 (全程双掌中点中位) + 尺度 (双掌距中位)。"""
    lpalm = kp[:, 0, PALM_IDX, :2].mean(axis=1)
    rpalm = kp[:, 1, PALM_IDX, :2].mean(axis=1)
    both = ~(np.isnan(lpalm[:, 0]) | np.isnan(rpalm[:, 0]))
    mid = (lpalm[both] + rpalm[both]) / 2
    dist = np.linalg.norm(lpalm[both] - rpalm[both], axis=1)
    return np.median(mid, axis=0), float(np.median(dist))


def seg_features(
    kp: np.ndarray,
    world: np.ndarray,
    ckp: np.ndarray,
    seg: dict,
    center: np.ndarray,
    scale: float,
) -> dict[str, float]:
    a = max(0, seg["startBin"] - PAD)
    b = min(len(kp), seg["endBin"] + PAD + 1)
    win = (kp[a:b] - [*center, 0]) / scale  # (T,2,21,3) 视频归一坐标系
    cwin = ckp[a:b]  # (T,2,21,2) 魔方格坐标系
    f = hand_features(win[:, 0], "L") | hand_features(win[:, 1], "R")
    f |= rot3d_features(world[a:b, 0], "L") | rot3d_features(world[a:b, 1], "R")
    lp, rp = f["L_path"], f["R_path"]
    tot = np.nansum([lp, rp])
    f["r_energy"] = rp / tot if tot > 0 else np.nan
    lpalm = win[:, 0, PALM_IDX, :2].mean(axis=1)
    rpalm = win[:, 1, PALM_IDX, :2].mean(axis=1)
    dist = np.linalg.norm(lpalm - rpalm, axis=1)
    ok = ~np.isnan(dist)
    f["palm_dist_delta"] = float(dist[ok][-1] - dist[ok][0]) if ok.sum() >= 2 else np.nan
    f["seg_len"] = seg["endBin"] - seg["startBin"]
    f |= cube_hand_features(cwin, 0, "L") | cube_hand_features(cwin, 1, "R")
    f |= peak_features(win, world[a:b], cwin)
    return f


def peak_features(win: np.ndarray, world: np.ndarray, cwin: np.ndarray) -> dict[str, float]:
    """峰速 7 帧窗: 拨/转的判别信号集中于此, 整段聚合会被 regrip 稀释。

    峰值时刻 = 双手食指尖+腕合成速度最大的帧; 窗内重算主手位移方向、
    3D 旋转、食指尖格坐标位置/净位移。"""
    keys = [
        "pk_hand", "pk_ux", "pk_uy", "pk_speed", "pk_cx", "pk_cy", "pk_cndx", "pk_cndy",
        "pk_rot_ax", "pk_rot_ay", "pk_rot_az", "pk_rot_ang",
    ]
    T = len(win)
    if T < 3:
        return {k: np.nan for k in keys}
    speed = np.zeros((T - 1, 2))
    for s in (0, 1):
        pts = win[:, s][:, [0, 8], :2].reshape(T, -1)  # 腕+食指尖
        d = np.linalg.norm(np.diff(pts, axis=0), axis=1)
        speed[:, s] = np.nan_to_num(d)
    comb = speed.sum(axis=1)
    pk = int(comb.argmax())
    s = int(speed[pk].argmax())  # 主动手
    a = max(0, pk - 3)
    b = min(T, pk + 4)
    hand = win[a:b, s]
    present = ~np.isnan(hand[:, 0, 0])
    if present.sum() < 2:
        return {k: np.nan for k in keys}
    p = hand[present]
    tip = p[:, 8, :2]
    nd = tip[-1] - tip[0]
    n = np.linalg.norm(nd)
    u = nd / n if n > 1e-6 else np.zeros(2)
    ctip = cwin[a:b, s][present, 8]  # 食指尖格坐标
    wp = world[a:b, s]
    wpresent = ~np.isnan(wp[:, 0, 0])
    if wpresent.sum() >= 2:
        q = wp[wpresent]
        ang, axis = kabsch_axis_angle(q[0], q[-1])
    else:
        ang, axis = np.nan, np.array([np.nan] * 3)
    return {
        "pk_hand": float(s),
        "pk_ux": float(u[0]),
        "pk_uy": float(u[1]),
        "pk_speed": float(comb[pk]),
        "pk_cx": float(ctip[:, 0].mean()),
        "pk_cy": float(ctip[:, 1].mean()),
        "pk_cndx": float(ctip[-1, 0] - ctip[0, 0]),
        "pk_cndy": float(ctip[-1, 1] - ctip[0, 1]),
        "pk_rot_ax": float(axis[0]),
        "pk_rot_ay": float(axis[1]),
        "pk_rot_az": float(axis[2]),
        "pk_rot_ang": float(ang),
    }


MIRROR_LABEL = {"L": "R", "R": "L"}


def mirror_arrays(kp: np.ndarray, world: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """水平镜像: 图像 x→1-x, 世界系 x→-x, 左右手槽互换 (标签 L↔R 由调用方换)。"""
    mkp = kp[:, ::-1].copy()
    mkp[..., 0] = 1 - mkp[..., 0]
    mw = world[:, ::-1].copy()
    mw[..., 0] = -mw[..., 0]
    return mkp, mw


def main() -> None:
    videos = json.loads((ROOT / "data" / "segments.json").read_text(encoding="utf8"))
    rows: list[dict[str, float]] = []
    labels: list[str] = []
    groups: list[str] = []
    tokens: list[str] = []
    mrows: list[dict[str, float]] = []
    mlabels: list[str] = []
    mgroups: list[str] = []
    quads_all = json.loads((ROOT / "data" / "quads.json").read_text(encoding="utf8"))
    for v in videos:
        npz = np.load(ROOT / "data" / "keypoints" / f"{v['video']}.npz")
        kp = npz["kp"]
        world = npz["world"]
        w_, h_ = int(npz["w"]), int(npz["h"])
        n_ = len(kp)
        raw_quads = quads_all[v["video"]]
        center, scale = video_norm(kp)
        centers, ms, minv = load_quads(raw_quads, n_)
        ckp = to_cube_all(kp, centers, minv, w_, h_)
        mkp, mw = mirror_arrays(kp, world)
        mcenter, mscale = video_norm(mkp)
        mcenters, mms, mminv = load_quads(mirror_quads(raw_quads, w_), n_)
        mckp = to_cube_all(mkp, mcenters, mminv, w_, h_)
        mm = np.memmap(
            ROOT.parent / "videos" / f"{v['video']}.framedump.bin",
            dtype=np.uint8, mode="r", shape=(n_, h_, w_, 3),
        )
        def lattice_geom(a: int, b: int, cs: np.ndarray, m: np.ndarray) -> dict[str, float]:
            """晶格几何: B/U 面歧义的条件特征 (U 面强透视压缩, 位置更高)。"""
            v1 = m[a:b, :, 0]
            v2 = m[a:b, :, 1]
            l1 = np.linalg.norm(v1, axis=1)
            l2 = np.linalg.norm(v2, axis=1)
            cosang = np.abs((v1 * v2).sum(axis=1) / np.maximum(l1 * l2, 1e-6))
            return {
                "geo_scale": float(l1.mean()),
                "geo_aspect": float((l2 / np.maximum(l1, 1e-6)).mean()),
                "geo_shear": float(cosang.mean()),
                "geo_cy": float(cs[a:b, 1].mean() / h_),
            }

        for seg in v["segments"]:
            a_, b_ = seg["startBin"], seg["endBin"]
            fl = seg_flow_features(mm, centers, ms, minv, a_, b_, w_, h_, False, ckp)
            geo = lattice_geom(max(0, a_), min(n_, b_ + 1), centers, ms)
            rows.append(seg_features(kp, world, ckp, seg, center, scale) | fl | geo)
            labels.append(seg["face"])
            groups.append(v["video"])
            tokens.append(seg["token"])
            # 镜像增广 (只进训练折): 同选手指法镜像即 L↔R 对称
            mfl = seg_flow_features(mm, mcenters, mms, mminv, a_, b_, w_, h_, True, mckp)
            mgeo = lattice_geom(max(0, a_), min(n_, b_ + 1), mcenters, mms)
            mrows.append(seg_features(mkp, mw, mckp, seg, mcenter, mscale) | mfl | mgeo)
            mlabels.append(MIRROR_LABEL.get(seg["face"], seg["face"]))
            mgroups.append(v["video"])
        print(f"  特征就绪: {v['video']}")

    import sys

    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    feat_names = sorted(rows[0])
    if only:
        feat_names = [k for k in feat_names if k.startswith(only)]
        print(f"消融: 只用 {only}* 特征 ({len(feat_names)} 个)")
    X = np.array([[r[k] for k in feat_names] for r in rows])
    y = np.array(labels)
    g = np.array(groups)
    mX = np.array([[r[k] for k in feat_names] for r in mrows])
    my = np.array(mlabels)
    mg = np.array(mgroups)
    classes = sorted(set(labels))
    base = max((y == c).mean() for c in classes)
    print(f"{len(y)} 段 (+镜像增广进训练折), {X.shape[1]} 特征, 类 {classes}, 多数类基线 {base:.1%}\n")

    # probs.json (旧链外观通道) 对齐: 非转体段按序消费
    probs_list: list[dict[str, float] | None] = []
    for v in videos:
        pj = json.loads(
            (ROOT.parent / "videos" / f"{v['video']}.probs.json").read_text(encoding="utf8")
        )
        it = iter(pj)
        for seg in v["segments"]:
            probs_list.append(next(it) if seg["face"] != "y" else None)

    all_true: list[str] = []
    all_pred: list[str] = []
    all_proba: list[np.ndarray] = []
    proba_classes: np.ndarray | None = None
    all_top2 = 0
    for vid in sorted(set(groups)):
        tr, te = g != vid, g == vid
        Xtr = np.vstack([X[tr], mX[mg != vid]])
        ytr = np.concatenate([y[tr], my[mg != vid]])
        clf = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.08, random_state=0)
        clf.fit(Xtr, ytr)
        pred = clf.predict(X[te])
        proba = clf.predict_proba(X[te])
        all_proba.extend(proba)
        proba_classes = clf.classes_
        order = np.argsort(-proba, axis=1)
        top2 = sum(
            yt in (clf.classes_[order[i, 0]], clf.classes_[order[i, 1]])
            for i, yt in enumerate(y[te])
        )
        acc = (pred == y[te]).mean()
        print(f"  {vid}: top1 {acc:.1%}  top2 {top2 / te.sum():.1%}  ({te.sum()} 段)")
        all_true.extend(y[te])
        all_pred.extend(pred)
        all_top2 += top2

    all_true_a = np.array(all_true)
    all_pred_a = np.array(all_pred)
    pooled = (all_true_a == all_pred_a).mean()
    print(f"\n池化 LOVO: top1 {pooled:.1%}  top2 {all_top2 / len(y):.1%}  (基线 {base:.1%})")

    cm = confusion_matrix(all_true_a, all_pred_a, labels=classes)
    print("\n混淆矩阵 (行=真):")
    print("      " + " ".join(f"{c:>4}" for c in classes))
    for i, c in enumerate(classes):
        rec = cm[i, i] / cm[i].sum() if cm[i].sum() else 0
        print(f"  {c:>3} " + " ".join(f"{x:>4}" for x in cm[i]) + f"  召回 {rec:.0%}")

    # 诊断 1: 视频内 k-fold (打破分组) — 高于 LOVO 很多 = 跨视频漂移是主因;
    # 同样烂 = 特征/窗口本身不携带信号
    from sklearn.model_selection import StratifiedKFold

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)
    okc = 0
    for tr_i, te_i in skf.split(X, y):
        clf = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.08, random_state=0)
        clf.fit(X[tr_i], y[tr_i])
        okc += (clf.predict(X[te_i]) == y[te_i]).sum()
    print(f"\n诊断: 视频内混合 5-fold top1 {okc / len(y):.1%}  (LOVO {pooled:.1%})")

    # 融合: P_hands^(1-w) × P_probs^w (非转体段; 两通道错误若不相关应显著超单通道)
    # all_proba 按 LOVO 视频序收集 = rows 原序 (视频名本身有序), 逐行对齐
    assert proba_classes is not None
    cls_idx = {c: i for i, c in enumerate(proba_classes)}
    for w_mix in (0.0, 0.3, 0.5, 0.7, 1.0):
        okf = okf2 = tot = 0
        for i in range(len(y)):
            pl = probs_list[i]
            if pl is None:
                continue
            ph = all_proba[i]
            fused = {}
            for c in proba_classes:
                if c == "y":
                    continue
                pp = max(pl.get(c, 0.0), 0.03)
                fused[c] = (max(ph[cls_idx[c]], 1e-4) ** (1 - w_mix)) * (pp ** w_mix)
            rank = sorted(fused, key=lambda k: -fused[k])
            tot += 1
            okf += rank[0] == y[i]
            okf2 += y[i] in rank[:2]
        tag = {0.0: "纯手部", 1.0: "纯probs"}.get(w_mix, f"w={w_mix}")
        print(f"融合 {tag}: top1 {okf / tot:.1%}  top2 {okf2 / tot:.1%}  ({tot} 非转体段)")

    # 诊断 3: 带位移指纹直检 — 每 face 的 |d| 冠军带分布 (绕过分类器)
    band_cols = [k for k in feat_names if k.startswith("fl_") and k.endswith("_d")]
    if band_cols:
        fi2 = {k: i for i, k in enumerate(feat_names)}
        bm = np.array([[abs(r[fi2[k]]) if not np.isnan(r[fi2[k]]) else 0 for k in band_cols] for r in X])
        win = np.argmax(bm, axis=1)
        moved = bm.max(axis=1) >= 0.5
        print("\n指纹直检: 每 face 的 |d| 冠军带分布 (仅 |d|≥0.5 者计入, none=全带静止)")
        short = [k.replace("fl_", "").replace("_d", "") for k in band_cols]
        print("      " + " ".join(f"{s:>6}" for s in short) + "   none")
        for c in classes:
            m = y == c
            cnt = np.bincount(win[m & moved], minlength=len(band_cols))
            print(f"  {c:>3} " + " ".join(f"{x:>6}" for x in cnt) + f"  {int((m & ~moved).sum()):>5}")


if __name__ == "__main__":
    main()
