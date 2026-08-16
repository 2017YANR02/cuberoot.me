#!/usr/bin/env python3
"""Normalize the public SQ1 PBL OOXML workbook with Python stdlib only."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import posixpath
import re
import struct
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from io import BytesIO
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

DOC_ID = "1VQNYNwdOLqqBkacHcfYtEBst22FOVhH9EAhTOYOZTgo"
LIVE_URL = f"https://docs.google.com/spreadsheets/d/{DOC_ID}/export?format=xlsx"
MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
UNUSED_CASES = ("Ga/Gd", "Ga/Jb", "Gb/Gc", "Gb/Jb")
SLICER_SHEETS = (
    "3 and 4 slicers",
    "5 slicers",
    "6 slicers",
    "7 slicers",
    "8 Slicers",
    "9 slicers",
)
PUBLIC_BASE_URL = "/data/sq1-pbl"
FORMULA_MEDIA_BASE_URL = f"{PUBLIC_BASE_URL}/formula-media"
FORMULA_IMAGE_BASES = {
    "https://wol4rwwr5d.execute-api.us-east-1.amazonaws.com/default/get_image?alg=": (".png", "image/png"),
    "https://wol4rwwr5d.execute-api.us-east-1.amazonaws.com/default/get_image3?&svg&mode=pbl&alg=": (".svg", "image/svg+xml"),
}
FORMULA_IMAGE_MAX_BYTES = 5 * 1024 * 1024
FORMULA_IMAGE_WORKERS = 14
A1_REFERENCE = re.compile(
    r"(?:(?P<sheet>'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_.]*)!)?"
    r"(?P<column_absolute>\$?)(?P<column>[A-Z]{1,3})"
    r"(?P<row_absolute>\$?)(?P<row>\d+)"
)
EXCLUSION_LEDGER = (
    {
        "category": "exporter-noise",
        "items": [
            "ZIP entry order and timestamps",
            "relationship IDs and media part names",
            "style/component IDs, apply flags, and theme-vs-RGB encoding",
            "shared-formula si IDs",
            "workbook and sheet selection/view state",
        ],
    },
    {
        "category": "debug-noise",
        "items": [
            "Excel _FilterDatabase defined names",
            "Google exporter Z_*_.wvu.FilterData GUID defined names",
        ],
    },
    {
        "category": "editorial-noise",
        "items": [
            "threaded discussion-comment export wrappers",
        ],
        "retained": "all stable cell notes, including historical author notes",
    },
)


def lname(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def digest(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def clean_text(value: str | None) -> str:
    return (value or "").replace("\r\n", "\n").replace("\r", "\n")


def attr_map(element: ET.Element, drop: set[str] | None = None) -> dict[str, str]:
    ignored = drop or set()
    return {
        lname(key): clean_text(value)
        for key, value in sorted(element.attrib.items(), key=lambda item: lname(item[0]))
        if lname(key) not in ignored
    }


def canon_xml(
    element: ET.Element,
    *,
    drop_attrs: set[str] | None = None,
    replace_attrs: dict[str, dict[str, str]] | None = None,
) -> Any:
    attrs = attr_map(element, drop_attrs)
    for key, mapping in (replace_attrs or {}).items():
        if key in attrs:
            attrs[key] = mapping.get(attrs[key], f"missing:{attrs[key]}")
    result: dict[str, Any] = {"tag": lname(element.tag)}
    if attrs:
        result["attrs"] = attrs
    if element.text not in (None, ""):
        result["text"] = clean_text(element.text)
    children = [
        canon_xml(child, drop_attrs=drop_attrs, replace_attrs=replace_attrs)
        for child in element
    ]
    if children:
        result["children"] = children
    return result


def text_of(element: ET.Element | None) -> str:
    if element is None:
        return ""
    return clean_text("".join(node.text or "" for node in element.iter() if lname(node.tag) == "t"))


def rels_path(part: str) -> str:
    return posixpath.join(posixpath.dirname(part), "_rels", posixpath.basename(part) + ".rels")


def resolve_part(base: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(base), target))


def parse_rels(archive: zipfile.ZipFile, part: str) -> dict[str, dict[str, str]]:
    rel_part = rels_path(part)
    if rel_part not in archive.namelist():
        return {}
    root = ET.fromstring(archive.read(rel_part))
    result: dict[str, dict[str, str]] = {}
    for rel in root:
        result[rel.attrib["Id"]] = {
            "type": rel.attrib.get("Type", "").rsplit("/", 1)[-1],
            "target": rel.attrib.get("Target", ""),
            "mode": rel.attrib.get("TargetMode", "Internal"),
        }
    return result


def fetch_bytes(source: str) -> tuple[bytes, str]:
    if source.startswith(("https://", "http://")):
        last: Exception | None = None
        for attempt in range(3):
            try:
                request = urllib.request.Request(
                    source,
                    headers={"User-Agent": "cuberoot.me sq1-pbl drift check"},
                )
                with urllib.request.urlopen(request, timeout=45) as response:
                    data = response.read()
                    content_type = response.headers.get("Content-Type", "")
                if not data.startswith(b"PK"):
                    raise ValueError(f"response is not XLSX ({content_type or 'unknown content type'})")
                return data, source
            except Exception as error:  # pragma: no cover - network retry
                last = error
                if attempt < 2:
                    time.sleep(attempt + 1)
        raise RuntimeError(f"download failed after 3 attempts: {last}")
    path = Path(source).expanduser().resolve()
    data = path.read_bytes()
    if not data.startswith(b"PK"):
        raise ValueError(f"not an XLSX ZIP: {path}")
    return data, str(path)


def style_model(archive: zipfile.ZipFile) -> dict[str, Any]:
    root = ET.fromstring(archive.read("xl/styles.xml"))

    theme_colors: list[str] = []
    theme_part = next((name for name in archive.namelist() if name.startswith("xl/theme/") and name.endswith(".xml")), None)
    if theme_part:
        theme_root = ET.fromstring(archive.read(theme_part))
        scheme = next((item for item in theme_root.iter() if lname(item.tag) == "clrScheme"), None)
        if scheme is not None:
            for slot in scheme:
                color = next(iter(slot), None)
                raw = "" if color is None else color.attrib.get("val", color.attrib.get("lastClr", ""))
                theme_colors.append(raw.upper())

    def style_xml(element: ET.Element) -> Any:
        attrs = attr_map(element)
        if lname(element.tag) in {"color", "fgColor", "bgColor"}:
            tint = attrs.get("tint")
            if "theme" in attrs:
                index = int(attrs["theme"])
                if 0 <= index < len(theme_colors) and theme_colors[index]:
                    attrs = {"rgb": f"FF{theme_colors[index][-6:]}"}
                    if tint is not None:
                        attrs["tint"] = tint
            elif "rgb" in attrs:
                rgb = attrs["rgb"].upper()
                attrs["rgb"] = rgb if len(rgb) == 8 else f"FF{rgb[-6:]}"
        result: dict[str, Any] = {"tag": lname(element.tag)}
        if attrs:
            result["attrs"] = attrs
        if element.text not in (None, ""):
            result["text"] = clean_text(element.text)
        children = [style_xml(child) for child in element]
        if children:
            result["children"] = children
        return result

    def children(name: str) -> list[ET.Element]:
        parent = root.find(f"{{{MAIN}}}{name}")
        return [] if parent is None else list(parent)

    num_formats = {
        item.attrib["numFmtId"]: clean_text(item.attrib.get("formatCode"))
        for item in children("numFmts")
    }
    fonts = [style_xml(item) for item in children("fonts")]
    fills = [style_xml(item) for item in children("fills")]
    borders = [style_xml(item) for item in children("borders")]
    base_xfs = children("cellStyleXfs")
    dxf_models = [canon_xml(item, drop_attrs={"uid"}) for item in children("dxfs")]
    dxfs = [digest(item) for item in dxf_models]

    def item_at(items: list[Any], raw: str | None) -> Any:
        index = int(raw or 0)
        return items[index] if 0 <= index < len(items) else {"missing": index}

    def xf_semantic(xf: ET.Element, include_base: bool = True) -> Any:
        attrs = attr_map(
            xf,
            {
                "numFmtId", "fontId", "fillId", "borderId", "xfId",
                "applyAlignment", "applyBorder", "applyFill", "applyFont",
                "applyNumberFormat", "applyProtection",
            },
        )
        number_id = xf.attrib.get("numFmtId", "0")
        result: dict[str, Any] = {
            "numFmt": num_formats.get(number_id, f"builtin:{number_id}"),
            "font": item_at(fonts, xf.attrib.get("fontId")),
            "fill": item_at(fills, xf.attrib.get("fillId")),
            "border": item_at(borders, xf.attrib.get("borderId")),
        }
        if attrs:
            result["attrs"] = attrs
        for child in xf:
            result[lname(child.tag)] = style_xml(child)
        if include_base and "xfId" in xf.attrib:
            base_index = int(xf.attrib["xfId"])
            if 0 <= base_index < len(base_xfs):
                result["base"] = xf_semantic(base_xfs[base_index], False)
        return result

    cell_xfs = [xf_semantic(item) for item in children("cellXfs")]
    style_hashes = [digest(item) for item in cell_xfs]
    return {
        "cell": style_hashes,
        "dxf": dxfs,
        "cellModels": {
            style_hash: model
            for style_hash, model in zip(style_hashes, cell_xfs)
        },
        "dxfModels": {
            style_hash: model
            for style_hash, model in zip(dxfs, dxf_models)
        },
        "counts": {
            "numFmts": len(num_formats),
            "fonts": len(fonts),
            "fills": len(fills),
            "borders": len(borders),
            "cellXfs": len(cell_xfs),
            "dxfs": len(dxfs),
            "semanticCellXfs": len(set(style_hashes)),
        },
    }


def png_size(data: bytes) -> tuple[int, int] | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        return struct.unpack(">II", data[16:24])
    return None


def svg_size(root: ET.Element) -> tuple[int, int] | None:
    def length(value: str | None) -> int | None:
        match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*", value or "")
        if not match:
            return None
        result = round(float(match.group(1)))
        return result if result > 0 else None

    width = length(root.attrib.get("width"))
    height = length(root.attrib.get("height"))
    if width and height:
        return width, height
    view_box = root.attrib.get("viewBox", "").replace(",", " ").split()
    if len(view_box) != 4:
        return None
    try:
        width = round(float(view_box[2]))
        height = round(float(view_box[3]))
    except ValueError:
        return None
    return (width, height) if width > 0 and height > 0 else None


def validate_svg(data: bytes) -> tuple[int, int] | None:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ValueError(f"SVG is not UTF-8: {error}") from error
    lowered = text.lower()
    for forbidden in ("<!doctype", "<!entity", "<script", "<foreignobject"):
        if forbidden in lowered:
            raise ValueError(f"unsafe SVG construct: {forbidden}")
    without_declaration = re.sub(r"^\s*<\?xml[^>]*\?>", "", text, count=1, flags=re.IGNORECASE)
    if "<?" in without_declaration:
        raise ValueError("unsafe SVG processing instruction")
    try:
        root = ET.fromstring(text)
    except ET.ParseError as error:
        raise ValueError(f"invalid SVG XML: {error}") from error
    if lname(root.tag).lower() != "svg":
        raise ValueError("SVG response root is not <svg>")

    def validate_css(value: str) -> None:
        lowered_value = value.lower()
        if "@import" in lowered_value or "javascript:" in lowered_value:
            raise ValueError("unsafe SVG CSS")
        for target in re.findall(r"url\(\s*(['\"]?)(.*?)\1\s*\)", value, flags=re.IGNORECASE):
            if not target[1].lstrip().startswith("#"):
                raise ValueError("external SVG CSS resource")

    for element in root.iter():
        tag = lname(element.tag).lower()
        if tag in {"script", "foreignobject"}:
            raise ValueError(f"unsafe SVG element: {tag}")
        if tag == "style":
            validate_css("".join(element.itertext()))
        for key, value in element.attrib.items():
            attribute = lname(key).lower()
            if attribute.startswith("on"):
                raise ValueError(f"unsafe SVG event attribute: {attribute}")
            if attribute in {"href", "src"} and value and not value.lstrip().startswith("#"):
                raise ValueError("external SVG resource")
            if attribute == "style" or "url(" in value.lower():
                validate_css(value)
            if "javascript:" in value.lower():
                raise ValueError("unsafe SVG javascript URL")
    return svg_size(root)


def validate_formula_image(data: bytes, content_type: str, extension: str) -> dict[str, Any]:
    if not 100 <= len(data) <= FORMULA_IMAGE_MAX_BYTES:
        raise ValueError(f"formula image has invalid size: {len(data)} bytes")
    mime = content_type.split(";", 1)[0].strip().lower()
    if extension == ".png":
        if mime != "image/png":
            raise ValueError(f"formula image MIME mismatch: expected image/png, got {mime or 'missing'}")
        dimensions = png_size(data)
        if dimensions is None or data[12:16] != b"IHDR" or b"IEND" not in data[-32:]:
            raise ValueError("formula image is not a complete PNG")
    elif extension == ".svg":
        if mime != "image/svg+xml":
            raise ValueError(f"formula image MIME mismatch: expected image/svg+xml, got {mime or 'missing'}")
        dimensions = validate_svg(data)
    else:
        raise ValueError(f"unsupported formula image extension: {extension}")
    if dimensions is not None and not all(0 < value <= 20_000 for value in dimensions):
        raise ValueError(f"formula image dimensions are unsafe: {dimensions}")
    image_hash = hashlib.sha256(data).hexdigest()
    return {
        key: value
        for key, value in {
            "sha256": image_hash,
            "bytes": len(data),
            "extension": extension,
            "mime": mime,
            "pixels": list(dimensions) if dimensions is not None else None,
            "raw": data,
        }.items()
        if value is not None
    }


def marker(anchor: ET.Element, name: str) -> dict[str, int] | None:
    item = next((child for child in anchor if lname(child.tag) == name), None)
    if item is None:
        return None
    result: dict[str, int] = {}
    for child in item:
        if lname(child.tag) in {"col", "colOff", "row", "rowOff", "x", "y", "cx", "cy"}:
            result[lname(child.tag)] = int(child.text or 0)
    for key, value in item.attrib.items():
        if lname(key) in {"x", "y", "cx", "cy"}:
            result[lname(key)] = int(value)
    return result


def drawing_model(
    archive: zipfile.ZipFile,
    sheet_part: str,
    sheet_root: ET.Element,
    sheet_rels: dict[str, dict[str, str]],
) -> tuple[list[Any], dict[str, dict[str, Any]], int]:
    drawings: list[Any] = []
    media: dict[str, dict[str, Any]] = {}
    non_pictures = 0
    for drawing_ref in sheet_root.findall(f"{{{MAIN}}}drawing"):
        relation_id = drawing_ref.attrib.get(f"{{{REL}}}id", "")
        relation = sheet_rels.get(relation_id)
        if not relation:
            continue
        drawing_part = resolve_part(sheet_part, relation["target"])
        drawing_root = ET.fromstring(archive.read(drawing_part))
        drawing_rels = parse_rels(archive, drawing_part)
        for anchor in drawing_root:
            pictures = [item for item in anchor.iter() if lname(item.tag) == "pic"]
            if not pictures:
                non_pictures += 1
                continue
            for picture in pictures:
                blip = next((item for item in picture.iter() if lname(item.tag) == "blip"), None)
                embed = "" if blip is None else blip.attrib.get(f"{{{REL}}}embed", "")
                image_rel = drawing_rels.get(embed)
                if not image_rel:
                    continue
                media_part = resolve_part(drawing_part, image_rel["target"])
                raw = archive.read(media_part)
                media_hash = hashlib.sha256(raw).hexdigest()
                extension = posixpath.splitext(media_part)[1].lower()
                media[media_hash] = {
                    "sha256": media_hash,
                    "bytes": len(raw),
                    "extension": extension,
                    "raw": raw,
                }
                properties = next((item for item in picture.iter() if lname(item.tag) == "cNvPr"), None)
                image: dict[str, Any] = {
                    "sha256": media_hash,
                    "bytes": len(raw),
                    "extension": extension,
                }
                dimensions = png_size(raw)
                if dimensions:
                    image["pixels"] = list(dimensions)
                    media[media_hash]["pixels"] = list(dimensions)
                if properties is not None:
                    for field in ("descr", "title"):
                        if properties.attrib.get(field):
                            image[field] = clean_text(properties.attrib[field])
                drawings.append(
                    {
                        "type": lname(anchor.tag),
                        "from": marker(anchor, "from"),
                        "to": marker(anchor, "to"),
                        "pos": marker(anchor, "pos"),
                        "ext": marker(anchor, "ext"),
                        "image": image,
                    }
                )
    drawings.sort(key=lambda item: json.dumps(item, sort_keys=True))
    return drawings, media, non_pictures


def comment_model(
    archive: zipfile.ZipFile,
    sheet_part: str,
    sheet_rels: dict[str, dict[str, str]],
) -> tuple[list[Any], list[Any]]:
    stable: list[Any] = []
    threaded: list[Any] = []
    for relation in sheet_rels.values():
        if relation["type"] != "comments":
            continue
        comment_part = resolve_part(sheet_part, relation["target"])
        root = ET.fromstring(archive.read(comment_part))
        authors = [item.text or "" for item in root.findall(f".//{{{MAIN}}}authors/{{{MAIN}}}author")]
        for comment in root.findall(f".//{{{MAIN}}}commentList/{{{MAIN}}}comment"):
            author_index = int(comment.attrib.get("authorId", "0"))
            author = authors[author_index] if author_index < len(authors) else ""
            text = text_of(comment.find(f"{{{MAIN}}}text"))
            item = {"ref": comment.attrib.get("ref", ""), "author": author, "text": text}
            if author.startswith("tc=") or "[Threaded comment]" in text:
                threaded.append(item)
            else:
                stable.append(item)
    key = lambda item: (item["ref"], item["author"], item["text"])
    return sorted(stable, key=key), sorted(threaded, key=key)


def cell_ref_key(reference: str) -> tuple[int, int]:
    match = re.fullmatch(r"([A-Z]+)(\d+)", reference)
    if not match:
        return (0, 0)
    column = 0
    for char in match.group(1):
        column = column * 26 + ord(char) - 64
    return (int(match.group(2)), column)


def column_name(column: int) -> str:
    result = ""
    while column > 0:
        column, remainder = divmod(column - 1, 26)
        result = chr(65 + remainder) + result
    return result


def range_ref(first_row: int, first_column: int, last_row: int, last_column: int) -> str:
    first = f"{column_name(first_column)}{first_row}"
    last = f"{column_name(last_column)}{last_row}"
    return first if first == last else f"{first}:{last}"


def used_dimension(cells: list[ET.Element]) -> str:
    coordinates = [cell_ref_key(cell.attrib.get("r", "")) for cell in cells]
    coordinates = [(row, column) for row, column in coordinates if row and column]
    if not coordinates:
        return ""
    rows = [row for row, _ in coordinates]
    columns = [column for _, column in coordinates]
    return range_ref(min(rows), min(columns), max(rows), max(columns))


def compress_style_cells(cells: list[tuple[int, int, str]]) -> list[dict[str, str]]:
    """Merge style-only cell records into stable horizontal/vertical rectangles."""
    by_row: dict[int, list[tuple[int, str]]] = {}
    for row, column, style in cells:
        by_row.setdefault(row, []).append((column, style))

    spans: dict[tuple[int, int, str], list[int]] = {}
    for row, entries in sorted(by_row.items()):
        entries.sort()
        start = end = entries[0][0]
        style = entries[0][1]
        for column, next_style in entries[1:]:
            if column == end + 1 and next_style == style:
                end = column
                continue
            spans.setdefault((start, end, style), []).append(row)
            start = end = column
            style = next_style
        spans.setdefault((start, end, style), []).append(row)

    ranges: list[dict[str, str]] = []
    for (first_column, last_column, style), rows in spans.items():
        first_row = last_row = rows[0]
        for row in rows[1:]:
            if row == last_row + 1:
                last_row = row
                continue
            ranges.append({
                "ref": range_ref(first_row, first_column, last_row, last_column),
                "style": style,
            })
            first_row = last_row = row
        ranges.append({
            "ref": range_ref(first_row, first_column, last_row, last_column),
            "style": style,
        })
    ranges.sort(key=lambda item: (*cell_ref_key(item["ref"].split(":", 1)[0]), item["ref"], item["style"]))
    return ranges


def stable_slugs(names: list[str]) -> dict[str, str]:
    candidates: dict[str, list[str]] = {}
    for name in names:
        normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
        base = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
        candidate = base or f"sheet-{digest(name)[:10]}"
        candidates.setdefault(candidate, []).append(name)
    result: dict[str, str] = {}
    for candidate, candidate_names in candidates.items():
        for name in candidate_names:
            result[name] = candidate if len(candidate_names) == 1 else f"{candidate}-{digest(name)[:10]}"
    return result


def number_value(value: str | None) -> int | float | None:
    if value in (None, ""):
        return None
    number = float(value)
    return int(number) if number.is_integer() else number


def atomic_write(path: Path, raw: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_bytes(raw)
    os.replace(temporary, path)


def atomic_json(path: Path, value: Any) -> None:
    raw = (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
    atomic_write(path, raw)


def quarantine_stale_generated_files(
    directory: Path,
    allowed_names: set[str],
    quarantine_root: Path,
) -> None:
    if not directory.exists():
        return
    for item in directory.iterdir():
        if item.name not in allowed_names and item.is_file() and not item.is_symlink():
            raw_hash = hashlib.sha256(item.read_bytes()).hexdigest()[:16]
            target_directory = quarantine_root / directory.name
            target_directory.mkdir(parents=True, exist_ok=True)
            target = target_directory / f"{raw_hash}-{item.name}"
            suffix = 1
            while target.exists():
                target = target_directory / f"{raw_hash}-{suffix}-{item.name}"
                suffix += 1
            item.rename(target)


def cell_value(
    cell: ET.Element,
    shared_strings: list[dict[str, Any]],
) -> tuple[bool, str | None, str | None, Any | None]:
    kind = cell.attrib.get("t")
    value = cell.find(f"{{{MAIN}}}v")
    inline = cell.find(f"{{{MAIN}}}is")
    if kind == "inlineStr" and inline is not None:
        rich_model = canon_xml(inline)
        has_runs = any(lname(item.tag) == "r" for item in inline)
        return True, text_of(inline), digest(rich_model), rich_model if has_runs else None
    if value is None or value.text is None:
        return False, None, None, None
    raw = clean_text(value.text)
    if kind == "s":
        index = int(raw)
        if 0 <= index < len(shared_strings):
            item = shared_strings[index]
            return True, item["text"], item["rich"], item.get("richModel")
    return True, raw, None, None


def worksheet_model(
    archive: zipfile.ZipFile,
    sheet_part: str,
    name: str,
    index: int,
    state: str,
    shared_strings: list[dict[str, Any]],
    styles: dict[str, Any],
    *,
    slug: str = "",
    include_public: bool = False,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]], set[str], dict[str, Any] | None]:
    root = ET.fromstring(archive.read(sheet_part))
    relationships = parse_rels(archive, sheet_part)
    cells = root.findall(f".//{{{MAIN}}}sheetData/{{{MAIN}}}row/{{{MAIN}}}c")
    shared_masters: dict[str, dict[str, str]] = {}
    for cell in cells:
        formula = cell.find(f"{{{MAIN}}}f")
        if formula is not None and formula.attrib.get("t") == "shared" and formula.text:
            shared_masters[formula.attrib.get("si", "")] = {
                "text": clean_text(formula.text),
                "ref": formula.attrib.get("ref", ""),
                "cell": cell.attrib.get("r", ""),
            }

    cell_content: list[Any] = []
    cell_presentation: list[Any] = []
    public_cells: list[Any] = []
    public_style_only: list[tuple[int, int, str]] = []
    values_by_ref: dict[str, str] = {}
    counts = Counter()
    formula_types = Counter()
    referenced_styles: set[str] = set()
    style_hashes = styles["cell"]

    for cell in sorted(cells, key=lambda item: cell_ref_key(item.attrib.get("r", ""))):
        reference = cell.attrib.get("r", "")
        has_value, value, rich, rich_model = cell_value(cell, shared_strings)
        formula = cell.find(f"{{{MAIN}}}f")
        has_formula = formula is not None
        formula_item: dict[str, Any] | None = None
        counts["cellRecords"] += 1
        counts["literalValues"] += int(has_value)
        counts["formulas"] += int(has_formula)
        counts["formulaValueOverlap"] += int(has_value and has_formula)
        counts["valueOrFormula"] += int(has_value or has_formula)
        counts["styleOnly"] += int(not has_value and not has_formula)
        if cell.attrib.get("t") == "e":
            counts["errorCells"] += 1

        if has_value and value is not None:
            values_by_ref[reference] = value
        if has_value or has_formula:
            item: dict[str, Any] = {"ref": reference}
            if cell.attrib.get("t"):
                item["type"] = cell.attrib["t"]
            if has_value:
                item["value"] = value
            if has_formula:
                formula_type = formula.attrib.get("t", "normal")
                formula_types[formula_type] += 1
                formula_item = {"type": formula_type}
                attrs = attr_map(formula, {"t", "si"})
                if formula_type == "shared":
                    master = shared_masters.get(formula.attrib.get("si", ""), {})
                    formula_item["text"] = master.get("text", clean_text(formula.text))
                    if master.get("ref"):
                        formula_item["ref"] = master["ref"]
                else:
                    formula_item["text"] = clean_text(formula.text)
                if attrs:
                    formula_item["attrs"] = attrs
                item["formula"] = formula_item
            cell_content.append(item)

        style_index = int(cell.attrib.get("s", "0"))
        style_hash = style_hashes[style_index] if style_index < len(style_hashes) else f"missing:{style_index}"
        referenced_styles.add(style_hash)
        style_item: dict[str, Any] = {"ref": reference, "style": style_hash}
        if rich:
            style_item["richText"] = rich
        cell_presentation.append(style_item)
        if include_public:
            if has_value or has_formula:
                public_item: dict[str, Any] = {
                    "ref": reference,
                    "type": cell.attrib.get("t", "n"),
                    "style": style_hash,
                }
                if has_formula:
                    public_formula = {**(formula_item or {})}
                    if formula is not None and formula.attrib.get("t") == "shared":
                        master = shared_masters.get(formula.attrib.get("si", ""), {})
                        public_formula.pop("ref", None)
                        public_formula["sharedMaster"] = master.get("cell", "")
                        if master.get("ref"):
                            public_formula["sharedRange"] = master["ref"]
                        if formula.text:
                            public_formula["text"] = clean_text(formula.text)
                        else:
                            public_formula.pop("text", None)
                            public_formula["template"] = master.get("text", "")
                    public_item["formula"] = public_formula
                    public_item["cached"] = value if has_value else None
                elif has_value:
                    public_item["value"] = value
                if rich_model is not None:
                    public_item["richText"] = rich_model
                public_cells.append(public_item)
            else:
                row, column = cell_ref_key(reference)
                if row and column:
                    public_style_only.append((row, column, style_hash))

    stable_comments, threaded_comments = comment_model(archive, sheet_part, relationships)
    pictures, media, non_pictures = drawing_model(archive, sheet_part, root, relationships)

    hyperlinks: list[Any] = []
    hyperlink_parent = root.find(f"{{{MAIN}}}hyperlinks")
    if hyperlink_parent is not None:
        for link in hyperlink_parent:
            item = attr_map(link, {"id"})
            relation_id = link.attrib.get(f"{{{REL}}}id")
            relation = relationships.get(relation_id or "")
            if relation:
                item["target"] = clean_text(relation["target"])
                item["targetMode"] = relation["mode"]
            hyperlinks.append(item)
    hyperlinks.sort(key=lambda item: json.dumps(item, sort_keys=True))

    merges_parent = root.find(f"{{{MAIN}}}mergeCells")
    merges = [] if merges_parent is None else sorted(item.attrib.get("ref", "") for item in merges_parent)

    validations: list[Any] = []
    validation_parent = root.find(f"{{{MAIN}}}dataValidations")
    if validation_parent is not None:
        validations = [canon_xml(item, drop_attrs={"count", "uid"}) for item in validation_parent]
        validations.sort(key=lambda item: json.dumps(item, sort_keys=True))

    conditional: list[Any] = []
    dxf_map = {str(i): value for i, value in enumerate(styles["dxf"])}
    for item in root.findall(f"{{{MAIN}}}conditionalFormatting"):
        conditional.append(canon_xml(item, drop_attrs={"uid"}, replace_attrs={"dxfId": dxf_map}))
    conditional.sort(key=lambda item: json.dumps(item, sort_keys=True))

    rows: list[Any] = []
    for row in root.findall(f".//{{{MAIN}}}sheetData/{{{MAIN}}}row"):
        attrs = attr_map(row, {"spans", "s", "customFormat"})
        if "s" in row.attrib:
            style_index = int(row.attrib["s"])
            attrs["style"] = style_hashes[style_index] if style_index < len(style_hashes) else f"missing:{style_index}"
            referenced_styles.add(attrs["style"])
        meaningful = set(attrs) - {"r"}
        if meaningful:
            rows.append(attrs)

    columns: list[Any] = []
    cols_parent = root.find(f"{{{MAIN}}}cols")
    if cols_parent is not None:
        for column in cols_parent:
            attrs = attr_map(column, {"style"})
            if "style" in column.attrib:
                style_index = int(column.attrib["style"])
                attrs["style"] = style_hashes[style_index] if style_index < len(style_hashes) else f"missing:{style_index}"
                referenced_styles.add(attrs["style"])
            columns.append(attrs)

    pane: dict[str, str] | None = None
    sheet_views = root.find(f"{{{MAIN}}}sheetViews")
    if sheet_views is not None:
        pane_element = sheet_views.find(f".//{{{MAIN}}}pane")
        if pane_element is not None:
            pane = attr_map(pane_element, {"activePane"})

    auto_filter = root.find(f"{{{MAIN}}}autoFilter")
    auto_filter_value = None if auto_filter is None else canon_xml(auto_filter, drop_attrs={"uid"})

    tables: list[Any] = []
    table_parts = root.find(f"{{{MAIN}}}tableParts")
    if table_parts is not None:
        for table_ref in table_parts:
            relation_id = table_ref.attrib.get(f"{{{REL}}}id", "")
            relation = relationships.get(relation_id)
            if not relation:
                continue
            table_part = resolve_part(sheet_part, relation["target"])
            table_root = ET.fromstring(archive.read(table_part))
            tables.append(canon_xml(table_root, drop_attrs={"id", "uid"}))
        tables.sort(key=lambda item: json.dumps(item, sort_keys=True))

    dimension = root.find(f"{{{MAIN}}}dimension")
    dimension_ref = "" if dimension is None else dimension.attrib.get("ref", "")
    public_dimension = dimension_ref or used_dimension(cells)
    content_payload = {
        "cells": cell_content,
        "comments": stable_comments,
        "hyperlinks": hyperlinks,
        "pictures": pictures,
    }
    presentation_payload = {
        "dimension": dimension_ref,
        "cells": cell_presentation,
        "rows": rows,
        "columns": columns,
        "merges": merges,
        "validations": validations,
        "conditionalFormatting": conditional,
        "pane": pane,
        "autoFilter": auto_filter_value,
        "tables": tables,
        "nonPictureDrawingAnchors": non_pictures,
    }
    summary = {
        "index": index,
        "name": name,
        "state": state,
        "dimension": dimension_ref,
        "digests": {
            "content": digest(content_payload),
            "presentation": digest(presentation_payload),
            "editorial": digest(threaded_comments),
        },
        "counts": {
            **dict(counts),
            "formulaTypes": dict(sorted(formula_types.items())),
            "merges": len(merges),
            "validations": len(validations),
            "conditionalFormatting": sum(
                1 for item in root.iter() if lname(item.tag) == "cfRule"
            ),
            "hyperlinks": len(hyperlinks),
            "stableComments": len(stable_comments),
            "threadedComments": len(threaded_comments),
            "pictureAnchors": len(pictures),
            "tables": len(tables),
            "customRows": len(rows),
            "columnDefinitions": len(columns),
            "referencedStyles": len(referenced_styles),
        },
        "valuesByRef": values_by_ref,
    }
    public_payload: dict[str, Any] | None = None
    if include_public:
        public_pictures = []
        for picture in pictures:
            public_picture = {**picture, "image": {**picture["image"]}}
            image = public_picture["image"]
            image["url"] = f"{PUBLIC_BASE_URL}/media/{image['sha256']}{image['extension']}"
            public_pictures.append(public_picture)
        style_ranges = compress_style_cells(public_style_only)
        public_counts = {
            key: value
            for key, value in summary["counts"].items()
            if key != "threadedComments"
        }
        public_payload = {
            "schemaVersion": 1,
            "index": index,
            "name": name,
            "slug": slug,
            "state": state,
            "dimension": public_dimension,
            "digests": {
                "content": summary["digests"]["content"],
                "presentation": summary["digests"]["presentation"],
            },
            "counts": {
                **public_counts,
                "styleRanges": len(style_ranges),
                "styleRangeCells": counts["styleOnly"],
            },
            "cells": public_cells,
            "styleRanges": style_ranges,
            "styles": {
                "cell": {
                    style_hash: styles["cellModels"][style_hash]
                    for style_hash in sorted(referenced_styles)
                    if style_hash in styles["cellModels"]
                },
                "differential": styles["dxfModels"] if conditional else {},
            },
            "notes": stable_comments,
            "hyperlinks": hyperlinks,
            "merges": merges,
            "pictures": public_pictures,
            "rows": rows,
            "columns": columns,
            "pane": pane,
            "validations": validations,
            "conditionalFormatting": conditional,
            "autoFilter": auto_filter_value,
            "tables": tables,
            "nonPictureDrawingAnchors": non_pictures,
        }
    return summary, media, referenced_styles, public_payload


def raw_invariants(sheet: dict[str, Any], slicers: list[dict[str, Any]]) -> dict[str, Any]:
    values = sheet["valuesByRef"]
    rows: list[dict[str, Any]] = []
    for row in range(1, 2000):
        key = values.get(f"A{row}")
        if key is None:
            continue
        rows.append(
            {
                "key": key,
                "frequency": values.get(f"D{row}", "0"),
                "slices": values.get(f"G{row}", ""),
            }
        )
    keys = [row["key"] for row in rows]
    frequencies = sum(float(row["frequency"]) for row in rows)
    slice_counts = Counter(row["slices"].removesuffix(".0") for row in rows)

    recommended = 0
    recommended_frequency = 0.0
    slicer_counts: dict[str, int] = {}
    for slicer in slicers:
        sheet_values = slicer["valuesByRef"]
        count = 0
        total = 0.0
        for row in range(1, 1000):
            ordinal = sheet_values.get(f"A{row}", "")
            name = sheet_values.get(f"B{row}")
            try:
                float(ordinal)
            except ValueError:
                continue
            if not name:
                continue
            count += 1
            total += float(sheet_values.get(f"G{row}", "0"))
        slicer_counts[slicer["name"]] = count
        recommended += count
        recommended_frequency += total

    return {
        "rawCases": len(rows),
        "uniqueRawKeys": len(set(keys)),
        "frequencyTotal": int(frequencies),
        "sliceDistribution": dict(sorted(slice_counts.items(), key=lambda item: int(item[0]))),
        "recommendedCases": recommended,
        "recommendedFrequency": int(recommended_frequency),
        "slicerCounts": slicer_counts,
        "unusedCases": {
            key: key in set(keys)
            for key in UNUSED_CASES
        },
    }


def build_case_export(
    raw_sheet: dict[str, Any],
    slicers: list[dict[str, Any]],
    slugs: dict[str, str],
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    raw_values = raw_sheet["valuesByRef"]
    raw_rows: list[dict[str, Any]] = []
    compact_keys: dict[str, str] = {}
    for row in range(1, 2000):
        key = raw_values.get(f"A{row}")
        if key is None:
            continue
        compact = key.replace("/", "")
        if compact in compact_keys:
            raise ValueError(f"ambiguous Raw Algs compact key: {compact}")
        compact_keys[compact] = key
        raw_rows.append({
            "key": key,
            "top": raw_values.get(f"B{row}", ""),
            "bottom": raw_values.get(f"C{row}", ""),
            "frequency": number_value(raw_values.get(f"D{row}")),
            "shapePair": raw_values.get(f"E{row}", ""),
            "solution": raw_values.get(f"F{row}") or None,
            "slices": number_value(raw_values.get(f"G{row}")),
        })

    bucket_ids = {
        "3 and 4 slicers": "3-4",
        "5 slicers": "5",
        "6 slicers": "6",
        "7 slicers": "7",
        "8 Slicers": "8",
        "9 slicers": "9",
    }
    recommendations: dict[str, dict[str, Any]] = {}
    buckets: list[dict[str, Any]] = []
    for slicer in slicers:
        values = slicer["valuesByRef"]
        bucket_count = 0
        for row in range(1, 1000):
            ordinal = values.get(f"A{row}", "")
            display_name = values.get(f"B{row}")
            try:
                rank = number_value(ordinal)
            except ValueError:
                continue
            if rank is None or not display_name:
                continue
            raw_key = compact_keys.get(display_name.replace("/", ""))
            if raw_key is None:
                raise ValueError(f"recommended case is missing from Raw Algs: {slicer['name']} {display_name}")
            if raw_key in recommendations:
                raise ValueError(f"recommended case appears more than once: {raw_key}")
            recommendations[raw_key] = {
                "bucket": bucket_ids[slicer["name"]],
                "sheet": slicer["name"],
                "sheetSlug": slugs[slicer["name"]],
                "rank": rank,
                "displayName": display_name,
                "angle": values.get(f"E{row}") or None,
                "algorithm": values.get(f"F{row}") or None,
                "frequency": number_value(values.get(f"G{row}")),
                "probability": number_value(values.get(f"I{row}")),
                "percentage": number_value(values.get(f"J{row}")),
            }
            bucket_count += 1
        buckets.append({
            "id": bucket_ids[slicer["name"]],
            "sheet": slicer["name"],
            "sheetSlug": slugs[slicer["name"]],
            "caseCount": bucket_count,
        })

    cases: list[dict[str, Any]] = []
    unused = set(UNUSED_CASES)
    for item in raw_rows:
        key = item["key"]
        recommendation = recommendations.get(key)
        used = key not in unused
        cases.append({
            **item,
            "used": used,
            "recommended": recommendation is not None,
            "bucket": recommendation["bucket"] if recommendation else ("unused" if not used else "solved"),
            "recommendation": recommendation,
        })

    return {
        "schemaVersion": 1,
        "source": {
            "documentId": DOC_ID,
            "url": f"https://docs.google.com/spreadsheets/d/{DOC_ID}/edit",
            "documentUrl": f"https://docs.google.com/spreadsheets/d/{DOC_ID}/edit",
            "sheet": "Raw Algs",
            "contentDigest": snapshot["digests"]["content"],
        },
        "invariants": {
            "caseCount": len(cases),
            "recommendedCount": len(recommendations),
            "frequencyTotal": snapshot["invariants"]["frequencyTotal"],
            "usedFalse": sorted(item["key"] for item in cases if not item["used"]),
        },
        "buckets": buckets,
        "cases": cases,
    }


def formula_without_string_literals(formula: str) -> list[str]:
    return [
        part
        for index, part in enumerate(re.split(r'("(?:[^"]|"")*")', formula))
        if index % 2 == 0
    ]


def decode_sheet_name(value: str | None, fallback: str) -> str:
    if not value:
        return fallback
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1].replace("''", "'")
    return value


def normalized_cell_ref(column: str, row: str) -> str:
    return f"{column.upper()}{int(row)}"


def formula_references(formula: str, current_sheet: str) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    for part in formula_without_string_literals(formula):
        for match in A1_REFERENCE.finditer(part):
            result.append((
                decode_sheet_name(match.group("sheet"), current_sheet),
                normalized_cell_ref(match.group("column"), match.group("row")),
            ))
    return result


def translate_shared_formula(formula: str, master_ref: str, target_ref: str) -> str:
    master_row, master_column = cell_ref_key(master_ref)
    target_row, target_column = cell_ref_key(target_ref)
    if not master_row or not master_column or not target_row or not target_column:
        raise ValueError(f"invalid shared formula coordinates: {master_ref} -> {target_ref}")
    row_delta = target_row - master_row
    column_delta = target_column - master_column

    def translate(part: str) -> str:
        def replace(match: re.Match[str]) -> str:
            row = int(match.group("row"))
            column = cell_ref_key(f"{match.group('column')}{row}")[1]
            if not match.group("row_absolute"):
                row += row_delta
            if not match.group("column_absolute"):
                column += column_delta
            if row <= 0 or column <= 0:
                raise ValueError(f"shared formula translated outside worksheet: {target_ref}")
            sheet = match.group("sheet")
            prefix = "" if sheet is None else f"{sheet}!"
            return (
                f"{prefix}{match.group('column_absolute')}{column_name(column)}"
                f"{match.group('row_absolute')}{row}"
            )

        return A1_REFERENCE.sub(replace, part)

    parts = re.split(r'("(?:[^"]|"")*")', formula)
    return "".join(part if index % 2 else translate(part) for index, part in enumerate(parts))


def effective_formula(cell: dict[str, Any]) -> str:
    formula = cell.get("formula") or {}
    if formula.get("text"):
        return formula["text"]
    if formula.get("template") and formula.get("sharedMaster"):
        return translate_shared_formula(formula["template"], formula["sharedMaster"], cell["ref"])
    return ""


def public_cell_value(cell: dict[str, Any] | None) -> str | None:
    if cell is None:
        return None
    if "value" in cell:
        return "" if cell["value"] is None else str(cell["value"])
    if cell.get("cached") is not None:
        return str(cell["cached"])
    return None


def formula_image_request(
    sheet_name: str,
    cell: dict[str, Any],
    cells_by_sheet: dict[str, dict[str, dict[str, Any]]],
) -> dict[str, str] | None:
    formula = effective_formula(cell)
    matching_bases = [base for base in FORMULA_IMAGE_BASES if base in formula]
    if not matching_bases:
        return None
    if len(matching_bases) != 1:
        raise ValueError(f"ambiguous formula image endpoint: {sheet_name}!{cell['ref']}")
    references = formula_references(formula, sheet_name)
    if len(references) != 1:
        raise ValueError(
            f"formula image must have exactly one input reference: {sheet_name}!{cell['ref']} has {len(references)}"
        )
    input_sheet, input_ref = references[0]
    input_cells = cells_by_sheet.get(input_sheet)
    if input_cells is None:
        raise ValueError(f"formula image input sheet missing: {input_sheet}")
    input_cell = input_cells.get(input_ref)
    value = public_cell_value(input_cell)
    if value is None:
        if input_cell is not None and input_cell.get("formula"):
            raise ValueError(f"formula image input has no cached value: {input_sheet}!{input_ref}")
        value = ""
    base = matching_bases[0]
    if "SUBSTITUTE(" in formula.upper():
        value = value.replace(" ", "/")
    url = f"{base}{urllib.parse.quote(value, safe='/')}"
    extension, mime = FORMULA_IMAGE_BASES[base]
    return {
        "url": url,
        "requestDigest": hashlib.sha256(url.encode("utf-8")).hexdigest(),
        "extension": extension,
        "mime": mime,
        "inputCell": f"{input_sheet}!{input_ref}",
    }


def fetch_formula_image(request: dict[str, str]) -> dict[str, Any]:
    last: Exception | None = None
    for attempt in range(3):
        try:
            http_request = urllib.request.Request(
                request["url"],
                headers={"User-Agent": "cuberoot.me sq1-pbl public export"},
            )
            with urllib.request.urlopen(http_request, timeout=45) as response:
                data = response.read(FORMULA_IMAGE_MAX_BYTES + 1)
                content_type = response.headers.get("Content-Type", "")
            image = validate_formula_image(data, content_type, request["extension"])
            if image["mime"] != request["mime"]:
                raise ValueError(f"validated MIME differs from expected {request['mime']}")
            image["requestDigest"] = request["requestDigest"]
            return image
        except Exception as error:  # pragma: no cover - network retry
            last = error
            if attempt < 2:
                time.sleep(attempt + 1)
    raise RuntimeError(f"formula image {request['requestDigest']} failed after 3 attempts: {last}")


def cached_formula_images(public_dir: Path) -> dict[str, dict[str, Any]]:
    manifest_path = public_dir / "manifest.json"
    if not manifest_path.exists():
        return {}
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    result: dict[str, dict[str, Any]] = {}
    for asset in manifest.get("formulaImages", {}).get("assets", []):
        extension = asset.get("extension")
        mime = asset.get("mime")
        image_hash = asset.get("sha256")
        if extension not in {".png", ".svg"} or not mime or not image_hash:
            continue
        path = public_dir / "formula-media" / f"{image_hash}{extension}"
        try:
            raw = path.read_bytes()
            image = validate_formula_image(raw, mime, extension)
        except (OSError, ValueError):
            continue
        if image["sha256"] != image_hash or image["bytes"] != asset.get("bytes"):
            continue
        for request_digest in asset.get("requestDigests", []):
            result[request_digest] = image
    return result


def parse_single_reference(token: str, fallback_sheet: str) -> tuple[str, str]:
    match = A1_REFERENCE.fullmatch(token.strip())
    if not match:
        raise ValueError(f"invalid formula reference: {token}")
    return (
        decode_sheet_name(match.group("sheet"), fallback_sheet),
        normalized_cell_ref(match.group("column"), match.group("row")),
    )


def derived_formula_image_source(
    sheet_name: str,
    cell: dict[str, Any],
    cells_by_sheet: dict[str, dict[str, dict[str, Any]]],
) -> tuple[str, str] | None:
    formula = effective_formula(cell)
    if not formula:
        return None
    if formula.lstrip().upper().startswith("IF("):
        pair_pattern = re.compile(
            r"(?P<condition>\$?[A-Z]{1,3}\$?\d+)\s*=\s*\"(?P<expected>[^\"]*)\"\s*,\s*"
            r"(?P<target>(?:(?:'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_.]*)!)?\$?[A-Z]{1,3}\$?\d+)",
            flags=re.IGNORECASE,
        )
        for match in pair_pattern.finditer(formula):
            condition_sheet, condition_ref = parse_single_reference(match.group("condition"), sheet_name)
            condition = public_cell_value(cells_by_sheet.get(condition_sheet, {}).get(condition_ref))
            if condition == match.group("expected"):
                return parse_single_reference(match.group("target"), sheet_name)
        return None

    sheet_token = r"(?:'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_.]*)"
    cell_token = r"\$?[A-Z]{1,3}\$?\d+"
    index_match = re.fullmatch(
        rf"\s*INDEX\((?P<result_sheet>{sheet_token})!(?P<result_start>{cell_token}):(?P<result_end>{cell_token}),\s*"
        rf"MATCH\((?P<lookup>{cell_token}),(?P<lookup_sheet>{sheet_token})!"
        rf"(?P<lookup_start>{cell_token}):(?P<lookup_end>{cell_token}),\s*0\s*\)\s*\)\s*",
        formula,
        flags=re.IGNORECASE,
    )
    if index_match is None:
        return None
    result_sheet = decode_sheet_name(index_match.group("result_sheet"), sheet_name)
    lookup_sheet = decode_sheet_name(index_match.group("lookup_sheet"), sheet_name)
    _, lookup_ref = parse_single_reference(index_match.group("lookup"), sheet_name)
    lookup_value = public_cell_value(cells_by_sheet.get(sheet_name, {}).get(lookup_ref))
    _, result_start = parse_single_reference(index_match.group("result_start"), result_sheet)
    _, result_end = parse_single_reference(index_match.group("result_end"), result_sheet)
    _, lookup_start = parse_single_reference(index_match.group("lookup_start"), lookup_sheet)
    _, lookup_end = parse_single_reference(index_match.group("lookup_end"), lookup_sheet)
    result_first_row, result_column = cell_ref_key(result_start)
    result_last_row, result_last_column = cell_ref_key(result_end)
    lookup_first_row, lookup_column = cell_ref_key(lookup_start)
    lookup_last_row, lookup_last_column = cell_ref_key(lookup_end)
    if result_column != result_last_column or lookup_column != lookup_last_column:
        return None
    if result_last_row - result_first_row != lookup_last_row - lookup_first_row:
        return None
    for offset, row in enumerate(range(lookup_first_row, lookup_last_row + 1)):
        candidate_ref = f"{column_name(lookup_column)}{row}"
        candidate = public_cell_value(cells_by_sheet.get(lookup_sheet, {}).get(candidate_ref))
        if candidate == lookup_value:
            return result_sheet, f"{column_name(result_column)}{result_first_row + offset}"
    return None


def materialize_formula_images(
    public_dir: Path,
    public_sheets: list[dict[str, Any]],
) -> dict[str, Any]:
    cells_by_sheet = {
        sheet["name"]: {cell["ref"]: cell for cell in sheet["cells"]}
        for sheet in public_sheets
    }
    direct_cells: list[tuple[str, dict[str, Any], dict[str, str]]] = []
    requests_by_digest: dict[str, dict[str, str]] = {}
    for sheet in public_sheets:
        for cell in sheet["cells"]:
            request = formula_image_request(sheet["name"], cell, cells_by_sheet)
            if request is None:
                continue
            direct_cells.append((sheet["name"], cell, request))
            requests_by_digest[request["requestDigest"]] = request

    images_by_request = cached_formula_images(public_dir)
    pending = [
        request for request_digest, request in sorted(requests_by_digest.items())
        if request_digest not in images_by_request
    ]
    if pending:
        print(
            f"sq1-pbl normalize: fetching {len(pending)} unique formula images with {FORMULA_IMAGE_WORKERS} workers",
            file=sys.stderr,
        )
        with concurrent.futures.ThreadPoolExecutor(max_workers=FORMULA_IMAGE_WORKERS) as executor:
            futures = {executor.submit(fetch_formula_image, request): request for request in pending}
            for future in concurrent.futures.as_completed(futures):
                image = future.result()
                images_by_request[image["requestDigest"]] = image

    def public_image(image: dict[str, Any], source: dict[str, str]) -> dict[str, Any]:
        return {
            key: value
            for key, value in {
                "url": f"{FORMULA_MEDIA_BASE_URL}/{image['sha256']}{image['extension']}",
                "sha256": image["sha256"],
                "bytes": image["bytes"],
                "extension": image["extension"],
                "mime": image["mime"],
                "pixels": image.get("pixels"),
                "source": source,
            }.items()
            if value is not None
        }

    request_digests_by_asset: dict[str, set[str]] = {}
    image_by_asset: dict[str, dict[str, Any]] = {}
    source_cells_by_asset: Counter[str] = Counter()
    for sheet_name, cell, request in direct_cells:
        image = images_by_request.get(request["requestDigest"])
        if image is None:
            raise ValueError(f"formula image request is unresolved: {request['requestDigest']}")
        cell["computedImage"] = public_image(image, {
            "kind": "direct",
            "inputCell": request["inputCell"],
        })
        request_digests_by_asset.setdefault(image["sha256"], set()).add(request["requestDigest"])
        image_by_asset[image["sha256"]] = image
        source_cells_by_asset[image["sha256"]] += 1

    derived_count = 0
    for sheet in public_sheets:
        for cell in sheet["cells"]:
            if "computedImage" in cell or not cell.get("formula"):
                continue
            source = derived_formula_image_source(sheet["name"], cell, cells_by_sheet)
            if source is None:
                continue
            source_sheet, source_ref = source
            source_cell = cells_by_sheet.get(source_sheet, {}).get(source_ref)
            if source_cell is None or "computedImage" not in source_cell:
                continue
            source_image = source_cell["computedImage"]
            image = image_by_asset[source_image["sha256"]]
            cell["computedImage"] = public_image(image, {
                "kind": "derived",
                "imageCell": f"{source_sheet}!{source_ref}",
            })
            source_cells_by_asset[image["sha256"]] += 1
            derived_count += 1

    for sheet in public_sheets:
        sheet["counts"]["computedImages"] = sum("computedImage" in cell for cell in sheet["cells"])

    assets: list[dict[str, Any]] = []
    for image_hash, image in sorted(image_by_asset.items()):
        atomic_write(public_dir / "formula-media" / f"{image_hash}{image['extension']}", image["raw"])
        assets.append({
            key: value
            for key, value in {
                "sha256": image_hash,
                "bytes": image["bytes"],
                "extension": image["extension"],
                "mime": image["mime"],
                "pixels": image.get("pixels"),
                "url": f"{FORMULA_MEDIA_BASE_URL}/{image_hash}{image['extension']}",
                "sourceCellCount": source_cells_by_asset[image_hash],
                "requestDigests": sorted(request_digests_by_asset.get(image_hash, set())),
            }.items()
            if value is not None
        })
    return {
        "sourceCells": len(direct_cells) + derived_count,
        "directFormulaCells": len(direct_cells),
        "derivedFormulaCells": derived_count,
        "uniqueRequests": len(requests_by_digest),
        "uniqueAssets": len(assets),
        "bytes": sum(item["bytes"] for item in assets),
        "mimeCounts": dict(sorted(Counter(item["mime"] for item in assets).items())),
        "assets": assets,
    }


def write_public_export(
    public_dir: Path,
    cases_output: Path,
    snapshot: dict[str, Any],
    public_sheets: list[dict[str, Any]],
    media: dict[str, dict[str, Any]],
    defined_names: list[Any],
    raw_sheet: dict[str, Any],
    slicers: list[dict[str, Any]],
    slugs: dict[str, str],
    finder_defaults: Path | None,
) -> None:
    media_manifest: list[dict[str, Any]] = []
    for media_hash, item in sorted(media.items()):
        extension = item["extension"]
        media_path = public_dir / "media" / f"{media_hash}{extension}"
        atomic_write(media_path, item["raw"])
        media_manifest.append({
            key: value
            for key, value in {
                "sha256": media_hash,
                "bytes": item["bytes"],
                "extension": extension,
                "pixels": item.get("pixels"),
                "url": f"{PUBLIC_BASE_URL}/media/{media_hash}{extension}",
            }.items()
            if value is not None
        })

    formula_images = materialize_formula_images(public_dir, public_sheets)
    sheet_manifest: list[dict[str, Any]] = []
    for sheet in public_sheets:
        data_url = f"{PUBLIC_BASE_URL}/sheets/{sheet['slug']}.json"
        atomic_json(public_dir / "sheets" / f"{sheet['slug']}.json", sheet)
        sheet_manifest.append({
            "index": sheet["index"],
            "name": sheet["name"],
            "slug": sheet["slug"],
            "state": sheet["state"],
            "dimension": sheet["dimension"],
            "dataUrl": data_url,
            "digests": sheet["digests"],
            "counts": sheet["counts"],
        })

    related_data: dict[str, Any] = {
        "cases": {
            "modulePath": "data/sq1-pbl/cases.json",
            "caseCount": snapshot["invariants"]["rawCases"],
        }
    }
    if finder_defaults is not None:
        raw_defaults = finder_defaults.read_bytes()
        json.loads(raw_defaults)
        atomic_write(public_dir / "finder-defaults.json", raw_defaults)
        related_data["finderDefaults"] = {
            "url": f"{PUBLIC_BASE_URL}/finder-defaults.json",
            "sha256": hashlib.sha256(raw_defaults).hexdigest(),
        }

    public_totals = {
        key: value
        for key, value in snapshot["totals"].items()
        if key != "threadedComments"
    }
    manifest = {
        "schemaVersion": 1,
        "source": {
            "title": "Daniel's Public PBL Doc",
            "documentId": DOC_ID,
            "url": f"https://docs.google.com/spreadsheets/d/{DOC_ID}/edit",
            "documentUrl": f"https://docs.google.com/spreadsheets/d/{DOC_ID}/edit",
            "downloadUrl": LIVE_URL,
            "contentDigest": snapshot["digests"]["content"],
            "presentationDigest": snapshot["digests"]["presentation"],
        },
        "dataBaseUrl": PUBLIC_BASE_URL,
        "totals": public_totals,
        "invariants": snapshot["invariants"],
        "definedNames": defined_names,
        "exclusions": list(EXCLUSION_LEDGER),
        "relatedData": related_data,
        "media": media_manifest,
        "formulaImages": formula_images,
        "sheets": sheet_manifest,
    }
    cases = build_case_export(raw_sheet, slicers, slugs, snapshot)
    atomic_json(cases_output, cases)
    # These are the only exporter-owned directories. Keep unrelated files and
    # nested directories under public_dir untouched.
    repository_root = next(
        (parent for parent in public_dir.parents if (parent / ".git").exists()),
        None,
    )
    if repository_root is None:
        raise ValueError(f"cannot locate repository root for stale asset quarantine: {public_dir}")
    quarantine_root = repository_root / ".tmp" / "sq1-pbl-stale"
    quarantine_stale_generated_files(
        public_dir / "sheets",
        {f"{sheet['slug']}.json" for sheet in public_sheets},
        quarantine_root,
    )
    quarantine_stale_generated_files(
        public_dir / "media",
        {f"{item['sha256']}{item['extension']}" for item in media_manifest},
        quarantine_root,
    )
    quarantine_stale_generated_files(
        public_dir / "formula-media",
        {f"{item['sha256']}{item['extension']}" for item in formula_images["assets"]},
        quarantine_root,
    )
    # Manifest is the publication pointer and is replaced only after every dependency exists.
    atomic_json(public_dir / "manifest.json", manifest)


def normalize(
    data: bytes,
    source: str,
    *,
    public_dir: Path | None = None,
    cases_output: Path | None = None,
    finder_defaults: Path | None = None,
) -> dict[str, Any]:
    raw_hash = hashlib.sha256(data).hexdigest()
    with zipfile.ZipFile(BytesIO(data)) as archive:
        required = {"xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml"}
        missing = required - set(archive.namelist())
        if missing:
            raise ValueError(f"missing XLSX parts: {', '.join(sorted(missing))}")

        workbook_part = "xl/workbook.xml"
        workbook = ET.fromstring(archive.read(workbook_part))
        workbook_rels = parse_rels(archive, workbook_part)
        shared_strings: list[dict[str, Any]] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in strings_root.findall(f"{{{MAIN}}}si"):
                rich_model = canon_xml(item)
                has_runs = any(lname(child.tag) == "r" for child in item)
                shared_strings.append({
                    "text": text_of(item),
                    "rich": digest(rich_model),
                    "richModel": rich_model if has_runs else None,
                })

        styles = style_model(archive)
        sheets: list[dict[str, Any]] = []
        public_sheets: list[dict[str, Any]] = []
        all_media: dict[str, dict[str, Any]] = {}
        all_referenced_styles: set[str] = set()
        sheets_parent = workbook.find(f"{{{MAIN}}}sheets")
        if sheets_parent is None:
            raise ValueError("workbook has no sheets")
        sheet_elements = list(sheets_parent)
        slugs = stable_slugs([sheet.attrib.get("name", "") for sheet in sheet_elements])
        for index, sheet in enumerate(sheet_elements, start=1):
            relation_id = sheet.attrib.get(f"{{{REL}}}id", "")
            relation = workbook_rels.get(relation_id)
            if not relation:
                raise ValueError(f"sheet relationship missing: {sheet.attrib.get('name', index)}")
            sheet_part = resolve_part(workbook_part, relation["target"])
            sheet_name = sheet.attrib.get("name", "")
            summary, media, referenced_styles, public_payload = worksheet_model(
                archive,
                sheet_part,
                sheet_name,
                index,
                sheet.attrib.get("state", "visible"),
                shared_strings,
                styles,
                slug=slugs[sheet_name],
                include_public=public_dir is not None,
            )
            sheets.append(summary)
            if public_payload is not None:
                public_sheets.append(public_payload)
            all_media.update(media)
            all_referenced_styles.update(referenced_styles)

        defined_names: list[Any] = []
        names_parent = workbook.find(f"{{{MAIN}}}definedNames")
        if names_parent is not None:
            guid_pattern = re.compile(r"^Z_[0-9A-Fa-f_-]+_\.wvu\.FilterData$")
            for item in names_parent:
                name = item.attrib.get("name", "")
                if name == "_xlnm._FilterDatabase" or guid_pattern.match(name):
                    continue
                defined_names.append({"attrs": attr_map(item), "text": clean_text(item.text)})

        content_book = {
            "sheets": [
                {"index": item["index"], "name": item["name"], "state": item["state"], "digest": item["digests"]["content"]}
                for item in sheets
            ],
            "definedNames": defined_names,
        }
        presentation_book = {
            "sheets": [
                {"index": item["index"], "name": item["name"], "digest": item["digests"]["presentation"]}
                for item in sheets
            ]
        }
        editorial_book = {
            "sheets": [
                {"index": item["index"], "name": item["name"], "digest": item["digests"]["editorial"]}
                for item in sheets
            ]
        }

        totals: Counter[str] = Counter()
        formula_types: Counter[str] = Counter()
        for sheet in sheets:
            for key, value in sheet["counts"].items():
                if isinstance(value, int):
                    totals[key] += value
            formula_types.update(sheet["counts"]["formulaTypes"])
        totals["sharedStrings"] = len(shared_strings)
        totals["referencedStyles"] = len(all_referenced_styles)
        totals["uniqueMedia"] = len(all_media)
        totals["uniqueMediaBytes"] = sum(item["bytes"] for item in all_media.values())
        totals["visibleSheets"] = sum(item["state"] == "visible" for item in sheets)
        totals["hiddenSheets"] = len(sheets) - totals["visibleSheets"]
        totals["sheets"] = len(sheets)
        totals["formulaTypes"] = dict(sorted(formula_types.items()))
        totals["styles"] = styles["counts"]

        by_name = {item["name"]: item for item in sheets}
        if "Raw Algs" not in by_name:
            raise ValueError("required sheet missing: Raw Algs")
        slicers = [by_name[name] for name in SLICER_SHEETS if name in by_name]
        invariants = {
            "sheetCount": len(sheets),
            "visibleSheets": totals["visibleSheets"],
            "hiddenSheetNames": [item["name"] for item in sheets if item["state"] != "visible"],
            **raw_invariants(by_name["Raw Algs"], slicers),
            "cellRecords": totals["cellRecords"],
            "valueOrFormula": totals["valueOrFormula"],
            "formulas": totals["formulas"],
            "merges": totals["merges"],
            "validations": totals["validations"],
            "conditionalFormatting": totals["conditionalFormatting"],
            "hyperlinks": totals["hyperlinks"],
            "pictureAnchors": totals["pictureAnchors"],
            "uniqueMedia": totals["uniqueMedia"],
        }

        snapshot = {
            "schemaVersion": 1,
            "source": source,
            "rawSha256": raw_hash,
            "digests": {
                "content": digest(content_book),
                "presentation": digest(presentation_book),
                "editorial": digest(editorial_book),
            },
            "totals": dict(totals),
            "invariants": invariants,
            "sheets": sheets,
        }
        if public_dir is not None:
            if cases_output is None:
                raise ValueError("cases output is required with public export")
            write_public_export(
                public_dir,
                cases_output,
                snapshot,
                public_sheets,
                all_media,
                defined_names,
                by_name["Raw Algs"],
                slicers,
                slugs,
                finder_defaults,
            )
        for item in sheets:
            item.pop("valuesByRef", None)
        return snapshot


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", default=LIVE_URL)
    parser.add_argument("--public-dir", type=Path)
    parser.add_argument("--cases-output", type=Path)
    parser.add_argument("--finder-defaults", type=Path)
    options = parser.parse_args()
    try:
        data, resolved_source = fetch_bytes(options.source)
        print(json.dumps(normalize(
            data,
            resolved_source,
            public_dir=None if options.public_dir is None else options.public_dir.resolve(),
            cases_output=None if options.cases_output is None else options.cases_output.resolve(),
            finder_defaults=None if options.finder_defaults is None else options.finder_defaults.resolve(),
        ), ensure_ascii=False, sort_keys=True))
        return 0
    except Exception as error:
        print(f"sq1-pbl normalize: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
