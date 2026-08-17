from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("normalize.py")
SPEC = importlib.util.spec_from_file_location("sq1_pbl_normalize", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {MODULE_PATH}")
NORMALIZE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(NORMALIZE)


class RawAlgorithmFallbackTests(unittest.TestCase):
    def build_cases(self, raw_values: dict[str, str], standard_values: dict[str, str]):
        return NORMALIZE.build_case_export(
            {"valuesByRef": raw_values},
            {"valuesByRef": standard_values},
            [{
                "name": "7 slicers",
                "valuesByRef": {"A1": "1", "B1": "MDb", "F1": "10 W' d D e' t -10"},
            }],
            {"7 slicers": "7-slicers"},
            {"digests": {"content": "fixture"}, "invariants": {"frequencyTotal": 16}},
        )

    def test_restores_only_m_db_from_the_explicit_standard_alg_cell(self) -> None:
        result = self.build_cases(
            {"A1": "M/Db", "B1": "M", "C1": "Db", "D1": "16", "E1": "P/P", "F1": " ", "G1": "7"},
            {"S208": "MDb", "T208": "10/-30/30/-12/03/-3-3/4-2/-10"},
        )
        self.assertEqual(result["cases"][0]["solution"], "10/-30/30/-12/03/-3-3/4-2/-10")
        self.assertEqual(result["cases"][0]["solutionEvidence"], {
            "sheet": "Standard Algs Data",
            "keyCell": "S208",
            "algorithmCell": "T208",
        })

    def test_fails_closed_for_any_other_non_solved_blank(self) -> None:
        with self.assertRaisesRegex(ValueError, "non-solved Raw Algs case has no solution"):
            self.build_cases(
                {"A1": "M/Da", "B1": "M", "C1": "Da", "F1": " "},
                {"S208": "MDb", "T208": "10/-30/30/-12/03/-3-3/4-2/-10"},
            )

    def test_fails_closed_when_the_evidence_cell_moves_or_is_not_seven_slices(self) -> None:
        raw = {"A1": "M/Db", "B1": "M", "C1": "Db", "F1": " "}
        for standard in (
            {"S208": "MDa", "T208": "10/-30/30/-12/03/-3-3/4-2/-10"},
            {"S208": "MDb", "T208": "10/-30/30/-12/03/-3-3/-10"},
        ):
            with self.subTest(standard=standard), self.assertRaises(ValueError):
                self.build_cases(raw, standard)


if __name__ == "__main__":
    unittest.main()
