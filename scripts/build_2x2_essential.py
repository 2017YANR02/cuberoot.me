# build_2x2_essential.py — one-off generator for the "所有本质状态" (all essential 2×2
# states) distribution shown on /scramble/solver?event=222 (难度 tab, WCA / 所有本质状态
# toggle).
#
# Source: a local research artifact `.tmp/2x2 uniq [77801].xlsx` (gitignored) authored by
# 张铭源 (Mingyuan Zhang), deduped by 欧阳韵奇 (Yunqi Ouyang), classified by CubeRoot. It holds
# the exact optimal-length statistics over all 3,674,160 essential 2×2×2 positions (fixing one
# corner), in HTM* / QTM* / Face-HTM* metrics, per https://www.jaapsch.net/puzzles/cube2.htm .
#
# Outputs (committed, static — this is the full state space and never changes):
#   stats/scramble/2x2_essential.json        — small: marginals, joint HTM×QTM table, the 6
#                                               first-face/first-layer sub-distributions,
#                                               case-sheet aggregates, credits + notation.
#   stats/scramble/2x2_essential_cases.json   — large (~lazy-loaded): all 77,801 unique cases
#                                               with their HTM- and QTM-optimal solutions.
#
# Run:  uv run --with openpyxl python scripts/build_2x2_essential.py
from __future__ import annotations
import json, os, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
XLSX = os.path.join(REPO, ".tmp", "2x2 uniq [77801].xlsx")
OUT_MAIN = os.path.join(REPO, "stats", "scramble", "2x2_essential.json")
OUT_CASES = os.path.join(REPO, "stats", "scramble", "2x2_essential_cases.json")

GENERATED_AT = "2026-07-06"

# README author/notation is mojibake in the file itself (Chinese corrupted at write time);
# names supplied by the site owner, notation transcribed from the intact ASCII legend.
CREDITS = {
    "author": {"zh": "张铭源", "en": "Mingyuan Zhang"},
    "dedup": {"zh": "欧阳韵奇", "en": "Yunqi Ouyang"},
    "classify": {"zh": "CubeRoot", "en": "CubeRoot"},
    "source_url": "https://www.jaapsch.net/puzzles/cube2.htm",
}
NOTATION = [
    {"sym": "F", "zh": "面转步数(Face HTM*):把 U/U'/U2 都记作 1 步的面转度量", "en": "Face turns (Face HTM*): any face turn — U, U', U2 — counts as one move"},
    {"sym": "H", "zh": "半转步数(HTM*):U2 计 1 步的标准半转度量", "en": "Half-turn metric (HTM*): U2 counts as one move"},
    {"sym": "Q", "zh": "四分之一转步数(QTM*):U2 计 2 步", "en": "Quarter-turn metric (QTM*): U2 counts as two moves"},
    {"sym": "*", "zh": "固定一个角块、只用相邻 3 个面(2×2 的标准解法约定)", "en": "one corner fixed, only the 3 adjacent faces turn (the standard 2×2 solving convention)"},
]


def load():
    import openpyxl
    if not os.path.exists(XLSX):
        sys.exit(f"missing source xlsx: {XLSX}")
    return openpyxl.load_workbook(XLSX, read_only=True, data_only=True)


def rows_of(ws):
    out = []
    for row in ws.iter_rows(values_only=True):
        r = list(row)
        while r and r[-1] is None:
            r.pop()
        out.append(r)
    return out


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def build_dist(ws):
    rows = rows_of(ws)
    joint = []          # list of {q, cells:[h0..h11]}
    htm_marginal = {}
    qtm_marginal = {}
    meta = {}
    htm_cols = list(range(12))   # HTM 0..11
    for r in rows:
        if not r:
            continue
        c0 = r[0] if len(r) > 0 else None
        c1 = r[1] if len(r) > 1 else None
        # QTM data rows: col1 is an int QTM value, cols 2..13 = HTM counts, last = row total
        if c0 is None and isinstance(c1, int):
            q = c1
            cells = []
            for h in htm_cols:
                v = r[2 + h] if len(r) > 2 + h else None
                cells.append(int(v) if is_num(v) else 0)
                if is_num(v):
                    htm_marginal[str(h)] = htm_marginal.get(str(h), 0) + int(v)
            qtm_marginal[str(q)] = sum(cells)
            joint.append({"q": q, "cells": cells})
        # HTM marginal ("Total" row) — trust it as authoritative over accumulation
        if c1 == "Total" and c0 is None:
            authoritative = {}
            for h in htm_cols:
                v = r[2 + h] if len(r) > 2 + h else None
                if is_num(v):
                    authoritative[str(h)] = int(v)
            if authoritative:
                htm_marginal = authoritative
        # scalar meta labels
        if isinstance(c0, str):
            lab = c0.strip()
            if lab == "God's number in HTM" and is_num(c1):
                meta["god_htm"] = int(c1)
            elif lab == "God's number in QTM" and is_num(c1):
                meta["god_qtm"] = int(c1)
            elif lab == "HTM avg" and is_num(c1):
                meta["avg_htm"] = round(float(c1), 4)
            elif lab == "QTM avg" and is_num(c1):
                meta["avg_qtm"] = round(float(c1), 4)
            elif lab.startswith("WCA-legal") and is_num(c1):
                meta["wca_legal_min4h"] = int(c1)
    total = sum(htm_marginal.values())
    meta["total_positions"] = total
    # trim marginals to compact ordered dicts
    htm = {str(k): htm_marginal[str(k)] for k in sorted(map(int, htm_marginal))}
    qtm = {str(k): qtm_marginal[str(k)] for k in sorted(map(int, qtm_marginal))}
    q_rows = sorted(x["q"] for x in joint)
    grid = []
    by_q = {x["q"]: x["cells"] for x in joint}
    for q in q_rows:
        grid.append(by_q[q])
    return {
        "meta": meta,
        "htm": {"min": min(map(int, htm)), "max": max(map(int, htm)), "counts": htm},
        "qtm": {"min": min(map(int, qtm)), "max": max(map(int, qtm)), "counts": qtm},
        "joint": {"htm": htm_cols, "qtm": q_rows, "grid": grid},
    }


STAT_LABELS = {
    "Fixed V": {"zh": "固定 V", "en": "Fixed V"},
    "Fixed FF": {"zh": "固定底面", "en": "Fixed FF"},
    "CN FF": {"zh": "色中性底面", "en": "CN FF"},
    "(No Bar) CN FF": {"zh": "无 bar · 色中性底面", "en": "(No Bar) CN FF"},
    "Fixed FL": {"zh": "固定首层", "en": "Fixed FL"},
    "CN FL": {"zh": "色中性首层", "en": "CN FL"},
}


def build_stat(ws):
    rows = rows_of(ws)
    groups = []
    cur = None
    note = None
    for i, r in enumerate(rows):
        if not r:
            continue
        c0 = r[0]
        if isinstance(c0, str):
            lab = c0.strip()
            if i == 0 and lab == "HTM":
                continue  # global header
            if lab.startswith("No Bar f*"):
                note = lab       # trailing annotation, e.g. "No Bar f* = R U2 F'"
                continue
            # new sub-table header
            cur = {"key": lab, "label": STAT_LABELS.get(lab, {"zh": lab, "en": lab}),
                   "rows": [], "total": None, "mean": None}
            groups.append(cur)
            continue
        if cur is None:
            continue
        # int col0 = metric value row [m, #case, 1/prob, dist, cumm]
        if isinstance(c0, int):
            cur["rows"].append({
                "m": c0,
                "cases": int(r[1]) if len(r) > 1 and is_num(r[1]) else 0,
                "inv": round(float(r[2]), 4) if len(r) > 2 and is_num(r[2]) else None,
                "dist": float(r[3]) if len(r) > 3 and is_num(r[3]) else None,
                "cumm": float(r[4]) if len(r) > 4 and is_num(r[4]) else None,
            })
        elif isinstance(c0, float):
            # summary row: [mean, total]
            cur["mean"] = round(c0, 4)
            cur["total"] = int(r[1]) if len(r) > 1 and is_num(r[1]) else sum(x["cases"] for x in cur["rows"])
    return {"groups": groups, "note": note}


def build_cases(ws):
    rows = rows_of(ws)
    cases = []
    distF, distH, distQ, distQH, dqhq = Counter(), Counter(), Counter(), Counter(), Counter()
    for i, r in enumerate(rows):
        if i == 0:
            continue  # header
        if not r or not is_num(r[0]):
            continue
        idx = int(r[0])
        hAlg = (r[1] or "").strip()
        F = int(r[2]) if is_num(r[2]) else None
        H = int(r[3]) if is_num(r[3]) else None
        QH = int(r[4]) if is_num(r[4]) else None
        Q = int(r[5]) if is_num(r[5]) else None
        qAlg = (r[8] or "").strip() if len(r) > 8 and r[8] else ""
        f6 = [int(r[9 + k]) for k in range(6)] if len(r) > 14 and all(is_num(r[9 + k]) for k in range(6)) else None
        diff = int(r[15]) if len(r) > 15 and is_num(r[15]) else (QH - Q if (QH is not None and Q is not None) else None)
        if F is not None:
            distF[F] += 1
        if H is not None:
            distH[H] += 1
        if Q is not None:
            distQ[Q] += 1
        if QH is not None:
            distQH[QH] += 1
        if diff is not None:
            dqhq[diff] += 1
        # compact row: qAlg null when identical to hAlg; f6 null when all == F
        q_out = None if (qAlg == hAlg or not qAlg) else qAlg
        f6_out = None if (f6 is None or all(x == F for x in f6)) else f6
        cases.append([idx, hAlg, F, H, QH, Q, q_out, f6_out, diff])
    agg = {
        "F": {str(k): distF[k] for k in sorted(distF)},
        "H": {str(k): distH[k] for k in sorted(distH)},
        "Q": {str(k): distQ[k] for k in sorted(distQ)},
        "QH": {str(k): distQH[k] for k in sorted(distQH)},
        "dqhq": {str(k): dqhq[k] for k in sorted(dqhq)},
        "total": len(cases),
    }
    return cases, agg


def main():
    wb = load()
    dist = build_dist(wb["dist"])
    stat = build_stat(wb["stat"])
    cases, agg = build_cases(wb["case"])

    main_meta = dict(dist["meta"])
    main_meta.update({
        "generated_at": GENERATED_AT,
        "credits": CREDITS,
        "notation": NOTATION,
    })
    main_obj = {
        "meta": main_meta,
        "htm": dist["htm"],
        "qtm": dist["qtm"],
        "joint": dist["joint"],
        "stat": stat,
        "case_agg": agg,
    }
    cases_obj = {
        "meta": {
            "generated_at": GENERATED_AT,
            "total": len(cases),
            "cols": ["idx", "hAlg", "F", "H", "QH", "Q", "qAlg", "f6", "dqhq"],
            "note": "qAlg=null ⇒ 同 hAlg(HTM 最优解也是 QTM 最优解);f6=null ⇒ 六朝向面转步数都等于 F",
        },
        "rows": cases,
    }
    os.makedirs(os.path.dirname(OUT_MAIN), exist_ok=True)
    with open(OUT_MAIN, "w", encoding="utf-8", newline="\n") as f:
        json.dump(main_obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    with open(OUT_CASES, "w", encoding="utf-8", newline="\n") as f:
        json.dump(cases_obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("wrote", OUT_MAIN, os.path.getsize(OUT_MAIN), "bytes")
    print("wrote", OUT_CASES, os.path.getsize(OUT_CASES), "bytes")
    print("total positions:", main_meta.get("total_positions"))
    print("god HTM/QTM:", main_meta.get("god_htm"), main_meta.get("god_qtm"))
    print("stat groups:", [g["key"] for g in stat["groups"]], "note=", stat["note"])
    print("cases:", len(cases), "F agg:", agg["F"], "H agg:", agg["H"])


if __name__ == "__main__":
    main()
