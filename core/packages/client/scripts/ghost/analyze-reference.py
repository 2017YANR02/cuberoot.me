"""Recover planar Ghost Cube evidence from the original designer's U3D mesh.

Run: uv run --with numpy --with scipy python core/packages/client/scripts/ghost/analyze-reference.py
Coordinates below are millimetres in the PDF's original assembly frame.
This is offline research, not simulator geometry.
"""
import os
for variable in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ[variable] = "14"

import json
import re
from collections import defaultdict
from itertools import combinations, product
from pathlib import Path

import numpy as np
from scipy.spatial import ConvexHull

ROOT = Path(__file__).resolve().parents[5]
OUT = ROOT / ".tmp/png"


def area(points):
    return abs(sum(a[0] * b[1] - a[1] * b[0] for a, b in zip(points, np.roll(points, -1, axis=0)))) / 2


def load_stickers():
    data = json.loads((OUT / "ghost-original-extracted.json").read_text(encoding="utf-8"))
    bodies = defaultdict(list)
    for mesh in data["meshes"]:
        name = next(n for n in mesh["ancestors"] if re.fullmatch(r"segment_body\d+", n))
        bodies[int(name.removeprefix("segment_body"))].append(mesh)
    stickers = []
    normals = []
    for body, meshes in sorted(bodies.items()):
        faces = []
        for mesh in meshes:
            p = np.array(mesh["positions"]) * 1000
            center = p.mean(axis=0)
            _, _, vt = np.linalg.svd(p - center)
            normal = vt[-1]
            if normal @ center < 0:
                normal = -normal
            total = sum(np.linalg.norm(np.cross(p[b] - p[a], p[c] - p[a])) / 2 for a, b, c in mesh["faces"])
            faces.append({"points": p, "normal": normal, "d": float(normal @ center), "area": total})
        caps = sorted(faces, key=lambda f: -f["area"])[:2]
        assert np.linalg.norm(caps[0]["normal"] - caps[1]["normal"]) < 1e-5
        base, top = sorted(caps, key=lambda f: f["d"])
        assert abs(base["d"] - 30) < 1e-4
        assert abs(top["d"] - base["d"] - 0.1) < 1e-4
        n = base["normal"]
        positive = n if n[np.argmax(abs(n))] > 0 else -n
        if not any(np.linalg.norm(positive - other) < 1e-5 for other in normals):
            normals.append(positive)
        stickers.append({"body": body, "points": base["points"], "normal": n, "area": base["area"]})
    # Stable canonical shell frame: X has zero Z; Z points upward in source Z.
    assert len(normals) == 3
    refined = []
    for n in normals:
        same = [s for s in stickers if abs(s["normal"] @ n) > 1 - 1e-6]
        average = sum((s["normal"] * np.sign(s["normal"] @ n) * s["area"] for s in same), start=np.zeros(3))
        refined.append(average / np.linalg.norm(average))
    nx = min(refined, key=lambda n: abs(n[2]))
    ny = max(refined, key=lambda n: n[2])
    nz = np.cross(nx, ny)
    basis = np.array([nx, ny, nz]).T
    # Polar decomposition removes only the source's float32 roundoff.
    u, _, vt = np.linalg.svd(basis)
    basis = u @ vt
    assert np.linalg.det(basis) > 0
    for sticker in stickers:
        p = sticker["points"] @ basis
        axis = int(np.argmax(abs(sticker["normal"] @ basis)))
        sign = 1 if np.mean(p[:, axis]) > 0 else -1
        dims = [i for i in range(3) if i != axis]
        hull = ConvexHull(p[:, dims])
        sticker.update(axis=axis, sign=sign, polygon=p[hull.vertices][:, dims], dims=dims)
    return data, basis, stickers


def source_edges(basis, stickers):
    records = []
    for sticker in stickers:
        p = np.zeros((len(sticker["polygon"]), 3))
        p[:, sticker["dims"]] = sticker["polygon"]
        p[:, sticker["axis"]] = 30 * sticker["sign"]
        p = p @ basis.T
        normal = basis[:, sticker["axis"]] * sticker["sign"]
        for a, b in zip(p, np.roll(p, -1, axis=0)):
            edge = b - a
            length = np.linalg.norm(edge)
            edge /= length
            midpoint = (a + b) / 2
            shell_axis = next((i for i in sticker["dims"] if abs(abs(midpoint @ basis[:, i]) - 28.5) < 1e-4), None)
            kind = "shell" if shell_axis is not None else "y" if abs(edge[1]) < 1e-5 else "horizontal"
            theta = float(np.degrees(np.arctan2(-edge[0], edge[2])) % 180) if kind == "horizontal" else None
            records.append({"body": sticker["body"], "kind": kind, "theta": theta,
                            "length": length, "edge": edge, "midpoint": midpoint,
                            "center": p.mean(axis=0), "faceNormal": normal,
                            "shellAxis": shell_axis})
    return records


def infer_parameters(basis, stickers):
    edges = source_edges(basis, stickers)
    clusters = []
    for edge in sorted((e for e in edges if e["kind"] == "horizontal"), key=lambda e: e["theta"]):
        if not clusters or edge["theta"] - clusters[-1][-1]["theta"] > 0.001:
            clusters.append([])
        clusters[-1].append(edge)
    assert len(clusters) == 6
    angles = [sum(e["theta"] * e["length"] for e in group) / sum(e["length"] for e in group) for group in clusters]
    # Integer-degree candidates are justified by independent edge directions, not assumed as source data.
    snapped = [round(angle) for angle in angles]
    assert max(abs(a - b) for a, b in zip(angles, snapped)) < 1e-4
    rows, values = [], []
    for edge in edges:
        if edge["kind"] == "shell":
            continue
        if edge["kind"] == "y":
            n = np.array([0., 1., 0.])
        else:
            angle = min(snapped, key=lambda a: abs(a - edge["theta"]))
            n = np.array([np.cos(np.radians(angle)), 0, np.sin(np.radians(angle))])
        n *= np.sign(n @ (edge["midpoint"] - edge["center"]))
        d = n @ edge["midpoint"]
        projection = n @ edge["faceNormal"]
        # d = signed half-cut + outward displacement - 3D cut inset - planar inset.
        row = [np.sign(d), projection, -1, -np.sqrt(1 - projection ** 2)]
        rows.append(row)
        values.append(d)
        edge.update(normal=n, intercept=d, row=row)
    fitted, _, rank, singular = np.linalg.lstsq(rows, values, rcond=None)
    assert rank == 4 and singular[0] / singular[-1] < 50
    nominal = np.round(fitted * 2) / 2
    assert max(abs(nominal - fitted)) < 1e-5
    residual = np.array(rows) @ nominal - values
    assert max(abs(residual)) < 1e-5
    half_cut, lift, cut_inset, sticker_inset = nominal
    shell_edges = [e for e in edges if e["kind"] == "shell"]
    observed_boundary = np.array([abs(e["midpoint"] @ basis[:, e["shellAxis"]]) for e in shell_edges])
    shell_half = float(np.mean(observed_boundary) + sticker_inset)
    assert abs(shell_half + lift - 30) < 1e-5
    layer_angles = [set(), set(), set()]
    for edge in edges:
        if edge["kind"] != "horizontal":
            continue
        # Undo the source's outward displacement before assigning the source Y slab.
        center_y = (edge["center"] - lift * edge["faceNormal"])[1]
        layer = 0 if center_y < -half_cut else 2 if center_y > half_cut else 1
        layer_angles[layer].add(round(edge["theta"]) % 90)
    assert all(len(angles) == 1 for angles in layer_angles), layer_angles
    theta_by_layer = [next(iter(angles)) for angles in layer_angles]
    home_rotations = [theta_by_layer[1] - theta for theta in theta_by_layer]
    return {
        "shellBasisColumns": basis.tolist(), "halfCutMm": float(half_cut),
        "shellHalfMm": float(round(shell_half, 5)), "stickerLiftMm": float(lift),
        "cutInsetMm": float(cut_inset), "stickerInsetMm": float(sticker_inset),
        "measuredNormalAnglesDegrees": angles, "normalAnglesDegrees": snapped,
        "thetaByLayerDegrees": theta_by_layer, "homeYRotationDegrees": home_rotations,
        "fittedParametersMm": fitted.tolist(), "cutEdges": len(rows), "shellEdges": len(shell_edges),
        "edgeResidualMaxMm": float(max(abs(residual))), "edgeResidualRmsMm": float(np.sqrt(np.mean(residual ** 2))),
        "fitConditionNumber": float(singular[0] / singular[-1]),
    }


def clip_polygon(polygon, n, d):
    output = []
    for a, b in zip(polygon, np.roll(polygon, -1, axis=0)):
        da, db = n @ a - d, n @ b - d
        if da <= 1e-9:
            output.append(a)
        if (da < -1e-9 and db > 1e-9) or (da > 1e-9 and db < -1e-9):
            output.append(a + (b - a) * da / (da - db))
    return np.array(output)


def cell_planes(slot, params):
    x, y, z = slot
    theta = np.radians(params["thetaByLayerDegrees"][y + 1])
    nx = np.array([np.cos(theta), 0, np.sin(theta)])
    ny = np.array([0., 1., 0.])
    nz = np.cross(nx, ny)
    planes = []
    for layer, n in zip((x, y, z), (nx, ny, nz)):
        if layer < 1:
            planes.append((n, params["halfCutMm"] * (-1 if layer == -1 else 1)))
        if layer > -1:
            planes.append((-n, params["halfCutMm"] * (-1 if layer == 1 else 1)))
    return planes


def face_polygon(basis, params, slot, axis, sign, sticker=False):
    h = params["shellHalfMm"]
    dims = [i for i in range(3) if i != axis]
    p = np.array([[-h, -h], [h, -h], [h, h], [-h, h]])
    if sticker:
        h -= params["stickerInsetMm"]
        p = np.array([[-h, -h], [h, -h], [h, h], [-h, h]])
    origin = basis[:, axis] * sign * params["shellHalfMm"]
    for n, d in cell_planes(slot, params):
        projected = n @ basis[:, dims]
        if sticker:
            d -= params["cutInsetMm"] + params["stickerInsetMm"] * np.linalg.norm(projected)
        p = clip_polygon(p, projected, d - n @ origin)
        if len(p) < 3:
            return np.empty((0, 2))
    return p


def reconstruct(basis, params, stickers):
    cells = []
    h = params["shellHalfMm"]
    shell = [(basis[:, i] * sign, h) for i in range(3) for sign in [-1, 1]]
    source_by_face = defaultdict(list)
    for s in stickers:
        source_by_face[s["axis"], s["sign"]].append(s)
    matched, errors, patch_counts, sticker_counts = [], [], defaultdict(int), defaultdict(int)
    for slot in product([-1, 0, 1], repeat=3):
        planes = shell + cell_planes(slot, params)
        vertices = []
        for triple in combinations(planes, 3):
            normals, offsets = map(np.array, zip(*triple))
            if abs(np.linalg.det(normals)) < 1e-9:
                continue
            vertex = np.linalg.solve(normals, offsets)
            if all(n @ vertex <= d + 1e-7 for n, d in planes) and not any(np.linalg.norm(vertex - v) < 1e-7 for v in vertices):
                vertices.append(vertex)
        assert len(vertices) >= 4
        hull = ConvexHull(vertices)
        patches = []
        for axis, sign in product(range(3), [-1, 1]):
            raw = face_polygon(basis, params, slot, axis, sign)
            sticker = face_polygon(basis, params, slot, axis, sign, sticker=True)
            if len(raw):
                patch_counts[axis, sign] += 1
            source_body = None
            error = None
            if len(sticker):
                sticker_counts[axis, sign] += 1
                # Hausdorff distance between convex polygon vertex sets: topology must match too.
                candidates = []
                for source in source_by_face[axis, sign]:
                    dist = np.linalg.norm(sticker[:, None] - source["polygon"][None, :], axis=2)
                    candidates.append((max(dist.min(axis=0).max(), dist.min(axis=1).max()), source))
                error, source = min(candidates, key=lambda item: item[0])
                assert len(sticker) == len(source["polygon"])
                assert error < 1e-5, (slot, axis, sign, error)
                source_body = source["body"]
                matched.append(source_body)
                errors.append(error)
            if len(raw):
                patches.append({"axis": axis, "sign": sign, "polygon": raw.tolist(), "sticker": sticker.tolist(),
                                "sourceBody": source_body, "vertexErrorMm": float(error) if error is not None else None})
        cells.append({"slot": list(slot), "volumeMm3": hull.volume, "vertices": np.array(vertices).tolist(), "patches": patches})
    assert sorted(matched) == list(range(55)), (len(matched), set(range(55)) - set(matched))
    assert abs(sum(c["volumeMm3"] for c in cells) - (h * 2) ** 3) < 1e-6
    assert sum(bool(c["patches"]) for c in cells) == 26
    assert [c["slot"] for c in cells if not c["patches"]] == [[0, 0, 0]]
    coverage = []
    for axis, sign in product(range(3), [-1, 1]):
        covered = sum(area(np.array(p["polygon"])) for c in cells for p in c["patches"] if (p["axis"], p["sign"]) == (axis, sign))
        assert abs(covered - (h * 2) ** 2) < 1e-7
        coverage.append({"axis": axis, "sign": sign, "areaMm2": covered,
                         "patches": patch_counts[axis, sign], "stickers": sticker_counts[axis, sign]})
    return cells, {"volumeMm3": sum(c["volumeMm3"] for c in cells), "coverage": coverage,
                   "sourceStickerCount": len(matched), "vertexResidualMaxMm": float(max(errors))}


def main():
    data, basis, stickers = load_stickers()
    params = infer_parameters(basis, stickers)
    cells, checks = reconstruct(basis, params, stickers)
    result = {"status": "geometry-review-only-awaiting-approval", "source": data["source"],
              "parameters": params, "checks": checks, "cells": cells,
              "sourceStickers": [{"body": s["body"], "axis": s["axis"], "sign": s["sign"], "polygon": s["polygon"].tolist()} for s in stickers]}
    (OUT / "ghost-original-analysis.json").write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({"parameters": params, "checks": checks}, indent=2))
    print("basis columns", basis.tolist())
    print("angles", np.degrees(np.arctan2(basis[1, 0], basis[0, 0])), np.degrees(np.arctan2(basis[2, 1], basis[2, 2])))


if __name__ == "__main__":
    main()
