"""Small failure-boundary checks; generated pixels are fixtures, never ML data."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from dataset import COLORS, DataError, assert_disjoint, image_and_masks, load_dataset, provenance, sha256
from metrics import match_instances, summarize_counts
from baseline import fresh_directory


class DatasetContract(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        # Two nonidentical 2x2 PPM fixtures, no imaging library needed to create.
        self.images = []
        for i, split in enumerate(("train", "val"), 1):
            image = self.root / f"{i}.ppm"
            image.write_bytes(b"P6\n2 2\n255\n" + bytes([i, 0, 0]) * 4)
            self.images.append({"id": i, "file_name": image.name, "width": 2, "height": 2,
                                "source_id": f"source-{i}", "recording_group": f"recording-{i}",
                                "split": split, "image_sha256": sha256(image), "pts_seconds": 0.2,
                                "reviewed": True, "annotation_complete": True,
                                "annotation_provenance": "human-visible", "reviewer": "fixture only"})
        self.positive = {"id": 1, "image_id": 1, "category_id": 1,
                         "segmentation": [[0, 0, 1, 0, 1, 1, 0, 1]], "bbox": [0, 0, 1, 1],
                         "area": 1, "iscrowd": 0, "visibility": "visible", "is_center": None}
        self.data = {"images": self.images, "annotations": [self.positive],
                     "categories": [{"id": i + 1, "name": name} for i, name in enumerate(COLORS)]}
        self.path = self.root / "dataset.json"

    def tearDown(self):
        self.temporary.cleanup()

    def load(self):
        self.path.write_text(json.dumps(self.data))
        return load_dataset(self.path, splits=("train", "val"), training=True)

    def test_reviewed_complete_negative_image_is_valid(self):
        self.assertEqual(len(self.load()[1]), 2)

    def test_negative_only_training_is_rejected(self):
        self.data["annotations"] = []
        with self.assertRaisesRegex(DataError, "positive visible sticker"):
            self.load()

    def test_pending_and_partial_images_never_become_background(self):
        for field, value in (("annotation_complete", False), ("reviewed", False), ("annotation_provenance", "model-prediction")):
            with self.subTest(field=field):
                data = copy.deepcopy(self.data)
                self.data["images"][0][field] = value
                with self.assertRaisesRegex(DataError, "complete human-visible review"):
                    self.load()
                self.data = data

    def test_source_recording_and_identical_image_leaks_are_rejected(self):
        for field in ("source_id", "recording_group", "image_sha256"):
            with self.subTest(field=field):
                data = copy.deepcopy(self.data)
                self.data["images"][1][field] = self.data["images"][0][field]
                with self.assertRaisesRegex(DataError, "Split leakage"):
                    self.load()
                self.data = data

    def test_whitespace_does_not_hide_source_leakage(self):
        self.data["images"][1]["source_id"] = self.data["images"][0]["source_id"] + " "
        with self.assertRaisesRegex(DataError, "Split leakage"):
            self.load()

    def test_separate_manifest_does_not_hide_source_leakage(self):
        prior = provenance([self.images[0]])
        later = copy.deepcopy(self.images[0])
        later["split"] = "test"
        with self.assertRaisesRegex(DataError, "does not make a holdout"):
            assert_disjoint([later], prior, "Test")

    def test_changed_pixels_and_dimensions_are_rejected(self):
        (self.root / "1.ppm").write_bytes(b"P6\n2 2\n255\n" + bytes([3, 0, 0]) * 4)
        with self.assertRaisesRegex(DataError, "SHA-256 mismatch"):
            self.load()
        self.data["images"][0]["image_sha256"] = sha256(self.root / "1.ppm")
        self.data["images"][0]["width"] = 3
        with self.assertRaisesRegex(DataError, "decoded dimensions"):
            self.load()

    def test_unknown_region_is_not_a_trainable_negative(self):
        self.data["annotations"].append({"id": 2, "image_id": 1, "category_id": None,
                                     "segmentation": [[0, 0, 1, 0, 1, 1, 0, 1]], "bbox": [0, 0, 1, 1],
                                     "area": 1, "iscrowd": 0, "visibility": "unknown", "is_center": None,
                                     "ignore": True, "ignore_reason": "unreadable color"})
        with self.assertRaisesRegex(DataError, "cannot ignore unknown masks"):
            self.load()
        self.data["annotations"][1]["image_id"] = 2
        self.assertEqual(len(self.load()[1]), 2)

    def test_mask_does_not_fill_an_unannotated_face(self):
        annotation = {"id": 1, "segmentation": [[0, 0, 0.4, 0, 0.4, 0.4, 0, 0.4]]}
        rgb, masks = image_and_masks(self.images[0], [annotation], self.root)
        self.assertEqual(rgb.shape, (2, 2, 3))
        self.assertEqual(int(masks[0].sum()), 1)

    def test_geometry_and_ignore_category_share_the_ts_contract(self):
        ann = {"id": 1, "image_id": 2, "category_id": 1, "segmentation": [[0, 0, 1, 0, 1, 1]],
               "bbox": [0, 0, 1, 1], "area": 0.5, "iscrowd": 0, "visibility": "visible", "is_center": None}
        for patch, message in (({"bbox": [0, 0, 0.1, 0.1]}, "does not contain"),
                               ({"area": 1000}, "positive area"),
                               ({"ignore": True, "ignore_reason": "ambiguous", "category_id": 999}, "category_id")):
            with self.subTest(patch=patch):
                self.data["annotations"] = [{**ann, **patch}]
                with self.assertRaisesRegex(DataError, message):
                    self.load()

    def test_string_ignore_cannot_remove_truth_from_scoring(self):
        self.data["annotations"][0]["ignore"] = "false"
        with self.assertRaisesRegex(DataError, "ignore must be boolean"):
            self.load()

    def test_outputs_cannot_silently_replace_an_existing_run(self):
        fresh_directory(self.root / "new")
        with self.assertRaisesRegex(DataError, "new or empty"):
            fresh_directory(self.root)


class JointMetrics(unittest.TestCase):
    def test_wrong_color_is_false_positive_and_false_negative(self):
        counts = match_instances([1], [2], [0.99], [[0.9]])
        self.assertEqual((counts["tp"], counts["fp"], counts["fn"]), (0, 1, 1))

    def test_duplicate_is_not_hidden_by_ignore_region(self):
        counts = match_instances([1], [1, 1], [0.99, 0.9], [[0.8], [0.8]], [[0.0], [0.9]])
        self.assertEqual((counts["tp"], counts["fp"], counts["ignored_predictions"]), (1, 1, 0))

    def test_ignored_and_rejected_are_reported_separately(self):
        counts = match_instances([1], [1, 2], [0.1, 0.9], [[0.9], [0.0]], [[0.0], [0.8]])
        self.assertEqual((counts["fn"], counts["ignored_predictions"], counts["rejected_predictions"]), (1, 1, 1))

    def test_empty_denominators_do_not_pass(self):
        result = summarize_counts([match_instances([], [], [], [])])
        self.assertIsNone(result["precision"])
        self.assertIsNone(result["recall"])
        self.assertFalse(result["passed_instance_gate"])

    def test_confidence_order_controls_match(self):
        result = match_instances([1], [1, 2], [0.8, 0.9], [[0.8], [0.8]])
        self.assertEqual((result["tp"], result["fp"], result["fn"]), (0, 2, 1))


if __name__ == "__main__":
    unittest.main()
