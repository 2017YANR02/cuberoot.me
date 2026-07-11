# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy>=1.26", "scipy>=1.11"]
# ///
"""
MANO pkl -> web hand asset (JSON + base64 buffers) for /sim hands.

Usage (uv, per global convention):
  uv run core/packages/client/scripts/convert-mano.py [--src D:/cube/mano] [--no-subdiv]

Input:  MANO_RIGHT.pkl / MANO_LEFT.pkl (searched under --src, its models/
        subdir, or inside mano_v1_2.zip found there). These are the licensed
        MPI files the user downloads from https://mano.is.tue.mpg.de after
        registration — NEVER commit them or the converted output (repo is
        public; MANO license forbids redistribution). Output dir is
        gitignored.
Output: core/packages/client/public/sim/hands/mano/{right,left}.mano.json

What it does (bind pose = MANO zero pose, betas = 0):
  1. Unpickle with a chumpy stub (original pkls reference chumpy classes;
     we only need the wrapped ndarrays — no chumpy install, no numpy pin).
  2. joints = J_regressor @ v_template  (16: wrist + 5 fingers x 3).
  3. Identify finger chains geometrically (thumb = chain base closest to
     wrist; index..pinky ordered by lateral position, index on thumb side)
     — robust to MANO's odd index/middle/pinky/ring/thumb joint order.
  4. Synthesize the WebXR joints MANO lacks: four-finger metacarpals
     (wrist + 22% toward MCP, zero skin weight — FK anchors for the rig's
     palm-arch meta channel) and five tips (extremal skin vertex along the
     distal bone axis). Result: the exact 25-name WebXR set, so the
     existing adaptGltfHand() consumes this asset unchanged.
  5. Cap the open wrist ring (fan to centroid, skinned to wrist) so the
     mesh is closed; then one Loop subdivision step (778 -> ~3.1k verts,
     silhouette-smooth; skin weights averaged + renormalized to top-4).
  6. Planar UVs from the two largest template axes (only used to tile the
     procedural skin-noise bump; MANO has no authored UV layout).
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import pickle
import sys
import zipfile
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[3]  # core/packages/client/scripts -> repo/core
OUT_DIR = REPO / "packages" / "client" / "public" / "sim" / "hands" / "mano"

WEBXR_FINGERS = ["thumb", "index", "middle", "ring", "pinky"]


# ---------------------------------------------------------------- unpickle
class _ChumpyStub:
    """Absorbs any chumpy.* class: keeps the pickled state dict; the wrapped
    ndarray lives under 'x' (Ch) — np.asarray() below digs it out."""

    def __init__(self, *a, **k):
        self.__dict__["_state"] = {}

    def __setstate__(self, state):
        self.__dict__["_state"] = state


class _Unpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if module.startswith("chumpy"):
            return _ChumpyStub
        return super().find_class(module, name)


def _to_np(x) -> np.ndarray:
    if isinstance(x, _ChumpyStub):
        st = x.__dict__.get("_state", {})
        if isinstance(st, dict):
            for key in ("x", "a", "_data"):
                if key in st:
                    return _to_np(st[key])
        raise ValueError(f"chumpy stub without array payload: keys={list(st) if isinstance(st, dict) else type(st)}")
    if hasattr(x, "toarray"):  # scipy sparse
        return np.asarray(x.toarray())
    return np.asarray(x)


def load_pkl(raw: bytes) -> dict:
    d = _Unpickler(io.BytesIO(raw), encoding="latin1").load()
    out = {}
    for k in ("v_template", "f", "weights", "J_regressor", "kintree_table"):
        if k not in d:
            raise KeyError(f"MANO pkl missing '{k}' (got keys {sorted(d.keys())})")
        out[k] = _to_np(d[k])
    return out


def find_sources(src: Path) -> dict[str, bytes]:
    """Return {'right': pklBytes, 'left': pklBytes} from loose pkls or a zip."""
    got: dict[str, bytes] = {}
    names = {"right": "MANO_RIGHT.PKL", "left": "MANO_LEFT.PKL"}
    for hand, fname in names.items():
        for cand in (src, src / "models", src / "mano_v1_2" / "models"):
            for p in cand.glob("*.pkl") if cand.is_dir() else []:
                if p.name.upper() == fname:
                    got[hand] = p.read_bytes()
    if len(got) < 2 and src.is_dir():
        for zp in sorted(src.glob("*.zip")):
            with zipfile.ZipFile(zp) as z:
                for info in z.infolist():
                    up = Path(info.filename).name.upper()
                    for hand, fname in names.items():
                        if up == fname and hand not in got:
                            got[hand] = z.read(info)
    missing = [h for h in names if h not in got]
    if missing:
        sys.exit(f"[convert-mano] missing {missing} under {src} (loose pkl, models/, or mano_v1_2.zip)")
    return got


# ---------------------------------------------------------------- geometry
def loop_subdivide(v: np.ndarray, f: np.ndarray, w: np.ndarray, uv: np.ndarray):
    """One Loop step on a CLOSED triangle mesh. Weights/uv: edge verts = avg
    of endpoints; old verts keep their weights (positions get Loop smoothing)."""
    nv = len(v)
    edges: dict[tuple[int, int], int] = {}
    opp: dict[tuple[int, int], list[int]] = {}
    for tri in f:
        for i in range(3):
            a, b, c = tri[i], tri[(i + 1) % 3], tri[(i + 2) % 3]
            key = (min(a, b), max(a, b))
            opp.setdefault(key, []).append(c)
    for key in opp:
        edges[key] = nv + len(edges)
    # neighbor sets for old-vertex smoothing
    nbr: list[set[int]] = [set() for _ in range(nv)]
    for (a, b) in opp:
        nbr[a].add(b)
        nbr[b].add(a)
    v_old = np.empty_like(v)
    for i in range(nv):
        n = len(nbr[i])
        if n < 3:
            v_old[i] = v[i]
            continue
        beta = (5.0 / 8.0 - (3.0 / 8.0 + 0.25 * np.cos(2 * np.pi / n)) ** 2) / n
        v_old[i] = (1 - n * beta) * v[i] + beta * sum(v[j] for j in nbr[i])
    v_edge = np.empty((len(edges), 3))
    w_edge = np.empty((len(edges), w.shape[1]))
    uv_edge = np.empty((len(edges), 2))
    for (a, b), idx in edges.items():
        os_ = opp[(a, b)]
        if len(os_) == 2:
            v_edge[idx - nv] = 3 / 8 * (v[a] + v[b]) + 1 / 8 * (v[os_[0]] + v[os_[1]])
        else:  # boundary edge (shouldn't happen after capping) — midpoint
            v_edge[idx - nv] = 0.5 * (v[a] + v[b])
        w_edge[idx - nv] = 0.5 * (w[a] + w[b])
        uv_edge[idx - nv] = 0.5 * (uv[a] + uv[b])
    f2 = []
    for tri in f:
        a, b, c = tri
        ab = edges[(min(a, b), max(a, b))]
        bc = edges[(min(b, c), max(b, c))]
        ca = edges[(min(c, a), max(c, a))]
        f2 += [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]
    return (
        np.vstack([v_old, v_edge]),
        np.asarray(f2, dtype=np.int64),
        np.vstack([w, w_edge]),
        np.vstack([uv, uv_edge]),
    )


def cap_boundary(v: np.ndarray, f: np.ndarray, w: np.ndarray, uv: np.ndarray, wrist_col: int):
    """Fan-cap every boundary loop (MANO wrist ring) with a centroid vertex
    skinned 100% to the wrist. Winding: boundary edge (a,b) seen as a->b in
    its face -> cap triangle (b,a,center) faces outward."""
    cnt: dict[tuple[int, int], int] = {}
    directed: dict[tuple[int, int], tuple[int, int]] = {}
    for tri in f:
        for i in range(3):
            a, b = tri[i], tri[(i + 1) % 3]
            key = (min(a, b), max(a, b))
            cnt[key] = cnt.get(key, 0) + 1
            directed[key] = (a, b)
    border = [directed[k] for k, c in cnt.items() if c == 1]
    if not border:
        return v, f, w, uv
    # chain loops
    nxt = {a: b for a, b in border}
    loops: list[list[int]] = []
    seen: set[int] = set()
    for a in list(nxt):
        if a in seen:
            continue
        loop = [a]
        seen.add(a)
        cur = nxt.get(a)
        while cur is not None and cur != a and cur not in seen:
            loop.append(cur)
            seen.add(cur)
            cur = nxt.get(cur)
        if len(loop) >= 3:
            loops.append(loop)
    tris = list(f)
    for loop in loops:
        center = len(v)
        cpos = v[loop].mean(axis=0, keepdims=True)
        v = np.vstack([v, cpos])
        wc = np.zeros((1, w.shape[1]))
        wc[0, wrist_col] = 1.0
        w = np.vstack([w, wc])
        uv = np.vstack([uv, uv[loop].mean(axis=0, keepdims=True)])
        for i in range(len(loop)):
            a, b = loop[i], loop[(i + 1) % len(loop)]
            tris.append([b, a, center])
    return v, np.asarray(tris, dtype=np.int64), w, uv


def b64(arr: np.ndarray, dtype) -> str:
    return base64.b64encode(np.ascontiguousarray(arr, dtype=dtype).tobytes()).decode("ascii")


def convert(hand: str, raw: bytes, subdiv: bool) -> dict:
    d = load_pkl(raw)
    v = np.asarray(d["v_template"], dtype=np.float64)          # (778,3)
    f = np.asarray(d["f"], dtype=np.int64)                     # (1538,3)
    w = np.asarray(d["weights"], dtype=np.float64)             # (778,16)
    J = np.asarray(d["J_regressor"], dtype=np.float64) @ v     # (16,3)
    kin = np.asarray(d["kintree_table"], dtype=np.int64)       # (2,16) parent row 0
    parent = kin[0].copy()
    parent[0] = -1
    assert v.shape == (778, 3) and w.shape == (778, 16) and J.shape == (16, 3), (v.shape, w.shape, J.shape)

    # ---- finger chains from kintree (each: [base, mid, dist] joint ids) ----
    roots = [j for j in range(1, 16) if parent[j] == 0]
    assert len(roots) == 5, roots
    chains = []
    for r in roots:
        chain = [r]
        while True:
            kids = [j for j in range(16) if parent[j] == chain[-1]]
            if not kids:
                break
            assert len(kids) == 1, kids
            chain.append(kids[0])
        assert len(chain) == 3, chain
        chains.append(chain)

    # ---- assign chains to fingers geometrically ----
    wrist = J[0]
    thumb_chain = min(chains, key=lambda c: np.linalg.norm(J[c[0]] - wrist))
    rest = [c for c in chains if c is not thumb_chain]
    mcps = np.array([J[c[0]] for c in rest])
    fwd = mcps.mean(axis=0) - wrist
    fwd /= np.linalg.norm(fwd)
    # lateral axis = dominant spread of the four MCPs perpendicular to fwd
    centered = mcps - mcps.mean(axis=0)
    centered -= np.outer(centered @ fwd, fwd)
    _, _, vt = np.linalg.svd(centered)
    lat = vt[0]
    order = sorted(range(4), key=lambda i: float(mcps[i] @ lat))
    # index end = the end whose MCP is closer to the thumb base
    tb = J[thumb_chain[0]]
    if np.linalg.norm(mcps[order[-1]] - tb) < np.linalg.norm(mcps[order[0]] - tb):
        order = order[::-1]
    finger_chains = {
        "thumb": thumb_chain,
        "index": rest[order[0]],
        "middle": rest[order[1]],
        "ring": rest[order[2]],
        "pinky": rest[order[3]],
    }
    std = {"index": [1, 2, 3], "middle": [4, 5, 6], "pinky": [7, 8, 9], "ring": [10, 11, 12], "thumb": [13, 14, 15]}
    if any(finger_chains[k] != std[k] for k in std):
        print(f"[convert-mano] note: {hand} joint order differs from standard MANO layout: {finger_chains}")

    # ---- close wrist, subdivide ----
    uv_axes = np.argsort(v.max(axis=0) - v.min(axis=0))[::-1][:2]
    span = float((v.max(axis=0) - v.min(axis=0))[uv_axes[0]])
    uv = v[:, uv_axes] / span * 4.0
    v, f, w, uv = cap_boundary(v, f, w, uv, wrist_col=0)
    # 封盖后网格闭合 → 符号体积可判外向绕向;负体积 = 面片朝内(左右手资产
    # 绕向不可信),整体翻转,否则 three 正面剔除下渲成 inside-out。
    vol = float(np.einsum("ij,ij->", v[f[:, 0]], np.cross(v[f[:, 1]], v[f[:, 2]]))) / 6.0
    if vol < 0:
        print(f"[convert-mano] {hand}: negative signed volume ({vol:.2e}) — flipping winding")
        f = f[:, ::-1].copy()
    if subdiv:
        v, f, w, uv = loop_subdivide(v, f, w, uv)

    # ---- synthesized joints: metacarpals + tips ----
    bones: list[dict] = [{"name": "wrist", "pos": J[0].tolist()}]
    bone_col: list[int | None] = [0]  # which weights column feeds this bone (None = synthetic)
    for name in WEBXR_FINGERS:
        c = finger_chains[name]
        if name == "thumb":
            chain_names = ["thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal"]
        else:
            meta_pos = J[0] + 0.22 * (J[c[0]] - J[0])
            bones.append({"name": f"{name}-finger-metacarpal", "pos": meta_pos.tolist()})
            bone_col.append(None)
            chain_names = [f"{name}-finger-phalanx-proximal", f"{name}-finger-phalanx-intermediate", f"{name}-finger-phalanx-distal"]
        for jid, jn in zip(c, chain_names):
            bones.append({"name": jn, "pos": J[jid].tolist()})
            bone_col.append(jid)
        # tip = farthest distal-weighted skin vertex along the distal bone axis
        dist_j = c[2]
        axis = J[dist_j] - J[c[1]]
        axis /= np.linalg.norm(axis)
        cand = np.where(w[:, dist_j] > 0.5)[0]
        if len(cand) == 0:
            cand = np.argsort(w[:, dist_j])[-30:]
        proj = (v[cand] - J[dist_j]) @ axis
        tip_pos = v[cand[int(np.argmax(proj))]]
        bones.append({"name": f"{name}{'' if name == 'thumb' else '-finger'}-tip", "pos": tip_pos.tolist()})
        bone_col.append(None)
    assert len(bones) == 25, len(bones)
    names = [b["name"] for b in bones]
    assert len(set(names)) == 25

    # ---- weights: MANO 16 columns -> top-4 over the 25-bone list ----
    col_to_bone = {}
    for bi, col in enumerate(bone_col):
        if col is not None:
            col_to_bone[col] = bi
    assert len(col_to_bone) == 16
    n = len(v)
    sk_i = np.zeros((n, 4), dtype=np.uint8)
    sk_w = np.zeros((n, 4), dtype=np.float64)
    top = np.argsort(w, axis=1)[:, ::-1][:, :4]
    for i in range(n):
        ws = w[i, top[i]]
        s = ws.sum()
        if s <= 0:
            sk_i[i, 0] = col_to_bone[0]
            sk_w[i, 0] = 1.0
            continue
        for k in range(4):
            sk_i[i, k] = col_to_bone[int(top[i, k])]
            sk_w[i, k] = ws[k] / s

    print(f"[convert-mano] {hand}: verts {n} faces {len(f)} bones 25"
          f" | wrist {np.round(J[0], 4).tolist()} middle-tip reach {np.linalg.norm(v[np.argmax(np.linalg.norm(v - J[0], axis=1))] - J[0]):.4f} m")
    return {
        "format": "cuberoot-mano-hand@1",
        "hand": hand,
        "counts": {"verts": n, "faces": int(len(f))},
        "bones": bones,
        "position": b64(v, np.float32),
        "index": b64(f, np.uint32),
        "uv": b64(uv, np.float32),
        "skinIndex": b64(sk_i, np.uint8),
        "skinWeight": b64(sk_w, np.float32),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="D:/cube/mano")
    ap.add_argument("--no-subdiv", action="store_true")
    args = ap.parse_args()
    srcs = find_sources(Path(args.src))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for hand in ("right", "left"):
        data = convert(hand, srcs[hand], subdiv=not args.no_subdiv)
        out = OUT_DIR / f"{hand}.mano.json"
        out.write_text(json.dumps(data), encoding="utf-8")
        print(f"[convert-mano] wrote {out} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
