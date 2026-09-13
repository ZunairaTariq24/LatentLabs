"""
Automated Verification Test Suite
Verifies all 15 operational scenarios from the specification document:
Production Downtime & Maintenance Decision Intelligence — Hackathon Research Edition
"""

import unittest
from data_loader import FactoryDataLoader
from calculator import evaluate_maintenance_case
from validators import validate_ai_explanation
from ai_engine import generate_deterministic_explanation

EXPECTED_BENCHMARKS = {
    "M1-E01": {"opt_a": 56500.0, "opt_b": 808000.0, "net": 751500.0, "safety": False},
    "M1-E02": {"opt_a": 36500.0, "opt_b": 622000.0, "net": 585500.0, "safety": False},
    "M1-E03": {"opt_a": 76000.0, "opt_b": 1229000.0, "net": 1153000.0, "safety": False},
    "M1-E04": {"opt_a": 37000.0, "opt_b": 0.0, "net": None, "safety": True},
    "M1-E05": {"opt_a": 98000.0, "opt_b": 1356000.0, "net": 1258000.0, "safety": False},
    "M2-E01": {"opt_a": 79000.0, "opt_b": 1519000.0, "net": 1440000.0, "safety": False},
    "M2-E02": {"opt_a": 47500.0, "opt_b": 777000.0, "net": 729500.0, "safety": False},
    "M2-E03": {"opt_a": 28000.0, "opt_b": 441800.0, "net": 413800.0, "safety": False},
    "M2-E04": {"opt_a": 30000.0, "opt_b": 781200.0, "net": 751200.0, "safety": False},
    "M2-E05": {"opt_a": 31500.0, "opt_b": 0.0, "net": None, "safety": True},
    "M3-E01": {"opt_a": 18750.0, "opt_b": 207500.0, "net": 188750.0, "safety": False},
    "M3-E02": {"opt_a": 14000.0, "opt_b": 224250.0, "net": 210250.0, "safety": False},
    "M3-E03": {"opt_a": 15500.0, "opt_b": 231300.0, "net": 215800.0, "safety": False},
    "M3-E04": {"opt_a": 16500.0, "opt_b": 259000.0, "net": 242500.0, "safety": False},
    "M3-E05": {"opt_a": 16000.0, "opt_b": 0.0, "net": None, "safety": True},
}


class TestMaintenanceDecisionIntelligence(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.loader = FactoryDataLoader()

    def test_all_15_master_scenarios(self):
        """Validates all 15 master errors against official specification benchmarks."""
        tested_errors = set()

        for err_id, expected in EXPECTED_BENCHMARKS.items():
            matching = [r for r in self.loader.records if r["error_id"] == err_id]
            self.assertTrue(len(matching) > 0, f"Error {err_id} missing from dataset")
            record = matching[0]

            decision = evaluate_maintenance_case(record)
            tested_errors.add(err_id)

            self.assertEqual(decision["safety_override"], expected["safety"], f"Safety override mismatch for {err_id}")
            self.assertEqual(decision["option_a_total"], expected["opt_a"], f"Option A mismatch for {err_id}")

            if expected["safety"]:
                self.assertTrue(decision["option_b"]["locked_out"], f"Option B should be locked out for {err_id}")
                self.assertIsNone(decision["net_avoided_loss"], f"Net avoided loss should be None for safety case {err_id}")
            else:
                self.assertEqual(decision["option_b_total"], expected["opt_b"], f"Option B mismatch for {err_id}")
                self.assertEqual(decision["net_avoided_loss"], expected["net"], f"Net avoided mismatch for {err_id}")

        self.assertEqual(len(tested_errors), 15, "All 15 errors must be verified")

    def test_mandatory_safety_overrides(self):
        """Verifies safety overrides enforce immediate shutdown and lock out deferrals."""
        for err_id in ["M1-E04", "M2-E05", "M3-E05"]:
            matching = [r for r in self.loader.records if r["error_id"] == err_id]
            decision = evaluate_maintenance_case(matching[0])
            self.assertTrue(decision["safety_override"])
            self.assertTrue(decision["option_b"]["locked_out"])

    def test_anti_hallucination_validation_catches_fabrications(self):
        """Verifies that ungrounded numbers or missing sections in AI text are rejected."""
        record = [r for r in self.loader.records if r["error_id"] == "M1-E01"][0]
        decision = evaluate_maintenance_case(record)

        fabricated_ai_text = """DECISION: Intervene immediately.
WHY: Hydraulic seal is leaking oil.
FINANCIAL IMPACT: Option A is PKR 56,500.00 and Option B is PKR 999,999.00.
RISK: Unplanned breakdown will stop the line.
ACTION: Approve immediate shutdown."""

        is_valid, err, _ = validate_ai_explanation(fabricated_ai_text, decision)
        self.assertFalse(is_valid)
        self.assertIn("ungrounded figure", err.lower())

    def test_deterministic_explanation_generator(self):
        """Verifies that our fallback generator satisfies all 5 sections and passes validation."""
        for r in self.loader.records:
            decision = evaluate_maintenance_case(r)
            text = generate_deterministic_explanation(decision)
            is_valid, err, sections = validate_ai_explanation(text, decision)
            self.assertTrue(is_valid, f"Fallback failed validation for {r['error_id']}: {err}")
            self.assertIsNotNone(sections)
            for req in ["DECISION", "WHY", "FINANCIAL IMPACT", "RISK", "ACTION"]:
                self.assertIn(req, sections)


if __name__ == "__main__":
    unittest.main()
