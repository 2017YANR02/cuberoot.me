from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("normalize.py")
SPEC = importlib.util.spec_from_file_location("sq1_pbl_normalize", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {MODULE_PATH}")
NORMALIZE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(NORMALIZE)


class FormulaImageContractTests(unittest.TestCase):
    def test_accepts_a_real_published_safe_svg(self) -> None:
        formula_media = MODULE_PATH.parents[2] / "public" / "data" / "sq1-pbl" / "formula-media"
        svg_paths = sorted(formula_media.glob("*.svg"))
        self.assertTrue(svg_paths, "public export must include a real get_image3 SVG")
        raw = svg_paths[0].read_bytes()
        image = NORMALIZE.validate_formula_image(raw, "image/svg+xml", ".svg")
        self.assertEqual(image["raw"], raw)
        self.assertEqual(image["mime"], "image/svg+xml")
        self.assertEqual(image["pixels"], [1400, 700])

    def test_rejects_active_or_external_svg_content(self) -> None:
        unsafe = {
            "script": '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
            "foreignObject": (
                '<svg xmlns="http://www.w3.org/2000/svg">'
                '<foreignObject><p xmlns="http://www.w3.org/1999/xhtml">x</p></foreignObject></svg>'
            ),
            "external href": (
                '<svg xmlns="http://www.w3.org/2000/svg">'
                '<image href="https://example.invalid/payload.png"/></svg>'
            ),
        }
        for label, svg in unsafe.items():
            with self.subTest(label=label), self.assertRaises(ValueError):
                NORMALIZE.validate_svg(svg.encode("utf-8"))

    def test_removes_only_stale_regular_files_in_controlled_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / "sheets"
            directory.mkdir()
            kept = directory / "kept.json"
            stale = directory / "old.json"
            nested = directory / "old-dir"
            kept.write_text("kept", encoding="utf-8")
            stale.write_text("stale", encoding="utf-8")
            nested.mkdir()
            (nested / "nested.json").write_text("nested", encoding="utf-8")

            quarantine = Path(temporary) / "quarantine"
            NORMALIZE.quarantine_stale_generated_files(directory, {kept.name}, quarantine)

            self.assertTrue(kept.is_file())
            self.assertFalse(stale.exists())
            self.assertTrue((nested / "nested.json").is_file())
            quarantined = list((quarantine / "sheets").iterdir())
            self.assertEqual(len(quarantined), 1)
            self.assertTrue(quarantined[0].name.endswith("-old.json"))
            self.assertEqual(quarantined[0].read_text(encoding="utf-8"), "stale")


if __name__ == "__main__":
    unittest.main()
