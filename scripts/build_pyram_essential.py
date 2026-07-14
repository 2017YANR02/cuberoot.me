# build_pyram_essential.py — home-grown generator for the "所有本质状态" (all essential
# pyraminx / no-tips states) distribution shown on /scramble/solver?event=pyram (难度 tab,
# 所有本质状态 toggle).
#
# SELF-CONTAINED: reads NO xlsx. Enumerates all 933,120 no-tips pyraminx core states from
# scratch (tips ignored — only U/L/R/B and their inverses), computes for every state:
#   H(s) = optimal full-solve distance in HTM* (no tips; each vertex turn = 1 move) via BFS.
#   V(s) = cstimer "Pyraminx V": min over the 12 reorientation frames of the optimal distance
#          to the V-target (solve the L/R/B centers + 2 adjacent edges forming a V). Computed on
#          the ALG-STATE (apply(alg, solved)); NOT inverse-symmetric.
# Then dedups by the tetrahedral group S4 (order 24 = 12 rotations A4 + 12 reflections; NOT
# inverse, since V is not inverse-invariant), giving 39,036 orbits; excluding the solved orbit
# leaves 39,035 essential cases. God's number (HTM*) = 11.
#
# Engine ported from solver/src/pyraminx_solver.rs and validated against jaapsch.net and the
# research oracle `.tmp/Pyraminx uniq [39035].xlsx` (39,035 filled cases; matches exactly).
#
# Home-grown enumeration by CubeRoot; this script is the sole source of the data.
#
# Outputs (this is the full state space and never changes — a static one-off build):
#   <OUT_DIR>/pyram_essential.json        — marginals (essential + full-space), joint V×H grid,
#                                           credits + notation.
#   <OUT_DIR>/pyram_essential_cases.json  — all 39,035 essential cases with a home-grown
#                                           HTM*-optimal full solution each.
#
# OUT_DIR defaults to .tmp/enum/out/ (gitignored; the site owner reviews before promoting to
# stats/). Override with env PYRAM_OUT_DIR.
#
# Run:  uv run --with numpy python scripts/build_pyram_essential.py
from __future__ import annotations
import json, os, sys
from collections import deque, Counter
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT_DIR = os.environ.get("PYRAM_OUT_DIR", os.path.join(REPO, ".tmp", "enum", "out"))

GENERATED_AT = "2026-07-11"

CREDITS = {
    "author": {"zh": "CubeRoot", "en": "CubeRoot"},
    "classify": {"zh": "CubeRoot", "en": "CubeRoot"},
    "algorithm": {"zh": "自有枚举(933,120 态精确)",
                  "en": "home-grown enumeration (exact over 933,120 states)"},
    "source_url": "https://www.jaapsch.net/puzzles/pyraminx.htm",
}
NOTATION = [
    {"sym": "V",
     "zh": "V-first 的 V 步数(先拼好 L/R/B 三个中心 + 2 条相邻棱组成的 V,不含小角)",
     "en": "V-first V step: solve the L/R/B centers + 2 adjacent edges forming a V (tips ignored)"},
    {"sym": "H",
     "zh": "整解步数(HTM*,不含小角;每个顶点转 1 步)",
     "en": "Full-solve HTM* (tips ignored; each vertex turn = 1 move)"},
]

# ---------------- abstract no-tips engine ----------------
# State = ep[6] edge perm, eo[6] edge orient, co[4] axial/center orient.
# Axis order 0=U 1=L 2=R 3=B. Edges 0=FR 1=FL 2=FD 3=RL 4=RD 5=LD.
CYC = [[0, 1, 3], [1, 2, 5], [0, 4, 2], [3, 5, 4]]
FLP = [[1, 1, 0], [1, 1, 0], [0, 1, 1], [0, 1, 1]]
ABS = ['U', 'L', 'R', 'B']
SOLVED = (0, 1, 2, 3, 4, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)


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


PYRA = 933120

# ---------------- cstimer facelet engine (for V target) ----------------
SOLVED_PYRA = 'FFFFFFRRRRRRLLLLLLDDDDDD'
_F = [0, 1, 2, 3, 4, 5]; _R = [6, 7, 8, 9, 10, 11]
_L = [12, 13, 14, 15, 16, 17]; _D = [18, 19, 20, 21, 22, 23]
moveData = [
    [[_F[5], _R[3], _D[4]], [_F[0], _R[1], _D[2]], [_F[1], _R[2], _D[0]]],  # R
    [[_F[3], _L[4], _R[5]], [_F[1], _L[2], _R[0]], [_F[2], _L[0], _R[1]]],  # U
    [[_F[4], _D[5], _L[3]], [_F[2], _D[0], _L[1]], [_F[0], _D[1], _L[2]]],  # L
    [[_R[4], _L[5], _D[3]], [_R[2], _L[0], _D[1]], [_R[0], _L[1], _D[2]]],  # B
]


def pyraMove(state, move):
    i = 'RULB'.index(move[0]); swaps = moveData[i]
    suf = move[1] if len(move) > 1 else ' '; pw = '? \''.index(suf)
    if pw <= 0:
        return state
    ret = list(state)
    for cyc in swaps:
        tmp = [ret[cyc[k]] for k in range(3)]
        for k in range(3):
            ret[cyc[(k + pw) % 3]] = tmp[k]
    return ''.join(ret)


ABS2CS = {0: 'U', 1: 'L', 2: 'R', 3: 'B'}


def cs_move(a, p):
    return ABS2CS[a] + ("'" if p else ' ')


def build():
    # BFS enumerate + facelet lockstep + parent pointers
    idx = {SOLVED: 0}; states = [SOLVED]; facelet = [SOLVED_PYRA]
    parent = [-1]; pmove = [(-1, -1)]
    q = deque([SOLVED])
    while q:
        s = q.popleft(); si = idx[s]; fs = facelet[si]
        for a in range(4):
            for p in (False, True):
                ns = apply_move(s, a, p)
                if ns not in idx:
                    idx[ns] = len(states); states.append(ns)
                    facelet.append(pyraMove(fs, cs_move(a, p)))
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

    # V target frame D (solve the L/R/B centers + 2 adjacent edges forming a V)
    def matches(s, t):
        return all(t[i] == '?' or s[i] == t[i] for i in range(len(t)))
    VTARGET = '????FF??RRR??L?L?L?DDDDD'
    srcD = [i for i in range(n) if matches(facelet[i], VTARGET)]
    distD = bfs(srcD)

    # 12 reorientation frames as state permutations
    rawMap = 'RULB'; CS2ABS = {'U': 0, 'L': 1, 'R': 2, 'B': 3}
    moveMaps = [['RULB', 'LUBR', 'BURL'], ['URBL', 'LRUB', 'BRLU'],
                ['RLBU', 'ULRB', 'BLUR'], ['RBUL', 'UBLR', 'LBRU']]
    frames = [mm for row in moveMaps for mm in row]

    def remap_move(mm, a, p):
        newX = rawMap[mm.index(ABS2CS[a])]
        return (CS2ABS[newX], p)
    reorient = np.zeros((12, n), dtype=np.int64)
    for r, mm in enumerate(frames):
        ro = np.zeros(n, dtype=np.int64)  # ro[0]=0
        for i in range(1, n):
            pa, (a, p) = parent[i], pmove[i]
            na, np_ = remap_move(mm, a, p)
            ro[i] = mt[ro[pa], na * 2 + (1 if np_ else 0)]
        reorient[r] = ro
        assert (H[ro] == H).all()
    V = np.min(distD[reorient], axis=0).astype(np.uint8)
    assert int(V.max()) == 7

    # mirror (reflection): axis swap L<->R + move inversion
    tau = [0, 2, 1, 3]
    mirror = np.zeros(n, dtype=np.int64)
    for i in range(1, n):
        pa, (a, p) = parent[i], pmove[i]
        na = tau[a]; np_ = not p
        mirror[i] = mt[mirror[pa], na * 2 + (1 if np_ else 0)]
    assert (H[mirror] == H).all() and (mirror[mirror] == np.arange(n)).all()
    assert (V[mirror] == V).all()

    # dedup group = rot12 + mirror (order 24)
    def close_perms(gens):
        seen = set(); idp = np.arange(n); grp = [idp]
        seen.add(idp.tobytes()); fr = [idp]
        while fr:
            g = fr.pop()
            for h in gens:
                c = h[g]; k = c.tobytes()
                if k not in seen:
                    seen.add(k); grp.append(c); fr.append(c)
        return grp
    grp = close_perms([reorient[r] for r in range(12)] + [mirror])
    assert len(grp) == 24
    canon = np.stack(grp).min(axis=0)
    reps = np.unique(canon)
    assert len(reps) == 39036
    reps = reps[reps != 0]  # exclude solved orbit
    assert len(reps) == 39035

    return states, idx, mt, H, V, reps


def optimal_solution(si, mt, H):
    """Moves that, applied to state si, reach solved. Length == H[si]."""
    cur = si; sol = []
    while H[cur] > 0:
        for m in range(8):
            nx = mt[cur, m]
            if H[nx] == H[cur] - 1:
                sol.append(m); cur = nx; break
    return sol


def main():
    states, idx, mt, H, V, reps = build()
    n = len(states)

    # ---- difficulty ranking: (H desc, V desc, canonicalIndex asc) ----
    # reps is ascending canonical index; stable sort keeps that as the tie-break.
    rows_src = sorted(((int(V[si]), int(H[si]), int(si)) for si in reps),
                      key=lambda r: (-r[1], -r[0]))
    cases = []
    for i, (v, h, si) in enumerate(rows_src, 1):
        sol = optimal_solution(si, mt, H)
        alg = ' '.join(ABS[m // 2] + ("'" if m % 2 else '') for m in sol)
        # validate: applying alg to the case state reaches solved; length == H
        st = states[si]
        for tok in alg.split():
            st = apply_move(st, ABS.index(tok[0]), tok.endswith("'"))
        assert st == SOLVED and len(sol) == h, (i, alg, h)
        cases.append([i, alg, v, h])

    # ---- essential marginals + joint ----
    ess_h = Counter(h for _, _, _, h in cases)
    ess_v = Counter(v for _, _, v, _ in cases)
    ess_vh = Counter((v, h) for _, _, v, h in cases)
    h_vals = list(range(1, 12))   # essential H: 1..11 (solved h=0 excluded)
    v_vals = list(range(0, 8))    # V: 0..7
    grid = [[ess_vh.get((v, h), 0) for h in h_vals] for v in v_vals]

    # ---- full-space marginals over all 933,120 states ----
    full_h = Counter(int(x) for x in H)
    full_v = Counter(int(x) for x in V)

    avg_h = round(sum(h for *_, h in cases) / len(cases), 6)
    avg_v = round(sum(v for _, _, v, _ in cases) / len(cases), 6)
    avg_h_full = round(float(H.mean()), 6)
    avg_v_full = round(float(V.mean()), 6)

    meta = {
        "total_positions": PYRA,
        "essential_count": len(cases),
        "god_htm": 11,
        "avg_h": avg_h,
        "avg_v": avg_v,
        "avg_h_full": avg_h_full,
        "avg_v_full": avg_v_full,
        "generated_at": GENERATED_AT,
        "credits": CREDITS,
        "notation": NOTATION,
    }
    main_obj = {
        "meta": meta,
        "h": {"min": min(ess_h), "max": max(ess_h),
              "counts": {str(k): ess_h[k] for k in sorted(ess_h)}},
        "v": {"min": min(ess_v), "max": max(ess_v),
              "counts": {str(k): ess_v[k] for k in sorted(ess_v)}},
        "joint": {"v": v_vals, "h": h_vals, "grid": grid},
        "full_h": {"min": min(full_h), "max": max(full_h),
                   "counts": {str(k): full_h[k] for k in sorted(full_h)}},
        "full_v": {"min": min(full_v), "max": max(full_v),
                   "counts": {str(k): full_v[k] for k in sorted(full_v)}},
    }
    cases_obj = {
        "meta": {
            "generated_at": GENERATED_AT,
            "total": len(cases),
            "cols": ["idx", "alg", "V", "H"],
            "note": "idx=难度序号(1=最难);alg=自产整解最优解(H 步,不含小角)",
        },
        "rows": cases,
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    out_main = os.path.join(OUT_DIR, "pyram_essential.json")
    out_cases = os.path.join(OUT_DIR, "pyram_essential_cases.json")
    with open(out_main, "w", encoding="utf-8", newline="\n") as f:
        json.dump(main_obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    with open(out_cases, "w", encoding="utf-8", newline="\n") as f:
        json.dump(cases_obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

    print("wrote", out_main, os.path.getsize(out_main), "bytes")
    print("wrote", out_cases, os.path.getsize(out_cases), "bytes")
    print("essential:", len(cases), "god_htm:", meta["god_htm"])
    print("avg_h/avg_v (ess):", avg_h, avg_v, " avg_h/avg_v (full):", avg_h_full, avg_v_full)
    print("essential H marginal:", {k: ess_h[k] for k in sorted(ess_h)})
    print("essential V marginal:", {k: ess_v[k] for k in sorted(ess_v)})
    print("full-space H marginal:", {k: full_h[k] for k in sorted(full_h)})
    print("full-space V marginal:", {k: full_v[k] for k in sorted(full_v)})


if __name__ == "__main__":
    main()
