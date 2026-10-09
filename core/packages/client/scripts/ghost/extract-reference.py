"""Extract the original Ghost Cube PDF without changing simulator code.

uv run --with pypdf python core/packages/client/scripts/ghost/extract-reference.py
The external decoder is a pinned, separately downloaded research tool, not vendored
production code. See REFERENCE.md for provenance and reproduction instructions.
"""
import hashlib
import importlib.util
import json
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[5]
OUT = ROOT / ".tmp/png"
PDF = OUT / "ghost-adam-cowan-original.pdf"
DECODER = OUT / "ghost-u3d2mesh.py"
PDF_SHA256 = "c70cdc32c4663a9b31983c1c9a7ac3d6e463ba3a037a05d0e77ec702e2109a32"
DECODER_SHA256 = "d2a42da14e1bb6933f976c863f6b0c83fc08a7b2143eb33a62d33ef055ec6289"


def main():
    for path, expected in [(PDF, PDF_SHA256), (DECODER, DECODER_SHA256)]:
        assert hashlib.sha256(path.read_bytes()).hexdigest() == expected, f"Unexpected source: {path}"
    spec = importlib.util.spec_from_file_location("ghost_u3d_decoder", DECODER)
    decoder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(decoder)
    reader = PdfReader(PDF)
    assert len(reader.pages) == 1
    annotations = [a.get_object() for a in reader.pages[0]["/Annots"]]
    streams = [a["/3DD"] for a in annotations if a.get("/Subtype") == "/3D"]
    assert len(streams) == 1 and streams[0]["/Subtype"] == "/U3D"
    raw = streams[0].get_data()
    assert raw[:4] == b"U3D\0"
    meshes = decoder.decode_bytes(raw)
    assert len(meshes) == 327, "Do not silently accept a partial decode"
    assert not any(m["has_progr"] for m in meshes), "Progressive refinement unsupported"
    assert all(0 <= i < len(m["positions"]) for m in meshes for f in m["faces"] for i in f)
    nodes = decoder.parse_node_tree(raw)
    names = {n["name"] for n in nodes}
    assert len(names) == len(nodes), "Duplicate scene node"
    assert all(len(n["parents"]) <= 1 for n in nodes), "Multi-parent scene unsupported"
    assert all(p == "" or p in names for n in nodes for p, _ in n["parents"]), "Missing parent"
    by_name = {n["name"]: n for n in nodes}
    for n in nodes:
        seen, current = set(), n
        while current["parents"] and current["parents"][0][0]:
            assert current["name"] not in seen, "Cyclic scene graph"
            seen.add(current["name"])
            current = by_name[current["parents"][0][0]]
    worlds = decoder._world_transforms(nodes)
    by_resource = {m["name"]: m for m in meshes}
    placed = []
    for n in nodes:
        if n["kind"] != "model":
            continue
        assert n["resource"] in by_resource, f"Missing resource {n['resource']}"
        mesh = by_resource[n["resource"]]
        ancestors, current = [], n
        while current["parents"] and current["parents"][0][0]:
            current = by_name[current["parents"][0][0]]
            ancestors.append(current["name"])
        placed.append({
            "name": n["name"], "resource": n["resource"], "ancestors": ancestors,
            "matrix": worlds[n["name"]],
            "positions": [decoder._mat_apply(worlds[n["name"]], p) for p in mesh["positions"]],
            "faces": mesh["faces"],
        })
    assert {p["resource"] for p in placed} == set(by_resource), "Unplaced geometry"
    result = {
        "source": {"url": "https://twistypuzzles.com/forum/download/file.php?id=9936",
                   "sha256": PDF_SHA256, "metadata": dict(reader.metadata),
                   "decoderCommit": "71c5f4428ae3bcff9c2521c4e00dd938a703a648",
                   "decoderSha256": DECODER_SHA256},
        "u3dBytes": len(raw), "units": meshes[0]["units"], "profile": meshes[0]["profile"],
        "nodes": nodes, "meshes": placed,
    }
    (OUT / "ghost-original-extracted.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    (OUT / "ghost-original.u3d").write_bytes(raw)
    print(json.dumps({"nodes": len(nodes), "meshes": len(placed),
                      "triangles": sum(len(p["faces"]) for p in placed),
                      "profile": result["profile"], "units": result["units"]}))


if __name__ == "__main__":
    main()
