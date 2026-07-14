# build_pyram_firstface.py — case gallery data for the pyraminx "V first step".
#
# The V = 5 pieces: centers L/R/B + the 2 edges LB, RB that form the cstimer "V"
# (VTARGET '????FF??RRR??L?L?L?DDDDD' -> 13 facelets). Everything else is grayed.
#
# DISPLAY CONVENTION (per user): render every case in ONE fixed orientation — the V's
# gap toward the front, i.e. the net's home frame. NO whole-puzzle reorientation dedup.
# That reorientation dedup was the ill-defined step (the V-piece-set has trivial setwise
# stabiliser under the tetrahedral group, so "V-appearance up to reorientation" has no
# clean equivalence, and the regauge dedup entangled the grayed pieces). Dropping it makes
# everything well-defined again: a "case" is just a distinct FIXED-FRAME V-appearance.
#   fixed frame (gap-front)   = 3240 distinct V-appearances   ← rows emitted
#   + L<->R mirror fold       = distinct mgid                 ← the one clean symmetry
# The L<->R mirror (swap L,R vertices) is the only reorientation that fixes the V-piece-set
# (L center<->R center, LB<->RB edge, B center fixed), so it folds cleanly; the UI toggles it.
#
# METRIC = distD, the home-frame V-solve distance (HTM moves to bring the 5 V-pieces home
# WITHOUT reorienting). It is a pure function of the fixed-frame V-appearance (verified: 0
# variance per appearance), the pyraminx analog of the 2x2 gallery's ffDist.
#
# Blur (2x2 gallery method): blur[i][p] = 0 if the sticker at position p is not a V sticker,
# else 1 + its shown COLOUR (F/R/L/D -> 0..3). Colour is intrinsic, so a position permutation
# is a real rotated view — used only for the mirror perm here.
#
# Each row also carries `sol`: an optimal home-frame V solve for the representative scramble
# (greedy descent on distD), so its move count is exactly the row's V.
#
# Engine reused from scripts/build_pyram_essential.py.
# Output: core/packages/client/app/[lang]/scramble/stats/_data/firstface_pyram.json
#   { meta:{generated_at,total_reorient,total_mirror_folded,fixed_frame,mask,cols,note},
#     rows:[[scramble,V,mgid,sol],...] }
# Run:  uv run --with numpy python scripts/build_pyram_firstface.py
from __future__ import annotations
import json, os
from collections import deque
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, "core", "packages", "client", "app", "[lang]",
                   "scramble", "stats", "_data", "firstface_pyram.json")
DBG = os.path.join(REPO, ".tmp", "enum", "pyram_firstface_debug.json")
GENERATED_AT = "2026-07-14"

# ---------------- abstract no-tips engine (verbatim) ----------------
CYC = [[0, 1, 3], [1, 2, 5], [0, 4, 2], [3, 5, 4]]
FLP = [[1, 1, 0], [1, 1, 0], [0, 1, 1], [0, 1, 1]]
ABS = ['U', 'L', 'R', 'B']
SOLVED = (0, 1, 2, 3, 4, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
PYRA = 933120


def apply_cw(st, axis):
    ep = list(st[0:6]); eo = list(st[6:12]); co = list(st[12:16])
    c = CYC[axis]; f = FLP[axis]
    e = [ep[c[0]], ep[c[1]], ep[c[2]]]; o = [eo[c[0]], eo[c[1]], eo[c[2]]]
    ep[c[1]] = e[0]; eo[c[1]] = o[0] ^ f[0]
    ep[c[2]] = e[1]; eo[c[2]] = o[1] ^ f[1]
    ep[c[0]] = e[2]; eo[c[0]] = o[2] ^ f[2]
    co[axis] = (co[axis] + 1) % 3
    return tuple(ep) + tuple(eo) + tuple(co)


def apply_move(st, axis, prime):
    for _ in range(2 if prime else 1):
        st = apply_cw(st, axis)
    return st


# ---------------- cstimer facelet engine (verbatim) ----------------
SOLVED_PYRA = 'FFFFFFRRRRRRLLLLLLDDDDDD'
_F = [0, 1, 2, 3, 4, 5]; _R = [6, 7, 8, 9, 10, 11]
_L = [12, 13, 14, 15, 16, 17]; _D = [18, 19, 20, 21, 22, 23]
moveData = [
    [[_F[5], _R[3], _D[4]], [_F[0], _R[1], _D[2]], [_F[1], _R[2], _D[0]]],  # R
    [[_F[3], _L[4], _R[5]], [_F[1], _L[2], _R[0]], [_F[2], _L[0], _R[1]]],  # U
    [[_F[4], _D[5], _L[3]], [_F[2], _D[0], _L[1]], [_F[0], _D[1], _L[2]]],  # L
    [[_R[4], _L[5], _D[3]], [_R[2], _L[0], _D[1]], [_R[0], _L[1], _D[2]]],  # B
]


def perm_move(seq, move):
    i = 'RULB'.index(move[0]); swaps = moveData[i]
    suf = move[1] if len(move) > 1 else ' '; pw = '? \''.index(suf)
    if pw <= 0:
        return list(seq)
    ret = list(seq)
    for cyc in swaps:
        tmp = [ret[cyc[k]] for k in range(3)]
        for k in range(3):
            ret[cyc[(k + pw) % 3]] = tmp[k]
    return ret


ABS2CS = {0: 'U', 1: 'L', 2: 'R', 3: 'B'}


def cs_move(a, p):
    return ABS2CS[a] + ("'" if p else " ")


VTARGET = '????FF??RRR??L?L?L?DDDDD'
VSET = frozenset(i for i, ch in enumerate(VTARGET) if ch != '?')  # 13 positions
CIDX = {'F': 0, 'R': 1, 'L': 2, 'D': 3}


# The L<->R mirror as a STATE map, not a facelet-position perm: a geometric reflection perm
# lands mostly outside this single fixed-frame orbit (it maps appearances to unreachable
# "ghosts"), so it folds nothing. Instead replay each state under the mirrored move set — swap
# the L,R vertices (axes 1,2) and flip each turn's direction (reflection reverses chirality).
# This is the one reorientation fixing the V-piece-set, so it maps V-appearances to
# V-appearances and folds cleanly, exactly like the 2x2 gallery's reflection fold.
MIR_AXIS = [0, 2, 1, 3]   # abstract axis U,L,R,B -> U,R,L,B


def build():
    """Return per-state H (god dist), distD (home-frame V-solve dist), blur (n x 24
    colour-mask), phi (L<->R mirror state map), parent, pmove — keyed to the FIXED frame."""
    idx = {SOLVED: 0}; states = [SOLVED]
    facelet = [SOLVED_PYRA]
    origin = [tuple(range(24))]
    parent = [-1]; pmove = [(-1, -1)]
    q = deque([SOLVED])
    while q:
        s = q.popleft(); si = idx[s]
        fs = facelet[si]; osq = origin[si]
        for a in range(4):
            for p in (False, True):
                ns = apply_move(s, a, p)
                if ns not in idx:
                    idx[ns] = len(states); states.append(ns)
                    facelet.append(''.join(perm_move(fs, cs_move(a, p))))
                    origin.append(tuple(perm_move(osq, cs_move(a, p))))
                    parent.append(si); pmove.append((a, p)); q.append(ns)
    n = len(states)
    assert n == PYRA, n

    mt = np.zeros((n, 8), dtype=np.int64)
    for i, s in enumerate(states):
        for m in range(8):
            mt[i, m] = idx[apply_move(s, m // 2, m % 2 == 1)]

    def bfs(sources):
        d = np.full(n, 255, dtype=np.uint8); d[sources] = 0
        fr = np.array(sources, dtype=np.int64); dd = 0
        while fr.size:
            nb = mt[fr].ravel(); nb = np.unique(nb[d[nb] == 255])
            d[nb] = dd + 1; fr = nb; dd += 1
        return d

    H = bfs([0])
    assert int(H.max()) == 11 and (H != 255).all()

    def matches(s, t):
        return all(t[i] == '?' or s[i] == t[i] for i in range(len(t)))
    srcD = [i for i in range(n) if matches(facelet[i], VTARGET)]
    distD = bfs(srcD)

    # blur[i][p] = 0 if the sticker at p is not a V-piece sticker, else 1 + its shown COLOUR.
    blur = np.zeros((n, 24), dtype=np.uint8)
    for i in range(n):
        og = origin[i]; fc = facelet[i]; row = blur[i]
        for p in range(24):
            if og[p] in VSET:
                row[p] = 1 + CIDX[fc[p]]

    # phi = mirror state map (swap L,R axes + flip direction), built by replay in BFS order.
    phi = np.zeros(n, dtype=np.int64)
    for i in range(1, n):
        a, p = pmove[i]
        phi[i] = mt[phi[parent[i]], MIR_AXIS[a] * 2 + (0 if p else 1)]
    assert phi[0] == 0 and (phi[phi] == np.arange(n)).all(), "mirror not an involution"
    assert (H[phi] == H).all(), "mirror does not preserve god-distance"
    return H, distD, blur, phi, parent, pmove, mt


def scramble_of(rep, parent, pmove):
    seq = []; cur = int(rep)
    while cur != 0:
        a, p = pmove[cur]
        seq.append(ABS[a] + ("'" if p else ""))
        cur = int(parent[cur])
    return ' '.join(reversed(seq))


def solve_of(rep, mt, distD):
    """Optimal home-frame V solve: greedy descent on distD (first-index tie-break)."""
    seq = []; cur = int(rep)
    while distD[cur]:
        d = int(distD[cur])
        for m in range(8):
            t = int(mt[cur, m])
            if int(distD[t]) == d - 1:
                seq.append(ABS[m // 2] + ("'" if m % 2 else ""))
                cur = t
                break
        else:
            raise AssertionError("distD descent stuck")
    return ' '.join(seq)


def main():
    H, distD, blur, phi, parent, pmove, mt = build()
    n = blur.shape[0]

    # fixed-frame appearance key (24 bytes) + the appearance of its L<->R mirror STATE.
    key_fixed = np.ascontiguousarray(blur).view('S24').ravel()
    mir = key_fixed[phi]

    _, inv_fixed = np.unique(key_fixed, return_inverse=True)
    inv_fixed = inv_fixed.astype(np.int64)
    n_fixed = int(inv_fixed.max()) + 1

    # mirror-orbit key = min(appearance, mirrored-state's appearance) per state. np.minimum has
    # no byte-string loop; lexicographic `<` on fixed-width bytes is fine.
    key_mir = np.where(key_fixed < mir, key_fixed, mir)
    _, inv_mir = np.unique(key_mir, return_inverse=True); inv_mir = inv_mir.astype(np.int64)
    n_mirror = int(inv_mir.max()) + 1

    # distD must be constant per fixed-frame appearance (metric well-defined per case).
    dmin = np.full(n_fixed, 255, np.int64); np.minimum.at(dmin, inv_fixed, distD.astype(np.int64))
    dmax = np.zeros(n_fixed, np.int64);     np.maximum.at(dmax, inv_fixed, distD.astype(np.int64))
    assert (dmin == dmax).all(), "distD not constant on a fixed-frame appearance"
    metric = dmin

    # mirror key constant per fixed appearance (mirror fold well-defined).
    mmin = np.full(n_fixed, np.iinfo(np.int64).max, np.int64); np.minimum.at(mmin, inv_fixed, inv_mir)
    mmax = np.zeros(n_fixed, np.int64);                        np.maximum.at(mmax, inv_fixed, inv_mir)
    assert (mmin == mmax).all(), "mirror orbit not constant on fixed appearances"

    # one representative state per fixed appearance: min god-dist H (cleanest scramble),
    # tie smallest index. Drop the solved V (appearance of the identity).
    order = np.lexsort((np.arange(n), H.astype(np.int64), inv_fixed))
    sinv = inv_fixed[order]
    reps = order[np.concatenate(([True], sinv[1:] != sinv[:-1]))]
    reps = reps[inv_fixed[reps] != inv_fixed[0]]              # drop solved-V appearance
    assert int(metric[inv_fixed[reps]].min()) >= 1, "a non-solved appearance has V==0"
    assert int((metric == 0).sum()) == 1, "more than one appearance has V==0"

    mg_of = {}; rows = []
    for rep in reps:
        rep = int(rep)
        mk = int(inv_mir[rep])
        if mk not in mg_of:
            mg_of[mk] = len(mg_of)
        v = int(metric[inv_fixed[rep]])
        sol = solve_of(rep, mt, distD)
        assert len(sol.split()) == v, (sol, v)               # solution length == the shown metric
        rows.append([scramble_of(rep, parent, pmove), v, mg_of[mk], sol])
    rows.sort(key=lambda r: -r[1])                            # hardest V first (section order)

    total_fixed = len(rows); total_mirror = len(mg_of)
    assert total_fixed == n_fixed - 1, (total_fixed, n_fixed)     # all minus solved
    assert total_mirror < total_fixed, (total_mirror, total_fixed)  # mirror must fold
    vdist = {}
    for r in rows:
        vdist[r[1]] = vdist.get(r[1], 0) + 1

    mask = "F:0,1,2,3,5,6,8;D:0,2,3,6;L:0,2,3,4,5,6;R:0,1,2,3,6,8"
    meta = {
        "generated_at": GENERATED_AT,
        "total_reorient": total_fixed,          # UI's "全部/Off" count = fixed-frame appearances
        "total_mirror_folded": total_mirror,    # UI's "合并/On" count = mirror orbits
        "fixed_frame": n_fixed,
        "mask": mask,
        "cols": ["scramble", "V", "mgid", "sol"],
        "note": "pyraminx V first step: centers L/R/B + the 2 edges forming the V, shown in one "
                "fixed orientation (V gap toward front). V = HTM moves to build the V from this "
                "appearance; sol = an optimal V solve for the shown scramble (|sol| == V); "
                "mgid folds the L<->R mirror pair.",
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"meta": meta, "rows": rows}, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    dbg = {
        "vset_cstimer": sorted(VSET),
        "vset_render_ids": ["F4", "F7", "D1", "D4", "D5", "D7", "D8",
                            "L1", "L7", "L8", "R4", "R5", "R7"],
        "mask": mask,
        "fixed_frame": n_fixed,
        "rep_scrambles": [r[0] for r in rows[:8]],
    }
    os.makedirs(os.path.dirname(DBG), exist_ok=True)
    with open(DBG, "w", encoding="utf-8", newline="\n") as f:
        json.dump(dbg, f, ensure_ascii=False, indent=2); f.write("\n")

    print("wrote", OUT, os.path.getsize(OUT), "bytes")
    print("fixed_frame:", n_fixed, " total(non-solved):", total_fixed,
          " mirror_folded:", total_mirror)
    print("V distribution (reps):", {k: vdist[k] for k in sorted(vdist)})
    print("all gates passed.")


if __name__ == "__main__":
    main()
