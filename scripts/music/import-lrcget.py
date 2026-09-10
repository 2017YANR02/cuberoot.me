"""Import LRCGET sidecars after prepare-music.ps1; no audio or source writes.

Run with uv run python scripts/music/import-lrcget.py [--apply].
The imported batch replaces legacy lyric bindings in the local manifest.
"""

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path


STAMP = re.compile(r"\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]")
# Quarantine this exact downloaded payload; a corrected export can be imported.
REJECTED = {
    "93978dcdf9e4b8fbfff43dbc05a94749095fffc71f7321dbd614248c7a74ea8d":
        "The Joy Of Life / Kenny G: unexpected vocal lyrics; review recording match",
}


def inspect_lrc(data, duration):
    digest = hashlib.sha256(data).hexdigest()
    if digest in REJECTED:
        return "review", REJECTED[digest]
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return "review", "not UTF-8"
    if re.search(r"\[au:\s*instrumental\s*\]", text, re.I):
        return "instrumental", "LRCGET instrumental marker"
    offset = re.search(r"\[offset:([+-]?\d+)\]", text, re.I)
    offset = int(offset[1]) / 1000 if offset else 0
    times = []
    for line in text.splitlines():
        if not re.sub(r"\[[^\]]*\]", "", line).strip():
            continue
        for stamp in STAMP.finditer(line):
            seconds = int(stamp[1]) * 60 + int(stamp[2])
            seconds += int((stamp[3] or "0").ljust(3, "0")) / 1000 + offset
            times.append(seconds)
    if not times:
        return "review", "no timed text"
    if min(times) < 0 or max(times) > duration + 2:
        return "review", "timestamps outside recording duration"
    return "synced", f"{len(times)} timed lines"


def write_json(path, value):
    data = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if path.exists() and path.read_bytes() == data:
        return
    part = path.with_suffix(path.suffix + ".part")
    part.write_bytes(data)
    part.replace(path)


def run(root, apply=False):
    root = root.resolve(strict=True)
    manifest_path = root / "manifest.v1.json"
    original = manifest_path.read_bytes()
    manifest = json.loads(original)
    if manifest.get("version") != 1 or not manifest.get("tracks"):
        raise ValueError("Expected a nonempty version 1 music manifest")
    rows, assets, ids = [], {}, set()
    for track in manifest["tracks"]:
        src = track["src"]
        if not re.fullmatch(r"/music/library/tracks/[a-f0-9]{64}\.(mp3|m4a|flac|wav)", src):
            raise ValueError("Unexpected audio path")
        if track["id"] in ids or not isinstance(track.get("duration"), (int, float)) or track["duration"] <= 0:
            raise ValueError("Duplicate track id or invalid duration")
        ids.add(track["id"])
        sidecar = root / "tracks" / (Path(src).stem + ".lrc")
        row = {"id": track["id"], "title": track["title"], "artist": track.get("artist", "")}
        track.pop("lyrics", None)
        if not sidecar.exists():
            row["status"] = "missing"
        else:
            data = sidecar.read_bytes()
            row["status"], row["reason"] = inspect_lrc(data, track["duration"])
            row["sha256"] = hashlib.sha256(data).hexdigest()
            if row["status"] == "synced":
                name = row["sha256"] + ".lrc"
                assets[name] = data
                track["lyrics"] = "/music/library/lyrics/" + name
        rows.append(row)
    report = {"source": "LRCGET exported sidecars", "counts": dict(Counter(r["status"] for r in rows)), "tracks": rows}
    if apply:
        if not assets:
            raise ValueError("No valid synced lyrics; refusing to replace manifest")
        inventory = root.parent / "inventory"
        inventory.mkdir(exist_ok=True)
        backup = inventory / ("manifest-before-lrcget-" + hashlib.sha256(original).hexdigest() + ".json")
        if manifest != json.loads(original) and not backup.exists():
            backup.write_bytes(original)
        (root / "lyrics").mkdir(exist_ok=True)
        for name, data in assets.items():
            destination = root / "lyrics" / name
            if destination.exists():
                if destination.read_bytes() != data:
                    raise ValueError("Content-addressed asset mismatch")
            else:
                destination.write_bytes(data)
        write_json(inventory / "lrcget-import.v1.json", report)
        write_json(manifest_path, manifest)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, default=Path("Z:/cuberoot-music-staging/library"))
    parser.add_argument("--apply", action="store_true", help="write assets, report and local manifest; never publish")
    args = parser.parse_args()
    print(json.dumps(run(args.library, args.apply)["counts"], ensure_ascii=False))
