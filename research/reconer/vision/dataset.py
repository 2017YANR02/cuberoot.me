"""Python boundary for visible-instance COCO and decoded-frame JSONL inputs.

No model, solution notation, old grid, or synthetic label is consulted here.
Unknown regions remain explicit; this baseline cannot train with ignore masks.
The COCO contract is shared with src/dataset-manifest.ts; frame metadata is
produced by the TypeScript video intake, never reconstructed from GT.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import re

COLORS = ("W", "Y", "R", "O", "B", "G")
SPLITS = {"train", "val", "test", "development", "unassigned"}


class DataError(ValueError):
    pass


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def number(value) -> bool:
    try:
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
    except OverflowError:
        return False


FRAME_MANIFEST_KIND = "reconer-frame-manifest"
MAX_MANIFEST_LINE_BYTES = 1024 * 1024


def _object_fields(value, fields, label, optional=()):
    if not isinstance(value, dict) or not set(fields).issubset(value) or set(value) - set(fields) - set(optional):
        raise DataError(f"{label}: expected exactly {', '.join(fields)}")


def _nonempty(value, label):
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise DataError(f"{label}: nonempty string without surrounding whitespace required")


def _hash(value, label):
    if not isinstance(value, str) or re.fullmatch(r"[a-f0-9]{64}", value) is None:
        raise DataError(f"{label}: lowercase SHA-256 required")


def _positive_int(value, label):
    if type(value) is not int or value <= 0 or value > 2 ** 53 - 1:
        raise DataError(f"{label}: positive JSON-safe integer required")


def _pts(value, label):
    if not isinstance(value, str) or re.fullmatch(r"0|-?[1-9][0-9]*", value) is None:
        raise DataError(f"{label}: exact decimal integer string required")
    return int(value)


def _read_jsonl_line(stream, label):
    line = stream.readline(MAX_MANIFEST_LINE_BYTES + 1)
    if not line:
        return None, line
    if len(line) > MAX_MANIFEST_LINE_BYTES:
        raise DataError(f"{label}: JSONL record exceeds 1 MiB")
    try:
        return json.loads(line), line
    except (ValueError, UnicodeDecodeError) as exc:
        raise DataError(f"{label}: malformed JSONL record") from exc


def read_frame_manifest_header(path):
    """Image stream input only. It has no annotation, solution or split fields."""
    if path.name.endswith(".partial.jsonl"):
        raise DataError("A partial extraction manifest is not a completed frame input")
    with path.open("rb") as stream:
        header, _ = _read_jsonl_line(stream, "Frame manifest header")
    _object_fields(header, ("schemaVersion", "kind", "videoId", "sourceHash", "sourcePath",
                            "sourceWidth", "sourceHeight", "timeBase", "timeMapping"), "Frame manifest header",
                   optional=("sampling", "producerConfigHash"))
    if type(header["schemaVersion"]) is not int or header["schemaVersion"] != 1 or header["kind"] != FRAME_MANIFEST_KIND:
        raise DataError("Unsupported frame manifest format")
    for key in ("videoId", "sourcePath"):
        _nonempty(header[key], key)
    _hash(header["sourceHash"], "sourceHash")
    for key in ("sourceWidth", "sourceHeight"):
        _positive_int(header[key], key)
    base = header["timeBase"]
    _object_fields(base, ("numerator", "denominator"), "timeBase")
    for key in base:
        _positive_int(base[key], f"timeBase.{key}")
    mapping = header["timeMapping"]
    _object_fields(mapping, ("ptsOrigin", "realTimeOriginMs", "realSecondsPerPtsSecond", "verified"), "timeMapping")
    _pts(mapping["ptsOrigin"], "timeMapping.ptsOrigin")
    if not number(mapping["realTimeOriginMs"]) or mapping["realTimeOriginMs"] < 0 or type(mapping["verified"]) is not bool:
        raise DataError("timeMapping needs a nonnegative real origin and explicit boolean verified")
    scale = mapping["realSecondsPerPtsSecond"]
    if scale is not None and (not number(scale) or scale <= 0):
        raise DataError("realSecondsPerPtsSecond must be positive or null")
    if mapping["verified"] and scale is None:
        raise DataError("Verified real-time mapping requires a known scale")
    if "sampling" in header:
        _object_fields(header["sampling"], ("kind", "duplicatesVerified"), "sampling")
        if header["sampling"]["kind"] != "all-decoded-frames" or header["sampling"]["duplicatesVerified"] is not False:
            raise DataError("This baseline requires declared all-decoded-frames sampling without a deduplication claim")
    if "producerConfigHash" in header:
        _hash(header["producerConfigHash"], "producerConfigHash")
    return header


def frame_real_time_ms(header, source_pts):
    """Never infer real time from nominal FPS or an unverified slow-motion scale."""
    mapping = header["timeMapping"]
    if not mapping["verified"]:
        return None
    base = header["timeBase"]
    elapsed = Fraction((source_pts - _pts(mapping["ptsOrigin"], "ptsOrigin")) * base["numerator"], base["denominator"])
    return float(elapsed) * mapping["realSecondsPerPtsSecond"] * 1000 + mapping["realTimeOriginMs"]


def validate_frame_record(frame, header, index, previous_pts):
    _object_fields(frame, ("kind", "frameId", "frameIndex", "imagePath", "imageHash", "width", "height",
                           "sourcePts", "ptsSeconds", "realTimeMs", "sourceCrop"), f"Frame {index}")
    if frame["kind"] != "frame" or type(frame["frameIndex"]) is not int or frame["frameIndex"] != index:
        raise DataError(f"Frame {index}: frameIndex must be contiguous and start at zero")
    for key in ("frameId", "imagePath"):
        _nonempty(frame[key], key)
    image_path = PurePosixPath(frame["imagePath"])
    if image_path.is_absolute() or ".." in image_path.parts or "\\" in frame["imagePath"] or str(image_path) != frame["imagePath"]:
        raise DataError(f"Frame {index}: imagePath must be a normalized relative POSIX path without '..'")
    _hash(frame["imageHash"], "imageHash")
    for key in ("width", "height"):
        _positive_int(frame[key], key)
    pts = _pts(frame["sourcePts"], "sourcePts")
    if previous_pts is not None and pts <= previous_pts:
        raise DataError(f"Frame {index}: decoded source PTS must increase strictly")
    base = header["timeBase"]
    try:
        pts_seconds = float(Fraction(pts * base["numerator"], base["denominator"]))
        real_time = frame_real_time_ms(header, pts)
    except OverflowError as exc:
        raise DataError(f"Frame {index}: PTS/time mapping exceeds finite numeric range") from exc
    if not number(frame["ptsSeconds"]) or not math.isclose(frame["ptsSeconds"], pts_seconds, rel_tol=1e-12, abs_tol=1e-6):
        raise DataError(f"Frame {index}: ptsSeconds does not match exact sourcePts/timeBase")
    if real_time is None:
        if frame["realTimeMs"] is not None:
            raise DataError(f"Frame {index}: unverified real-time mapping requires realTimeMs=null")
    elif not number(real_time) or real_time < 0 or not number(frame["realTimeMs"]) or not math.isclose(frame["realTimeMs"], real_time, rel_tol=1e-12, abs_tol=1e-3):
        raise DataError(f"Frame {index}: realTimeMs does not match verified timeMapping")
    crop = frame["sourceCrop"]
    if not isinstance(crop, list) or len(crop) != 4 or not all(number(v) for v in crop):
        raise DataError(f"Frame {index}: sourceCrop must be [x,y,width,height]")
    x, y, width, height = crop
    if min(x, y) < 0 or min(width, height) <= 0 or x + width > header["sourceWidth"] or y + height > header["sourceHeight"]:
        raise DataError(f"Frame {index}: sourceCrop leaves the source image")
    return pts


def iter_manifest_frames(path, header, expected_hash=None):
    """Yield one metadata record at a time; no video frames or predictions accumulate."""
    digest = hashlib.sha256()
    frame_ids = set()
    with path.open("rb") as stream:
        actual_header, line = _read_jsonl_line(stream, "Frame manifest header")
        if actual_header != header:
            raise DataError("Frame manifest header changed after preparation")
        digest.update(line)
        index, previous_pts = 0, None
        while True:
            frame, line = _read_jsonl_line(stream, f"Frame {index}")
            if frame is None and not line:
                break
            digest.update(line)
            previous_pts = validate_frame_record(frame, header, index, previous_pts)
            if frame["frameId"] in frame_ids:
                raise DataError(f"Duplicate frameId: {frame['frameId']}")
            frame_ids.add(frame["frameId"])
            yield frame
            index += 1
    if expected_hash is not None and digest.hexdigest() != expected_hash:
        raise DataError("Frame manifest bytes changed during the run; do not treat partial output as complete")


def verify_frame_image(frame, root):
    path = (root / frame["imagePath"]).resolve()
    if not path.is_relative_to(root) or not path.is_file() or sha256(path) != frame["imageHash"]:
        raise DataError(f"Frame {frame['frameId']}: missing image or imageHash mismatch")
    from PIL import Image
    with Image.open(path) as image:
        if image.size != (frame["width"], frame["height"]):
            raise DataError(f"Frame {frame['frameId']}: image dimensions differ from manifest")
        image.verify()


def prepare_frame_manifest(path, images_root=None):
    path = path.resolve()
    header = read_frame_manifest_header(path)
    manifest_hash = sha256(path)
    root = (images_root or path.parent).resolve()
    count = 0
    for frame in iter_manifest_frames(path, header, manifest_hash):
        verify_frame_image(frame, root)
        count += 1
    if not count:
        raise DataError("Frame manifest has no decoded frames")
    return header, root, count, manifest_hash


def load_dataset(path: Path, root: Path | None = None, splits=(), training=False):
    """Validate provenance, grouping, polygons and bytes before importing torch.

    Reviewed + annotation_complete describes the entire image, including true
    negative images. A partially labelled image must never train as background.
    """
    path = path.resolve()
    if not path.is_file():
        raise DataError(f"Dataset not found: {path}. Supply reviewed visible-instance COCO labels.")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise DataError("COCO dataset must be an object")
    for key in ("images", "annotations", "categories"):
        if not isinstance(data.get(key), list):
            raise DataError(f"COCO {key} must be an array")
        if not all(isinstance(item, dict) for item in data[key]):
            raise DataError(f"COCO {key} entries must be objects")
    expected = {i + 1: name for i, name in enumerate(COLORS)}
    if len(data["categories"]) != 6 or {c.get("id"): c.get("name") for c in data["categories"]} != expected:
        raise DataError("Categories must be 1 W, 2 Y, 3 R, 4 O, 5 B, 6 G")
    root = (root or path.parent).resolve()
    images, annotations = {}, defaultdict(list)
    owners = {key: {} for key in ("source_id", "recording_group", "image_sha256")}
    errors = []
    for item in data["images"]:
        ident = item.get("id")
        if not isinstance(ident, int) or isinstance(ident, bool) or ident in images:
            raise DataError(f"Duplicate or invalid image id: {ident}")
        if item.get("split") not in SPLITS:
            raise DataError(f"Image {ident}: invalid split")
        if any(not isinstance(item.get(k), int) or isinstance(item[k], bool) or item[k] <= 0 for k in ("width", "height")):
            raise DataError(f"Image {ident}: positive integer width and height required")
        if not number(item.get("pts_seconds")) or item["pts_seconds"] < 0:
            raise DataError(f"Image {ident}: nonnegative PTS required")
        if not isinstance(item.get("file_name"), str) or not item["file_name"].strip():
            raise DataError(f"Image {ident}: file_name required")
        for key, seen in owners.items():
            value = item.get(key)
            if not isinstance(value, str) or not value.strip():
                raise DataError(f"Image {ident}: {key} required")
            if key == "image_sha256" and (len(value) != 64 or any(c not in "0123456789abcdef" for c in value)):
                raise DataError(f"Image {ident}: lowercase SHA-256 required")
            if item["split"] == "unassigned":
                continue
            canonical = value.strip()
            if canonical in seen and seen[canonical] != item["split"]:
                raise DataError(f"Split leakage: {key} {value} occurs in {seen[canonical]} and {item['split']}")
            seen[canonical] = item["split"]
        images[ident] = item
    annotation_ids = set()
    for ann in data["annotations"]:
        ident = ann.get("id")
        if not isinstance(ident, int) or isinstance(ident, bool) or ident in annotation_ids:
            raise DataError(f"Duplicate or invalid annotation id: {ident}")
        annotation_ids.add(ident)
        image = images.get(ann.get("image_id"))
        if image is None:
            raise DataError(f"Annotation {ident}: missing image")
        if "ignore" in ann and not isinstance(ann["ignore"], bool):
            raise DataError(f"Annotation {ident}: ignore must be boolean when present")
        ignored = ann.get("ignore") is True
        if ann.get("visibility") not in ("visible", "unknown") or type(ann.get("iscrowd")) is not int or ann["iscrowd"] != 0:
            raise DataError(f"Annotation {ident}: visibility and iscrowd=0 required")
        if "is_center" not in ann or ann["is_center"] is not None and not isinstance(ann["is_center"], bool):
            raise DataError(f"Annotation {ident}: is_center must be true, false or null")
        if ignored:
            if not isinstance(ann.get("ignore_reason"), str) or not ann["ignore_reason"].strip():
                raise DataError(f"Annotation {ident}: ignored region needs a reason")
        elif isinstance(ann.get("category_id"), bool) or ann.get("category_id") not in expected or ann["visibility"] != "visible":
            raise DataError(f"Annotation {ident}: unknown color/visibility requires an explicit ignored region")
        if ann.get("category_id") is not None and (isinstance(ann["category_id"], bool) or ann["category_id"] not in expected):
            raise DataError(f"Annotation {ident}: category_id must be 1..6 or null for ignored regions")
        polygons = ann.get("segmentation")
        if not isinstance(polygons, list) or not polygons:
            raise DataError(f"Annotation {ident}: visible polygon masks required")
        for polygon in polygons:
            if not isinstance(polygon, list) or len(polygon) < 6 or len(polygon) % 2 or not all(number(x) for x in polygon):
                raise DataError(f"Annotation {ident}: invalid polygon")
            if any(not 0 <= x <= image["width"] for x in polygon[::2]) or any(not 0 <= y <= image["height"] for y in polygon[1::2]):
                raise DataError(f"Annotation {ident}: polygon outside image")
            points = list(zip(polygon[::2], polygon[1::2]))
            if abs(sum(x * points[(j + 1) % len(points)][1] - y * points[(j + 1) % len(points)][0] for j, (x, y) in enumerate(points))) < 1e-6:
                raise DataError(f"Annotation {ident}: zero-area polygon")
        box = ann.get("bbox")
        if not isinstance(box, list) or len(box) != 4 or not all(number(x) for x in box):
            raise DataError(f"Annotation {ident}: COCO xywh bbox required")
        x, y, w, h = box
        if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > image["width"] + 1e-6 or y + h > image["height"] + 1e-6:
            raise DataError(f"Annotation {ident}: bbox outside image")
        if any(any(px < x - 1e-6 or px > x + w + 1e-6 for px in p[::2]) or any(py < y - 1e-6 or py > y + h + 1e-6 for py in p[1::2]) for p in polygons):
            raise DataError(f"Annotation {ident}: bbox does not contain polygon")
        if not number(ann.get("area")) or ann["area"] <= 0 or ann["area"] > image["width"] * image["height"]:
            raise DataError(f"Annotation {ident}: positive area required")
        annotations[image["id"]].append(ann)
    selected = [im for im in images.values() if not splits or im["split"] in splits]
    for split in splits:
        if not any(im["split"] == split for im in selected):
            errors.append(f"No images in required {split} split")
    if not selected:
        errors.append("No image annotations available; splits/probs/RGB census are not segmentation labels")
    for im in selected:
        ident = im["id"]
        if im.get("reviewed") is not True or im.get("annotation_complete") is not True or im.get("annotation_provenance") != "human-visible" or not isinstance(im.get("reviewer"), str) or not im["reviewer"].strip():
            errors.append(f"Image {ident}: complete human-visible review and reviewer required")
        if training and im["split"] == "train" and any(a.get("ignore") is True for a in annotations[ident]):
            errors.append(f"Image {ident}: baseline training cannot ignore unknown masks; use another fully reviewed frame")
        image_path = root / im["file_name"]
        if not image_path.is_file():
            errors.append(f"Image {ident}: file missing: {image_path}")
        elif sha256(image_path) != im["image_sha256"]:
            errors.append(f"Image {ident}: image SHA-256 mismatch")
        else:
            from PIL import Image
            with Image.open(image_path) as source:
                if source.size != (im["width"], im["height"]):
                    errors.append(f"Image {ident}: decoded dimensions differ from manifest")
                source.verify()
    if errors:
        raise DataError("; ".join(errors))
    if training and not any(annotations[im["id"]] for im in selected if im["split"] == "train"):
        raise DataError("Training needs positive visible sticker instances; negative-only images cannot train this detector")
    return data, selected, annotations, root


def provenance(rows):
    return {key: sorted({row[key].strip() for row in rows}) for key in ("source_id", "recording_group", "image_sha256")}


def assert_disjoint(rows, previous, context):
    for key, values in provenance(rows).items():
        if set(values).intersection(previous.get(key, [])):
            raise DataError(f"{context} overlaps earlier {key}; splitting a separate COCO file does not make a holdout")


def dataset_summary(data, selected):
    selected_ids = {im["id"] for im in selected}
    selected_annotations = [a for a in data["annotations"] if a["image_id"] in selected_ids]
    return {"images": len(selected), "splits": dict(Counter(i["split"] for i in selected)),
            "source_groups": len({i["recording_group"] for i in selected}),
            "annotations": len(selected_annotations),
            "color_instances": {color: sum(a["category_id"] == i + 1 and a.get("ignore") is not True for a in selected_annotations) for i, color in enumerate(COLORS)},
            "ignored_regions": sum(a.get("ignore") is True for a in selected_annotations)}


def image_and_masks(image, annotations, root):
    """Rasterize only the supplied visible polygons; never complete a hidden face."""
    import numpy as np
    from PIL import Image, ImageDraw
    with Image.open(root / image["file_name"]) as source:
        if source.size != (image["width"], image["height"]):
            raise DataError(f"Image {image['id']}: decoded dimensions differ from manifest")
        rgb = np.array(source.convert("RGB"), copy=True)
    masks = []
    for ann in annotations:
        mask = Image.new("L", (image["width"], image["height"]))
        draw = ImageDraw.Draw(mask)
        for polygon in ann["segmentation"]:
            draw.polygon(list(zip(polygon[::2], polygon[1::2])), fill=1)
        array = np.array(mask, dtype=np.uint8)
        if not array.any():
            raise DataError(f"Annotation {ann['id']}: empty raster mask")
        masks.append(array)
    return rgb, masks
