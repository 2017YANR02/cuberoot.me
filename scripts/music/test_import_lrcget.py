"""Run with uv run python scripts/music/test_import_lrcget.py."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("import_lrcget", Path(__file__).with_name("import-lrcget.py"))
IMPORTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(IMPORTER)


class ImportTests(unittest.TestCase):
    def test_timestamp_and_instrumental_boundaries(self):
        for payload, expected in [
            (b"[offset:500]\n[00:01.20][00:03]Hello", "synced"),
            (b"[au: instrumental]", "instrumental"),
            (b"[00:13]Too late", "review"),
            (b"[offset:-2000]\n[00:01]Negative", "review"),
            (b"[00:99]Invalid seconds", "review"),
            (b"Plain lyrics", "review"),
            (b"\xff", "review"),
        ]:
            with self.subTest(payload=payload):
                self.assertEqual(IMPORTER.inspect_lrc(payload, 10)[0], expected)

    def test_apply_preserves_media_and_is_idempotent(self):
        scratch = Path(__file__).resolve().parents[2] / ".tmp" / "png"
        scratch.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as temporary:
            root = Path(temporary) / "library"
            (root / "tracks").mkdir(parents=True)
            tracks = [{"id": str(i), "title": "Song", "duration": 10,
                       "src": f"/music/library/tracks/{i:064x}.mp3",
                       "lyrics": "/music/library/lyrics/old.lrc", "cover": "/cover.jpg"}
                      for i in range(3)]
            original = json.dumps({"version": 1, "tracks": tracks}).encode()
            manifest = root / "manifest.v1.json"
            manifest.write_bytes(original)
            audio = root / "tracks" / ("0" * 64 + ".mp3")
            audio.write_bytes(b"unchanged audio")
            sidecar = audio.with_suffix(".lrc")
            sidecar.write_bytes(b"[00:01]Hello")
            (root / "tracks" / (f"{1:064x}.lrc")).write_bytes(b"[au: instrumental]")
            self.assertEqual(IMPORTER.run(root)["counts"], {"synced": 1, "instrumental": 1, "missing": 1})
            self.assertEqual(manifest.read_bytes(), original)
            IMPORTER.run(root, True)
            first = manifest.read_bytes()
            result = json.loads(first)["tracks"]
            for before, after in zip(tracks, result):
                self.assertEqual({k: v for k, v in before.items() if k != "lyrics"},
                                 {k: v for k, v in after.items() if k != "lyrics"})
            self.assertNotIn("lyrics", result[1])
            self.assertNotIn("lyrics", result[2])
            self.assertEqual(audio.read_bytes(), b"unchanged audio")
            backups = list((root.parent / "inventory").glob("manifest-before-*.json"))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), original)
            IMPORTER.run(root, True)
            self.assertEqual(manifest.read_bytes(), first)
            self.assertEqual(len(list((root.parent / "inventory").glob("manifest-before-*.json"))), 1)
            sidecar.write_bytes(b"No synchronized lyrics")
            with self.assertRaisesRegex(ValueError, "No valid synced lyrics"):
                IMPORTER.run(root, True)
            self.assertEqual(manifest.read_bytes(), first)
            invalid = json.loads(first)
            invalid["tracks"][0]["src"] = "/music/library/tracks/../../outside.mp3"
            manifest.write_text(json.dumps(invalid), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Unexpected audio path"):
                IMPORTER.run(root, True)


if __name__ == "__main__":
    unittest.main()
